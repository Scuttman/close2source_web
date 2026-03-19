/**
 * dal/fieldValues.ts
 *
 * Backend-agnostic wrappers for Firestore "field value sentinels".
 *
 * Instead of importing `arrayUnion`, `arrayRemove`, `deleteField`, or
 * `serverTimestamp` from `firebase/firestore`, application code should
 * import these helpers from `@/lib/dal`.
 *
 * When migrating to a different backend (e.g. Appwrite, Supabase), only
 * this file needs to change — all call-sites remain untouched.
 */

import {
  arrayUnion   as _arrayUnion,
  arrayRemove  as _arrayRemove,
  deleteField  as _deleteField,
  serverTimestamp as _serverTimestamp,
} from 'firebase/firestore';
import type { FieldValue } from 'firebase/firestore';

// Re-export with the same signatures so existing call-sites work as-is.

/** Sentinel that tells the backend to append unique values to an array field. */
export const fieldArrayUnion: typeof _arrayUnion = _arrayUnion;

/** Sentinel that tells the backend to remove values from an array field. */
export const fieldArrayRemove: typeof _arrayRemove = _arrayRemove;

/** Sentinel that tells the backend to delete the field entirely. */
export const fieldDelete: typeof _deleteField = _deleteField;

/** Sentinel that tells the backend to use its own server clock. */
export const fieldServerTimestamp: typeof _serverTimestamp = _serverTimestamp;

// Also re-export the FieldValue type for consumers that need it.
export type { FieldValue };
