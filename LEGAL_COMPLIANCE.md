# Legal Compliance — GDPR / UK GDPR Analysis

**Analysed:** 18 March 2026  
**Frameworks:** UK GDPR (UK Data Protection Act 2018), EU GDPR (Regulation 2016/679), PECR (Privacy and Electronic Communications Regulations 2003)  
**Status:** ⚠️ Work in progress — all P1 critical issues resolved; P2/P3 items remain

---

## Executive Summary

All critical (P1) compliance gaps have been resolved in code. One manual action remains: signing the OpenAI Data Processing Addendum at openai.com/policies/data-processing-addendum and updating deployment environment variables. P2 items (cookie consent, Firestore access control) should be addressed before significant user growth.

---

## Priority Table

| Priority | Status | Issue | GDPR Article |
|----------|--------|-------|--------------|
| P1 | ✅ Done | OpenAI API key exposed in browser; user data sent to US without notice or consent | Art. 13, 46, 28 |
| P1 | ✅ Done | No consent checkpoint at registration | Art. 7 |
| P1 | ✅ Done | Account deletion mechanism | Art. 17 |
| P1 | ✅ Done | Legal basis not stated in privacy policy for each processing activity | Art. 13(1)(c) |
| P1 | ✅ Done | OpenAI processor not disclosed; no international transfer mechanism documented | Art. 13, 46 |
| P1 | ⚠️ Manual | Sign OpenAI DPA at openai.com/policies/data-processing-addendum | Art. 28 |
| P2 | ✅ Done | Cookie banner uses opt-out language; analytics fires without prior consent | PECR Reg. 6 |
| P2 | ✅ Done | Private/draft projects readable by anyone via Firestore directly (rules bypass UI) | Art. 5(1)(f) |
| P2 | ✅ Done | Any authenticated user can read all other users' email/name/bio via Firestore rules | Art. 5(1)(c) |
| P2 | ✅ Done | No ICO complaint right stated in privacy policy | Art. 13(2)(d) |
| P2 | ✅ Done | No breach notification procedure documented | Art. 33 |
| P3 | ✅ Done | No data export / portability feature | Art. 20 |
| P3 | ✅ Done | No legal entity / registered address in privacy policy | Art. 13(1)(a) |
| P3 | ✅ Done | SMTP processor location and DPA status unconfirmed | Art. 28 |
| P3 | ⚠️ Manual | Accept Krystal DPA in client portal; accept Firebase DPA in Firebase Console | Art. 28 |

---

## Detailed Findings

### 1. Lawful Basis for Processing (Article 6)

**Status:** ⚠️ Partial  
**File:** `app/privacy/page.tsx`

The privacy policy describes *what* data is used for but **never states the legal basis** (Article 6 ground) for each processing activity.

**Required action:** For each category of processing, explicitly state the ground:

| Processing Activity | Recommended Legal Basis |
|--------------------|------------------------|
| Account credentials (name, email, password) | Performance of a contract (Art. 6(1)(b)) |
| Transactional emails | Performance of a contract (Art. 6(1)(b)) |
| Firebase Analytics | Consent (Art. 6(1)(a)) |
| AI processing of project/profile content | Consent (Art. 6(1)(a)) |
| Partner/pledge data | Legitimate interest or contract |
| Contact form messages | Legitimate interest (Art. 6(1)(f)) |
| Legal compliance obligations | Legal obligation (Art. 6(1)(c)) |

---

### 2. Consent at Registration (Article 7)

**Status:** ✅ Resolved (18 March 2026)

**What was done:**
- Created `components/ConsentStage.tsx` — a reusable scrollable consent panel that requires the user to scroll to the end of each policy before the checkbox is enabled. Cannot be submitted without scrolling and ticking.
- Added three new onboarding stages to `app/register/page.tsx` (between account creation and the profile photo stage):
  1. **Privacy Policy** — inline summary with link to `/privacy`; records `consent.privacyPolicy` in Firestore
  2. **Terms of Service** — inline summary with link to `/terms`; records `consent.terms` in Firestore
  3. **AI Use Policy** — inline summary with link to `/ai-policy`; user can agree or explicitly decline; records `consent.aiPolicy` and `aiConsent` flag in Firestore
- Google Sign-In and Apple Sign-In new user flows now also run the consent stages before redirecting to `/profile`.
- Returns users to consent flow are handled via `activityLog` sub-collection (see below).
- Created `src/lib/userConsent.ts` with `recordConsent()` and `logUserActivity()` helpers.
- Each consent decision is written to `users/{uid}/activityLog` with the event type, ISO UTC timestamp, policy version, and user agent.  
**File:** `app/register/page.tsx`

