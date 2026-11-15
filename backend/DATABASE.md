# Database

The website keeps its data in Supabase (PostgreSQL, project
`qemfloodlswcorxwqrzw`). The browser talks to Supabase directly using the
public publishable key, and row level security (RLS) decides what each request
may do. No application server sits in between: `server.mjs` only serves the
built site. No secret key is used. The old `SUPABASE_SECRET_KEY` and `WCC_*`
variables belonged to the removed server code and are no longer used.

## Setup

In the Supabase SQL Editor, run these files in this order. They are safe to
run again and preserve existing learning-page edits.

1. [`supabase/schema.sql`](supabase/schema.sql): tables, the `post-media`
   storage bucket, the search function and the visitor policies.
2. [`supabase/vite_admin_policies.sql`](supabase/vite_admin_policies.sql): the
   `is_wcc_admin()` check and the administrator policies.
3. [`supabase/learning_pages.sql`](supabase/learning_pages.sql): managed learning
   pages, the FODE post category, page targeting and initial page content.

Then apply the one-time Supabase Auth settings in
[`HOSTINGER.md`](../HOSTINGER.md#supabase-settings-one-time), so that invitation
links work.

## Tables

Text limits are in characters. "Required" means `not null` with no default.
`updated_at` is set automatically by a trigger whenever a row is updated.

### `posts`

News and event stories on the public site, managed in the admin dashboard.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | bigint | Identity primary key |
| `title` | text | Required, 3–160 |
| `summary` | text | Required, 5–400 |
| `body` | text | Default `''`, up to 10,000 |
| `category` | text | Required: `news_events`, `early_learning`, `primary_school`, `secondary_school`, `student_life` or `fode` |
| `learning_page_id` | bigint | Optional page target in the same category. Deleting a subpage clears this link and preserves the post |
| `event_date` | date | Optional. The site shows it instead of `created_at` when set |
| `published` | boolean | Default `true`. Only published posts are public |
| `promoted` | boolean | Default `false`. Promoted posts are listed first |
| `media_url` | text | Optional public URL of the image or video, up to 2,000 |
| `media_type` | text | Optional: `image` or `video` |
| `media_path` | text | Optional path of the file in `post-media`, up to 500 |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

If `posts` already existed before the media columns were introduced,
`schema.sql` adds `media_url`, `media_type` and `media_path` without these
checks.

### `enquiries`

Messages sent with the public site's Enquire form, read in the admin inbox.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | bigint | Identity primary key |
| `name` | text | Required, 2–120 |
| `email` | text | Required, up to 320 (the database does not check the format) |
| `year_level` | text | Required, 2–80 |
| `message` | text | Default `''`, up to 3,000 |
| `status` | text | Default `new`. One of `new`, `in_progress`, `resolved` |
| `created_at` | timestamptz | Default `now()` |

### `learning_pages`

Editable learning content at `/learning/<slug>`. The initial six pages cover
Early Learning, Primary School, Secondary School, FODE, Grade 10 upgrading and
Grade 12 upgrading. Admins can add more subpages under any pathway.

Each page has a unique `slug`, a learning `category`, `title`, `eyebrow`,
`summary`, plain-text `body`, `published` flag and `sort_order`. Draft pages
are private to administrators. The four pathway overview addresses cannot be
renamed or deleted; their content and visibility remain editable.

Posts may target a page in the same category. An overview shows all posts in
its category; a subpage shows posts assigned to it. Posts have their own
publication switch, so published posts also appear in college news even if
their page is a draft. Deleting a subpage preserves its posts and removes
their page assignment.

The rollback-only checks in
[`supabase/verify_learning_pages.sql`](supabase/verify_learning_pages.sql) cover
admin editing, visitor permissions, draft privacy, category consistency and
safe subpage deletion.

### `staff_profiles`

People on the Administration & staff page.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | bigint | Identity primary key |
| `name` | text | Required, 2–120 |
| `job_title` | text | Required, 2–160 |
| `email` | text | Required, up to 320 |
| `linkedin_url` | text | Optional, up to 500 |
| `photo_url` | text | Optional public URL of the photo, up to 2,000 |
| `photo_path` | text | Optional path of the photo in `post-media`, up to 500 |
| `sort_order` | integer | Default `0`, must be 0 or more. Staff are listed by `sort_order`, then `name` |
| `published` | boolean | Default `true` |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

### `career_opportunities`

Vacancies on the Career opportunities page.

| Column | Type | Rules |
| --- | --- | --- |
| `id` | bigint | Identity primary key |
| `title` | text | Required, 3–160 |
| `department` | text | Default `''`, up to 120 |
| `location` | text | Default `Waigani Heights, Port Moresby`, up to 160 |
| `employment_type` | text | Default `Full-time`. One of `Full-time`, `Part-time`, `Contract`, `Casual`, `Internship` |
| `summary` | text | Required, 5–500 |
| `description` | text | Default `''`, up to 12,000 |
| `application_email` | text | Required, up to 320 |
| `application_url` | text | Optional, up to 2,000 |
| `closing_date` | date | Optional. Roles are listed by closing date, soonest first, undated last |
| `published` | boolean | Default `true` |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, updated by trigger |

## File storage: the `post-media` bucket

- Public bucket: anyone who has a file's URL can view it.
- At most 50 MB per file (`file_size_limit` 52428800 bytes).
- Allowed types: JPEG, PNG, WebP and GIF images; MP4, WebM and MOV
  (`video/quicktime`) videos.
- The admin dashboard also limits images to 10 MB before uploading
  (`frontend/src/adminApi.ts`). The bucket itself allows 50 MB for any allowed
  type.
- Post media and staff photos are both stored as `posts/<random id>.<ext>`. The
  row keeps the public URL (`media_url` or `photo_url`) and the path
  (`media_path` or `photo_path`). Deleting a post or staff profile in the
  dashboard also deletes its file.

## Search: `search_published_posts(search_term text)`

The public site search calls this function with `supabase.rpc`.

- Splits the search text into words and returns the posts that contain every
  word (case-insensitive) in their title, summary or body.
- Only published posts, promoted first, then newest; at most 20 results.
- Returns `id`, `title`, `summary`, `category`, `event_date`, `promoted`,
  `media_url` and `media_type` (not `body`).
- Runs with the caller's permissions (`security invoker`), so RLS still
  applies. Visitors and signed-in users may call it.

## Who can do what

RLS is enabled on all five tables.

| | Visitors | Administrators |
| --- | --- | --- |
| `posts`, `staff_profiles`, `career_opportunities` | Read rows where `published` is true | Everything: read, add, edit and delete any row |
| `learning_pages` | Read published pages | Manage pages; pathway overview addresses are protected |
| `enquiries` | Add an enquiry with status `new`. Cannot read, edit or delete enquiries | Everything |
| Files in `post-media` | View them through their public URLs | List, upload, update and delete |
| `search_published_posts` | Call it | Call it |

Visitor access comes from the policies in `schema.sql`. Administrator access
comes from `vite_admin_policies.sql` and `learning_pages.sql`: the tables and the bucket have admin
policies that allow everything to a signed-in user for whom
`public.is_wcc_admin()` is true. That function is true when the signed-in
Supabase Auth user was invited (`auth.users.invited_at` is set) or their verified
email is `masomanu23@gmail.com` or `judykupun@gmail.com`. Anyone else who signs
in gets the same access as a visitor.

The admin dashboard checks the signed-in user with `is_wcc_admin()`. The database
policies are what protect the data.

## Adding and removing administrators

1. In Supabase → Authentication → Users, choose **Add user** → **Send
   invitation** and enter the person's email address.
2. The link in the email opens `https://<your-domain>/admin/setup`, where they
   choose a password (at least 8 characters). The link only goes there if the
   Invite user email template is set up as described in `HOSTINGER.md`.
3. After that they sign in at `/admin` with their email address and password.

Every invited user is an administrator, so invite only people who should manage
the website. To remove someone's access, delete their user in Supabase →
Authentication → Users. It is also worth turning off **Allow new users to sign
up** in Supabase → Authentication: invitations still work, and nobody can
create an account on their own.

## Where the browser code lives

All paths are under `frontend/src/`.

- [`supabase.ts`](frontend/src/supabase.ts): creates the Supabase client from
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in
  `frontend/.env.production`, falling back to the same values built into the
  code. `completeAuthRedirect()` finishes sign-in from invitation and
  password-reset links.
- [`App.tsx`](frontend/src/App.tsx): the public site. Reads published posts,
  staff and careers, runs the search, and adds enquiries.
- [`Admin.tsx`](frontend/src/Admin.tsx): the admin dashboard at `/admin` and
  the set-password page at `/admin/setup`.
- [`adminApi.ts`](frontend/src/adminApi.ts): maps the dashboard's request names
  (`/api/posts`, `/api/media` and so on) to direct Supabase calls in the
  browser. No HTTP API sits behind those names. It also checks a file's type
  and size before uploading.
