# Hostinger Business deployment

Deploy this repository as a **Node.js Web App**, not a Static Frontend App.

## Build settings

- Project/root directory: `.`
- Build command: `npm run build`
- Start command: `npm start`
- Entry file (if requested): `server.mjs`
- Node.js version: 22 or 24

## Environment variables

None are required. Hostinger provides `PORT` automatically.

The browser talks to Supabase directly: public pages use the publishable key
in `backend/frontend/.env.production`, and the admin dashboard signs in with
Supabase Auth and is protected by the row level security policies in
`backend/supabase/vite_admin_policies.sql`. The Node server only serves the
built site, so it holds no database secrets.

The old `SUPABASE_SECRET_KEY`, `WCC_ADMIN_USERNAME`, `WCC_ADMIN_PASSWORD` and
`WCC_SECRET_KEY` variables are no longer used. Delete them from hPanel.

## Supabase settings (one-time)

In Supabase → Authentication → URL Configuration:

- Site URL: the live website address, e.g. `https://your-domain`
- Redirect URLs: add `https://your-domain/admin/setup`

Invitation emails must use `/admin/setup` as the redirect so new
administrators can set their password.

## Checking a deployment

- `https://your-domain/api/health` should return `{"status":"healthy"}`.
- `https://your-domain/admin` should show the email sign-in form.
