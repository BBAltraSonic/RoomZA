-- Enterprise bulk listing imports acceptance plan.
-- Apply the matching migration to a disposable local Supabase database first.
-- This transaction validates the production security and indexing contract and
-- leaves the database unchanged.
begin;
select plan(1);

do $$
declare
  table_name text;
  required_tables constant text[] := array[
    'organizations', 'organization_offices', 'organization_memberships',
    'organization_invitations', 'listing_external_refs', 'listing_import_jobs',
    'listing_import_rows', 'listing_import_issues', 'listing_import_assets',
    'listing_import_templates', 'listing_import_events',
    'listing_import_change_snapshots', 'listing_import_geocode_cache'
  ];
begin
  foreach table_name in array required_tables loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
        and c.relforcerowsecurity
    ) then
      raise exception 'FAIL: %.% must enable and force RLS', 'public', table_name;
    end if;
  end loop;

  if has_function_privilege('authenticated', 'public.claim_listing_import_chunk(uuid,public.listing_import_job_stage,bigint,bigint,integer)', 'execute')
    or has_function_privilege('anon', 'public.claim_listing_import_chunk(uuid,public.listing_import_job_stage,bigint,bigint,integer)', 'execute')
    or not has_function_privilege('service_role', 'public.claim_listing_import_chunk(uuid,public.listing_import_job_stage,bigint,bigint,integer)', 'execute') then
    raise exception 'FAIL: chunk claim RPC is not service-role-only';
  end if;

  if has_function_privilege('authenticated', 'public.apply_listing_import_row_results(uuid,public.listing_import_job_stage,bigint,bigint,jsonb,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'public.apply_listing_import_row_results(uuid,public.listing_import_job_stage,bigint,bigint,jsonb,jsonb)', 'execute') then
    raise exception 'FAIL: per-row result RPC is not service-role-only';
  end if;

  if not has_table_privilege('service_role', 'public.listings', 'select,insert,update,delete')
    or not has_table_privilege('service_role', 'public.listing_images', 'select,insert,update,delete') then
    raise exception 'FAIL: import workers cannot create, update, or roll back listing records';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'listing_external_refs'
      and indexdef ilike '%unique%'
      and indexdef ilike '%organization_id, provider, source_reference%'
  ) then
    raise exception 'FAIL: organization/provider/source reference uniqueness is missing';
  end if;

  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname like 'listing_import_%'
      and c.contype = 'f'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
      )
  ) then
    raise exception 'FAIL: an import foreign key is missing a supporting index';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'listings'
      and policyname = 'Organization members can read managed listings'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'Organization managers can view listing applications'
  ) then
    raise exception 'FAIL: organization listing/application authorization policies are missing';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname ilike '%organization%'
  ) then
    raise exception 'FAIL: organization managers must not receive conversation-content access';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'listing-imports'
      and not public
      and file_size_limit = 2147483648
      and allowed_mime_types @> array[
        'text/csv',
        'text/tab-separated-values',
        'application/vnd.ms-excel'
      ]
  ) then
    raise exception 'FAIL: private listing-imports bucket is missing or misconfigured';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'listing_import_jobs'
  ) or exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename in ('listing_import_rows', 'listing_import_issues', 'listing_import_assets')
  ) then
    raise exception 'FAIL: Realtime must publish job-level progress only';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'try_uuid'
      and 'search_path=pg_catalog' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception 'FAIL: private.try_uuid must have an immutable search path';
  end if;
end;
$$;
select pass('enterprise import RLS, grants, indexes, storage, and Realtime boundaries are correct');

-- Manual identity matrix for the local test harness:
-- 1. Seed owner, admin, assigned agent, unrelated member, personal landlord,
--    revoked member, and service worker identities.
-- 2. Set request.jwt.claim.sub and role=authenticated for each identity.
-- 3. Assert owner/admin see and mutate organization rows; assigned agents see
--    assigned listings only; unrelated/revoked users see none; personal
--    landlords retain their own personal listings; service worker RPCs work.
-- 4. Exercise duplicate delivery and stale cursors against
--    claim_listing_import_chunk, then inject one invalid row result and confirm
--    other row results commit.
-- 5. Edit a listing after an import snapshot and confirm rollback reports a
--    conflict instead of overwriting the later edit.

select * from finish();
rollback;
