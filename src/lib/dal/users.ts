/**
 * dal/users.ts
 *
 * All Firestore operations for the `users/{uid}` collection and its
 * sub-collections (`activityLog`, `transactions`).
 *
 * Caching strategy
 *  - `getUser`   → memory + sessionStorage, TTL 60 s
 *  - `updateUser` → writes to Firestore, then invalidates the cache entry
 *    so the next read gets a fresh copy
 *  - `subscribeUser` → real-time listener; each snapshot updates the cache
 *    so one-off `getUser` calls elsewhere in the same tab get a fresh value
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { UserDoc, ActivityLogDoc, CreditTransactionDoc } from './types';

const db = () => getFirestore(app);

// ─── Cache key helpers ───────────────────────────────────────────────────────

const userKey = (uid: string) => `users/${uid}`;

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Fetches the user document by UID.
 * Returns `null` if the document does not exist.
 * Hits the in-memory / sessionStorage cache first (TTL 60 s).
 */
export async function getUser(uid: string): Promise<(UserDoc & { id: string }) | null> {
  const key = userKey(uid);
  const hit = cache.get<UserDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'users', uid));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as UserDoc) };
  cache.set(key, data, DalCache.TTL.USER_DOC);
  return data;
}

/**
 * Subscribe to real-time user document updates.
 * Each incoming snapshot updates the cache entry so that concurrent
 * one-off `getUser` calls see fresh data without an additional read.
 *
 * Returns the unsubscribe function.
 */
export function subscribeUser(
  uid: string,
  onData: (user: (UserDoc & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), 'users', uid),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const data = { id: snap.id, ...(snap.data() as UserDoc) };
      cache.set(userKey(uid), data, DalCache.TTL.USER_DOC);
      onData(data);
    },
    (err) => { onError?.(err as Error); },
  );
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Fetch user documents matching a list of email addresses.
 * Uses Firestore `in` operator (max 10 emails per query).
 * Returns a map of lowercase-email → user data.
 */
export async function getUsersByEmails(
  emails: string[],
): Promise<Record<string, UserDoc & { id: string }>> {
  if (!emails.length) return {};
  const unique = Array.from(new Set(emails.map(e => e.toLowerCase()))).slice(0, 10);
  const snap = await getDocs(query(collection(db(), 'users'), where('email', 'in', unique)));
  const result: Record<string, UserDoc & { id: string }> = {};
  snap.forEach(d => {
    const data = { id: d.id, ...(d.data() as UserDoc) };
    const key = (data.email || '').toLowerCase();
    if (key) result[key] = data;
  });
  return result;
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * Partially updates the user document.
 * Invalidates the cache entry so the next `getUser` fetches fresh data.
 */
export async function updateUser(uid: string, patch: Partial<UserDoc>): Promise<void> {
  await updateDoc(doc(db(), 'users', uid), patch as Record<string, unknown>);
  cache.invalidate(userKey(uid));
}

/**
 * Creates or overwrites a user document (uses `setDoc` without merge).
 * Use for brand-new user accounts (login/register flows) where
 * `updateDoc` would fail because the document doesn't exist yet.
 */
export async function createUserDoc(uid: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db(), 'users', uid), data);
  cache.invalidate(userKey(uid));
}

/**
 * Merges fields into an existing (or non-existing) user document.
 * Equivalent to `setDoc(ref, data, { merge: true })`.
 * Use when you want upsert semantics (create-if-missing, merge-if-exists).
 */
export async function mergeUserDoc(uid: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db(), 'users', uid), data, { merge: true });
  cache.invalidate(userKey(uid));
}

// ─── Activity log sub-collection ─────────────────────────────────────────────

/** Appends an entry to `users/{uid}/activityLog`. */
export async function addActivityLog(uid: string, entry: Omit<ActivityLogDoc, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db(), 'users', uid, 'activityLog'), entry);
  return ref.id;
}

/** Fetches the full activity log for a user (ordered by timestamp desc). */
export async function getActivityLog(uid: string): Promise<(ActivityLogDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'users', uid, 'activityLog'), orderBy('timestamp', 'desc')),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ActivityLogDoc) }));
}

// ─── Transactions sub-collection ─────────────────────────────────────────────

/** Appends a credit transaction record. Automatically adds a server timestamp. */
export async function addCreditTransaction(
  uid: string,
  entry: Omit<CreditTransactionDoc, 'id' | 'timestamp'>,
): Promise<string> {
  const ref = await addDoc(collection(db(), 'users', uid, 'transactions'), {
    ...entry,
    timestamp: serverTimestamp(),
  });
  return ref.id;
}

/** Fetches the credit transaction history (newest first). */
export async function getCreditTransactions(uid: string): Promise<(CreditTransactionDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'users', uid, 'transactions'), orderBy('timestamp', 'desc')),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as CreditTransactionDoc) }));
}

// ─── Account deletion ────────────────────────────────────────────────────────

/**
 * Deletes the top-level `users/{uid}` document.
 * Sub-collections (activityLog, transactions) are NOT auto-deleted by
 * the client SDK — use a Cloud Function or the Firebase console to clean
 * those up after deletion, or call the batched helper below.
 *
 * The caller is responsible for removing other owned data (individuals,
 * orgs, projects) before calling this. See `settings/page.tsx`.
 */
export async function deleteUserDoc(uid: string): Promise<void> {
  await deleteDoc(doc(db(), 'users', uid));
  cache.invalidate(userKey(uid));
}
