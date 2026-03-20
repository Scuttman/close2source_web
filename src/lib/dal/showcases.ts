/**
 * dal/showcases.ts
 *
 * All Firestore operations for the `showcases/{id}` collection.
 *
 * Caching strategy: doc ID key cached at 2 min, code lookup at 5 min.
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
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { ShowcaseDoc } from './types';

const db = () => getFirestore(app);

const scDocKey  = (id: string)   => `showcases/${id}`;
const scCodeKey = (code: string) => `showcase_code/${code.toUpperCase()}`;

// ─── Read ────────────────────────────────────────────────────────────────────

/** Fetch a showcase by Firestore document ID. Cached (TTL 2 min). */
export async function getShowcase(docId: string): Promise<(ShowcaseDoc & { id: string }) | null> {
  const key = scDocKey(docId);
  const hit = cache.get<ShowcaseDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'showcases', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as ShowcaseDoc) };
  cache.set(key, data, DalCache.TTL.SHOWCASE_DOC);
  if (data.showcaseId) cache.set(scCodeKey(data.showcaseId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** Fetch a showcase by its short code (e.g. "SABCDEF"). Cached (TTL 5 min). */
export async function getShowcaseByCode(
  showcaseId: string,
): Promise<(ShowcaseDoc & { id: string }) | null> {
  const codeKey = scCodeKey(showcaseId);
  const hit = cache.get<ShowcaseDoc & { id: string }>(codeKey);
  if (hit) return hit;

  const snap = await getDocs(
    query(collection(db(), 'showcases'), where('showcaseId', '==', showcaseId.toUpperCase())),
  );
  if (snap.empty) return null;

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as ShowcaseDoc) };
  cache.set(scDocKey(data.id), data, DalCache.TTL.SHOWCASE_DOC);
  cache.set(codeKey, data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** Fetch all showcases owned by a user. */
export async function getUserShowcases(uid: string): Promise<(ShowcaseDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'showcases'), where('ownerUid', '==', uid)),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ShowcaseDoc) }));
}

/** Fetch all showcases belonging to an organisation. */
export async function getOrgShowcases(orgId: string): Promise<(ShowcaseDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'showcases'), where('orgId', '==', orgId)),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ShowcaseDoc) }));
}

/** Subscribe to all showcases for a user (real-time). */
export function subscribeUserShowcases(
  uid: string,
  onData: (showcases: (ShowcaseDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'showcases'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ShowcaseDoc) }));
      rows.forEach(sc => {
        cache.set(scDocKey(sc.id), sc, DalCache.TTL.SHOWCASE_DOC);
        if (sc.showcaseId) cache.set(scCodeKey(sc.showcaseId), sc, DalCache.TTL.CODE_LOOKUP);
      });
      onData(rows);
    },
    (err) => onError?.(err as Error),
  );
}

/** Subscribe to all showcases for an organisation (real-time). */
export function subscribeOrgShowcases(
  orgId: string,
  onData: (showcases: (ShowcaseDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'showcases'), where('orgId', '==', orgId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ShowcaseDoc) }));
      rows.forEach(sc => {
        cache.set(scDocKey(sc.id), sc, DalCache.TTL.SHOWCASE_DOC);
        if (sc.showcaseId) cache.set(scCodeKey(sc.showcaseId), sc, DalCache.TTL.CODE_LOOKUP);
      });
      onData(rows);
    },
    (err) => onError?.(err as Error),
  );
}

/** Subscribe to a single showcase document (real-time). */
export function subscribeShowcase(
  docId: string,
  onData: (showcase: (ShowcaseDoc & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), 'showcases', docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const data = { id: snap.id, ...(snap.data() as ShowcaseDoc) };
      cache.set(scDocKey(data.id), data, DalCache.TTL.SHOWCASE_DOC);
      if (data.showcaseId) cache.set(scCodeKey(data.showcaseId), data, DalCache.TTL.CODE_LOOKUP);
      onData(data);
    },
    (err) => onError?.(err as Error),
  );
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Create a new showcase. Returns the Firestore document ID. */
export async function createShowcase(
  data: Omit<ShowcaseDoc, 'createdAt'>,
): Promise<string> {
  // Strip undefined values — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries({ ...data, createdAt: serverTimestamp() }).filter(([, v]) => v !== undefined),
  );
  const ref = await addDoc(collection(db(), 'showcases'), clean);
  return ref.id;
}

/** Partially update a showcase. Invalidates cache. */
export async function updateShowcase(
  docId: string,
  patch: Partial<ShowcaseDoc>,
): Promise<void> {
  await updateDoc(doc(db(), 'showcases', docId), patch as Record<string, unknown>);
  cache.invalidate(scDocKey(docId));
  cache.invalidatePrefix('showcase_code/');
}

/** Delete a showcase and invalidate cache. */
export async function deleteShowcase(docId: string): Promise<void> {
  await deleteDoc(doc(db(), 'showcases', docId));
  cache.invalidate(scDocKey(docId));
  cache.invalidatePrefix('showcase_code/');
}
