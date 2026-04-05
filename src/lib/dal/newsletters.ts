/**
 * dal/newsletters.ts
 *
 * All Firestore operations for the `newsletters/{id}` collection.
 */

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { NewsletterDoc } from './types';

const db = () => getFirestore(app);

const nlDocKey  = (id: string)   => `newsletters/${id}`;
const nlCodeKey = (code: string) => `newsletter_code/${code.toUpperCase()}`;

// ─── Read ────────────────────────────────────────────────────────────────────

/** Fetch a newsletter by Firestore document ID. Cached (TTL 2 min). */
export async function getNewsletter(docId: string): Promise<(NewsletterDoc & { id: string }) | null> {
  const key = nlDocKey(docId);
  const hit = cache.get<NewsletterDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'newsletters', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as NewsletterDoc) };
  cache.set(key, data, DalCache.TTL.NEWSLETTER_DOC);
  if (data.newsletterId) cache.set(nlCodeKey(data.newsletterId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** Fetch a newsletter by its share code (e.g. "NABCDEF"). */
export async function getNewsletterByCode(
  newsletterId: string,
  options?: { noCache?: boolean },
): Promise<(NewsletterDoc & { id: string }) | null> {
  const codeKey = nlCodeKey(newsletterId);
  if (!options?.noCache) {
    const hit = cache.get<NewsletterDoc & { id: string }>(codeKey);
    if (hit) return hit;
  }

  const snap = await getDocs(
    query(collection(db(), 'newsletters'), where('newsletterId', '==', newsletterId.toUpperCase())),
  );
  if (snap.empty) return null;

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as NewsletterDoc) };
  cache.set(nlDocKey(data.id), data, DalCache.TTL.NEWSLETTER_DOC);
  cache.set(codeKey, data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/**
 * Fetch all newsletters for a given individual profile code belonging to an owner.
 * Queries by individualId (single-field index); filters ownerUid client-side to
 * avoid requiring a composite index.
 */
export async function getNewslettersByIndividual(
  individualId: string,
  ownerUid: string,
): Promise<(NewsletterDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'newsletters'), where('individualId', '==', individualId)),
  );
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as NewsletterDoc) }))
    .filter(nl => nl.ownerUid === ownerUid);
}

/** Fetch all newsletters owned by a user. */
export async function getUserNewsletters(uid: string): Promise<(NewsletterDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'newsletters'), where('ownerUid', '==', uid)),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as NewsletterDoc) }));
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Create a new newsletter. Returns the Firestore document ID. */
export async function createNewsletter(
  data: Omit<NewsletterDoc, 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const clean = Object.fromEntries(
    Object.entries({ ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      .filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(collection(db(), 'newsletters'), clean);
  return ref.id;
}

/** Partially update a newsletter. Automatically stamps updatedAt. Invalidates cache. */
export async function updateNewsletter(
  docId: string,
  patch: Partial<Omit<NewsletterDoc, 'createdAt'>>,
): Promise<void> {
  const update = { ...patch, updatedAt: serverTimestamp() };
  await updateDoc(doc(db(), 'newsletters', docId), update as Record<string, unknown>);
  cache.invalidate(nlDocKey(docId));
  cache.invalidatePrefix('newsletter_code/');
}

/** Delete a newsletter and invalidate cache. */
export async function deleteNewsletter(docId: string): Promise<void> {
  await deleteDoc(doc(db(), 'newsletters', docId));
  cache.invalidate(nlDocKey(docId));
  cache.invalidatePrefix('newsletter_code/');
}
