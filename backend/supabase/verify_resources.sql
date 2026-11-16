-- Run as database administrator after resources.sql. Test rows are rolled back.
begin;
do $$
begin
  if not exists (select 1 from storage.buckets where id='school-resources' and public=false
    and file_size_limit=20971520 and allowed_mime_types @> array['application/pdf','application/msword']) then
    raise exception 'Document bucket privacy or upload configuration is incorrect';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where lower(email)='masomanu23@gmail.com'),true);
select set_config('test.resources_admin',current_setting('request.jwt.claim.sub'),true);
set local role authenticated;
do $$
declare resource_id bigint;
begin
  if not public.is_wcc_admin() then raise exception 'Primary administrator is unavailable'; end if;
  insert into public.resources (title,description,category,file_url,file_bucket,file_path,file_name,file_size,published)
  values ('Verification resource','Temporary verification document','fees','','school-resources',
    'resources/verification-'||txid_current()||'.pdf','verification.pdf',42,false) returning id into resource_id;
  perform set_config('test.resource_id',resource_id::text,true);
  update public.resources set title='Updated verification resource' where id=resource_id;
  if not exists (select 1 from public.resources where id=resource_id and title='Updated verification resource') then
    raise exception 'Administrator resource create/read/update failed';
  end if;
end;
$$;
set local role anon;
do $$
declare blocked boolean:=false;
begin
  if exists (select 1 from public.resources where id=current_setting('test.resource_id')::bigint) then
    raise exception 'Anonymous visitor can read a draft resource';
  end if;
  begin
    insert into public.resources (title,file_path,file_name) values ('Unauthorized resource','resources/blocked.pdf','blocked.pdf');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Anonymous visitor can create resources'; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$
declare affected integer; blocked boolean:=false;
begin
  if public.is_wcc_admin() then raise exception 'Unknown user has administrator access'; end if;
  if exists (select 1 from public.resources where id=current_setting('test.resource_id')::bigint) then
    raise exception 'Non-admin can read a draft resource';
  end if;
  begin
    insert into public.resources (title,file_path,file_name) values ('Unauthorized resource','resources/blocked.pdf','blocked.pdf');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Non-admin can create resources'; end if;
  update public.resources set published=true where id=current_setting('test.resource_id')::bigint;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Non-admin can publish resources'; end if;
  delete from public.resources where id=current_setting('test.resource_id')::bigint;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Non-admin can delete resources'; end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.resources_admin'),true);
update public.resources set published=true where id=current_setting('test.resource_id')::bigint;
set local role anon;
do $$
begin
  if not exists (select 1 from public.resources where id=current_setting('test.resource_id')::bigint and published=true) then
    raise exception 'Published resource is not visible to visitors';
  end if;
end;
$$;
set local role authenticated;
update public.resources set published=false where id=current_setting('test.resource_id')::bigint;
set local role anon;
do $$
begin
  if exists (select 1 from public.resources where id=current_setting('test.resource_id')::bigint) then
    raise exception 'Unpublished resource remains visible to visitors';
  end if;
end;
$$;
set local role authenticated;
delete from public.resources where id=current_setting('test.resource_id')::bigint;
do $$
begin
  if exists (select 1 from public.resources where id=current_setting('test.resource_id')::bigint) then
    raise exception 'Administrator resource deletion failed';
  end if;
end;
$$;
rollback;
select 'Resource editing, draft privacy, publishing and bucket configuration checks passed' as verification;
