-- Only the application service can mutate staged image review. All operations
-- lock the job first, consistently with row review and draft preparation.
create function public.reconcile_listing_import_row_assets(target_job_id uuid, target_row_id uuid)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  job public.listing_import_jobs%rowtype;
  import_row public.listing_import_rows%rowtype;
  image_count integer;
  changed boolean := false;
  affected integer;
  next_state public.listing_import_row_state;
begin
  select * into job from public.listing_import_jobs where id = target_job_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'import_not_found'; end if;
  if job.stage not in ('validating', 'resolving', 'preview') then
    raise exception using errcode = 'PT409', message = 'import_images_not_editable';
  end if;
  select * into import_row from public.listing_import_rows
    where id = target_row_id and job_id = target_job_id and organization_id = job.organization_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'import_row_not_found'; end if;
  if import_row.state in ('removed', 'committed', 'published') or import_row.resulting_listing_id is not null then return false; end if;
  select count(*) into image_count from public.listing_import_assets
    where job_id = target_job_id and organization_id = job.organization_id and row_id = target_row_id
      and state in ('matched', 'uploaded', 'attached') and mime_type in ('image/jpeg', 'image/png', 'image/webp');
  if image_count >= 3 then
    delete from public.listing_import_issues where job_id = target_job_id and row_id = target_row_id and code = 'missing_images';
    get diagnostics affected = row_count;
    changed := affected > 0;
  elsif not exists(select 1 from public.listing_import_issues where job_id = target_job_id and row_id = target_row_id and code = 'missing_images' and resolved_at is null) then
    insert into public.listing_import_issues(job_id, organization_id, row_id, severity, code, field, message)
      values(target_job_id, job.organization_id, target_row_id, 'publish_blocker', 'missing_images', 'imageReferences', 'Add at least three matched images before publishing.');
    changed := true;
  end if;
  next_state := case
    when import_row.duplicate_strategy = 'skip' then 'skipped'
    when cardinality(import_row.duplicate_candidate_ids) > 0 and import_row.duplicate_strategy is null then 'duplicate_review'
    when exists(select 1 from public.listing_import_issues where job_id = target_job_id and row_id = target_row_id and severity = 'blocking' and resolved_at is null) then 'parse_blocked'
    when exists(select 1 from public.listing_import_issues where job_id = target_job_id and row_id = target_row_id and severity = 'publish_blocker' and resolved_at is null) then 'publish_blocked'
    when exists(select 1 from public.listing_import_issues where job_id = target_job_id and row_id = target_row_id and severity = 'warning' and resolved_at is null) then 'warning'
    else 'draft_ready' end::public.listing_import_row_state;
  if import_row.state is distinct from next_state then
    update public.listing_import_rows set state = next_state where id = target_row_id and job_id = target_job_id;
    changed := true;
  end if;
  return changed;
end;
$$;