There is **no terms/privacy acceptance checkbox** at registration. The signup form collects name, email and password and creates an account with no affirmative acceptance of the Privacy Policy or Terms of Service. Under UK GDPR Art. 7 and ICO guidance, "by continuing to use the site" is insufficient at account creation.

**Required action:**
- Add a required checkbox: *"I have read and agree to the [Privacy Policy] and [Terms of Service]"*
- Gate form submission on this checkbox
- On account creation, write `consentGiven: true, consentDate: new Date().toISOString()` to the `users/{uid}` Firestore document

---

### 5. AI Use Policy (New — Art. 13, 6(1)(a))

**Status:** ✅ Resolved (18 March 2026)

**What was done:**
- Created `app/ai-policy/page.tsx` — a full standalone AI Use Policy page covering: what AI does, what data is sent, OpenAI as a US processor, IDTA/SCC transfer mechanism, legal basis (consent), opt-in/opt-out rights, and accuracy disclaimer.
- Added AI Policy link to the footer in `app/layout.tsx`.

---

### 6. AI Consent Toggle in Settings

**Status:** ✅ Resolved (18 March 2026)

**What was done:**
- Added AI Features toggle to `app/settings/page.tsx`. Reads/writes `aiConsent` (boolean) and `consent.aiPolicy` (object with timestamp + version) on the `users/{uid}` Firestore document.
- Toggle calls `updateAIConsent()` from `src/lib/userConsent.ts` which logs the change to `activityLog`.
- Created `src/lib/aiContext.tsx` — `AIConsentProvider` + `useAIConsent()` hook. Wraps the app in `app/layout.tsx` with a real-time Firestore listener so consent changes take effect immediately without a page reload.
- `components/AITextarea.tsx` now calls `useAIConsent()` and hides the AI sparkle button completely when `aiEnabled === false`.

---

### 7. User Activity Log

**Status:** ✅ Implemented (18 March 2026)

Every major account and consent event is recorded to `users/{uid}/activityLog` (Firestore sub-collection) as:
```json
{
  "event": "account_created | privacy_policy_agreed | terms_agreed | ai_policy_agreed | ai_policy_declined | ai_policy_revoked | ai_policy_reinstated | ...",
  "timestamp": "2026-03-18T12:00:00.000Z",
  "version": "1.0",
  "userAgent": "Mozilla/5.0 ..."
}
```

The canonical consent flags are also stored on the user document for fast querying:
- `consent.privacyPolicy`, `consent.terms`, `consent.aiPolicy` — each an object with `{ agreed, version, timestamp }`
- `aiConsent` — flat boolean read by `AIConsentProvider`

---

### 8. Cookie Consent (PECR Regulation 6 + UK GDPR)

**Status:** ✅ Resolved (18 March 2026)  
**File:** `app/layout.tsx`

The cookie banner currently says: *"By continuing to use this site, you agree to the use of cookies and local storage on your device."* This is the pre-GDPR notice model. UK PECR (Regulation 6) requires **prior opt-in** for non-essential cookies including Firebase Analytics.

**Required actions:**
1. Replace the single-button banner with an **Accept / Decline** choice
2. Only initialise Firebase Analytics **after** the user accepts:
   ```js
   if (localStorage.getItem("c2s_cookie_consent") === "true") {
     // initialise analytics
   }
   ```
3. Add cookie categories: *Essential (always on) | Analytics (optional)*
4. Link to a cookie policy or the relevant section of the Privacy Policy

---

### 4. AI API Key Exposed + Unnotified Data Transfer to OpenAI (CRITICAL)

**Status:** ✅ Resolved (18 March 2026)

**What was done:**
- Created `app/api/ai/route.ts` — a server-side Next.js API route that proxies all OpenAI requests. Supports both JSON and SSE streaming responses.
- The API key is now stored as `OPENAI_API_KEY` (no `NEXT_PUBLIC_` prefix). It is never sent to the browser.
- Updated `src/lib/ai.ts`, `components/ProjectAIReviewModal.tsx`, `components/IndividualAIReviewModal.tsx`, `components/ProjectAIChatModal.tsx`, `app/projects/register-ai/page.tsx`, and `app/individuals/register-ai/page.tsx` — all now `POST /api/ai` instead of calling OpenAI directly.
- Removed `NEXT_PUBLIC_OPENAI_API_KEY` from all client-side code.

