/**
 * dal/transactions.ts
 *
 * Domain-specific atomic operations that span multiple documents.
 *
 * Every Firestore `runTransaction` / `writeBatch` that lived in page or
 * component code is now centralised here.  Application code calls these
 * named functions with plain business-level parameters — no Firestore
 * primitives leak into the UI layer.
 *
 * When migrating to a different backend (e.g. Appwrite, Supabase), only
 * this file and the other DAL modules need to change.
 */

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache } from './cache';

const db = () => getFirestore(app);

// ─── Helper ──────────────────────────────────────────────────────────────────

const userKey  = (uid: string) => `users/${uid}`;

// ─── Create-project + deduct credits (used by 3 pages) ──────────────────────

export interface CreateProjectTxInput {
  /** UID of the creating user */
  uid: string;
  /** Data to store on the new project document */
  projectData: Record<string, unknown>;
  /** Credit cost (default 50) */
  creditCost?: number;
}

export interface CreateProjectTxResult {
  /** Firestore-generated document ID */
  docId: string;
}

/**
 * Atomically creates a project document and deducts credits from the user.
 * Returns the auto-generated Firestore document ID.
 */
export async function createProjectWithCredits(
  input: CreateProjectTxInput,
): Promise<CreateProjectTxResult> {
  const { uid, projectData, creditCost = 50 } = input;
  let newDocId = '';

  await runTransaction(db(), async (tx) => {
    const userRef = doc(db(), 'users', uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('User profile not found.');
    const userData = userSnap.data();
    if ((userData.credits || 0) < creditCost)
      throw new Error(`Not enough credits (need ${creditCost}).`);

    const newRef = doc(collection(db(), 'projects'));
    newDocId = newRef.id;

    tx.set(newRef, {
      ...projectData,
      createdAt: serverTimestamp(),
    });
    tx.update(userRef, { credits: (userData.credits || 0) - creditCost });
  });

  cache.invalidate(userKey(uid));
  return { docId: newDocId };
}

// ─── Create-individual + deduct credits ──────────────────────────────────────

export interface CreateIndividualTxInput {
  uid: string;
  individualData: Record<string, unknown>;
  creditCost?: number;
}

export interface CreateIndividualTxResult {
  docId: string;
}

/**
 * Atomically creates an individual-profile document and deducts credits.
 */
export async function createIndividualWithCredits(
  input: CreateIndividualTxInput,
): Promise<CreateIndividualTxResult> {
  const { uid, individualData, creditCost = 50 } = input;
  let newDocId = '';

  await runTransaction(db(), async (tx) => {
    const userRef = doc(db(), 'users', uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('User profile not found.');
    const userData = userSnap.data();
    if ((userData.credits || 0) < creditCost)
      throw new Error(`Not enough credits. You need ${creditCost} credits to create an individual profile.`);

    const indRef = doc(collection(db(), 'individuals'));
    newDocId = indRef.id;

    tx.set(indRef, {
      ...individualData,
      createdAt: serverTimestamp(),
    });
    tx.update(userRef, { credits: (userData.credits || 0) - creditCost });
  });

  cache.invalidate(userKey(uid));
  return { docId: newDocId };
}

// ─── Accept org invite (used by invite page + register page) ─────────────────

export interface AcceptOrgInviteInput {
  /** The orgInvite document ID (the token) */
  inviteToken: string;
  /** The accepting user's info */
  user: { uid: string; email: string; displayName?: string };
  /** Optional: extra member fields */
  memberName?: string;
  memberRole?: string;
}

export interface AcceptOrgInviteResult {
  orgId: string;
  orgName: string;
  orgDbId: string;
}

/**
 * Atomically validates & accepts an org invite, adding the user to the
 * organization team and marking the invite as accepted.
 */
export async function acceptOrgInvite(
  input: AcceptOrgInviteInput,
): Promise<AcceptOrgInviteResult> {
  const { inviteToken, user, memberName, memberRole = 'Member' } = input;
  let orgId = '';
  let orgName = '';
  let orgDbId = '';

  await runTransaction(db(), async (tx) => {
    const inviteRef = doc(db(), 'orgInvites', inviteToken);
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invite not found');
    const inv: any = inviteSnap.data();
    if (inv.status !== 'pending') throw new Error('Invite already processed');
    if (inv.email && inv.email.toLowerCase() !== user.email.toLowerCase())
      throw new Error('Invitation email mismatch');

    const orgRef = doc(db(), 'organizations', inv.orgDbId);
    const orgSnap = await tx.get(orgRef);
    if (!orgSnap.exists()) throw new Error('Organization missing');
    const orgData: any = orgSnap.data();

    const team: any[] = Array.isArray(orgData.team) ? orgData.team : [];
    const already = team.some(
      (m: any) =>
        (m.uid && m.uid === user.uid) ||
        (m.email && m.email.toLowerCase() === user.email.toLowerCase()),
    );

    const member = {
      uid: user.uid,
      email: user.email,
      name: memberName || user.displayName || user.email,
      type: 'user',
      role: memberRole,
    };
    const newTeam = already ? team : [...team, member];

    tx.update(orgRef, { team: newTeam });
    tx.update(inviteRef, {
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      acceptedBy: user.uid,
    });

    orgId = inv.orgId || inv.orgDbId || '';
    orgName = inv.orgName || 'Organization';
    orgDbId = inv.orgDbId || '';
  });

  return { orgId, orgName, orgDbId };
}

// ─── Join org by code + PIN ──────────────────────────────────────────────────

export interface JoinOrgByPinInput {
  orgDocId: string;
  user: { uid: string; email: string; displayName?: string };
  /** Full display name for the team entry */
  memberName?: string;
}

/**
 * Atomically adds a user to an org's team array (join-by-PIN flow).
 * The caller is expected to validate the PIN before calling this.
 */
export async function joinOrgByPin(input: JoinOrgByPinInput): Promise<void> {
  const { orgDocId, user, memberName } = input;

  await runTransaction(db(), async (tx) => {
    const orgRef = doc(db(), 'organizations', orgDocId);
    const latest = await tx.get(orgRef);
    const latestTeam: any[] = Array.isArray(latest.data()?.team) ? latest.data()!.team : [];
    const stillMember = latestTeam.some((m: any) => m.uid === user.uid);
    if (stillMember) return; // idempotent

    const member = {
      uid: user.uid,
      email: user.email || '',
      name: memberName || user.displayName || user.email || '',
      type: 'user',
      role: 'Member',
    };
    tx.update(orgRef, { team: [...latestTeam, member] });
  });
}

// ─── Delete user account (batch) ─────────────────────────────────────────────

export interface DeleteAccountInput {
  uid: string;
  email: string;
  individuals: { id: string }[];
  soloOrgs: { docId: string; orgId: string }[];
  memberOrgs: { docId: string }[];
}

/**
 * Batch-deletes all data associated with a user account:
 * individual profiles, solo-owned orgs + their projects, and removes the
 * user from any team memberships. Finally deletes the user Firestore doc.
 *
 * The caller is responsible for reauthentication and deleting the Firebase
 * Auth account afterwards.
 */
export async function deleteUserAccount(input: DeleteAccountInput): Promise<void> {
  const { uid, email, individuals, soloOrgs, memberOrgs } = input;
  const batch = writeBatch(db());

  // 1. Delete individual profiles
  for (const ind of individuals) {
    batch.delete(doc(db(), 'individuals', ind.id));
  }

  // 2. Delete solo-owned orgs + all their projects
  for (const org of soloOrgs) {
    const projSnap = await getDocs(
      query(collection(db(), 'projects'), where('organizationId', '==', org.orgId)),
    );
    projSnap.forEach((p) => batch.delete(p.ref));
    batch.delete(doc(db(), 'organizations', org.docId));
  }

  // 3. Remove user from team of member orgs
  for (const org of memberOrgs) {
    const orgRef = doc(db(), 'organizations', org.docId);
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      const currentTeam: any[] = Array.isArray(orgSnap.data().team)
        ? orgSnap.data().team
        : [];
      const updatedTeam = currentTeam.filter(
        (m: any) => m.uid !== uid && m.email !== email,
      );
      batch.update(orgRef, { team: updatedTeam });
    }
  }

  // 4. Delete user doc
  batch.delete(doc(db(), 'users', uid));

  await batch.commit();

  cache.invalidate(userKey(uid));
}

// ─── Project-updates transactions (comments, reactions, edits) ───────────────

/**
 * Generic helper that reads the project doc inside a transaction,
 * passes the `updates` array to a mutator callback, then writes
 * the modified array back.
 *
 * Every comment / reaction / update-edit operation follows this
 * exact pattern, so this helper removes all duplication.
 */
export async function mutateProjectUpdates(
  projectDocId: string,
  mutator: (updates: any[]) => void,
): Promise<void> {
  await runTransaction(db(), async (tx) => {
    const ref = doc(db(), 'projects', projectDocId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Project not found');
    const data: any = snap.data();
    const updates: any[] = Array.isArray(data.updates) ? [...data.updates] : [];
    mutator(updates);
    tx.update(ref, { updates });
  });
}
