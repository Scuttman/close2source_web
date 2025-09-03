# close2source

Modern Next.js (App Router) + Firebase platform connecting supporters directly with African farming & community projects and individual change‑makers. Focus: transparency (finance, receipts, updates) + engagement (reactions, comments, tagging).

### Stack
Next.js 14 (App Router) · TypeScript · Tailwind CSS · Firebase (Auth, Firestore, Storage) · `next/image`.

---
## Feature Overview
Core
* PageShell layout & responsive design system
* Firebase Auth (ownership gates editing, role-driven visibility)

Individuals & Projects
* Creation & browsing (`/i`, `/projects`)
* Tabbed pages (Overview, Plan, Updates, Finance, Team, Settings; Individuals add About & Prayer)
* Location editing + map preview

Project Planning
* Structured Plan (Vision · Strategy · Focus Statement)
* Focus Areas (deadline or ongoing, description, cost aggregation)
* Tasks (start/end dates, status, multi‑assignees, resource list)
* Resources (qty, unit cost, auto total, currency tagging, per‑task & per‑area rollups + plan total)
* Multi‑assignee modal picker (grid of team members, bulk select, avatars, roles)
* Automatic legacy migrations (single owner → assignees[], orphaned area resources → synthetic “General” task)

Team Management
* Owner auto‑added (protected from omission)
* Add members by email (platform user) or external contributor (offline) with role labels
* Inline edit (external: name + role; user: role; profile edits route to /profile with return redirect)
* Live profile enrichment (first + surname & avatar fetched from `users` collection)
* Engagement metrics (updates, comments, reactions, weighted score)

Updates & Media
* Inline composer (no modal) with multi‑image upload & progress
* Client image resize (≤500px width) & collage layouts (1–5, 6+ overlay)
* Optional slideshow (controls, pause, keyboard, magnifier → lightbox)
* Lightbox (portal, keyboard nav, thumbnails)
* Tag chips + sidebar filter, URL sanitization
* Lazy loading shimmer & broken URL skip

Engagement
* Reactions (like / love / pray) with per‑reaction user arrays
* Nested comments: reply, edit, delete (author gated)

Finance (initial)
* Transactions + breakdown & spending components
* Receipt / document uploads (future: cleanup parity for project deletions)

Permissions & Roles
* Unified `accessSettings` per tab: view/edit arrays for roles (public, supporter, representative, owner)
* Dynamic tab rendering (hidden tabs not in allowed view set)
* Role resolution via creator, representatives list, supporters list
* Coupled rule enforcement: adding edit ⇒ ensures view, removing view ⇒ strips edit, removing edit keeps view

Assignment UX
* Modal-based multi‑select (avatars, roles, counts)
* Pills show canonical name & avatar (platform users) or fallback initial

Reliability & Data Hygiene
* Recursive undefined stripping before Firestore writes (plan, team)
* Normalization utilities & ID migrations
* Firestore transactions for mutable engagement (reactions/comments)
* Stored image path references for future deletion integrity

---
## Data Model (High Level)
```
Project.plan = {
	vision, strategy, focusStatement,
	focusAreas: [{ id, title, description, deadline, ongoing, tasks: [
		{ id, title, startDate, endDate, status, assignees:[memberId], resources:[
			{ id, name, qty, unitCost, cost (derived), currency, url?, note? }
		] }
	] }]
}
Project.team = [{ id, type:'user'|'external', name, email?, role?, photoURL? }]
accessSettings = { tabId: { view:[roles], edit:[roles] } }
```

## Structure
* `/app` – routes (App Router)
* `/components` – UI & tab components
* `/public` – static assets
* `/src/lib` – Firebase init & helpers
* Config: `tailwind.config.ts`, `next.config.ts`, `firestore.rules`, `storage.rules`

---
## Dev Notes
Images
* Client resize before upload (500px width) reduces bandwidth
* Firebase Storage URLs served via `next/image` (domain allow‑listed)

Slideshow
* Opacity cross‑fade; eager first slide to avoid blank load race

Tags
* Lowercased, deduped, chip UI; sidebar builds tag filter set

Plan & Team
* Cost totals derived at render (no duplication)
* Owner cannot be silently removed (auto re-insert if missing)
* Profile enrichment fetches only missing users (cached in memory map)

Permissions
* View gating occurs before tab mount to prevent accidental flicker display
* Edit toggle (global) only effective if role included in tab edit array

Deletion
* Individual post deletion cleans Storage via saved paths
* Project post deletion storage cleanup pending

---
## Setup
1. `npm install`
2. Firebase project (Auth, Firestore, Storage) & populate config in `src/lib/firebase.ts`
3. `npm run dev`
4. Visit `http://localhost:3000`

Optional: `.env.local` for future secrets.

---
## Roadmap
Short
* Project update deletion → storage cleanup parity
* Assignee modal: search & role filter
* Lightbox accessibility (focus trap, ARIA labels)
* Finance summaries & export

Mid
* Receipt thumbnail / blur placeholders
* Notifications (comment / reaction) + email/web push
* Admin role management (custom claims)
* Caching: profile & plan hydration (SWR / React cache layer)
* Testing harness (Firestore emulator, Vitest/RTL)

Future
* Currency conversion service
* Offline caching / PWA shell
* Localization (i18n)
* Advanced analytics dashboard

---
## Contributing
Issues & PRs welcome (describe context; keep changes scoped).

License: TBD (internal).

README updated Sept 2025 (planning, team, permissions, multi‑assignee modal).
