-- Review writes are atomic and serialized with the job's version. Only the
-- trusted application service can call this invoker function; client roles
-- retain their existing RLS and cannot submit review commands directly.
create function public.apply_listing_import_review(
  target_job_id uuid,
  expected_job_version bigint,
  review_request jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_job public.listing_import_jobs%rowtype;
  target_row public.listing_import_rows%rowtype;
  operation text := review_request->>'action';
  selection jsonb := coalesce(review_request->'selection', '{}'::jsonb);
  patch jsonb := coalesce(review_request->'patch', '{}'::jsonb);
  updated_data jsonb;
  clear_codes text[];
  updated_strategy public.listing_import_duplicate_strategy;
  updated_target uuid;
  updated_state public.listing_import_row_state;
  affected integer := 0;
  saved_row_version bigint;
  requested_agent uuid;
  requested_row uuid;
begin
  if operation is null or operation not in ('patch_row', 'bulk_patch', 'resolve_duplicate') then
    raise exception using errcode = '22023', message = 'invalid_import_review';
  end if;
  select * into target_job from public.listing_import_jobs
  where id = target_job_id for update;
  if not found or expected_job_version is null or target_job.version <> expected_job_version
    or target_job.stage not in ('resolving', 'preview') then
    raise exception using errcode = 'PT409', message = 'import_review_conflict';
  end if;

  if operation = 'bulk_patch' then
    if selection->>'mode' is null or selection->>'mode' not in ('explicit', 'all_matching') then
      raise exception using errcode = '22023', message = 'invalid_import_selection';
    end if;
  else
    requested_row := (review_request->>'rowId')::uuid;
    if requested_row is null then
      raise exception using errcode = '22023', message = 'import_row_required';
    end if;
  end if;
  if patch ? 'responsibleAgentId' then
    requested_agent := (patch->>'responsibleAgentId')::uuid;
    if not exists (
      select 1 from public.organization_memberships m
      where m.organization_id = target_job.organization_id
        and m.user_id = requested_agent and m.revoked_at is null
        and not exists (select 1 from public.account_suspensions s
          where s.user_id = m.user_id and s.restored_at is null
            and (s.suspended_until is null or s.suspended_until > now()))
    ) then
      raise exception using errcode = '42501', message = 'import_agent_unavailable';
    end if;
  end if;

  -- Every row belongs to the locked job. Stable row order prevents opposing
  -- bulk operations from taking row locks in different orders.
  for target_row in
    select r.* from public.listing_import_rows r
    where r.job_id = target_job_id and (
      (operation <> 'bulk_patch' and r.id = requested_row)
      or (operation = 'bulk_patch' and (
        (selection->>'mode' = 'explicit' and r.id in (
          select value::uuid from jsonb_array_elements_text(selection->'included')
        ))
        or (selection->>'mode' = 'all_matching'
          and r.id not in (
            select value::uuid from jsonb_array_elements_text(coalesce(selection->'excluded', '[]'::jsonb))
          )
          and (jsonb_array_length(coalesce(selection#>'{filter,states}', '[]'::jsonb)) = 0
            or r.state::text in (select value from jsonb_array_elements_text(selection#>'{filter,states}')))
          and (not coalesce((selection#>>'{filter,duplicateOnly}')::boolean, false)
            or cardinality(r.duplicate_candidate_ids) > 0)
          and (coalesce(selection#>>'{filter,query}', '') = '' or exists (
            select 1 from unnest(array[
              r.normalized_data->>'title', r.normalized_data->>'address', r.normalized_data->>'sourceReference'
            ]) value where strpos(lower(coalesce(value, '')), lower(selection#>>'{filter,query}')) > 0
          ))
          and (jsonb_array_length(coalesce(selection#>'{filter,severities}', '[]'::jsonb)) = 0 or exists (
            select 1 from public.listing_import_issues i
            where i.row_id = r.id and i.resolved_at is null
              and i.severity::text in (select value from jsonb_array_elements_text(selection#>'{filter,severities}'))
          ))
        )
      ))
    ) order by r.row_number, r.id for update
  loop
    if target_row.state = 'removed' and not coalesce(
      operation = 'bulk_patch' and patch->>'removeFromBatch' = 'false', false
    ) then
      if operation = 'bulk_patch' then continue; end if;
      raise exception using errcode = 'PT409', message = 'import_row_conflict';
    end if;
    if target_row.state in ('committed', 'published')
      or (operation = 'patch_row' and not (review_request ? 'expectedRowVersion'))
      or (review_request ? 'expectedRowVersion'
        and target_row.row_version <> (review_request->>'expectedRowVersion')::bigint) then
      raise exception using errcode = 'PT409', message = 'import_row_conflict';
    end if;

    updated_data := target_row.normalized_data;
    updated_strategy := target_row.duplicate_strategy;
    updated_target := target_row.duplicate_listing_id;
    clear_codes := array[]::text[];
    if operation = 'resolve_duplicate' then
      updated_strategy := (review_request->>'strategy')::public.listing_import_duplicate_strategy;
      if updated_strategy is null then
        raise exception using errcode = '22023', message = 'import_duplicate_strategy_required';
      end if;
      updated_target := nullif(review_request->>'listingId', '')::uuid;
      if updated_strategy in ('replace', 'merge') and updated_target is null then
        raise exception using errcode = '22023', message = 'import_duplicate_target_required';
      end if;
      if updated_target is not null and (
        not (updated_target = any(target_row.duplicate_candidate_ids))
        or not exists (select 1 from public.listings l
          where l.id = updated_target and l.organization_id = target_job.organization_id)
      ) then
        raise exception using errcode = '42501', message = 'import_duplicate_target_unavailable';
      end if;
      if updated_strategy = 'import_new' then updated_target := null; end if;
      clear_codes := array['ambiguous_duplicate', 'duplicate_external_reference', 'duplicate_address', 'duplicate_coordinates'];
    else
      -- A generic price edit applies to the listing's own price field. Other
      -- canonical fields are preserved; publication/removal are explicit flags.
      if updated_data->>'listingType' = 'sale' and patch ? 'price' then
        updated_data := updated_data || (patch - 'price' - 'removeFromBatch')
          || jsonb_build_object('salePrice', coalesce(patch->'salePrice', patch->'price'));
      else
        updated_data := updated_data || (patch - 'removeFromBatch');
      end if;
      if patch ? 'title' then clear_codes := clear_codes || 'missing_title'::text; end if;
      if patch ? 'address' then clear_codes := clear_codes || 'missing_address'::text; end if;
      if (updated_data->>'listingType' = 'sale' and (patch ? 'price' or patch ? 'salePrice'))
        or (updated_data->>'listingType' is distinct from 'sale' and patch ? 'price') then
        clear_codes := clear_codes || 'invalid_price'::text;
      end if;
      if patch ? 'availabilityDate' then clear_codes := clear_codes || 'invalid_date'::text; end if;
      if patch ? 'propertyType' then clear_codes := clear_codes || 'invalid_enum'::text; end if;
      if patch ? 'responsibleAgentId' then clear_codes := clear_codes || 'responsible_agent_required'::text; end if;
      if patch ? 'latitude' or patch ? 'longitude' then
        clear_codes := clear_codes || array['invalid_coordinates', 'ambiguous_geocode'];
      end if;
    end if;

    -- Preserve unrelated asset, contact, and validation findings. A positive
    -- validated field correction clears only that field's existing findings.
    delete from public.listing_import_issues
      where row_id = target_row.id and resolved_at is null and code = any(clear_codes);
    if (patch ? 'latitude' or patch ? 'longitude') and (
      jsonb_typeof(updated_data->'latitude') is distinct from 'number'
      or jsonb_typeof(updated_data->'longitude') is distinct from 'number'
      or (updated_data->>'latitude')::numeric not between -90 and 90
      or (updated_data->>'longitude')::numeric not between -180 and 180
    ) then
      insert into public.listing_import_issues(job_id, row_id, organization_id, severity, code, field, message)
      values (target_job_id, target_row.id, target_job.organization_id, 'publish_blocker',
        'invalid_coordinates', 'latitude', 'Provide both valid latitude and longitude values.');
    end if;

    updated_state := case
      when patch->>'removeFromBatch' = 'true' then 'removed'
      when updated_strategy = 'skip' then 'skipped'
      when cardinality(target_row.duplicate_candidate_ids) > 0 and updated_strategy is null then 'duplicate_review'
      when exists (select 1 from public.listing_import_issues i
        where i.row_id = target_row.id and i.resolved_at is null and i.severity = 'blocking') then 'parse_blocked'
      when exists (select 1 from public.listing_import_issues i
        where i.row_id = target_row.id and i.resolved_at is null and i.severity = 'publish_blocker') then 'publish_blocked'
      when exists (select 1 from public.listing_import_issues i
        where i.row_id = target_row.id and i.resolved_at is null and i.severity = 'warning') then 'warning'
      else 'draft_ready'
    end;
    update public.listing_import_rows set
      normalized_data = updated_data,
      responsible_agent_id = nullif(updated_data->>'responsibleAgentId', '')::uuid,
      office_id = nullif(updated_data->>'officeId', '')::uuid,
      address_fingerprint = case when patch ? 'address'
        then review_request->>'addressFingerprint' else target_row.address_fingerprint end,
      publication_selected = coalesce((updated_data->>'publicationSelected')::boolean, target_row.publication_selected),
      duplicate_strategy = updated_strategy, duplicate_listing_id = updated_target,
      state = updated_state, row_version = row_version + 1, updated_at = now()
    where id = target_row.id returning row_version into saved_row_version;
    affected := affected + 1;
  end loop;
  if operation <> 'bulk_patch' and affected <> 1 then
    raise exception using errcode = 'P0002', message = 'import_row_not_found';
  end if;
  perform public.refresh_listing_import_job_counters(target_job_id);
  update public.listing_import_jobs set version = version + 1 where id = target_job_id;
  return jsonb_build_object('affected', affected, 'rowId', requested_row, 'rowVersion', saved_row_version);
end;
$$;

revoke all on function public.apply_listing_import_review(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.apply_listing_import_review(uuid, bigint, jsonb) to service_role;

-- All staging writes already use authenticated application routes and the
-- service client. Keep scoped SELECT/Realtime access while preventing direct
-- Data API writes from bypassing stage, row-version and validation guards.
revoke insert, update, delete, truncate, references, trigger
on table public.listing_import_jobs, public.listing_import_rows,
  public.listing_import_issues, public.listing_import_assets,
  public.listing_import_templates
from public, anon, authenticated;

notify pgrst, 'reload schema';
