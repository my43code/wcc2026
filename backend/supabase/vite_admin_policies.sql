-- Administrator access for the admin dashboard (/admin), through Supabase Auth.
-- Run this in the Supabase SQL Editor after schema.sql. Safe to run again.

-- An administrator is a signed-in user who was invited from the Supabase
-- dashboard (auth.users.invited_at is set) or whose verified email is
-- masomanu23@gmail.com or judykupun@gmail.com.
-- security definer lets this check read auth.users.

create or replace function public.is_wcc_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and (
        invited_at is not null
        or (
          email_confirmed_at is not null
          and lower(email) in ('masomanu23@gmail.com', 'judykupun@gmail.com')
        )
      )
  );
$$;

revoke all on function public.is_wcc_admin() from public;
revoke all on function public.is_wcc_admin() from anon;

grant execute on function public.is_wcc_admin() to authenticated;

-- Administrators can read, add, change and delete every row, published or not.
drop policy if exists "Admin manages posts" on public.posts;
create policy "Admin manages posts" on public.posts for all to authenticated
using ((select public.is_wcc_admin())) with check ((select public.is_wcc_admin()));

drop policy if exists "Admin manages enquiries" on public.enquiries;
create policy "Admin manages enquiries" on public.enquiries for all to authenticated
using ((select public.is_wcc_admin())) with check ((select public.is_wcc_admin()));

drop policy if exists "Admin manages staff" on public.staff_profiles;
create policy "Admin manages staff" on public.staff_profiles for all to authenticated
using ((select public.is_wcc_admin())) with check ((select public.is_wcc_admin()));

drop policy if exists "Admin manages careers" on public.career_opportunities;
create policy "Admin manages careers" on public.career_opportunities for all to authenticated
using ((select public.is_wcc_admin())) with check ((select public.is_wcc_admin()));

-- Administrators can list, upload, replace and delete files in post-media.
-- Visitors see the files through public URLs because the bucket is public.
drop policy if exists "Admin reads post media" on storage.objects;
create policy "Admin reads post media" on storage.objects for select to authenticated
using (bucket_id = 'post-media' and (select public.is_wcc_admin()));

drop policy if exists "Admin uploads post media" on storage.objects;
create policy "Admin uploads post media" on storage.objects for insert to authenticated
with check (bucket_id = 'post-media' and (select public.is_wcc_admin()));

drop policy if exists "Admin updates post media" on storage.objects;
create policy "Admin updates post media" on storage.objects for update to authenticated
using (bucket_id = 'post-media' and (select public.is_wcc_admin()))
with check (bucket_id = 'post-media' and (select public.is_wcc_admin()));

drop policy if exists "Admin deletes post media" on storage.objects;
create policy "Admin deletes post media" on storage.objects for delete to authenticated
using (bucket_id = 'post-media' and (select public.is_wcc_admin()));

-- Resources table: admin full access
drop policy if exists "Admin manages resources" on public.resources;
create policy "Admin manages resources" on public.resources for all to authenticated
using ((select public.is_wcc_admin())) with check ((select public.is_wcc_admin()));
