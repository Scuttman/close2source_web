
# close2source

close2source is a modern web platform (Next.js App Router + Firebase + Tailwind CSS) connecting supporters directly with impactful African farming & community projects and individual stories. It emphasises transparency (live updates, finance breakdowns, receipts) and direct engagement (reactions, comments, tagging).



## Current Features

- **Unified PageShell Layout**: Consistent full‑height container (max-width 1200px) with header search & action slot (e.g. New Project / Add Profile buttons).
- **Responsive Branded UI**: Tailwind design; compact portrait tiles for Individuals & Projects; flexible, scroll-safe layout.
- **Authentication & Roles**: Firebase Auth + (planned) custom claims; creator‑only settings for each project.
- **Profiles & Projects**: Create / view Individuals (`/i`) & Projects (`/projects`). Project detail uses tabbed dashboard (Overview, Updates, Finance, Settings*creator only*).
- **Inline Location Editing**: Add / update country, town, and optional GPS coords post‑creation. Automatic geocode fallback (Nominatim) to show approximate map when only textual location is provided.
- **Adaptive Map Preview**: Exact pin when GPS provided; centroid or geocoded approximation otherwise; transparent messaging when location incomplete.
- **Updates Feed**: Rich project updates with title, body, images (first displayed), document attachments, tag chips, search & tag filtering, comments, edit-in-place, and per‑user reactions (🙏 / ❤️) using user ID arrays for accurate counts.
- **Tag Chips Input**: Natural tag entry (Enter / comma) with removable chips & duplicate prevention.
- **AI Description Improvement**: One-click improvement (demo) deducting credits (mock pricing currently -2 credits) with optimistic UI & error handling.
- **Credits System (Scaffold)**: Balance display & transaction logger; hooks ready for broader deduction flows.
- **Finance Tracking**: Per‑project finance tab (creator only) with:
	- Transaction subcollection (`financeTransactions`): type (income/expense), category, amount, note, company/vendor, receipts[] (files), transactionDate (date only), timestamps.
	- Receipt Uploads: Multiple images / PDFs stored under `projects/{id}/receipts/*`.
	- Company / Vendor Field & Optional Note.
	- Currency Selection: Project-level currency (Settings) stored as `currency`; symbol-prefixed formatting (no FX conversion).
	- Aggregated Summary: income total, expense total, balance, per-category income/expense/net persisted to `project.financeSummary` for public viewing.
	- Expense-Only Pie Chart: CSS `conic-gradient` visual plus legend with formatted values & inline % labels (hidden for tiny slices for clarity).
	- Expense Categories Count: Only categories with >0 expense included.
- **Optimistic & Transactional Updates**: Firestore `runTransaction` for reactions & update edits to avoid race conditions.
- **Document Attachments**: Updates can attach arbitrary files (displayed with file type badge & size).
- **Deletion Safeguards**: Project delete gated behind explicit text confirmation in Settings.
- **Extensibility Hooks**: Utility modules in `src/lib` (AI, credits, firebase) for future service substitution.
- **Version Controlled**: Git & GitHub workflow (main branch) with expanding .gitignore (.next, logs, coverage, editor files).



## Project Structure

- `/app` — Next.js App Router pages (projects, individuals, auth, finance-enabled project detail, registration flows)
- `/app/projects/[id]/page.tsx` — Comprehensive project dashboard (overview, updates feed, finance, settings)
- `/components` — UI components (NavBar, PageShell, UserHero, MapPreview, CreateProjectUpdateModal, etc.)
- `/public` — Static assets & images
- `/src/lib` — Utilities (Firebase init, AI improvement mock, credits logger)
- `firestore.rules`, `storage.rules` — Firestore & Storage security (needs tightening for fine-grained finance / receipts access)
- `tailwind.config.ts` — Tailwind configuration
- `next.config.ts` — Next.js configuration (image domains)



## Key Implementation Notes

- **Project Page Architecture**: Single file orchestrates state slices (description, updates, reactions, location editor, finance transactions, receipts, currency). Early returns placed strictly after hook declarations to avoid React hook order violations.
- **Finance Aggregation**: Creator view recalculates summary client-side and persists to the project doc; non-creators read the persisted snapshot only (privacy for transaction-level data).
- **Reactions Data Model**: `update.reactionUsers.{pray|love}` arrays of user IDs; numeric `update.reactions.{pray|love}` maintained for backward compatibility / quick counts.
- **Tags Normalisation**: Lowercased & de-duplicated before persistence.
- **Currency Handling**: Display-only; amounts stored as raw numbers. A simple symbol map (USD/EUR/GBP/ZAR/...) with graceful fallback to code.
- **Pie Chart**: Pure CSS `conic-gradient`; inline percentage labels positioned via mid-angle (hidden for <6% slices to reduce clutter).
- **Geocoding Fallback**: Client-side OpenStreetMap Nominatim fetch only when static list lacks country; approximate zoom determined by presence of town.
- **Receipts Upload**: Sequential `uploadBytes` + `getDownloadURL`; stored metadata includes name, size, type.
- **AI Improve Flow**: Deducts credits via `logCreditTransaction` and updates user doc, with insufficient credit guard.
- **Performance Considerations**: Finance aggregation and pie segments derived with `useMemo`; selective rendering of labels.



## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a Firebase project (enable Auth, Firestore, Storage) & update `src/lib/firebase.ts` with config
4. (Optional) Replace mock AI logic in `src/lib/ai.ts` with a real endpoint
5. (Optional) Add custom claims (SuperAdmin) for pricing config & future admin UIs
6. Run locally: `npm run dev`
7. Open a project page and set currency in Settings before adding finance transactions (so historical context is consistent for viewers)



## Roadmap / Pending Work

Short Term:
- Transaction editing & deletion + receipt removal
- Receipt preview thumbnails & image optimization
- Tighten Firestore security (restrict finance transactions & receipts to project creator)
- Geocode result caching (avoid repeated Nominatim calls)
- Accessibility: ARIA description + color contrast checks for pie chart & reaction buttons
- Multi-image update upload & progress indicator
- Dynamic pricing deductions (replace hard-coded AI improvement credit cost)

Medium Term:
- Credit transaction history UI & pagination
- Real-time listeners for finance summary (others) & transactions (creator) instead of manual refresh
- Notifications (new update, reaction, comment) per user
- Role management console (assign Admin / SuperAdmin)
- Basic automated tests (unit + integration) & CI workflow

Long Term:
- Currency conversion / multi-currency aggregation
- Subscription / recurring support model
- Analytics dashboard (donor engagement, finance trends)
- Localization & multi-language support
- Offline-friendly caching of static assets & recent updates

## Contributing

PRs and suggestions welcome. Please open an issue to discuss substantial changes first.

---


**close2source** — Empowering direct support for impactful projects and individuals.

---
_This README reflects the state as of August 2025 (finance, currency selection, receipts, inline location editing, reactions, attachments, improved tagging)._ 
