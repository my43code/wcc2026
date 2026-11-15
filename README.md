# Waigani Christian College website

The public website and admin dashboard of Waigani Christian College, Port
Moresby, Papua New Guinea.

- **Frontend:** React 19, Vite and TypeScript in `backend/frontend`. The public
  pages and the admin dashboard (`/admin`) are one single-page app.
- **Data:** Supabase (database, file storage and admin sign-in). The browser
  talks to Supabase directly, and row level security protects the data.
- **Server:** `server.mjs`, a small Node.js server (Hono) that serves the built
  site on Hostinger. It needs no secrets or environment variables.

## Folder layout

```text
server.mjs                   Serves the built site, plus GET /api/health
package.json                 Root scripts: build, start, lint
HOSTINGER.md                 Deployment guide
backend/
  DATABASE.md                Tables, file storage, search and admin access
  supabase/
    schema.sql               Tables, storage bucket, search function, visitor policies
    vite_admin_policies.sql  Administrator policies
  frontend/                  The React app (see its README.md)
    src/App.tsx              Public pages
    src/Admin.tsx            Admin dashboard (/admin and /admin/setup)
    src/adminApi.ts          Admin data calls to Supabase
    src/supabase.ts          Supabase client
    .env.production          Public Supabase URL and publishable key
.agents/, skills-lock.json   Coding-assistant skill files, not used by the site
```

The `backend` folder name is historical. It no longer contains a server.

## Local development

You need Node.js 20.19+ or 22.12+ (Hostinger uses 22 or 24).

To work on the site with hot reload:

```sh
cd backend/frontend
npm install
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173. The admin
dashboard is at `/admin`. The dev server uses the live Supabase project, so
changes you make in the admin dashboard are real.

To run the production build the way Hostinger does, from the repository root:

```sh
npm install
npm run build
npm start
```

Then open http://localhost:3000.

## Documentation

- [HOSTINGER.md](HOSTINGER.md): deployment and the one-time Supabase settings
- [backend/DATABASE.md](backend/DATABASE.md): tables, file storage, search, and
  who can do what
- [backend/frontend/README.md](backend/frontend/README.md): frontend scripts and
  code map
