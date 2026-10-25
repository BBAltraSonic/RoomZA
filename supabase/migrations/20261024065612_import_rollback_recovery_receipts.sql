-- Keep database rollback and its retry/cleanup receipt in one transaction.
-- Storage deletion is acknowledged separately only after its actual result.
begin;
alter table public.listing_import_change_snapshots
  add column rollback_receipt jsonb,
  add constraint listing_import_rollback_receipt_object
    check (rollback_receipt is null or jsonb_typeof(rollback_receipt) = 'object');

comment on column public.listing_import_change_snapshots.rollback_receipt is
  'Service-written database rollback and pending Storage cleanup receipt; retained for retry and version chains.';

create function public.lock_listing_import_rollback_job(target_job_id uuid, rollback_actor_id uuid)
returns public.listing_import_jobs
language plpgsql security invoker set search_path = ''
as $rollback$
declare target_job public.listing_import_jobs%rowtype;
begin
  select * into target_job from public.listing_import_jobs where id = target_job_id for update;
  if not found or target_job.stage <> 'complete' then
    raise exception using errcode = 'PT409', message = 'import_rollback_unavailable';
  end if;
  if not exists (
    select 1 from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = target_job.organization_id and m.user_id = rollback_actor_id
      and m.role in ('owner', 'admin') and m.revoked_at is null and o.imports_pilot_enabled
      and not exists (select 1 from public.account_suspensions s
        where s.user_id = m.user_id and s.restored_at is null
          and (s.suspended_until is null or s.suspended_until > clock_timestamp()))
  ) or not coalesce((select enabled from public.app_feature_flags where key = 'bulk_listing_imports'), false) then
    raise exception using errcode = '42501', message = 'import_rollback_access_unavailable';
  end if;
  return target_job;
end;
$rollback$;

