## close2source

Modern Next.js (App Router) + Firebase platform connecting supporters directly with African farming & community projects and individual change‑makers. Focus: transparency (finance, receipts, updates) + engagement (reactions, comments, tagging).

### Stack
Next.js 14 App Router, TypeScript, Tailwind CSS, Firebase (Auth, Firestore, Storage), `next/image`.

---
## Feature Overview
Core
* PageShell layout & responsive design system
* Auth via Firebase; edit/create gated by ownership

Individuals & Projects
* Creation & browsing (`/i`, `/projects`)
* Tabbed pages (Overview, Updates, Finance, Settings; Individuals also: About, Prayer)
* Location editing + map preview

Updates & Media
* Inline composer (individual + project) – replaces modal
* Multi‑image upload (client resize max width 500px) + progress UI
* Collage layouts (1–5, 6+ with overlay count)
* Optional slideshow with controls, pause, magnifier to lightbox
* Lightbox (portal, keyboard nav, thumbnails)
* Tag chips + filtering sidebar
* Lazy loaded images (IntersectionObserver shimmer)
* URL sanitization & broken URL skipping

Engagement
* Reactions (like / love / pray) transactional user arrays
* Nested comments (reply, edit, delete if author)

Finance (initial)
* Transactions + breakdown components (scaffold)
* Receipt/document uploads

Permissions
* Project & Individual Settings share accessSettings model (view/edit roles, representatives, supporters)

Reliability
* Firestore transactions for reactions/comment edits
* Normalization (IDs, arrays)
* imagePaths stored (individual delete cleans storage; project delete TODO)

---
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

Deletion
* Individual post deletion cleans Storage via saved paths
* Project post deletion cleanup pending

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
* Project update deletion -> Storage cleanup parity
* Lightbox accessibility (focus trap, ARIA labels)
* Image URL cache to skip repeat shimmer
* Finance tab polishing & summaries

Mid
* Receipt thumbnail / blur placeholders
* Notifications (comment / reaction)
* Admin role management (claims)
* Testing harness (Firestore emulator + component tests)

Future
* Currency conversion
* Offline caching
* Localization (i18n)

---
## Contributing
Issues & PRs welcome (describe context; keep changes scoped).

License: TBD (internal).

README updated Sept 2025 (media/slideshow/permissions parity).