**Remaining actions:**
- Update `.env.local` to rename `NEXT_PUBLIC_OPENAI_API_KEY` → `OPENAI_API_KEY` and remove the old key
- Sign OpenAI's Data Processing Addendum and reference it in the Privacy Policy under "Third-Party Processors"
- Add AI processor disclosure to the Privacy Policy (the AI Use Policy page already covers this)  
**Files:** `components/ProjectAIReviewModal.tsx`, `components/IndividualAIReviewModal.tsx`, `components/ProjectAIChatModal.tsx`

Three components call the OpenAI API **directly from the browser** using `NEXT_PUBLIC_OPENAI_API_KEY`. This causes two overlapping GDPR violations:

1. **Key exposure** — any user can view the API key in browser DevTools / page source
2. **Unnotified international transfer** — user content (project descriptions, individual profiles, org data) is sent to OpenAI's servers in the **United States** with no user notice and no consent

This violates:
- UK GDPR Art. 13 — users not informed that their data is sent to a third party
- UK GDPR Art. 46 / Chapter V — international transfer with no adequacy decision and no SCCs documented for OpenAI
- UK GDPR Art. 28 — no Data Processing Agreement with OpenAI referenced

**Required actions (in priority order):**

1. **Move all OpenAI calls to a server-side API route** (e.g. `app/api/ai/review/route.ts`). The key must be `OPENAI_API_KEY` (no `NEXT_PUBLIC_` prefix) so it is never sent to the browser.

2. Add disclosure to the Privacy Policy:
   > "When you use AI-powered features, content you provide may be processed by OpenAI Inc. (USA). This transfer is governed by OpenAI's Standard Contractual Clauses / UK International Data Transfer Addendum."

3. Add a **per-use consent notice** before AI modals open:
   > "This will send your project content to OpenAI for analysis. Do you agree?"

4. Sign OpenAI's [Data Processing Addendum](https://openai.com/policies/data-processing-addendum) and reference it in the Privacy Policy under "Third-Party Processors".

---

### 5. Firestore Security Rules — Access Control

**Status:** ⚠️ Significant  
**File:** `firestore.rules`

**Issue 1 — Private projects are publicly readable:**
```
match /projects/{allPaths=**} {
  allow read: if true;    // ← unauthenticated users can read ALL projects
  allow write: if isSignedIn();  // ← any signed-in user can write any project
}
```
The `visibility: 'private'` and `status: 'draft'` flags are enforced only in the UI. Any script or unauthenticated request to Firestore bypasses this entirely.

**Issue 2 — User profile over-exposure:**
```
match /users/{userId} {
  allow read: if isSignedIn();  // ← all users' email, name, bio, photoURL visible to all users
}
```
This exposes email addresses, names, bios and photo URLs of every registered user to every other authenticated user, exceeding data minimisation requirements.

**Required actions:**
- Tighten project rules so `visibility == 'private'` or `status == 'draft'` documents require ownership/org membership to read
- Scope user profile reads to only the fields needed for display (name, photoURL) — not email:
  ```
  allow read: if isSignedIn() && (
    request.auth.uid == userId ||
    // allow read of non-sensitive fields only via field mask
  );
  ```

---

### 6. Right to Erasure / Account Deletion (Article 17)

**Status:** 🔴 Not implemented  
**File:** `app/settings/page.tsx`

The privacy policy promises data deletion within 30 days on request. However, the settings page contains **no `deleteUser()`, `deleteDoc()`, or account deletion flow**. Users have no self-service way to delete their account.

**Required action — implement account deletion flow in Settings:**
1. Re-authenticate the user (Firebase requires this before `deleteUser()`)
2. Delete or anonymise Firestore docs: `users/{uid}`, `individuals/` records owned by the user
3. Remove the user from org `team` arrays
4. Delete their Firebase Auth account via `deleteUser()`
5. Send a confirmation email
6. Redirect to the home page

---

### 7. Data Portability (Article 20)

**Status:** ❌ Missing  
The privacy policy mentions the right to data portability but there is **no "Export my data" feature** anywhere in the platform.

**Required action:** Add a "Download my data" button in the user profile/settings that exports the user's Firestore documents (user profile, owned organisations, projects, individual profiles) as a JSON file.

---

### 8. Privacy Policy Gaps

**File:** `app/privacy/page.tsx`

