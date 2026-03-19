/**
 * dal/projects.ts
 *
 * All Firestore operations for the `projects/{id}` collection and its
 * `financeTransactions` sub-collection.
 *
 * Caching strategy
 *  - `getProject(docId)` / `getProjectByCode(projectId)` → cached (TTL 2 min)
 *  - `subscribeUserProjects` / `subscribeOrgProjects` → real-time; each
 *    snapshot populates the per-doc cache
 *  - Writes → invalidate affected cache entry
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
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import type { DocumentSnapshot, QueryConstraint } from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { ProjectDoc, FinanceTransactionDoc } from './types';

const db = () => getFirestore(app);

// ─── Cache key helpers ───────────────────────────────────────────────────────

const projDocKey  = (id: string)   => `projects/${id}`;
const projCodeKey = (code: string) => `proj_code/${code.toUpperCase()}`;

// ─── Read ────────────────────────────────────────────────────────────────────

/** Fetch a project by its Firestore document ID. Cached (TTL 2 min). */
export async function getProject(docId: string): Promise<(ProjectDoc & { id: string }) | null> {
  const key = projDocKey(docId);
  const hit = cache.get<ProjectDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'projects', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as ProjectDoc) };
  cache.set(key, data, DalCache.TTL.PROJECT_DOC);
  if (data.projectId) cache.set(projCodeKey(data.projectId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/**
 * Fetch a project by its human-readable short code (e.g. "PABC123").
 * The code→docId mapping is cached (TTL 5 min).
 */
export async function getProjectByCode(projectId: string): Promise<(ProjectDoc & { id: string }) | null> {
  const codeKey = projCodeKey(projectId);
  const hit = cache.get<ProjectDoc & { id: string }>(codeKey);
  if (hit) return hit;

  const snap = await getDocs(
    query(collection(db(), 'projects'), where('projectId', '==', projectId.toUpperCase())),
  );
  if (snap.empty) return null;

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as ProjectDoc) };
  cache.set(projDocKey(data.id), data, DalCache.TTL.PROJECT_DOC);
  cache.set(codeKey, data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** Fetch all projects created by a given user. Not cached (list can grow). */
export async function getUserProjects(uid: string): Promise<(ProjectDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'projects'), where('createdBy', '==', uid)),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
}

/**
 * Subscribe to all projects created by a user.
 * Each snapshot populates the per-doc cache.
 */
export function subscribeUserProjects(
  uid: string,
  onData: (projects: (ProjectDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'projects'), where('createdBy', '==', uid));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
    rows.forEach(p => {
      cache.set(projDocKey(p.id), p, DalCache.TTL.PROJECT_DOC);
      if (p.projectId) cache.set(projCodeKey(p.projectId), p, DalCache.TTL.CODE_LOOKUP);
    });
    onData(rows);
  }, err => onError?.(err as Error));
}

/**
 * Fetch all projects (full scan).
 *
 * ⚠️  EXPENSIVE — reads every project document.
 * Currently used only by the home-page ID migration helper,
 * which should check a `localStorage` migration-done flag first.
 * Do not use for display purposes.
 */
export async function getAllProjects(): Promise<(ProjectDoc & { id: string })[]> {
  const snap = await getDocs(collection(db(), 'projects'));
  const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
  rows.forEach(p => {
    cache.set(projDocKey(p.id), p, DalCache.TTL.PROJECT_DOC);
    if (p.projectId) cache.set(projCodeKey(p.projectId), p, DalCache.TTL.CODE_LOOKUP);
  });
  return rows;
}

/**
 * Subscribe to a single project document for real-time updates.
 * Each snapshot updates the doc cache.
 */
export function subscribeProject(
  docId: string,
  onData: (project: (ProjectDoc & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), 'projects', docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const data = { id: snap.id, ...(snap.data() as ProjectDoc) };
      cache.set(projDocKey(data.id), data, DalCache.TTL.PROJECT_DOC);
      if (data.projectId) cache.set(projCodeKey(data.projectId), data, DalCache.TTL.CODE_LOOKUP);
      onData(data);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Paginated fetch of publicly-visible projects sorted by name.
 * Returns the rows plus an opaque cursor for `startAfter`.
 */
export async function getPublicProjectsPage(
  pageSize: number,
  afterCursor?: DocumentSnapshot | null,
): Promise<{ rows: (ProjectDoc & { id: string })[]; cursor: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [
    where('publicVisible', '!=', false),
    orderBy('publicVisible'),
    orderBy('nameLower'),
    limit(pageSize),
  ];
  if (afterCursor) constraints.push(startAfter(afterCursor));
  const q = query(collection(db(), 'projects'), ...constraints);
  const snap = await getDocs(q);
  const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
  const cursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { rows, cursor };
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Partially update a project. Invalidates cache. */
export async function updateProject(docId: string, patch: Partial<ProjectDoc>): Promise<void> {
  await updateDoc(doc(db(), 'projects', docId), patch as Record<string, unknown>);
  cache.invalidate(projDocKey(docId));
  cache.invalidatePrefix('proj_code/');
}

/**
 * Create a new project using a Firestore transaction.
 * Ensures the projectId uniqueness check and write are atomic.
 * Returns the new document ID.
 */
export async function createProject(
  data: Omit<ProjectDoc, 'createdAt'>,
): Promise<string> {
  const firestore = db();
  const newRef = doc(collection(firestore, 'projects'));
  await runTransaction(firestore, async (tx) => {
    tx.set(newRef, { ...data, createdAt: serverTimestamp() });
  });
  return newRef.id;
}

/** Delete a project document and invalidate cache. */
export async function deleteProject(docId: string): Promise<void> {
  await deleteDoc(doc(db(), 'projects', docId));
  cache.invalidate(projDocKey(docId));
  cache.invalidatePrefix('proj_code/');
}

// ─── Finance transactions sub-collection ─────────────────────────────────────

/** Fetch finance transactions for a project (newest first). */
export async function getFinanceTransactions(
  projectDocId: string,
): Promise<(FinanceTransactionDoc & { id: string })[]> {
  const snap = await getDocs(
    query(
      collection(db(), 'projects', projectDocId, 'financeTransactions'),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as FinanceTransactionDoc) }));
}

/** Add a finance transaction record. */
export async function addFinanceTransaction(
  projectDocId: string,
  entry: Omit<FinanceTransactionDoc, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(
    collection(db(), 'projects', projectDocId, 'financeTransactions'),
    { ...entry, createdAt: serverTimestamp() },
  );
  return ref.id;
}
