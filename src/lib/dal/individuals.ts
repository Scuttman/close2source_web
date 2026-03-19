/**
 * dal/individuals.ts
 *
 * All Firestore operations for the `individuals/{id}` collection.
 *
 * Caching strategy — same as projects: doc ID and code both cached (TTL 2 min).
 */

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { IndividualDoc } from './types';

const db = () => getFirestore(app);

const indDocKey  = (id: string)   => `individuals/${id}`;
const indCodeKey = (code: string) => `ind_code/${code.toUpperCase()}`;

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL individual profiles (real-time).
 * ⚠️ Full collection listener — use only on the public individuals listing page.
 */
export function subscribeAllIndividuals(
  onData: (profiles: (IndividualDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db(), 'individuals'),
    (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as IndividualDoc) }));
      rows.forEach(ind => {
        cache.set(indDocKey(ind.id), ind, DalCache.TTL.INDIVIDUAL_DOC);
        if (ind.individualId) cache.set(indCodeKey(ind.individualId), ind, DalCache.TTL.CODE_LOOKUP);
      });
      onData(rows);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Subscribe to a single individual document for real-time updates.
 */
export function subscribeIndividual(
  docId: string,
  onData: (profile: (IndividualDoc & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), 'individuals', docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const data = { id: snap.id, ...(snap.data() as IndividualDoc) };
      cache.set(indDocKey(data.id), data, DalCache.TTL.INDIVIDUAL_DOC);
      if (data.individualId) cache.set(indCodeKey(data.individualId), data, DalCache.TTL.CODE_LOOKUP);
      onData(data);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch an individual profile by Firestore document ID. Cached (TTL 2 min). */
export async function getIndividual(docId: string): Promise<(IndividualDoc & { id: string }) | null> {
  const key = indDocKey(docId);
  const hit = cache.get<IndividualDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'individuals', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as IndividualDoc) };
  cache.set(key, data, DalCache.TTL.INDIVIDUAL_DOC);
  if (data.individualId) cache.set(indCodeKey(data.individualId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/**
 * Fetch an individual profile by its short code (e.g. "IABC123").
 * Cached (TTL 5 min).
 */
export async function getIndividualByCode(
  individualId: string,
): Promise<(IndividualDoc & { id: string }) | null> {
  const codeKey = indCodeKey(individualId);
  const hit = cache.get<IndividualDoc & { id: string }>(codeKey);
  if (hit) return hit;

  const snap = await getDocs(
    query(collection(db(), 'individuals'), where('individualId', '==', individualId.toUpperCase())),
  );
  if (snap.empty) return null;

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as IndividualDoc) };
  cache.set(indDocKey(data.id), data, DalCache.TTL.INDIVIDUAL_DOC);
  cache.set(codeKey, data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** Fetch all individual profiles owned by a user. */
export async function getUserIndividuals(uid: string): Promise<(IndividualDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'individuals'), where('ownerUid', '==', uid)),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as IndividualDoc) }));
}

/** Subscribe to a user's individual profiles. Each snapshot updates the cache. */
export function subscribeUserIndividuals(
  uid: string,
  onData: (profiles: (IndividualDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'individuals'), where('ownerUid', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as IndividualDoc) }));
    rows.forEach(ind => {
      cache.set(indDocKey(ind.id), ind, DalCache.TTL.INDIVIDUAL_DOC);
      if (ind.individualId) cache.set(indCodeKey(ind.individualId), ind, DalCache.TTL.CODE_LOOKUP);
    });
    onData(rows);
  }, err => onError?.(err as Error));
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Partially update an individual profile. Invalidates cache. */
export async function updateIndividual(docId: string, patch: Partial<IndividualDoc>): Promise<void> {
  await updateDoc(doc(db(), 'individuals', docId), patch as Record<string, unknown>);
  cache.invalidate(indDocKey(docId));
  cache.invalidatePrefix('ind_code/');
}

/** Create a new individual profile using a Firestore transaction. Returns new doc ID. */
export async function createIndividual(
  data: Omit<IndividualDoc, 'createdAt'>,
): Promise<string> {
  const firestore = db();
  const newRef = doc(collection(firestore, 'individuals'));
  await runTransaction(firestore, async (tx) => {
    tx.set(newRef, { ...data, createdAt: serverTimestamp() });
  });
  return newRef.id;
}

/** Delete an individual profile and invalidate cache. */
export async function deleteIndividual(docId: string): Promise<void> {
  await deleteDoc(doc(db(), 'individuals', docId));
  cache.invalidate(indDocKey(docId));
  cache.invalidatePrefix('ind_code/');
}
