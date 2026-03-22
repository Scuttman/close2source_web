# close2source

Next.js 15 (App Router) + Firebase platform connecting partners directly with community projects and individual change-makers. Focus: transparency (finance, receipts, live updates) + engagement (reactions, comments) + responsible AI tools - all built to UK GDPR standard.

### Stack
Next.js 15 (App Router) - TypeScript - Tailwind CSS - Firebase (Auth, Firestore, Storage) - Server-side AI (OpenAI) - `next/image`

---

## Architecture

### Data Abstraction Layer (DAL)
All Firestore access is routed through `src/lib/dal/` - no direct `firebase/firestore` imports exist in app pages or components.

```
src/lib/dal/
  index.ts          - single re-export entry point
  types.ts          - shared TypeScript interfaces for all Firestore documents
  cache.ts          - two-tier cache (in-memory Map + sessionStorage), TTL-based
  users.ts          - user doc reads/writes/subscriptions
  organizations.ts  - org reads/writes/subscriptions
  projects.ts       - project reads/writes/subscriptions + paginated public listing
  individuals.ts    - individual profile reads/writes/subscriptions
  config.ts         - pricing config, invite management, pending moderation reads
  fieldValues.ts    - wrappers for arrayUnion/Remove, deleteField, serverTimestamp
  transactions.ts   - domain-specific atomic operations (createProject, deleteAccount, joinOrg, etc.)
```

**Cache behaviour:**
- `get*` one-off reads check memory then sessionStorage before hitting Firestore (TTLs: user 1 min, docs 2 min, code lookups 5 min, config 10 min)
- `subscribe*` real-time listeners always open a fresh connection, but each snapshot populates the cache so concurrent `get*` calls don't double-read
- sessionStorage cache survives React re-renders and soft navigations within a browser tab; cleared on tab close

**Firestore cost discipline:**
- All listeners and queries are scoped by user UID, org ID, or document ID - no full collection scans on normal user flows
- The only `getAllOrgs()` full scan is inside the account deletion analysis path (runs at most once per user lifetime)
- No startup migration loops or unrendered dead listeners

---

## Feature Overview

### Core
- PageShell layout + responsive design system
- Firebase Auth with ownership gates and role-driven tab visibility
- Credits system - purchase, consume, and track AI feature usage
- QR codes and short-code deep links (`?id=CODE`) for projects, orgs, and individuals

### Organizations
- Create, edit, and manage organizations with logo, cover image, locations, and safeguarding documents
- Tabbed org pages: Overview, Projects, Updates, Team, Partners, Locations, Finance, Compliance, Settings
- Team management: invite by email (platform user or external), role labels, PIN-based joining
- Org invites with token-based accept flow (`/org/invite/[token]`)

### Projects
- AI-assisted registration (`/projects/register-ai`) and standard registration
- Full proposal editor: cover image, gallery, key documents, plan, finance, team, settings
- Tabbed project pages: Overview, Plan, Updates, Finance, Team, Partners, Settings
- Paginated public project listing (24 per page, cursor-based)

### Project Planning
- Structured plan: Vision, Strategy, Focus Statement
- Focus Areas (deadline or ongoing) => Tasks (dates, status, multi-assignees) => Resources (qty, unit cost, currency, rollups)
- Cost totals derived at render; plan total aggregated from all areas

### Updates & Media
- Inline update composer with multi-image upload and progress tracking
- Client-side image resize (500px max) before upload
- Collage layouts (1-5 images; 6+ with overlay count), optional slideshow, lightbox
- Tag chips + sidebar filter

### Individuals
- Individual profiles with About, Overview, Updates, Prayer, Finance, Settings tabs
- AI-assisted profile registration
- Claim flow (link an existing profile to your account)

### AI Features (server-side only)
- All AI calls are server-side (`/api/ai/`) - no OpenAI key exposed to the browser
- AI-assisted text generation for project and individual profile creation
- AI safety review (moderation) before profiles and projects go public
- User opt-in/opt-out consent tracked per user; consent gate on first use
- AI usage disclosed in `/ai-policy`

