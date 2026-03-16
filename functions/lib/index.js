"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptOrgInvite = exports.onInviteAccepted = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
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
exports.onInviteAccepted = functions.firestore
    .document('orgInvites/{inviteId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after)
        return;
    if (before.status === 'pending' && after.status === 'accepted') {
        const { orgDbId, email, role } = after;
        if (!orgDbId || !email)
            return;
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
            await db.runTransaction(async (tx) => {
                const orgSnapshot = await tx.get(orgRef);
                if (!orgSnapshot.exists)
                    return;
                const data = orgSnapshot.data();
                const team = Array.isArray(data.team) ? data.team : [];
                const exists = team.some(m => m.uid === member.uid || (m.email && m.email.toLowerCase() === email.toLowerCase()));
                if (!exists) {
                    tx.update(orgRef, { team: [...team, member] });
                }
            });
            console.log('Added member via invite', email, 'to org', orgDbId);
        }
        catch (err) {
            console.error('Failed to add member on invite acceptance', err);
        }
    }
});
/**
 * callable: acceptOrgInvite
 * Accept an invite by token. Client only sets invite status; function will mark accepted and rely on trigger OR directly add user.
 */
exports.acceptOrgInvite = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const { inviteToken } = data;
    if (!inviteToken)
        throw new functions.https.HttpsError('invalid-argument', 'inviteToken required');
    const inviteRef = db.collection('orgInvites').doc(inviteToken);
    const snap = await inviteRef.get();
    if (!snap.exists)
        throw new functions.https.HttpsError('not-found', 'Invite not found');
    const inv = snap.data();
    if (inv.status !== 'pending')
        throw new functions.https.HttpsError('failed-precondition', 'Invite already processed');
    // Optional: ensure auth email matches invite email if invite has an email
    if (inv.email && inv.email.toLowerCase() !== (context.auth.token.email || '').toLowerCase()) {
        throw new functions.https.HttpsError('permission-denied', 'Email does not match invite');
    }
    await inviteRef.update({ status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: context.auth.uid });
    return { ok: true };
});
