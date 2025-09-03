
# close2source

close2source is a modern web platform (Next.js App Router + Firebase + Tailwind CSS) connecting supporters directly with impactful African farming & community projects and individual stories. It emphasises transparency (live updates, finance breakdowns, receipts) and direct engagement (reactions, comments, tagging). As of September 2025 a unified content model (`profilePosts`) powers consolidated feeds (Updates, Prayer Requests, Funding Needs) with improved media presentation and performance.



## Current Features

Core Platform & Layout
- **Unified PageShell Layout**: Consistent full‑height container (max-width 1200px) with header search & contextual action slot.
- **Responsive Branded UI**: Tailwind design system; adaptive cards & tiles for Individuals & Projects.
- **Authentication & Roles**: Firebase Auth (custom claims planned) with creator‑only settings gates.

Profiles & Projects
- **Individuals & Projects**: Creation & viewing at `/i` and `/projects` with tabbed dashboards (Overview, Updates, Finance, Settings, plus Individual-specific tabs: About, Prayer, Funding/Finance, Settings).
- **Inline Location Editing**: Country, town, GPS coordinates with geocode fallback (Nominatim) and clear state messaging.
- **Adaptive Map Preview**: Exact vs approximate markers with transparency about precision.

Unified Content Model (September 2025)
- **Single `profilePosts` Array**: Consolidates legacy `updates`, `prayerRequests`, `fundingNeeds` (and prior `feed`) into typed entries: `{ id, type: 'update'|'prayer'|'funding', showInUpdatesFeed, title, text/body, images[], createdAt, author, ...typeSpecific }`.
- **Automatic Migration**: On first load of a legacy profile the client derives `profilePosts` and deletes obsolete arrays to prevent divergence.
- **Per-Post Feed Visibility**: `showInUpdatesFeed` flag controls inclusion in the Updates view (prayer & funding default off unless intentionally cross‑posted; updates default on).
- **Type Highlighting**: Distinct visual badges / colored borders for `prayer` and `funding` types in the Updates feed.

Media & UX Enhancements
- **Multi-Image Collage Layouts**: Deterministic responsive patterns for 1–5 images and a 6+ overlay grid with count badge.
- **Lightbox Viewer**: Click-to-expand with navigation across all images in a post.
- **Lazy Loading with Caching**: IntersectionObserver-based image loader prevents duplicate downloads (in-memory URL cache + early bailouts for already loaded assets).
- **Shimmer & Spinner Placeholders**: Replaces blank/black boxes while images stream; improves perceived performance.
- **Optimized Delivery**: `next/image` with remote Firebase Storage patterns for sizing & format optimization.

Engagement & Interaction
- **Reactions**: Per-user reaction arrays (🙏 / ❤️) stored as user IDs with derived counts to mitigate race conditions (transactional updates).
- **Comments / Responses**: Contextual comment threads (prayer moderation states: open / freeze / off).
- **Tagging**: Chip-based tag input with dedupe & normalization.

Finance & Transparency
- **Project Finance Tracking**: Income/expense transactions, categories, vendor/company, receipts (images/PDFs) with aggregated summary snapshot.
- **Currency Selection**: Per-project fixed currency (symbol display; no conversion yet).
- **Receipt Uploads**: Multi-file uploads with stored metadata.
- **Visual Breakdown**: Pure CSS `conic-gradient` expense chart + dynamic legend & thresholded labels.

AI & Credits (Scaffold)
- **AI Text Improvement (Demo)**: Mock credit deduction & optimistic updates; pluggable service.
- **Credits Ledger**: Transaction logging + balance display (extensible for future pricing models).

Reliability & Safety
- **Optimistic / Transactional Writes**: Firestore transactions for concurrent-safe reactions & edits.
- **Deletion Safeguards**: Explicit confirmation flows for destructive project actions.
- **Data Normalization**: Legacy arrays removed post-migration to avoid drift.

Developer Foundations
- **Utility Modules**: Centralized `src/lib` for Firebase, AI placeholder, credits.
- **Extensible Styling**: Tailwind config supporting brand palette & component patterns.
- **Version Control Hygiene**: Ignoring build artifacts, logs, editor settings.



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