| Item | Status | Required Action |
|------|--------|-----------------|
| Legal basis per processing activity | 🔴 Missing | Add Article 6 ground for each purpose (see Section 1 above) |
| OpenAI / AI processors | 🔴 Missing | Add disclosure of OpenAI as a data processor with US transfer mechanism |
| International transfers mechanism | 🔴 Incomplete | Firebase (London) covered; OpenAI (USA) not covered |
| Legal entity / registered address | ❌ Missing | Add company name, registration number, registered address |
| Right to complain to ICO | ❌ Missing | Add: "You have the right to lodge a complaint with the Information Commissioner's Office (ICO), ico.org.uk" |
| Data breach notification (Art. 33) | ❌ Missing | Add statement that breaches will be reported to the ICO within 72 hours and affected users notified without undue delay |
| Automated decision-making (Art. 22) | ❌ Missing | AI features make content suggestions — if any automated decisions have legal or significant effect, disclosure is required |
| DPO / representative | ⚠️ Consider | No DPO named. If processing EU data at scale or special category data, a DPO may be required |
| Policy change notification | ⚠️ Weak | Currently "check back here" — active notification by email is better practice |

---

### 9. Third-Party Processors (Article 28)

A Data Processing Agreement (DPA) must be in place with every processor.

| Processor | Location | DPA Status | Action Required |
|-----------|----------|------------|-----------------|
| Google Firebase (Auth, Firestore, Storage, Analytics) | europe-west2 (London) | Available — confirm signed via Firebase Console → Project Settings → Legal | Verify DPA is accepted |
| OpenAI | USA | **Not signed / not referenced** | Sign DPA, document transfer mechanism (SCCs + UK Addendum), add to Privacy Policy |
| Krystal Hosting Ltd (SMTP / email) | UK — 124 City Road, London EC1V 2NX (Co. No. 07571790) | DPA published at krystal.io/legal/data-processing-agreement | Accept DPA in Krystal client portal; no international transfer |

---

### 10. Contact Form — Minor Issues

**Status:** ✅ Good (mostly)  
**File:** `app/api/contact/route.ts`

Contact data is forwarded by email and not stored in Firestore — no database retention risk. Minor issues:

- No stated retention period for emails received (should be in the Privacy Policy)
- Emails forwarded to a second recipient address (`cjsconsultingservices.com`) — this should be disclosed in the Privacy Policy as internal forwarding

---

### 11. Partner Data — Third-Party Individuals

**Status:** ⚠️ Minor gap

Partner records stored in project documents include `name`, `email`, `uid`, and `pledgeAmount` of individuals who partner a project. These people receive no specific privacy notice at the point of becoming a partner beyond the general platform policy.

**Required action:** Add a brief privacy notice at the point the "Become a Partner" modal submits: *"Your name, organisation (if applicable), and contact details will be stored by the project owner in connection with this partnership. See our [Privacy Policy]."*

---

## Resolution Checklist

- [x] **P1** — Move OpenAI API calls server-side; remove `NEXT_PUBLIC_OPENAI_API_KEY` ✅ 18 Mar 2026
- [x] **P1** — Add scrollable consent stages for Privacy Policy, Terms, and AI Policy at registration ✅ 18 Mar 2026
- [x] **P1** — Create AI Use Policy page (`/ai-policy`) ✅ 18 Mar 2026
- [x] **P1** — User activity / consent log (`users/{uid}/activityLog` Firestore sub-collection) ✅ 18 Mar 2026
- [x] **P1** — AI consent toggle in Settings with real-time effect via `AIConsentProvider` ✅ 18 Mar 2026
- [x] **P1 (Safeguarding)** — Mandatory AI content moderation pipeline on all profile publishes ✅ 18 Mar 2026
  - `app/api/moderate/route.ts` — two-pass OpenAI Moderation API + GPT safeguarding check
  - `src/lib/moderation.ts` — client helper, queue submission, approval/rejection helpers
  - `app/admin/review/page.tsx` — SuperAdmin review queue at `/admin/review`
  - Hooked into: project go-live toggle, project AI creation, individual AI creation
  - Flagged profiles set to `status:'pending_review'`; staff must approve before going live
  - Users shown non-alarming "under review" message with no details of what was flagged
  - Firestore security rules: `moderationQueue/` — users can create, only SuperAdmin can read/update
- [x] **P1** — `NEXT_PUBLIC_OPENAI_API_KEY` → `OPENAI_API_KEY` confirmed in `.env.local` ✅ 18 Mar 2026
- [x] **P1** — OpenAI disclosed in Privacy Policy (Section 4) with SCCs/IDTA transfer mechanism; international transfers section added ✅ 18 Mar 2026
  - ⚠️ **Manual action still required**: Sign OpenAI DPA at openai.com/policies/data-processing-addendum and confirm in deployment env vars
