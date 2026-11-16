# Frontend

The Waigani Christian College website: a React 19 + TypeScript single-page app
built with Vite. It holds both the public site and the admin dashboard, and it
talks to Supabase directly from the browser.

## Scripts

Run `npm install` once in this folder, then:

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server with hot reload (usually http://localhost:5173) |
| `npm run build` | Type-checks (`tsc -b`) and builds the site into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally |
| `npm run lint` | Runs ESLint |

In production the root `npm run build` builds this app, and the root
`server.mjs` serves `dist/` (see [`HOSTINGER.md`](../../HOSTINGER.md)).

## Supabase settings

`.env.production` sets the two values the app needs:

- `VITE_SUPABASE_URL`: the Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key

Both are public. Vite builds `VITE_` variables into the JavaScript that
browsers download, and row level security protects the data (see
[`DATABASE.md`](../DATABASE.md)). Never put a secret key in a `VITE_` variable.

Vite reads `.env.production` only when building. During `npm run dev`,
`src/supabase.ts` falls back to the same project URL and key, so the dev server
uses the live data and changes made in the local admin dashboard are real. To
work against another Supabase project, put both variables in `.env.local`,
which Git ignores.

## Admin pages

- `/admin`: sign in with email address and password (Supabase Auth).
- `/admin/setup`: opened from an invitation (or password reset) email. The
  administrator chooses a password and then lands in the dashboard.
- **Learning pages** in the dashboard: edit the four pathway pages, manage
  subpages, and add page-specific posts. FODE includes Grade 10 and Grade 12
  upgrading pages.

Public learning pages live at `/learning/<slug>`, including
`/learning/fode/grade-10-upgrading` and `/learning/fode/grade-12-upgrading`.
Each pathway overview lists its category's posts; subpages list posts assigned
to that page. Draft pages are visible only to administrators in the dashboard.

Administrators are invited from the Supabase dashboard. See
[`DATABASE.md`](../DATABASE.md).

## Forms, resources and sitemap

- `/forms-resources`: searchable, filterable school documents. Fee structures
  and application forms can be linked directly with `?category=fees` and
  `?category=application`.
- `/sitemap`: a visitor sitemap that includes published learning pages.
- `/sitemap.xml`: generated at build time from public routes and published
  learning pages. The visible sitemap reflects newly published pages on reload;
  the XML is refreshed on the next deployment.
- **Forms & Resources** in the dashboard: upload documents, replace files,
  manage their details and display order, save drafts or publish downloads.

Draft uploads are private. Document downloads use short-lived signed URLs.
No sample school fees or application forms are published automatically.

## News and updates

The homepage shows published posts in a swipeable carousel with pathway
filters, previous/next controls and a pause button. Opening a card displays
the full story; sharing remains a separate action. Motion pauses during
interaction and respects reduced-motion preferences. The news page lists all
published posts. Posts assigned to an upgrading subpage show its title in the
category label.

## Code map

- `src/main.tsx`: shows the admin dashboard for `/admin` paths and the public
  site for everything else.
- `src/App.tsx`: the public pages. The page is chosen from
  `window.location.pathname`.
- `src/Admin.tsx`: the admin dashboard and the set-password page.
- `src/adminApi.ts`: maps the dashboard's `/api/...` request names to direct
  Supabase calls. There is no HTTP API behind them.
- `src/supabase.ts`: the Supabase client, and the code that finishes sign-in
  from invitation and password reset links.
- `src/App.css`, `src/Admin.css`, `src/index.css`: styles.
- `src/assets/`: images. `public/`: files copied into `dist/` unchanged.
