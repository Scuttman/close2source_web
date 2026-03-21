/**
 * dal/types.ts
 *
 * Canonical TypeScript interfaces for every Firestore document shape used
 * by the app.  All DAL functions are typed against these interfaces so that
 * callers get full intellisense and compile-time safety.
 */

// ─── Shared primitives ────────────────────────────────────────────────────────

export interface ConsentRecord {
  agreed: boolean;
  version: string;
  timestamp: string; // ISO 8601
}

export interface UserConsent {
  privacyPolicy?: ConsentRecord;
  terms?: ConsentRecord;
  aiPolicy?: ConsentRecord;
}

export type UserRole = 'User' | 'Admin' | 'SuperAdmin';

// ─── users/{uid} ─────────────────────────────────────────────────────────────

export interface UserDoc {
  uid?: string;           // denormalised doc ID (not always stored)
  name: string;
  surname: string;
  email: string;
  bio?: string;
  photoURL?: string;
  coverPhotoUrl?: string;
  role: UserRole;
  credits: number;
  aiConsent: boolean;
  consent?: UserConsent;
  displayName?: string;
  createdAt?: string;
}

// users/{uid}/activityLog/{id}
export interface ActivityLogDoc {
  event: string;
  timestamp: string;
  version?: string;
  details?: Record<string, unknown>;
  userAgent?: string;
}

// users/{uid}/transactions/{id}
export interface CreditTransactionDoc {
  type: 'purchase' | 'spend';
  amount: number;
  description: string;
  timestamp: unknown; // serverTimestamp
}

// ─── organizations/{id} ───────────────────────────────────────────────────────

export interface OrgLocation {
  id: string;
  name: string;
  vision?: string;
  whatWeDo?: string;
  lat?: number;
  lng?: number;
  country?: string;         // Country name for country-level display
  sensitiveLocation?: boolean;  // If true, only show country-level map pin
}

export interface OrgTeamMember {
  uid?: string;
  id?: string;
  email?: string;
  name?: string;
  surname?: string;
  photoURL?: string;
  role?: string;
  type?: string;
}

export interface OrgDoc {
  orgId: string;           // short human-readable code e.g. "OABC123"
  name: string;
  ownerUid: string;
  bio?: string;
  tagline?: string;
  logoUrl?: string | null;
  backgroundImageUrl?: string;
  backgroundUrl?: string | null;
  backgroundBrightness?: number;
  backgroundBlur?: number;
  backgroundFade?: number;
  website?: string;
  locations?: OrgLocation[];
  team?: OrgTeamMember[];
  memberUids?: string[];   // array of all member UIDs (for efficient querying)
  partners?: string[];     // array of project IDs
  accentColor?: string;
  accentTextColor?: string;
  joinPin?: string;
  orgType?: string;
  publicVisible?: boolean;
  hideFromSearch?: boolean;  // If true, only accessible via direct link
  accessSettings?: Record<string, { view: string[]; edit: string[] }>;
  themeHeaderBg?: string;
  themeHeaderText?: string;
  themeAccent?: string;
  themeAccentText?: string;
  themeAccentHover?: string;
  themeTabActiveBg?: string;
  themeTabActiveText?: string;
  themeTabInactiveText?: string;
  themeWidgetTitleColor?: string;
  createdAt?: unknown;     // serverTimestamp
}

// ─── projects/{id} ────────────────────────────────────────────────────────────

export type ProjectStatus = 'draft' | 'pending_review' | 'live' | 'rejected';
export type ProjectVisibility = 'public' | 'private';

export interface ProjectLocation {
  name?: string;
  town?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  sensitiveLocation?: boolean;  // If true, only show country-level map pin and hide address details
}

export interface ProjectTeamMember {
  uid?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface ProjectDoc {
  projectId: string;       // short code e.g. "PABC123"
  name: string;
  description?: string;
  createdBy: string;       // uid
  organizationId?: string; // org short code
  originatingOrganizationDbId?: string; // org Firestore doc id
  status: ProjectStatus;
  visibility: ProjectVisibility;
  location?: ProjectLocation;
  coverPhotoUrl?: string;
  galleryImages?: string[];
  keyDocuments?: { name: string; url: string; type?: string }[];
  team?: ProjectTeamMember[];
  goals?: string[];
  projectSummary?: string;
  projectImpact?: string;
  totalBudget?: number;
  currency?: string;
  timeline?: string;
  showOnOrganizationOverview?: boolean;
  partners?: { orgId: string; orgName?: string; joinedAt?: string }[];
  updates?: unknown[];
  moderationReviewedAt?: string;
  moderationReviewedBy?: string;
  amountPledged?: number;
  budgetPhases?: {
    id: string;
    name: string;
    notes?: string;
    target: number;
    pledged?: number;
    raised?: number;
  }[];
  accessPin?: string; // 4-6 digit PIN for view protection
  authorizedViewers?: string[]; // UIDs of users who have entered correct PIN
  createdAt?: unknown;
}

// projects/{id}/financeTransactions/{txId}
export interface FinanceTransactionDoc {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  transactionDate?: string;
  createdAt?: unknown;
}

// ─── individuals/{id} ─────────────────────────────────────────────────────────

export interface IndividualDoc {
  individualId: string;    // short code e.g. "IABC123"
  ownerUid: string;
  name: string;
  bio?: string;
  photoURL?: string;
  coverPhotoUrl?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  accessPin?: string;      // 4-6 digit PIN for access control
  authorizedViewers?: string[];  // UIDs of users who have entered correct PIN
  createdAt?: unknown;
}

// ─── showcases/{id} ───────────────────────────────────────────────────────────

export interface ShowcaseDoc {
  showcaseId: string;       // short code e.g. "SABCDEF"
  title: string;
  description?: string;
  ownerUid: string;
  orgId?: string;           // undefined/null = personal showcase; set = org showcase
  projectDocIds: string[];  // Firestore document IDs of included projects
  createdAt?: unknown;      // serverTimestamp
}

// ─── moderationQueue/{id} ─────────────────────────────────────────────────────

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface ModerationQueueDoc {
  type: 'project' | 'individual' | 'organization';
  docId: string;
  docCollection: string;
  profileName: string;
  profileCode: string;
  ownerUid: string;
  flaggedAt: string;
  flaggedAtTs?: unknown; // serverTimestamp
  status: ModerationStatus;
  flagCategories: string[];
  flagReason: string;
  severity: 'low' | 'medium' | 'high';
  contentSnapshot: Record<string, string>;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

// ─── orgInvites/{token} ───────────────────────────────────────────────────────

export interface OrgInviteDoc {
  orgId: string;
  orgDbId: string;
  orgName?: string | null;
  email: string;
  invitedByUid?: string | null;
  createdAt?: unknown;
  status: 'pending' | 'accepted' | 'expired';
  role: string;
}

// ─── config/pricing ───────────────────────────────────────────────────────────

export interface PricingConfig {
  costCreateIndividualProfile: number;
  costCreateFundraisingProfile: number;
  costCreateProjectProfile: number;
  costImprovePost: number;
  updatedAt?: string;
}
