# Hostinger Business deployment

Deploy this repository as a **Node.js Web App**, not a Static Frontend App.

## Build settings

- Project/root directory: `.`
- Build command: `npm run build`
- Start command: `npm start`
- Entry file (if requested): `server.mjs`
- Node.js version: 22 or 24

## Required environment variables

Add these in hPanel under the web app's environment variables. Copy their
values from `backend/.env.local`; never add the secret values to Git.

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
WCC_ADMIN_USERNAME
WCC_ADMIN_PASSWORD
WCC_SECRET_KEY
```

Hostinger provides `PORT` automatically. The Node server serves both the Vite
frontend and `/api/*`, so public and local deployments use the same URLs.
