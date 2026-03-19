/**
 * dal/index.ts
 *
 * Single entry-point for the data abstraction layer.
 *
 * Import from here in application code:
 *
 *   import { getUser, getOrgByCode, subscribeUserProjects } from '@/src/lib/dal';
 *
 * This keeps a clean public surface area; internal cache helpers are only
 * accessible via the named sub-modules if you need them.
 */

// ── Cache (public for manual invalidation / clear-on-signout) ────────────────
export { cache } from './cache';

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  UserDoc,
  ActivityLogDoc,
  CreditTransactionDoc,
  OrgDoc,
  OrgLocation,
  OrgTeamMember,
  ProjectDoc,
  ProjectLocation,
  ProjectTeamMember,
  FinanceTransactionDoc,
  IndividualDoc,
  ModerationQueueDoc,
  OrgInviteDoc,
  PricingConfig,
  UserConsent,
  ConsentRecord,
  UserRole,
  ProjectStatus,
  ProjectVisibility,
  ModerationStatus,
  ShowcaseDoc,
} from './types';

// ── Users ────────────────────────────────────────────────────────────────────
export {
  getUser,
  subscribeUser,
  updateUser,
  createUserDoc,
  mergeUserDoc,
  getUsersByEmails,
  addActivityLog,
  getActivityLog,
  addCreditTransaction,
  getCreditTransactions,
  deleteUserDoc,
} from './users';

// ── Organizations ─────────────────────────────────────────────────────────────
export {
  getOrg,
  getOrgByCode,
  getUserOrgs,
  subscribeOrg,
  subscribeUserOrgs,
  subscribeOrgProjects,
  getOrgProjects,
  getAllOrgs,
  updateOrg,
  createOrg,
  deleteOrg,
} from './organizations';

// ── Projects ──────────────────────────────────────────────────────────────────
export {
  getProject,
  getProjectByCode,
  getUserProjects,
  subscribeProject,
  subscribeUserProjects,
  getAllProjects,
  getPublicProjectsPage,
  updateProject,
  createProject,
  deleteProject,
  getFinanceTransactions,
  addFinanceTransaction,
} from './projects';

// ── Individuals ───────────────────────────────────────────────────────────────
export {
  getIndividual,
  getIndividualByCode,
  getUserIndividuals,
  subscribeAllIndividuals,
  subscribeIndividual,
  subscribeUserIndividuals,
  updateIndividual,
  createIndividual,
  deleteIndividual,
} from './individuals';

// ── Showcases ────────────────────────────────────────────────────────────────
export {
  getShowcase,
  getShowcaseByCode,
  getUserShowcases,
  getOrgShowcases,
  subscribeShowcase,
  subscribeUserShowcases,
  subscribeOrgShowcases,
  createShowcase,
  updateShowcase,
  deleteShowcase,
} from './showcases';

// ── Config / Invites / Moderation ─────────────────────────────────────────────
export {
  getPricingConfig,
  savePricingConfig,
  getOrgInvite,
  subscribePendingInvites,
  createOrgInvite,
  addOrgInvite,
  deleteOrgInvite,
  getPendingModerationItems,
  createModerationEntry,
  updateModerationEntry,
} from './config';

// ── Field-value sentinels (backend-agnostic wrappers) ─────────────────────────
export {
  fieldArrayUnion,
  fieldArrayRemove,
  fieldDelete,
  fieldServerTimestamp,
} from './fieldValues';
export type { FieldValue } from './fieldValues';

// ── Transactions (domain-specific atomic operations) ──────────────────────────
export {
  createProjectWithCredits,
  createIndividualWithCredits,
  acceptOrgInvite,
  joinOrgByPin,
  deleteUserAccount,
  mutateProjectUpdates,
} from './transactions';
export type {
  CreateProjectTxInput,
  CreateProjectTxResult,
  CreateIndividualTxInput,
  CreateIndividualTxResult,
  AcceptOrgInviteInput,
  AcceptOrgInviteResult,
  JoinOrgByPinInput,
  DeleteAccountInput,
} from './transactions';
