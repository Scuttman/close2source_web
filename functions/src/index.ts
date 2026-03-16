import * as admin from 'firebase-admin';
import { firestore as AdminFirestore } from 'firebase-admin';
import * as functions from 'firebase-functions';

// Centralize region selection (align with Firestore location europe-west2)
const REGION = 'europe-west2';

// Lazy init pattern to avoid duplicate initialization in emulator hot reload
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * onInviteAccepted
 * Trigger: update to orgInvites/{inviteId} where status transitions pending -> accepted
 * Action: finds user by email, adds them to organization team if not present.
 */
export const onInviteAccepted = functions.region(REGION).firestore
  .document('orgInvites/{inviteId}')
  .onUpdate(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return;
    if (before.status === 'pending' && after.status === 'accepted') {
      const { orgDbId, email, role } = after;
      if (!orgDbId || !email) return;
      // Lookup user by email
      const userSnap = await db.collection('users').where('email', '==', email).limit(1).get();
      if (userSnap.empty) {
        console.log('Invite accepted but no user doc yet for email', email);
        return; // Could retry later or schedule
      }
      const userDoc = userSnap.docs[0];
      const member = {
        uid: userDoc.id,
        email,
        name: [userDoc.get('name'), userDoc.get('surname')].filter(Boolean).join(' ') || email,
        type: 'user',
        role: role || 'Member'
      };
      const orgRef = db.collection('organizations').doc(orgDbId);
      try {
  await db.runTransaction(async (tx: AdminFirestore.Transaction) => {
          const orgSnapshot = await tx.get(orgRef);
          if (!orgSnapshot.exists) return;
            const data: any = orgSnapshot.data();
            const team: any[] = Array.isArray(data.team) ? data.team : [];
            const exists = team.some(m => m.uid === member.uid || (m.email && m.email.toLowerCase() === email.toLowerCase()));
            if (!exists) {
              tx.update(orgRef, { team: [...team, member] });
            }
        });
        console.log('Added member via invite', email, 'to org', orgDbId);
      } catch (err) {
        console.error('Failed to add member on invite acceptance', err);
      }
    }
  });

/**
 * callable: acceptOrgInvite
 * Accept an invite by token. Client only sets invite status; function will mark accepted and rely on trigger OR directly add user.
 */
export const acceptOrgInvite = functions.region(REGION).https.onCall(async (data: { inviteToken?: string }, context: functions.https.CallableContext) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const { inviteToken } = data;
  if (!inviteToken) throw new functions.https.HttpsError('invalid-argument', 'inviteToken required');
  const inviteRef = db.collection('orgInvites').doc(inviteToken);
  const snap = await inviteRef.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Invite not found');
  const inv: any = snap.data();
  if (inv.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Invite already processed');
  // Optional: ensure auth email matches invite email if invite has an email
  if (inv.email && inv.email.toLowerCase() !== (context.auth.token.email || '').toLowerCase()) {
    throw new functions.https.HttpsError('permission-denied', 'Email does not match invite');
  }
  await inviteRef.update({ status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: context.auth.uid });
  return { ok: true };
});

/**
 * onOrganizationWrite
 * Maintains denormalized membership index arrays (teamUids, teamEmails) for efficient client membership queries.
 * These arrays are derived from the organization.team array of member objects (each may contain uid/email fields).
 * Safeguards:
 *  - Only updates when a change to team array detected OR when the index fields are missing.
 *  - Avoids recursive loop by comparing existing arrays before writing.
 */
export const onOrganizationWrite = functions.region(REGION).firestore
  .document('organizations/{orgId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return; // deleted
    const team: any[] = Array.isArray(after.team) ? after.team : [];
    const derivedUids: string[] = [];
    const derivedEmails: string[] = [];
    for (const m of team) {
      if (m && typeof m === 'object') {
        if (m.uid && typeof m.uid === 'string' && !derivedUids.includes(m.uid)) derivedUids.push(m.uid);
        if (m.email && typeof m.email === 'string') {
          const lower = m.email.toLowerCase();
            if (!derivedEmails.includes(lower)) derivedEmails.push(lower);
        }
      }
    }
    // Always include ownerUid in teamUids for symmetry (so owner query also matches membership index path)
    if (after.ownerUid && typeof after.ownerUid === 'string' && !derivedUids.includes(after.ownerUid)) {
      derivedUids.push(after.ownerUid);
    }

    const existingUids: string[] = Array.isArray(after.teamUids) ? after.teamUids : [];
    const existingEmails: string[] = Array.isArray(after.teamEmails) ? after.teamEmails : [];

    const equalArrays = (a: string[], b: string[]) => a.length === b.length && a.every(v => b.includes(v));
    const needsUidsUpdate = !equalArrays(existingUids, derivedUids);
    const needsEmailsUpdate = !equalArrays(existingEmails, derivedEmails);
    if (!needsUidsUpdate && !needsEmailsUpdate) return; // no-op

    try {
      await change.after.ref.update({
        ...(needsUidsUpdate ? { teamUids: derivedUids } : {}),
        ...(needsEmailsUpdate ? { teamEmails: derivedEmails } : {})
      });
      console.log('Updated membership indexes for org', context.params.orgId);
    } catch (e) {
      console.error('Failed updating membership indexes for org', context.params.orgId, e);
    }
  });
