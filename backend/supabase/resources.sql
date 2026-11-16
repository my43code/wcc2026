-- Run after schema.sql and vite_admin_policies.sql. Existing rows are preserved.
-- New documents use private storage; only published documents can be downloaded.
alter table public.resources add column if not exists file_bucket text not null default 'post-media';
alter table public.resources alter column file_bucket set default 'school-resources';
alter table public.resources drop constraint if exists resources_file_bucket_check;
alter table public.resources add constraint resources_file_bucket_check check (file_bucket in ('post-media','school-resources'));
alter table public.resources alter column file_url set default '';
alter table public.resources drop constraint if exists resources_file_url_check;
alter table public.resources add constraint resources_file_url_check check (char_length(file_url) <= 2000);
alter table public.resources alter column published set default false;
alter table public.resources enable row level security;
revoke all on public.resources from anon, authenticated;
grant select on public.resources to anon;
grant select,insert,update,delete on public.resources to authenticated;
grant all on public.resources to service_role;
revoke all on sequence public.resources_id_seq from anon, authenticated;
grant usage,select on sequence public.resources_id_seq to authenticated, service_role;

drop policy if exists "Public can read published resources" on public.resources;
create policy "Public can read published resources" on public.resources for select to anon,authenticated using (published = true);
drop policy if exists "Admin manages resources" on public.resources;
create policy "Admin manages resources" on public.resources for all to authenticated
using ((select public.is_wcc_admin())) with check ((select public.is_wcc_admin()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('school-resources','school-resources',false,20971520,array[
 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'image/jpeg','image/png','image/webp'
]) on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public downloads published school resources" on storage.objects;
create policy "Public downloads published school resources" on storage.objects for select to anon,authenticated
using (bucket_id='school-resources' and exists (
 select 1 from public.resources r
 where r.file_bucket='school-resources' and r.file_path=storage.objects.name and r.published=true
));
drop policy if exists "Admin manages school resources files" on storage.objects;
create policy "Admin manages school resources files" on storage.objects for all to authenticated
using (bucket_id='school-resources' and (select public.is_wcc_admin()))
with check (bucket_id='school-resources' and (select public.is_wcc_admin()));

create index if not exists resources_file_lookup_idx on public.resources (file_bucket,file_path,published);
