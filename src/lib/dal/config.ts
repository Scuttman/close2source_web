/**
 * dal/config.ts
 *
 * Firestore operations for the `config/pricing` document and
 * the `orgInvites` + `moderationQueue` collections.
 */

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { PricingConfig, OrgInviteDoc, ModerationQueueDoc } from './types';

const db = () => getFirestore(app);

// ─── Pricing config ───────────────────────────────────────────────────────────

const PRICING_KEY = 'config/pricing';

/** Fetch the pricing config document.  Cached aggressively (10 min). */
export async function getPricingConfig(): Promise<PricingConfig | null> {
  const hit = cache.get<PricingConfig>(PRICING_KEY);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'config', 'pricing'));
  if (!snap.exists()) return null;

  const data = snap.data() as PricingConfig;
  cache.set(PRICING_KEY, data, DalCache.TTL.CONFIG);
  return data;
}

/** Save / merge the pricing config and invalidate cache. */
export async function savePricingConfig(data: Partial<PricingConfig>): Promise<void> {
  await setDoc(doc(db(), 'config', 'pricing'), data, { merge: true });
  cache.invalidate(PRICING_KEY);
}

// ─── Org invites ─────────────────────────────────────────────────────────────

/** Fetch a single org invite by its token (document ID). */
export async function getOrgInvite(token: string): Promise<(OrgInviteDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db(), 'orgInvites', token));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as OrgInviteDoc) };
}

/** Subscribe to pending invites for an org (used by OrgTeamTab). */
export function subscribePendingInvites(
  orgDbId: string,
  onData: (invites: (OrgInviteDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db(), 'orgInvites'),
    where('orgDbId', '==', orgDbId),
    where('status', '==', 'pending'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map(d => ({ id: d.id, ...(d.data() as OrgInviteDoc) })));
  }, err => onError?.(err as Error));
}

/** Create an org invite at a specific doc ID (the token). */
export async function createOrgInvite(token: string, data: Omit<OrgInviteDoc, 'id'>): Promise<void> {
  await setDoc(doc(db(), 'orgInvites', token), data);
}

/** Create an org invite with an auto-generated ID. Returns the new doc ID. */
export async function addOrgInvite(data: Omit<OrgInviteDoc, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db(), 'orgInvites'), data);
  return ref.id;
}

/** Delete an org invite (e.g. on acceptance or revocation). */
export async function deleteOrgInvite(token: string): Promise<void> {
  await deleteDoc(doc(db(), 'orgInvites', token));
}

// ─── Moderation queue ─────────────────────────────────────────────────────────

/** Fetch pending moderation items (admin review page). */
export async function getPendingModerationItems(): Promise<(ModerationQueueDoc & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db(), 'moderationQueue'), where('status', '==', 'pending')),
  );
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ModerationQueueDoc) }));
}

/** Create a moderation queue entry. Returns the new doc ID. */
export async function createModerationEntry(
  data: Omit<ModerationQueueDoc, 'id' | 'flaggedAtTs'>,
): Promise<string> {
  const ref = await addDoc(collection(db(), 'moderationQueue'), {
    ...data,
    flaggedAtTs: serverTimestamp(),
  });
  return ref.id;
}

/** Update a moderation queue entry (approve / reject). */
export async function updateModerationEntry(
  queueId: string,
  patch: Partial<ModerationQueueDoc>,
): Promise<void> {
  await updateDoc(doc(db(), 'moderationQueue', queueId), patch as Record<string, unknown>);
}
