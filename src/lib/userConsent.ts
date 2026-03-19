/**
 * userConsent.ts
 *
 * Utilities for recording user consent decisions and logging major user
 * activity events to Firestore. Every meaningful consent / account action
 * is written to the `users/{uid}/activityLog` sub-collection with a
 * UTC ISO 8601 timestamp, and the canonical consent flags are also kept
 * as top-level fields on the `users/{uid}` document for easy querying.
 */

import { addActivityLog, updateUser } from './dal';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsentEventType =
  | 'account_created'
  | 'privacy_policy_agreed'
  | 'terms_agreed'
  | 'ai_policy_agreed'
  | 'ai_policy_declined'
  | 'ai_policy_revoked'      // user turned off AI in Settings
  | 'ai_policy_reinstated'  // user turned AI back on in Settings
  | 'account_deleted'
  | 'data_export_requested'
  | 'password_changed'
  | 'profile_updated';

export interface ActivityLogEntry {
  event: ConsentEventType;
  timestamp: string;        // ISO 8601 UTC
  version?: string;         // policy version string e.g. '1.0'
  details?: Record<string, unknown>;
  userAgent?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ua(): string | undefined {
  if (typeof navigator !== 'undefined') return navigator.userAgent;
  return undefined;
}

/**
 * Append an event to the activityLog sub-collection for the given user.
 */
export async function logUserActivity(
  uid: string,
  event: ConsentEventType,
  details?: Record<string, unknown>,
  version?: string
): Promise<void> {
  const entry: Record<string, unknown> = {
    event,
    timestamp: new Date().toISOString(),
  };
  if (version)  entry.version   = version;
  if (details)  entry.details   = details;
  const userAgent = ua();
  if (userAgent) entry.userAgent = userAgent;

  await addActivityLog(uid, entry as any);
}

// ─── Consent Recording ────────────────────────────────────────────────────────

export interface ConsentDecisions {
  privacyPolicy?: boolean;
  terms?: boolean;
  aiPolicy?: boolean;       // true = opted in, false = opted out
}

/**
 * Write consent decisions to the `users/{uid}` document and log each
 * decision as an activityLog entry.  Call this immediately after the
 * Firebase account has been created.
 */
export async function recordConsent(
  uid: string,
  decisions: ConsentDecisions
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  if (decisions.privacyPolicy !== undefined) {
    updates['consent.privacyPolicy'] = {
      agreed:    decisions.privacyPolicy,
      version:   '1.0',
      timestamp: now,
    };
    await logUserActivity(uid, 'privacy_policy_agreed', undefined, '1.0');
  }

  if (decisions.terms !== undefined) {
    updates['consent.terms'] = {
      agreed:    decisions.terms,
      version:   '1.0',
      timestamp: now,
    };
    await logUserActivity(uid, 'terms_agreed', undefined, '1.0');
  }

  if (decisions.aiPolicy !== undefined) {
    updates['consent.aiPolicy'] = {
      agreed:    decisions.aiPolicy,
      version:   '1.0',
      timestamp: now,
    };
    // Flat flag used by AIConsentProvider for real-time subscription
    updates['aiConsent'] = decisions.aiPolicy;
    await logUserActivity(
      uid,
      decisions.aiPolicy ? 'ai_policy_agreed' : 'ai_policy_declined',
      undefined,
      '1.0'
    );
  }

  if (Object.keys(updates).length > 0) {
    await updateUser(uid, updates as any);
  }
}

/**
 * Update just the AI consent flag and log the change.
 * Used by the Settings page AI toggle.
 */
export async function updateAIConsent(
  uid: string,
  enabled: boolean
): Promise<void> {
  const now = new Date().toISOString();

  await updateUser(uid, {
    'consent.aiPolicy': { agreed: enabled, version: '1.0', timestamp: now },
    aiConsent: enabled,
  } as any);

  await logUserActivity(
    uid,
    enabled ? 'ai_policy_reinstated' : 'ai_policy_revoked',
    undefined,
    '1.0'
  );
}