- [x] **P1** — Account deletion implemented in Settings (org-aware multi-step flow) ✅ 18 Mar 2026
  - `analyzeDeletion()` runs before any confirmation: queries individuals, owned orgs, and scans team membership across all orgs
  - Solo-owned orgs (no other members): org + all linked projects deleted
  - Orgs with other members: user is **blocked** from deleting until they transfer admin role or all other members leave — UI shows named orgs and instructions
  - Orgs where user is a member only: user silently removed from `team` array (org not deleted)
  - Re-authenticates email/password users; soft-guidance for OAuth users
  - Multi-step modal: `analyzing → blocked | confirm → deleting`; confirm screen shows full impact summary
  - Logs `account_deleted` event to activity log before deletion
  - Deletes: individuals, solo-org projects, solo orgs, user doc; then calls `deleteUser()`
- [x] **P1** — Article 6 lawful basis table added to Privacy Policy (Section 3a) ✅ 18 Mar 2026
- [x] **P2** — ICO complaint right added to Privacy Policy (Section 8) ✅ 18 Mar 2026
- [x] **P2** — Data breach notification commitment added to Privacy Policy (Section 5) ✅ 18 Mar 2026
- [x] **P2** — Replace cookie banner with Accept/Decline choice; gate analytics on consent ✅ 18 Mar 2026
  - `CookieBanner` in `app/layout.tsx` replaced: opt-out "close" button → explicit **Accept analytics / Decline analytics** choice
  - Storage key `c2s_cookie_consent`: value is now `"accepted"` or `"declined"` (previously just `"true"`)
  - Firebase Analytics deferred import fires **only** after acceptance; no analytics code loads on decline or before decision
  - `isCookieConsentGranted()` helper exported from `app/layout.tsx` for use anywhere analytics is guarded
  - Banner hidden once a decision is stored; does not re-appear on page reload
- [x] **P2** — Tighten Firestore rules for private/draft projects and user profiles ✅ 18 Mar 2026
  - `projects/{projectId}`: `allow read: if true` replaced with visibility+status gate; unauthenticated and non-creator users can only read `visibility == 'public' && status != 'draft'` docs
  - `projects/{projectId}` write: `allow write: if isSignedIn()` replaced with `create: isSignedIn()` + `update/delete: creator || SuperAdmin` — prevents cross-user project edits
  - `projects/{projectId}/{rest=**}` sub-collections: authenticated-only (was unrestricted)
  - `users/{userId}`: restricted `allow read` to own doc or SuperAdmin (`isSignedIn()` → `uid == userId || isSuperAdmin()`); added `allow delete` (required for Art. 17 erasure flow)
  - `users/{userId}/activityLog/{logId}`: added owner-only read/create + immutable (no update/delete) — was entirely unruled
  - Known limitation: org team members who are not the project creator cannot read/write private org projects via rules alone; requires storing org Firestore doc ID on project doc to enable `get()`-based membership check
- [x] **P3** — Implement data export / portability feature ✅ 18 Mar 2026
  - `exportData()` in `app/settings/page.tsx` — collects: user doc, individual profiles, owned orgs, created projects, activityLog sub-collection
  - Triggers a browser download of a timestamped JSON file
  - "Your Data" section added above Danger Zone in Settings UI
  - Firestore `activityLog` sub-collection readable by owner (secured in rules update earlier this session)
- [x] **P3** — Add legal entity name and registered address to Privacy Policy ✅ 18 Mar 2026
  - Data controller box added to Privacy Policy Section 1: Christopher Scutt t/a Close2Source, 87 Little Breach, Chichester, West Sussex PO19 5TZ
  - Noted as unregistered sole trader
- [ ] **P3** — Confirm/sign Google Firebase DPA in project settings
- [x] **P3** — Identify and document SMTP provider; obtain DPA ✅ 18 Mar 2026
  - Provider identified: **Krystal Hosting Ltd** (UK) — MX records `mx1/mx2.krystal.uk`; IP 77.72.2.94
  - UK-registered (Co. No. 07571790), 124 City Road, London EC1V 2NX — no international transfer
  - ISO 27001 certified
  - DPA published at krystal.io/legal/data-processing-agreement — **manual action: accept in Krystal client portal**
  - Krystal added as a disclosed processor in Privacy Policy Section 4
- [x] **P3** — Add privacy notice to "Become a Partner" modal submission ✅ 18 Mar 2026
  - Notice added above Submit button in `components/BecomePartnerModal.tsx`: names storage by project owner, visibility to project team, and links to Privacy Policy

---

*This document should be reviewed by a qualified data protection solicitor before the platform reaches significant user scale or processes data of EU/UK residents commercially.*
