-- Vite-only admin access through Supabase Auth.
-- Run this once in the Supabase SQL Editor.

create or replace function public.is_wcc_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'email') = 'wccadmin@wcc.ac.pg', false);
$$;

grant execute on function public.is_wcc_admin() to authenticated;

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