create function public.apply_listing_import_rollback_snapshot(
  target_job_id uuid, target_snapshot_id uuid, rollback_actor_id uuid
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $rollback$
declare
  target_job public.listing_import_jobs%rowtype;
  target_snapshot public.listing_import_change_snapshots%rowtype;
  newer_snapshot public.listing_import_change_snapshots%rowtype;
  current_listing public.listings%rowtype;
  restored_listing public.listings%rowtype;
  expected_version timestamptz;
  resulting_version timestamptz;
  conflict_code text;
  cleanup_paths jsonb := '[]'::jsonb;
  original_images jsonb;
  image_record jsonb;
  restore_data jsonb;
  receipt jsonb;
  image_prefix text;
  field_name text;
begin
  target_job := public.lock_listing_import_rollback_job(target_job_id, rollback_actor_id);
  select * into target_snapshot from public.listing_import_change_snapshots
    where id = target_snapshot_id and job_id = target_job_id
      and organization_id = target_job.organization_id for update;
  if not found then raise exception using errcode = '42501', message = 'import_rollback_snapshot_unavailable'; end if;
  if target_snapshot.rolled_back_at is not null then
    return jsonb_build_object('id', target_snapshot.id, 'listingId', target_snapshot.listing_id,
      'status', case when target_snapshot.rollback_receipt is null then 'legacy_unverified' else 'done' end);
  end if;
  if target_snapshot.rollback_receipt is not null then
    return jsonb_build_object('id', target_snapshot.id, 'listingId', target_snapshot.listing_id,
      'status', 'pending', 'receipt', target_snapshot.rollback_receipt);
  end if;
  if target_snapshot.operation not in ('create', 'replace', 'merge', 'publish') then
    conflict_code := 'unsupported_operation';
  end if;

  expected_version := target_snapshot.listing_updated_at_after;
  select * into newer_snapshot from public.listing_import_change_snapshots
    where job_id = target_job_id and listing_id = target_snapshot.listing_id
      and (created_at, id) > (target_snapshot.created_at, target_snapshot.id)
    order by created_at, id limit 1;
  if found then
    if newer_snapshot.rollback_receipt is null then
      conflict_code := 'newer_change_not_rolled_back';
    else
      expected_version := (newer_snapshot.rollback_receipt->>'listingUpdatedAtAfter')::timestamptz;
    end if;
  end if;
  if expected_version is null then conflict_code := coalesce(conflict_code, 'missing_version'); end if;

  select * into current_listing from public.listings
    where id = target_snapshot.listing_id and organization_id = target_job.organization_id for update;
  if not found or current_listing.updated_at is distinct from expected_version
    or (target_snapshot.operation = 'create' and current_listing.status <> 'draft') then
    conflict_code := coalesce(conflict_code, case when target_snapshot.operation = 'create'
      then 'listing_changed_or_not_draft' else 'listing_changed_since_import' end);
  end if;
  if target_snapshot.operation <> 'create' and target_snapshot.before_data is null then
    conflict_code := coalesce(conflict_code, 'snapshot_missing');
  end if;
  if target_snapshot.before_data ? 'organization_id'
    and target_snapshot.before_data->>'organization_id' is distinct from target_job.organization_id::text then
    conflict_code := coalesce(conflict_code, 'snapshot_organization_changed');
  end if;

  -- Keep the entire listing when renters have an active application. Reverting
  -- publication first would let the older create snapshot cascade-delete it.
  if conflict_code is null and exists (
    select 1 from public.applications where listing_id = current_listing.id
      and status in ('submitted', 'under_review', 'shortlisted', 'approved')
  ) then
    conflict_code := 'listing_has_active_applications';
  end if;

  -- An enquiry does not update the listing version. Preserve publication and
  -- its older create snapshot so cascading deletes cannot erase buyer work.
  if conflict_code is null and exists (
    select 1 from public.buyer_interests where listing_id = current_listing.id
      and status in ('interested', 'negotiating', 'accepted')
  ) then
    conflict_code := 'listing_has_active_buyer_interests';
  end if;

  if conflict_code is null then
    perform 1 from public.listing_images where listing_id = current_listing.id order by id for update;
    original_images := case when jsonb_typeof(target_snapshot.before_data->'__images') = 'array'
      then target_snapshot.before_data->'__images' else null end;
    image_prefix := 'organizations/' || target_job.organization_id || '/' || current_listing.id || '/';
    if target_snapshot.operation = 'create' or original_images is not null then
      if exists (
        select 1 from public.listing_images i where i.listing_id = current_listing.id
          and (target_snapshot.operation = 'create' or not exists (
            select 1 from jsonb_array_elements(original_images) old_image where old_image->>'path' = i.path
          )) and (i.bucket is distinct from 'listing-images' or i.path is null or i.path !~ (
            '^' || image_prefix || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp)$'
          ))
      ) then conflict_code := 'image_scope_changed'; end if;
      select coalesce(jsonb_agg(i.path order by i.path), '[]'::jsonb) into cleanup_paths
        from public.listing_images i where i.listing_id = current_listing.id
          and (target_snapshot.operation = 'create' or not exists (
            select 1 from jsonb_array_elements(original_images) old_image where old_image->>'path' = i.path
          ));
    end if;
  end if;
  if conflict_code is not null then
    update public.listing_import_change_snapshots set rollback_conflict_code = conflict_code
      where id = target_snapshot.id;
    return jsonb_build_object('id', target_snapshot.id, 'listingId', target_snapshot.listing_id,
      'status', 'conflict', 'code', conflict_code);
  end if;

  if target_snapshot.operation = 'create' then
    delete from public.listings where id = current_listing.id and organization_id = target_job.organization_id;
    resulting_version := null;
  else
    -- Preserve fields absent from older partial snapshots, and never move a listing between organizations.
    restore_data := to_jsonb(current_listing) - 'location';
    foreach field_name in array array[
      'address','availability_date','bathrooms','bedrooms','description','electricity_estimate',
      'electricity_included','electricity_type','is_featured','landlord_id','latitude','lease_duration',
      'listing_type','longitude','metadata','address_fingerprint','parking_count',
      'parking_estimate','parking_included','parking_type','price','property_type','sale_price',
      'security_fee_estimate','status','title','water_availability','water_estimate','water_included',
      'wifi_available','wifi_estimate','wifi_included'
    ] loop
      if target_snapshot.before_data ? field_name then
        restore_data := jsonb_set(restore_data, array[field_name], target_snapshot.before_data->field_name);
      end if;
    end loop;
    restored_listing := jsonb_populate_record(null::public.listings, restore_data);
    update public.listings set
      address=restored_listing.address, availability_date=restored_listing.availability_date,
      bathrooms=restored_listing.bathrooms, bedrooms=restored_listing.bedrooms,
      description=restored_listing.description, electricity_estimate=restored_listing.electricity_estimate,
      electricity_included=restored_listing.electricity_included, electricity_type=restored_listing.electricity_type,
      is_featured=restored_listing.is_featured, landlord_id=restored_listing.landlord_id,
      latitude=restored_listing.latitude, lease_duration=restored_listing.lease_duration,
      listing_type=restored_listing.listing_type,
      longitude=restored_listing.longitude, metadata=restored_listing.metadata,
      address_fingerprint=restored_listing.address_fingerprint, parking_count=restored_listing.parking_count,
      parking_estimate=restored_listing.parking_estimate, parking_included=restored_listing.parking_included,
      parking_type=restored_listing.parking_type, price=restored_listing.price,
      property_type=restored_listing.property_type, sale_price=restored_listing.sale_price,
      security_fee_estimate=restored_listing.security_fee_estimate, status=restored_listing.status,
      title=restored_listing.title, water_availability=restored_listing.water_availability,
      water_estimate=restored_listing.water_estimate, water_included=restored_listing.water_included,
      wifi_available=restored_listing.wifi_available, wifi_estimate=restored_listing.wifi_estimate,
      wifi_included=restored_listing.wifi_included, updated_at=clock_timestamp()
      where id=current_listing.id and organization_id=target_job.organization_id
      returning updated_at into resulting_version;
    if original_images is not null then
      delete from public.listing_images where listing_id = current_listing.id;
      for image_record in select value from jsonb_array_elements(original_images) loop
        insert into public.listing_images(id, listing_id, bucket, path, public_url, sort_order, created_at)
          values ((image_record->>'id')::uuid, current_listing.id, image_record->>'bucket',
            image_record->>'path', image_record->>'public_url', (image_record->>'sort_order')::integer,
            coalesce((image_record->>'created_at')::timestamptz, clock_timestamp()));
      end loop;
    end if;
    select updated_at into resulting_version from public.listings where id=current_listing.id;
  end if;
  receipt := jsonb_build_object('version',1,'databaseApplied',true,'operation',target_snapshot.operation,
    'cleanupPaths',cleanup_paths,'listingUpdatedAtAfter',resulting_version,
    'actorId',rollback_actor_id,'appliedAt',clock_timestamp());
  update public.listing_import_change_snapshots set rollback_receipt = receipt, rollback_conflict_code = null
    where id = target_snapshot.id;
  return jsonb_build_object('id',target_snapshot.id,'listingId',target_snapshot.listing_id,
    'status','pending','receipt',receipt);
