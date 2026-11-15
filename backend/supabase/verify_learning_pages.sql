-- Run after learning_pages.sql as the database administrator.
-- All test rows and edits are rolled back. Identity sequences may advance.
begin;

select set_config('request.jwt.claim.sub', (
  select id::text from auth.users where lower(email) = 'masomanu23@gmail.com'
), true);
select set_config('test.learning_admin_id', current_setting('request.jwt.claim.sub'), true);
set local role authenticated;

do $$
declare
  page_id bigint;
  post_id bigint;
  blocked boolean;
begin
  if not public.is_wcc_admin() then raise exception 'Primary administrator is unavailable'; end if;
  insert into public.learning_pages (slug, category, title, summary, body, published)
  values ('fode/verification-fixture-' || txid_current(), 'fode', 'Verification page',
    'A temporary verification page.', 'Temporary content.', false)
  returning id into page_id;
  perform set_config('test.learning_page_id', page_id::text, true);
  update public.learning_pages set title = 'Updated verification page' where id = page_id;
  if not exists (select 1 from public.learning_pages where id = page_id and title = 'Updated verification page') then
    raise exception 'Administrator page create/read/update failed';
  end if;

  insert into public.posts (title, summary, body, category, published, learning_page_id)
  values ('Verification post', 'A temporary verification post.', '', 'fode', false, page_id)
  returning id into post_id;
  perform set_config('test.learning_post_id', post_id::text, true);
  update public.posts set title = 'Updated verification post' where id = post_id;
  if not exists (select 1 from public.posts where id = post_id and title = 'Updated verification post') then
    raise exception 'Administrator assigned post create/read/update failed';
  end if;

  blocked := false;
  begin
    update public.posts set category = 'primary_school' where id = post_id;
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then raise exception 'Mismatched post/page category was accepted'; end if;

  if not exists (select 1 from public.learning_pages where slug = 'fode') then
    raise exception 'FODE root page is missing';
  end if;
  blocked := false;
  begin
    delete from public.learning_pages where slug = 'fode';
  exception when raise_exception then
    if sqlerrm not like 'Main learning pages cannot be deleted.%' then raise; end if;
    blocked := true;
  end;
  if not blocked then raise exception 'Root page deletion was accepted'; end if;
end;
$$;

set local role anon;
do $$
declare blocked boolean := false; affected integer;
begin
  if not exists (select 1 from public.learning_pages where slug = 'fode' and published) then
    raise exception 'Anonymous visitor cannot read the published FODE page';
  end if;
  if exists (select 1 from public.learning_pages where id = current_setting('test.learning_page_id')::bigint) then
    raise exception 'Anonymous visitor can see a draft learning page';
  end if;
  if exists (select 1 from public.posts where id = current_setting('test.learning_post_id')::bigint) then
    raise exception 'Anonymous visitor can see a draft post';
  end if;
  begin
    insert into public.learning_pages (slug, category, title, summary)
    values ('fode/anonymous-fixture-' || txid_current(), 'fode', 'Unauthorized page', 'Must not be created.');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Anonymous visitor created a learning page'; end if;
  begin
    update public.learning_pages set title = 'Unauthorized change'
    where id = current_setting('test.learning_page_id')::bigint;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Anonymous visitor updated a learning page'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.learning_pages where id = current_setting('test.learning_page_id')::bigint;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Anonymous visitor deleted a learning page'; end if;
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- An authenticated subject with no corresponding Auth user has no admin grant.
set local role authenticated;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
do $$
declare blocked boolean := false; affected integer;
begin
  if public.is_wcc_admin() then raise exception 'Unknown subject has administrator access'; end if;
  if exists (select 1 from public.learning_pages where id = current_setting('test.learning_page_id')::bigint) then
    raise exception 'Non-admin can see a draft learning page';
  end if;
  begin
    insert into public.learning_pages (slug, category, title, summary)
    values ('fode/nonadmin-fixture-' || txid_current(), 'fode', 'Unauthorized page', 'Must not be created.');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Non-admin created a learning page'; end if;
  update public.learning_pages set title = 'Unauthorized change'
  where id = current_setting('test.learning_page_id')::bigint;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Non-admin updated a learning page'; end if;
  delete from public.learning_pages where id = current_setting('test.learning_page_id')::bigint;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Non-admin deleted a learning page'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.learning_admin_id'), true);
do $$
begin
  delete from public.learning_pages where id = current_setting('test.learning_page_id')::bigint;
  if exists (select 1 from public.learning_pages where id = current_setting('test.learning_page_id')::bigint) then
    raise exception 'Administrator subpage deletion failed';
  end if;
  if not exists (
    select 1 from public.posts where id = current_setting('test.learning_post_id')::bigint
      and category = 'fode' and learning_page_id is null
  ) then
    raise exception 'Deleting a subpage did not preserve and detach its post';
  end if;
  delete from public.posts where id = current_setting('test.learning_post_id')::bigint;
  if exists (select 1 from public.posts where id = current_setting('test.learning_post_id')::bigint) then
    raise exception 'Administrator post deletion failed';
  end if;
end;
$$;

rollback;
select 'Learning page CRUD, access controls, category assignment and deletion checks passed' as verification;
