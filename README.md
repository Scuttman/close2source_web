
# close2source

close2source is a modern web platform (Next.js App Router + Firebase + Tailwind CSS) connecting supporters directly with impactful African farming & community projects and individual stories.



## Current Features

- **Unified PageShell Layout**: Consistent semi‑transparent container (max-width 1200px) with a black header bar; optional header search and action slot (e.g. New Project / Add Profile buttons).
- **Responsive Branded UI**: Tailwind-based design with focus on clarity and speed; compact portrait tiles for Individuals & Projects with left-aligned wrapping.
- **Auth & Roles**: Firebase Auth with custom claims; SuperAdmin gating for platform configuration (pricing). Sign‑out now redirects home with spinner feedback.
- **User / Individual / Project Profiles**: Create, browse, and manage entities; individual profiles accessible via `/i?id=CODE`.
- **Searchable Listings**: Header search integrated into Individuals and Projects pages (replaces legacy in‑page inputs).
- **Configurable Credits Pricing**: SuperAdmin can set action costs (create individual / fundraising / project profile, improve post) in Firestore doc `config/pricing` via Settings page UI.
- **Credits System (Base)**: Real-time balance display (UserHero) and deduction scaffolding (dynamic application in creation flows pending—see Roadmap).
- **AI Description Improvement (Prototype)**: Mock AI enhancer (`src/lib/ai.ts`) for project descriptions; to be tied to configurable pricing.
- **Real-Time Firestore Streams**: Live updates for listings and user credit changes.
- **Secure Firestore & Storage Rules**: Role helpers (`isSignedIn`, `isOwner`, `isAdmin`, `isSuperAdmin`) and SuperAdmin-only writes for config; storage paths segmented (profile pics, projects, individuals/updates).
- **Action Buttons in Headers**: New Project and Add Profile buttons use PageShell headerRight slot for consistent placement.
- **Version Controlled**: Git & GitHub workflow active.



## Project Structure

- `/app` — Next.js app directory (pages, registration, project & individual profiles, credits, etc.)
- `/components` — Reusable UI components (NavBar, UserHero)
- `/public` — Static assets and images
- `/src/lib` — Firebase configuration and utilities
- `firestore.rules`, `storage.rules` — Security rules for Firestore and Storage
- `tailwind.config.ts` — Tailwind CSS configuration
- `next.config.ts` — Next.js configuration (image domains)



## Key Implementation Notes

- **PageShell API**: Props include `title`, `searchEnabled`, `searchValue`, `onSearchChange`, `searchPlaceholder`, and `headerRight` (for contextual buttons).
- **Listings**: Individuals & Projects now share a compact, portrait tile pattern (Tailwind widths `w-24/28/32` for individuals; `w-40/44/48` for projects) with `flex-wrap` left alignment (minimal horizontal gaps).
- **Pricing Config**: Stored at `config/pricing` (fields: `costCreateIndividualProfile`, `costCreateFundraisingProfile`, `costCreateProjectProfile`, `costImprovePost`, `updatedAt`). Only SuperAdmin can write.
- **Security Rules**: `firestore.rules` enforces SuperAdmin for `/config/*` writes; owner/admin protections for individuals; open read of listings.
- **Sign-Out UX**: Spinner state + redirect to home after `signOut()` in `UserHero`.
- **Search Consolidation**: Old per-page input bars removed where header search is enabled (Individuals, Projects).
- **Extensibility**: Header action slot allows future page-level commands without layout divergence.



## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a Firebase project (Auth, Firestore, Storage) & update `src/lib/firebase.ts`
4. (Optional) Replace mock AI logic in `src/lib/ai.ts` with a real endpoint
5. (Optional) Set a SuperAdmin custom claim for your admin user (via Firebase Admin SDK script or Cloud Function) so you can edit pricing
6. Run locally: `npm run dev`



## Roadmap / Pending Work

Short Term:
- Apply dynamic pricing deductions (replace any remaining hard-coded credit costs) using `config/pricing` values
- Multi-image upload & progress for posts (currently single-image placeholder in `CreatePostModal`)
- Reactions (pray / love) with atomic increments in Firestore
- Improve Post (AI) flow integration with pricing + credit deduction & insufficient credit handling
- Role management utility / UI for assigning SuperAdmin or admin roles

Medium Term:
- Credit transaction ledger & history UI
- Notification system for updates & reactions
- Accessibility & keyboard navigation enhancements
- Basic automated test suite (unit + integration)

Long Term:
- Subscription / recurring support model
- Analytics dashboard for project owners
- Localization & multi-language support

## Contributing

PRs and suggestions welcome. Please open an issue to discuss substantial changes first.

---


**close2source** — Empowering direct support for impactful projects and individuals.