end;
$rollback$;

create function public.prepare_listing_import_rollback_batch(
  target_job_id uuid, target_snapshot_ids uuid[], rollback_actor_id uuid
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $rollback$
declare target_job public.listing_import_jobs%rowtype; snapshot_id uuid; result jsonb := '[]'::jsonb;
begin
  target_job := public.lock_listing_import_rollback_job(target_job_id, rollback_actor_id);
  if cardinality(target_snapshot_ids) is null or cardinality(target_snapshot_ids) not between 1 and 50 then
    raise exception using errcode='22023', message='import_rollback_batch_invalid';
  end if;
  if (select count(*) from public.listing_import_change_snapshots
      where id=any(target_snapshot_ids) and job_id=target_job_id and organization_id=target_job.organization_id)
      <> cardinality(target_snapshot_ids) then
    raise exception using errcode='42501', message='import_rollback_snapshot_unavailable';
  end if;
  perform 1 from public.listing_import_change_snapshots where id=any(target_snapshot_ids) order by id for update;
  perform 1 from public.listings where organization_id=target_job.organization_id
    and id in (select listing_id from public.listing_import_change_snapshots where id=any(target_snapshot_ids))
    order by id for update;
  for snapshot_id in select id from public.listing_import_change_snapshots
    where id=any(target_snapshot_ids) order by created_at desc,id desc loop
    result := result || jsonb_build_array(public.apply_listing_import_rollback_snapshot(
      target_job_id,snapshot_id,rollback_actor_id));
  end loop;
  return result;
end;
$rollback$;

create function public.acknowledge_listing_import_rollback_batch(
  target_job_id uuid, target_snapshot_ids uuid[], rollback_actor_id uuid
)
returns void
language plpgsql security invoker set search_path = ''
as $rollback$
declare target_job public.listing_import_jobs%rowtype; target_snapshot public.listing_import_change_snapshots%rowtype;
begin
  target_job := public.lock_listing_import_rollback_job(target_job_id,rollback_actor_id);
  if cardinality(target_snapshot_ids) is null or cardinality(target_snapshot_ids) not between 1 and 50 then
    raise exception using errcode='22023', message='import_rollback_batch_invalid';
  end if;
  if (select count(*) from public.listing_import_change_snapshots where id=any(target_snapshot_ids)
      and job_id=target_job_id and organization_id=target_job.organization_id) <> cardinality(target_snapshot_ids) then
    raise exception using errcode='42501', message='import_rollback_snapshot_unavailable';
  end if;
  for target_snapshot in select * from public.listing_import_change_snapshots
    where id=any(target_snapshot_ids) order by id for update loop
    if target_snapshot.rollback_receipt is null then
      raise exception using errcode='22023', message='import_rollback_receipt_required';
    end if;
    if target_snapshot.rolled_back_at is null then
      update public.listing_import_change_snapshots set rolled_back_at=clock_timestamp(),rollback_conflict_code=null
        where id=target_snapshot.id;
    end if;
  end loop;
end;
$rollback$;

create function public.finish_listing_import_rollback(target_job_id uuid, rollback_actor_id uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $rollback$
declare
  target_job public.listing_import_jobs%rowtype;
  restored integer; deleted_drafts integer; conflicts integer; pending integer; completed integer;
  result_code text; result_detail text; fingerprint text; counts jsonb;
begin
  target_job := public.lock_listing_import_rollback_job(target_job_id,rollback_actor_id);
  select
    count(*) filter(where rollback_receipt is not null and operation<>'create'),
    count(*) filter(where rollback_receipt is not null and operation='create'),
    count(*) filter(where (rolled_back_at is null and rollback_conflict_code is not null)
      or (rolled_back_at is not null and rollback_receipt is null)),
    count(*) filter(where rolled_back_at is null and rollback_conflict_code is null),
    count(*) filter(where rolled_back_at is not null and rollback_receipt is not null),
    md5(coalesce(string_agg(id::text||':'||coalesce(rolled_back_at::text,'')||':'||
      coalesce(rollback_conflict_code,'')||':'||coalesce((rollback_receipt->>'databaseApplied'),'false'),',' order by id),''))
    into restored,deleted_drafts,conflicts,pending,completed,fingerprint
    from public.listing_import_change_snapshots where job_id=target_job_id;
  result_code := case when pending>0 then 'rollback_incomplete' when conflicts>0 then 'rollback_conflicts' else 'rollback_complete' end;
  result_detail := case when pending>0 then pending||case when pending=1
      then ' change still needs rollback or cleanup. Retry to continue from saved progress.'
      else ' changes still need rollback or cleanup. Retry to continue from saved progress.' end
    when conflicts>0 then conflicts||case when conflicts=1
      then ' listing change requires manual review.' else ' listing changes require manual review.' end
    else 'All eligible import changes were rolled back.' end;
  if exists(select 1 from public.listing_import_change_snapshots where job_id=target_job_id
    and rollback_conflict_code='listing_has_active_applications') then
    result_detail := result_detail || ' Listings with active applications were kept.';
  end if;
  if exists(select 1 from public.listing_import_change_snapshots where job_id=target_job_id
    and rollback_conflict_code='listing_has_active_buyer_interests') then
    result_detail := result_detail || ' Listings with active buyer enquiries were kept.';
  end if;
  counts := jsonb_build_object('restored',restored,'deletedDrafts',deleted_drafts,'conflicts',conflicts,
    'pending',pending,'completed',completed);
  if not exists(select 1 from public.listing_import_events where job_id=target_job_id and event_type=result_code
      and sanitized_detail->>'rollbackFingerprint'=fingerprint) then
    insert into public.listing_import_events(job_id,organization_id,actor_id,event_type,aggregate_counts,sanitized_detail)
      values(target_job_id,target_job.organization_id,rollback_actor_id,result_code,counts,
        jsonb_build_object('rollbackReceiptVersion',1,'rollbackFingerprint',fingerprint));
  end if;
  update public.listing_import_jobs set message_code=result_code,message_detail=result_detail where id=target_job_id;
  return counts||jsonb_build_object('messageCode',result_code);
end;
$rollback$;

revoke all on function public.lock_listing_import_rollback_job(uuid,uuid),
  public.apply_listing_import_rollback_snapshot(uuid,uuid,uuid),
  public.prepare_listing_import_rollback_batch(uuid,uuid[],uuid),
  public.acknowledge_listing_import_rollback_batch(uuid,uuid[],uuid),
  public.finish_listing_import_rollback(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lock_listing_import_rollback_job(uuid,uuid),
  public.apply_listing_import_rollback_snapshot(uuid,uuid,uuid),
  public.prepare_listing_import_rollback_batch(uuid,uuid[],uuid),
  public.acknowledge_listing_import_rollback_batch(uuid,uuid[],uuid),
  public.finish_listing_import_rollback(uuid,uuid) to service_role;

notify pgrst,'reload schema';
commit;
