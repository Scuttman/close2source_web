/**
 * src/lib/moderation.ts
 *
 * Client-callable helpers for the mandatory content-moderation pipeline.
 * Calls the server-side /api/moderate endpoint so the OpenAI API key is
 * never exposed in the browser bundle.
 *
 * This system is INDEPENDENT of aiConsent — it runs for every user on
 * every publish action regardless of their AI preferences.
 */

import {
  createModerationEntry,
  updateModerationEntry,
  updateProject,
  updateIndividual,
  updateOrg,
} from './dal';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModerationSeverity = 'clean' | 'low' | 'medium' | 'high';

export interface ModerationContent {
  [field: string]: string | undefined;
}

export interface ModerationResult {
  flagged:    boolean;
  severity:   ModerationSeverity;
  categories: string[];
  reason:     string;
}

export type ProfileType = 'project' | 'individual' | 'organization';

export interface ModerationQueueEntry {
  type:            ProfileType;
  docId:           string;           // Firestore document ID
  docCollection:   string;           // e.g. 'projects', 'individuals', 'organizations'
  profileName:     string;
  profileCode:     string;           // human-readable code / slug
  ownerUid:        string;
  flaggedAt:       string;           // ISO 8601
  status:          'pending' | 'approved' | 'rejected';
  flagCategories:  string[];
  flagReason:      string;
  severity:        Exclude<ModerationSeverity, 'clean'>;
  contentSnapshot: Record<string, string>;
  reviewedBy?:     string;
  reviewedAt?:     string;
  reviewNotes?:    string;
}

// ─── Core moderation call ───────────────────────────────────────────────────

/**
 * Sends profile content to /api/moderate for two-pass AI analysis.
 * Fails open: if the request errors, returns { flagged: false } so a
 * temporary API outage cannot block all profile publishing.
 */
export async function moderateProfileContent(
  content:     ModerationContent,
  profileType: ProfileType,
): Promise<ModerationResult> {
  try {
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(content)) {
      if (v && typeof v === 'string' && v.trim()) filtered[k] = v.trim();
    }

    const res = await fetch('/api/moderate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: filtered, profileType }),
    });

    if (!res.ok) {
      console.warn('[moderation] /api/moderate responded', res.status, '— failing open');
      return { flagged: false, severity: 'clean', categories: [], reason: '' };
    }

    return await res.json() as ModerationResult;
  } catch (err) {
    console.error('[moderation] request error — failing open:', err);
    return { flagged: false, severity: 'clean', categories: [], reason: '' };
  }
}

// ─── Queue helpers ───────────────────────────────────────────────────────────

/**
 * Creates a moderation queue record in Firestore.
 * Call this when moderateProfileContent returns flagged === true.
 * Returns the new queue document ID.
 */
export async function submitToModerationQueue(
  opts: {
    type:            ProfileType;
    docId:           string;
    docCollection:   string;
    profileName:     string;
    profileCode:     string;
    ownerUid:        string;
    result:          ModerationResult;
    contentSnapshot: Record<string, string>;
  },
): Promise<string> {
  const entry: Omit<ModerationQueueEntry, 'reviewedBy' | 'reviewedAt' | 'reviewNotes'> = {
    type:            opts.type,
    docId:           opts.docId,
    docCollection:   opts.docCollection,
    profileName:     opts.profileName,
    profileCode:     opts.profileCode,
    ownerUid:        opts.ownerUid,
    flaggedAt:       new Date().toISOString(),
    status:          'pending',
    flagCategories:  opts.result.categories,
    flagReason:      opts.result.reason,
    severity:        (opts.result.severity === 'clean' ? 'low' : opts.result.severity) as Exclude<ModerationSeverity, 'clean'>,
    contentSnapshot: opts.contentSnapshot,
  };

  const id = await createModerationEntry(entry as any);
  return id;
}

/**
 * Updates the moderation queue entry AND the original document once a
 * staff member approves or rejects.
 */
export async function resolveModerationItem(
  queueId:     string,
  docId:       string,
  docCollection: string,
  decision:    'approved' | 'rejected',
  reviewerUid: string,
  notes:       string,
): Promise<void> {
  const reviewedAt = new Date().toISOString();

  // Update moderation queue entry
  await updateModerationEntry(queueId, {
    status:      decision,
    reviewedBy:  reviewerUid,
    reviewedAt,
    reviewNotes: notes,
  } as any);

  // Update the source document status
  const statusPatch = {
    status: decision === 'approved' ? 'live' : 'rejected',
    moderationReviewedAt: reviewedAt,
    moderationReviewedBy: reviewerUid,
  };

  if (docCollection === 'projects') {
    await updateProject(docId, statusPatch as any);
  } else if (docCollection === 'individuals') {
    await updateIndividual(docId, statusPatch as any);
  } else if (docCollection === 'organizations') {
    await updateOrg(docId, statusPatch as any);
  }
}

// ─── UI message helper ───────────────────────────────────────────────────────

/**
 * Returns a user-friendly, non-alarming message to show when a profile
 * is held for review.  Does NOT expose what was flagged.
 */
export function getPendingReviewMessage(type: ProfileType): string {
  const noun = type === 'project' ? 'project' : type === 'individual' ? 'profile' : 'organisation profile';
  return (
    `Your ${noun} has been submitted for review before going live. ` +
    `This is a routine check that applies to all ${noun}s. ` +
    `You'll be notified once it's approved — typically within 24\u202fhours.`
  );
}