### PDF & Print Exports
- Professional A4 Prospectus: High-fidelity 3-page HTML-to-PDF print engine for project profiles.
- Automated Layout: Paragraph-aware content splitting (Page 1 summary split at 26 lines, Page 2 continuation).
- Visual Branding: Hero images (164px), brand typography (Inter), and custom sidebar layouts.
- Deep Linking: Integrated QR codes for both Projects (Page 1) and Organizations (Page 3).
- Print Safety: 1.5cm safety margins and widened sidebars for physical printing compatibility.

### Moderation
- All new org/project/individual submissions enter a `pending_review` state
- AI safety pre-screen runs via `/api/moderate/`
- Admin review queue at `/admin/review` for human oversight
- Moderation outcomes (approved/flagged/rejected) stored in `moderationQueue` collection

### Compliance & Privacy (UK GDPR)
- Cookie consent gate on first visit (`LegacyConsentGate` / `ConsentStage`)
- AI consent tracked separately from cookie consent; withdrawable at any time from Settings
- Full privacy policy at `/privacy` with lawful basis stated per processing activity
- Data export and account deletion from Settings - deletion uses an atomic DAL transaction that removes all owned data
- `LEGAL_COMPLIANCE.md` documents the compliance posture for internal reference

### Engagement
- Reactions (like / love / pray) with per-reaction user arrays
- Nested comments: reply, edit, delete (author-gated)

### Finance
- Finance transactions with breakdown and spending components
- Receipt / document uploads linked to transactions

### Permissions & Roles
- `accessSettings` per tab: `view` and `edit` arrays for roles (public, supporter, representative, owner)
- Coupled rule enforcement: adding edit ensures view; removing view strips edit
- View gating before tab mount (no flicker)

---

## Data Model (High Level)

```
Project {
  projectId, name, organizationId, createdBy, status, publicVisible,
  plan: {
    vision, strategy, focusStatement,
    focusAreas: [{ id, title, deadline, tasks: [
      { id, title, status, assignees, resources: [{ id, name, qty, unitCost, currency }] }
    ]}]
  },
  team: [{ id, type: 'user'|'external', name, email?, role? }],
  accessSettings: { tabId: { view: [roles], edit: [roles] } }
}

Organization { orgId, name, ownerUid, team, joinPin, locations, partners }
Individual   { individualId, name, ownerUid, bio, photoUrl }
User         { displayName, email, credits, aiConsent, cookieConsent }
```

---

## Structure

```
app/                - Next.js App Router pages
  admin/            - admin review queue
  ai-policy/        - public AI disclosure page
  api/ai/           - server-side AI endpoints (text generation)
  api/moderate/     - server-side AI safety pre-screen
  individuals/      - individual profiles + create + AI register
  org/              - org pages + create + invite accept
  projects/         - project pages + register + AI register
  profile/          - authenticated user dashboard
  settings/         - account, consent, deletion
components/         - shared UI + all tab components
src/lib/
  dal/              - Data Abstraction Layer (all Firestore access)
  firebase.ts       - Firebase app initialisation
  ai.ts             - server-side AI helpers
  credits.ts        - credit pricing logic
  moderation.ts     - moderation queue helpers
  userConsent.ts    - consent read/write helpers
  aiContext.tsx     - React context for AI consent state
LEGAL_COMPLIANCE.md - UK GDPR compliance reference
firestore.rules     - Firestore security rules
storage.rules       - Firebase Storage security rules
```

---

## Setup

1. `npm install`
2. Create a Firebase project (Auth, Firestore, Storage) and populate `src/lib/firebase.ts`
3. Add `OPENAI_API_KEY` to `.env.local` for AI features
4. `npm run dev`
5. Visit `http://localhost:3000`

---

## Roadmap

Short
- Project update deletion => Storage cleanup parity
- Lightbox accessibility (focus trap, ARIA labels)
- Finance summaries & export

Mid
- Notifications (comment / reaction) - email / web push
- Admin role management (custom claims)
- Testing harness (Firestore emulator, Vitest/RTL)

Future
- Currency conversion service
- Offline caching / PWA shell
- Localization (i18n)
- Advanced analytics dashboard

---

## Contributing
Issues & PRs welcome. Describe context and keep changes scoped.

License: TBD (internal).

README updated March 2026 - DAL architecture, AI features, moderation, compliance, Firestore cost optimisations.
