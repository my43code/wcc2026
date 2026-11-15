# Hostinger Business deployment

Deploy this repository as a **Node.js Web App**, not a Static Frontend App.

## Build settings

- Project/root directory: `.`
- Build command: `npm run build`
- Start command: `npm start`
- Entry file (if requested): `server.mjs`
- Node.js version: 22 or 24

`npm run build` installs the frontend's packages and builds the site into
`backend/frontend/dist`. `npm start` runs `server.mjs`, which serves that
folder, returns `index.html` for page addresses such as `/admin`, and answers
`GET /api/health`.

## Environment variables

None are required. Hostinger provides `PORT` automatically.

The browser talks to Supabase directly: public pages use the publishable key
in `backend/frontend/.env.production`, and the admin dashboard signs in with
Supabase Auth. Row level security decides what each user may do (see
`backend/DATABASE.md`). The Node server only serves the built site, so it holds
no database secrets.

The old `SUPABASE_SECRET_KEY`, `WCC_ADMIN_USERNAME`, `WCC_ADMIN_PASSWORD` and
`WCC_SECRET_KEY` variables are no longer used. Delete them from hPanel.
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are not used either, but they are
not secret.

## Supabase settings (one-time)

In Supabase → Authentication:

- URL Configuration → Site URL: the live website address with no trailing
  slash, e.g. `https://your-domain`.
- URL Configuration → Redirect URLs: add `https://your-domain/admin/setup`.
- Emails → Invite user template: make the link open the set-password page.

  ```html
  <a href="{{ .SiteURL }}/admin/setup?token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a>
  ```

  The default `{{ .ConfirmationURL }}` link sends people to the Site URL (the
  homepage) instead, where they cannot set a password.
- Emails → Reset Password template: use the following link so recovery works
  even when the email opens in another browser:

  ```html
  <a href="{{ .SiteURL }}/admin/setup?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
  ```

The dashboard sign-in at `/admin` defaults to `masomanu23@gmail.com` and has a
**Forgot password?** link at `/admin/forgot-password`. Recovery requires an
existing Supabase Auth user; it does not create an account or grant permissions.
Invite this address from Authentication → Users if it does not exist, and run
`backend/supabase/vite_admin_policies.sql` to apply the updated administrator
email. After opening the invitation or reset email, choose a password of at
least eight characters at `/admin/setup`.

How to invite administrators is described in `backend/DATABASE.md`.

## Checking a deployment

- `https://your-domain/api/health` should return `{"status":"healthy"}`.
- `https://your-domain/admin` should show the email sign-in form.
