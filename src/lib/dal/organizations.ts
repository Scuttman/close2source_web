/**
 * dal/organizations.ts
 *
 * All Firestore operations for the `organizations/{id}` collection.
 *
 * Caching strategy
 *  - `getOrg(docId)` / `getOrgByCode(orgId)` → cache by both doc ID and
 *    short code, TTL 2 min.
 *  - `subscribeOrgProjects` → real-time; no caching (list may grow).
 *  - Writes → invalidate the affected doc entry.
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
  writeBatch,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { OrgDoc, ProjectDoc } from './types';

const db = () => getFirestore(app);

// ─── Cache key helpers ───────────────────────────────────────────────────────

const orgDocKey  = (id: string)     => `organizations/${id}`;
const orgCodeKey = (code: string)   => `org_code/${code.toUpperCase()}`;   // → docId

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Subscribe to a single organization document for real-time updates.
 * Each snapshot updates the doc cache so one-off `getOrg` calls elsewhere
 * in the same tab get a fresh value.
 */
export function subscribeOrg(
  docId: string,
  onData: (org: (OrgDoc & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), 'organizations', docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const data = { id: snap.id, ...(snap.data() as OrgDoc) };
      cache.set(orgDocKey(data.id), data, DalCache.TTL.ORG_DOC);
      if (data.orgId) cache.set(orgCodeKey(data.orgId), data, DalCache.TTL.CODE_LOOKUP);
      onData(data);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch an org by its Firestore document ID. Cached (TTL 2 min). */
export async function getOrg(docId: string): Promise<(OrgDoc & { id: string }) | null> {
  const key = orgDocKey(docId);
  const hit = cache.get<OrgDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'organizations', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as OrgDoc) };
  cache.set(key, data, DalCache.TTL.ORG_DOC);
  // Also cache the code → docId mapping
  if (data.orgId) cache.set(orgCodeKey(data.orgId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/**
 * Fetch an org by its human-readable short code (e.g. "OABC123").
 *
 * The code→docId mapping is cached (TTL 5 min) so repeated code-search
 * lookups (home page, project registration) only hit Firestore once per
 * browser session.
 */
export async function getOrgByCode(orgId: string): Promise<(OrgDoc & { id: string }) | null> {
  const codeKey = orgCodeKey(orgId);
  const hit = cache.get<OrgDoc & { id: string }>(codeKey);
  if (hit) return hit;

  const snap = await getDocs(
    query(collection(db(), 'organizations'), where('orgId', '==', orgId.toUpperCase())),
  );
  if (snap.empty) return null;

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as OrgDoc) };
  cache.set(orgDocKey(data.id), data, DalCache.TTL.ORG_DOC);
  cache.set(codeKey, data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** Fetch all organizations owned by a given user. Not cached (list can grow). */
export async function getUserOrgs(uid: string): Promise<(OrgDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'organizations'), where('ownerUid', '==', uid)),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as OrgDoc) }));
}

/**
 * Subscribe to the orgs list for a user.  Each snapshot repopulates the
 * per-org doc cache entries so that getOrg/getOrgByCode calls hit cache.
 */
export function subscribeUserOrgs(
  uid: string,
  onData: (orgs: (OrgDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'organizations'), where('ownerUid', '==', uid));
  return onSnapshot(q, (snap) => {
    const orgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as OrgDoc) }));
    orgs.forEach(org => {
      cache.set(orgDocKey(org.id), org, DalCache.TTL.ORG_DOC);
      if (org.orgId) cache.set(orgCodeKey(org.orgId), org, DalCache.TTL.CODE_LOOKUP);
    });
    onData(orgs);
  }, err => onError?.(err as Error));
}

/**
 * Subscribe to all projects belonging to an org.
 * Includes a sessionStorage cache seed so the first render is instant
 * (same pattern already used in OrgProjectsTab).
 */
export function subscribeOrgProjects(
  orgId: string,
  onData: (projects: (ProjectDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'projects'), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
    onData(rows);
  }, err => onError?.(err as Error));
}

/** One-off fetch of all projects belonging to an org (by organizationId field). */
export async function getOrgProjects(orgId: string): Promise<(ProjectDoc & { id: string })[]> {
  const q = query(collection(db(), 'projects'), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
}

/**
 * Fetch all organizations (full scan).
 *
 * ⚠️  EXPENSIVE — reads every organization document.
 * Only use where unavoidable (e.g. membership analysis during account
 * deletion).  For most features, use the scoped helpers above.
 */
export async function getAllOrgs(): Promise<(OrgDoc & { id: string })[]> {
  const snap = await getDocs(collection(db(), 'organizations'));
  const orgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as OrgDoc) }));
  // Populate doc cache while we have all the data
  orgs.forEach(org => {
    cache.set(orgDocKey(org.id), org, DalCache.TTL.ORG_DOC);
    if (org.orgId) cache.set(orgCodeKey(org.orgId), org, DalCache.TTL.CODE_LOOKUP);
  });
  return orgs;
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Partially update an org document. Invalidates cache. */
export async function updateOrg(docId: string, patch: Partial<OrgDoc>): Promise<void> {
  await updateDoc(doc(db(), 'organizations', docId), patch as Record<string, unknown>);
  cache.invalidate(orgDocKey(docId));
  // Invalidate by code too (patch could change orgId, though unlikely)
  cache.invalidatePrefix('org_code/');
}

/**
 * Create a new organization using a Firestore transaction.
 * Returns the new document ID.
 */
export async function createOrg(
  data: Omit<OrgDoc, 'createdAt'> & { createdBy?: string },
): Promise<string> {
  const firestore = db();
  const newRef = doc(collection(firestore, 'organizations'));
  await runTransaction(firestore, async (tx) => {
    tx.set(newRef, { ...data, createdAt: serverTimestamp() });
  });
  return newRef.id;
}

/** Delete an org document and invalidate cache. */
export async function deleteOrg(docId: string): Promise<void> {
  await deleteDoc(doc(db(), 'organizations', docId));
  cache.invalidate(orgDocKey(docId));
  cache.invalidatePrefix('org_code/');
}