create function public.apply_listing_import_asset_review(target_job_id uuid, asset_request jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  job public.listing_import_jobs%rowtype;
  import_row public.listing_import_rows%rowtype;
  image public.listing_import_assets%rowtype;
  operation text := asset_request->>'action';
  info jsonb := coalesce(asset_request->'asset', '{}'::jsonb);
  requested_row uuid;
  old_row uuid;
  asset_id uuid;
  requested_storage_path text;
  prefix text;
  kind text;
  image_count integer;
  next_order integer;
  has_cover boolean;
  changed boolean := false;
  affected integer := 0;
  candidate jsonb;
  current_hints jsonb;
begin
  if operation is null or operation not in ('register', 'arrange', 'match', 'reconcile') then
    raise exception using errcode = '22023', message = 'invalid_import_image_action';
  end if;
  select * into job from public.listing_import_jobs where id = target_job_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'import_not_found'; end if;
  if job.stage not in ('resolving', 'preview') and not (job.stage = 'validating' and operation in ('match', 'reconcile')) then
    raise exception using errcode = 'PT409', message = 'import_images_not_editable';
  end if;
  requested_row := nullif(case when operation = 'register' then info->>'rowId' else asset_request->>'rowId' end, '')::uuid;
  if requested_row is not null then
    select * into import_row from public.listing_import_rows
      where id = requested_row and job_id = target_job_id and organization_id = job.organization_id for update;
    if not found then raise exception using errcode = 'PT404', message = 'import_row_not_found'; end if;
    if operation in ('register', 'arrange') and (import_row.state in ('removed', 'committed', 'published') or import_row.resulting_listing_id is not null) then
      raise exception using errcode = 'PT409', message = 'import_image_row_not_editable';
    end if;
  elsif operation in ('match', 'reconcile') then
    raise exception using errcode = '22023', message = 'import_image_row_required';
  end if;

  if operation = 'register' then
    kind := info->>'kind';
    if kind is null or kind not in ('image', 'archive') then raise exception using errcode = '22023', message = 'invalid_import_image_kind'; end if;
    requested_storage_path := info->>'storagePath';
    prefix := job.organization_id::text || '/' || target_job_id::text || case when kind = 'archive' then '/archives/' else '/assets/' end;
    if requested_storage_path is null or left(requested_storage_path, length(prefix)) <> prefix or substring(requested_storage_path from length(prefix) + 1) !~ '^[A-Za-z0-9._-]+$' or substring(requested_storage_path from length(prefix) + 1) in ('.', '..') then
      raise exception using errcode = '22023', message = 'invalid_import_image_path';
    end if;
    select a.* into image from public.listing_import_assets a where a.job_id = target_job_id and a.organization_id = job.organization_id and a.storage_path = requested_storage_path order by a.created_at, a.id limit 1 for update;
    if found then return jsonb_build_object('assetId', image.id, 'affected', 0, 'stale', false); end if;
    if kind = 'archive' then
      if requested_row is not null or (info->>'sizeBytes')::bigint not between 1 and 2147483648 then raise exception using errcode = '22023', message = 'invalid_import_archive'; end if;
      insert into public.listing_import_assets(job_id, organization_id, state, source_name, storage_path, mime_type, archive_size_bytes, rejection_code)
        values(target_job_id, job.organization_id, 'rejected', info->>'sourceName', requested_storage_path, 'application/zip', (info->>'sizeBytes')::bigint, 'archive_extracted_to_individual_assets') returning id into asset_id;
    else
      if info->>'mimeType' not in ('image/jpeg', 'image/png', 'image/webp') or (info->>'sizeBytes')::bigint not between 1 and 10485760 then raise exception using errcode = '22023', message = 'invalid_import_image'; end if;
      if requested_row is not null and (select count(*) from public.listing_import_assets where job_id = target_job_id and row_id = requested_row and state in ('matched', 'uploaded', 'attached')) >= 20 then
        raise exception using errcode = 'PT409', message = 'import_image_limit';
      end if;
      insert into public.listing_import_assets(job_id, organization_id, row_id, state, source_name, source_url_hash, storage_path, mime_type, size_bytes)
        values(target_job_id, job.organization_id, requested_row, (case when requested_row is null then 'uploaded' else 'matched' end)::public.listing_import_asset_state, info->>'sourceName', info->>'sourceUrlHash', requested_storage_path, info->>'mimeType', (info->>'sizeBytes')::bigint) returning id into asset_id;
      if requested_row is not null then perform public.reconcile_listing_import_row_assets(target_job_id, requested_row); end if;
    end if;
    affected := 1;
  elsif operation = 'arrange' then
    select * into image from public.listing_import_assets where id = (asset_request->>'assetId')::uuid and job_id = target_job_id and organization_id = job.organization_id for update;
    if not found then raise exception using errcode = 'PT404', message = 'import_image_not_found'; end if;
    if image.mime_type is null or image.mime_type not in ('image/jpeg', 'image/png', 'image/webp') or image.state not in ('uploaded', 'unmatched', 'matched', 'attached') then
      raise exception using errcode = '22023', message = 'invalid_import_image_arrangement';
    end if;
    if (asset_request->>'sortOrder')::integer not between 0 and 19 or jsonb_typeof(asset_request->'isCover') <> 'boolean' then raise exception using errcode = '22023', message = 'invalid_import_image_arrangement'; end if;
    if nullif(asset_request->>'expectedUpdatedAt', '') is null then raise exception using errcode = 'PT409', message = 'import_image_revision_required'; end if;
    if image.row_id is not distinct from requested_row and image.sort_order is not distinct from (case when requested_row is null then null else (asset_request->>'sortOrder')::integer end) and image.is_cover = (requested_row is not null and (asset_request->>'isCover')::boolean) then
      return jsonb_build_object('assetId', image.id, 'affected', 0, 'stale', false);
    end if;
    if image.updated_at is distinct from (asset_request->>'expectedUpdatedAt')::timestamptz then raise exception using errcode = 'PT409', message = 'import_image_revision_conflict'; end if;
    if requested_row is not null and (select count(*) from public.listing_import_assets where job_id = target_job_id and row_id = requested_row and id <> image.id and state in ('matched', 'uploaded', 'attached')) >= 20 then raise exception using errcode = 'PT409', message = 'import_image_limit'; end if;
    old_row := image.row_id;
    if requested_row is not null and (asset_request->>'isCover')::boolean then
      update public.listing_import_assets set is_cover = false where job_id = target_job_id and organization_id = job.organization_id and row_id = requested_row and id <> image.id and is_cover;
    end if;
    update public.listing_import_assets set row_id = requested_row,
      state = (case when requested_row is null then 'unmatched' else 'matched' end)::public.listing_import_asset_state,
      match_method = case when requested_row is null then null else 'manual' end,
      sort_order = case when requested_row is null then null else (asset_request->>'sortOrder')::integer end,
      is_cover = requested_row is not null and (asset_request->>'isCover')::boolean
      where id = image.id;
    if requested_row is not null then perform public.reconcile_listing_import_row_assets(target_job_id, requested_row); end if;
    if old_row is not null and old_row is distinct from requested_row and exists(select 1 from public.listing_import_rows where id = old_row and job_id = target_job_id and organization_id = job.organization_id) then perform public.reconcile_listing_import_row_assets(target_job_id, old_row); end if;
    asset_id := image.id;
    affected := 1;
  elsif operation = 'match' then
    if import_row.state in ('skipped', 'removed', 'committed', 'published') or import_row.resulting_listing_id is not null then return jsonb_build_object('assetId', null, 'affected', 0, 'stale', false); end if;
    current_hints := jsonb_build_object('sourceReference', import_row.normalized_data->'sourceReference', 'imageReferences', coalesce(nullif(import_row.normalized_data->'imageReferences', 'null'::jsonb), '[]'::jsonb));
    if current_hints is distinct from asset_request->'hints' then return jsonb_build_object('assetId', null, 'affected', 0, 'stale', true); end if;
    if jsonb_typeof(asset_request->'matches') <> 'array' or jsonb_array_length(asset_request->'matches') > 20 then raise exception using errcode = '22023', message = 'invalid_import_image_matches'; end if;
    for candidate in select value from jsonb_array_elements(asset_request->'matches') loop
      if candidate->>'method' not in ('explicit', 'source_reference', 'prefix') then raise exception using errcode = '22023', message = 'invalid_import_image_match'; end if;
      select * into image from public.listing_import_assets where id = (candidate->>'assetId')::uuid and job_id = target_job_id and organization_id = job.organization_id and row_id is null and state in ('uploaded', 'unmatched') and mime_type in ('image/jpeg', 'image/png', 'image/webp') for update;
      if not found then continue; end if;
      select count(*) into image_count from public.listing_import_assets where job_id = target_job_id and row_id = requested_row and state in ('matched', 'uploaded', 'attached');
      if image_count >= 20 then exit; end if;
      select exists(select 1 from public.listing_import_assets where job_id = target_job_id and row_id = requested_row and is_cover) into has_cover;
      select n into next_order from generate_series(0, 19) n where not exists(select 1 from public.listing_import_assets where job_id = target_job_id and row_id = requested_row and sort_order = n) order by n limit 1;
      if next_order is null then exit; end if;
      update public.listing_import_assets set row_id = requested_row, state = 'matched', match_method = candidate->>'method', sort_order = next_order, is_cover = not has_cover where id = image.id;
      affected := affected + 1;
    end loop;
    changed := public.reconcile_listing_import_row_assets(target_job_id, requested_row);
  else
    changed := public.reconcile_listing_import_row_assets(target_job_id, requested_row);
  end if;
  if (affected > 0 or changed) and job.stage <> 'validating' then
    perform public.refresh_listing_import_job_counters(target_job_id);
    update public.listing_import_jobs set version = version + 1 where id = target_job_id;
  end if;
  return jsonb_build_object('assetId', asset_id, 'affected', affected, 'stale', false);
end;
$$;

revoke all on function public.reconcile_listing_import_row_assets(uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_listing_import_asset_review(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_listing_import_row_assets(uuid, uuid) to service_role;
grant execute on function public.apply_listing_import_asset_review(uuid, jsonb) to service_role;