Architecture & Data Flow
- **Profile / Project Pages**: Orchestrate distinct state slices (description, posts, reactions, location, finance, receipts) while preserving React hook ordering (no conditional hook calls).
- **Unified Posts Assembly**: Rebuild helpers ensure any CRUD operation on prayer / funding / update items produces a consistent `profilePosts` array before persistence.
- **Migration Strategy**: Lazy (on-demand) migration avoids mass write operations; after success, legacy fields are removed to guarantee canonical single source.

Data Modeling
- **`profilePosts` Shape** (baseline):
	```ts
	interface ProfilePostBase { id: string; type: 'update'|'prayer'|'funding'; showInUpdatesFeed: boolean; title?: string; text?: string; images?: string[]; createdAt: number; authorId: string; }
	// Type-specific extensions (examples)
	interface PrayerPost extends ProfilePostBase { type: 'prayer'; commentStatus: 'on'|'freeze'|'off'; reactions?: { pray?: number; love?: number }; reactionUsers?: { pray?: string[]; love?: string[] }; }
	interface FundingPost extends ProfilePostBase { type: 'funding'; amountNeeded?: number; progress?: number; }
	interface UpdatePost extends ProfilePostBase { type: 'update'; tags?: string[]; attachments?: { name: string; url: string; size: number; type: string }[]; }
	```

Performance & Media
- **IntersectionObserver Lazy Loading**: Defers image loading until near viewport; observer disconnects early to reduce overhead.
- **In-Memory Image Cache**: Simple Set keyed by URL to skip placeholder cycle for previously loaded images.
- **Shimmer Placeholder**: Animated gradient skeleton + spinner overlay for better perceived performance.
- **`next/image` Integration**: Remote patterns configured for Firebase Storage; ensures automatic format & size optimization.

UX & Interaction
- **Feed Visibility Toggle**: Exposed in prayer (and can extend to funding) edit forms; ensures intentional prominence in Updates feed.
- **Lightbox**: Centralized overlay using stateful index & ESC handling (future: swipe support on touch devices).

Finance & Transparency
- **Aggregation**: Creator recalculations persist a summary snapshot enabling public lightweight reads without exposing raw transaction documents.
- **Receipts**: Stored under predictable path with metadata enabling future validation or OCR expansion.

Resilience
- **Transactional Writes**: Firestore transactions for reaction increments avoid lost updates.
- **Legacy Field Pruning**: Ensures no divergence between old & new representations post-migration.



## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a Firebase project (enable Auth, Firestore, Storage) & update `src/lib/firebase.ts` with config
4. (Optional) Replace mock AI logic in `src/lib/ai.ts` with a real endpoint
5. (Optional) Add custom claims (SuperAdmin) for pricing config & future admin UIs
6. Run locally: `npm run dev`
7. Open a project page and set currency in Settings before adding finance transactions (so historical context is consistent for viewers)



## Roadmap / Pending Work

Recently Completed (Sept 2025)
- Unified `profilePosts` model & migration cleanup
- Multi-image collage layouts & lightbox
- Lazy loading with shimmer placeholder & caching
- Type highlighting & per-post feed visibility flag

Short Term
- Add feed visibility toggle for funding & update types (parity with prayer)
- Receipt thumbnail previews (blur-up / optimized size)
- Geocode result caching & rate limiting
- Accessibility audit (ARIA roles, focus management in lightbox, color contrast)
- Prayer & funding edit modals refactor (shared form components) 
- Blur / dominant-color image placeholder extraction

Medium Term
- Credit transaction history UI & pagination
- Real-time finance transaction listener (creator) + summary listener (public)
- Notifications system (new post, reaction, comment, prayer answer)
- Role management console (Admin / SuperAdmin claims management)
- Automated test harness (unit + component + Firestore emulators) & CI

Long Term
- Currency conversion / FX rate caching
- Recurring support / subscription flows
- Analytics dashboards (engagement & finance trends)
- Localization & multi-language i18n pipeline
- Offline-first caching of recent posts & static assets
- Unified reactions & comments schema across post types

## Contributing

PRs and suggestions welcome. Please open an issue to discuss substantial changes first.

---


**close2source** — Empowering direct support for impactful projects and individuals.

---
_This README reflects the state as of September 2025 (unified `profilePosts`, multi-image collage + lightbox, lazy loading w/ shimmer placeholders, per-post feed visibility, ongoing finance & transparency features)._ 
