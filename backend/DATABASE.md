# Website database inventory

The website API uses Supabase PostgreSQL. The ready-to-run schema is in
`supabase/schema.sql`; the browser continues to call FastAPI so the database
secret never reaches frontend code.

## Stored server data

### `posts`

Used by the homepage news list, public search, and the admin content manager.

| Column | Purpose |
| --- | --- |
| `id` | Unique post identifier |
| `title` | News/event title |
| `summary` | Homepage and search excerpt |
| `body` | Full story content |
| `category` | One of `news_events`, `early_learning`, `primary_school`, `secondary_school`, `student_life` |
| `event_date` | Optional calendar date |
| `published` | Controls public visibility |
| `promoted` | Moves featured content ahead of other posts |
| `created_at` | Creation timestamp |
| `updated_at` | Last-edit timestamp |

API usage: `GET/POST /api/posts`, `PUT/DELETE /api/posts/{id}`, and
`GET /api/search`.

### `enquiries`

Used by the public enrolment form and admin enquiry inbox.

| Column | Purpose |
| --- | --- |
| `id` | Unique enquiry identifier |
| `name` | Parent/carer name |
| `email` | Contact email address |
| `year_level` | Requested student year level |
| `message` | Optional family message |
| `status` | `new`, `in_progress`, or `resolved` |
| `created_at` | Submission timestamp |

API usage: `POST/GET /api/enquiries` and `PATCH /api/enquiries/{id}`.

## Authentication and browser storage

Admin username, password, and token-signing secret are currently read from
`WCC_ADMIN_USERNAME`, `WCC_ADMIN_PASSWORD`, and `WCC_SECRET_KEY`. They are not
database tables. The browser keeps only `wcc_admin_token` in `sessionStorage`;
it expires after eight hours and is removed on sign-out.

Configure these server-only variables in `backend/.env`:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_server-only-secret
```

Do not prefix the secret key with `VITE_` and never place it in frontend
code. Public clients may read published posts and submit new enquiries; only the
server should manage unpublished posts or read/update enquiries.

## Migration checklist

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Add the two server environment variables to the deployment host.
3. If needed, export existing SQLite rows from `posts` and `enquiries` and import them.
4. Start FastAPI and open `GET /api/health` to verify the Supabase connection.
5. Verify public post/search access, enquiry submission, and every admin action.
6. Retain any old `wcc.db` file as a backup until record counts are verified.

