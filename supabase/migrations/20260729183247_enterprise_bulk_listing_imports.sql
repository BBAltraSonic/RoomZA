-- Enterprise bulk listing imports, production V1.
-- This migration is intentionally created but not applied by this change.

create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_role') then
    create type public.organization_role as enum ('owner', 'admin', 'agent');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_import_source_kind') then
    create type public.listing_import_source_kind as enum (
      'csv', 'xlsx', 'xml', 'json', 'pasted_table', 'image_archive', 'image_folder',
      'image_urls', 'pinpoint_v1'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_import_job_stage') then
    create type public.listing_import_job_stage as enum (
      'source', 'upload', 'mapping', 'validating', 'resolving', 'preview',
      'committing', 'confirming', 'complete', 'cancelled', 'failed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_import_row_state') then
    create type public.listing_import_row_state as enum (
      'pending', 'parse_blocked', 'draft_ready', 'publish_blocked', 'warning',
      'duplicate_review', 'committed', 'published', 'skipped', 'failed', 'removed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_import_issue_severity') then
    create type public.listing_import_issue_severity as enum ('blocking', 'publish_blocker', 'warning');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_import_duplicate_strategy') then
    create type public.listing_import_duplicate_strategy as enum ('skip', 'replace', 'merge', 'import_new');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_import_asset_state') then
    create type public.listing_import_asset_state as enum ('uploaded', 'url_pending', 'matched', 'unmatched', 'rejected', 'attached');
  end if;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  imports_pilot_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (slug)
);

create table public.organization_offices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text,
  phone text,
  email text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create unique index organization_offices_one_default_idx
  on public.organization_offices(organization_id)
  where is_default;

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  office_id uuid references public.organization_offices(id) on delete set null,
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.organization_role not null check (role <> 'owner'),
  office_id uuid references public.organization_offices(id) on delete set null,
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '7 days')
);

create unique index organization_invitations_open_email_idx
  on public.organization_invitations(organization_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations(id) on delete set null;

alter table public.listings
  add column if not exists organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists is_featured boolean not null default false,
  add column if not exists address_fingerprint text,
  alter column latitude drop not null,
  alter column longitude drop not null;

create index listings_organization_status_idx
  on public.listings(organization_id, status, updated_at desc)
  where organization_id is not null;
create index listings_organization_address_fingerprint_idx
  on public.listings(organization_id, address_fingerprint, listing_type)
  where organization_id is not null and address_fingerprint is not null;

create table public.listing_external_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 1 and 80),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, source_reference)
);

create index listing_external_refs_listing_id_idx on public.listing_external_refs(listing_id);

create table public.listing_import_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  source_kind public.listing_import_source_kind not null,
  adapter_version text not null,
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  enum_dictionaries jsonb not null default '{}'::jsonb check (jsonb_typeof(enum_dictionaries) = 'object'),
  defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(defaults) = 'object'),
  default_agent_id uuid references public.profiles(id) on delete set null,
  default_office_id uuid references public.organization_offices(id) on delete set null,
  publish_preselected boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.listing_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  source_kind public.listing_import_source_kind not null,
  source_name text,
  source_path text,
  source_size_bytes bigint check (source_size_bytes is null or source_size_bytes >= 0),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  adapter_version text not null default '1',
  record_path text,
  sheet_name text,
  stage public.listing_import_job_stage not null default 'source',
  stage_cursor bigint not null default 0 check (stage_cursor >= 0),
  version bigint not null default 1 check (version > 0),
  total_rows integer not null default 0 check (total_rows between 0 and 25000),
  processed_rows integer not null default 0 check (processed_rows between 0 and 25000),
  valid_rows integer not null default 0 check (valid_rows between 0 and 25000),
  warning_rows integer not null default 0 check (warning_rows between 0 and 25000),
  blocked_rows integer not null default 0 check (blocked_rows between 0 and 25000),
  committed_rows integer not null default 0 check (committed_rows between 0 and 25000),
  failed_rows integer not null default 0 check (failed_rows between 0 and 25000),
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(defaults) = 'object'),
  selection jsonb not null default '{"mode":"explicit","included":[],"excluded":[]}'::jsonb
    check (jsonb_typeof(selection) = 'object'),
  message_code text,
  message_detail text,
  cancel_requested_at timestamptz,
  cancelled_at timestamptz,
  heartbeat_at timestamptz,
  last_progress_at timestamptz,
  completed_at timestamptz,
  retention_source_until timestamptz not null default (now() + interval '30 days'),
  retention_audit_until timestamptz not null default (now() + interval '1 year'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listing_import_jobs_org_updated_idx
  on public.listing_import_jobs(organization_id, updated_at desc, id desc);
create index listing_import_jobs_active_heartbeat_idx
  on public.listing_import_jobs(heartbeat_at)
  where stage in ('validating', 'committing');

create table public.listing_import_rows (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.listing_import_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  unmapped_data jsonb not null default '{}'::jsonb,
  state public.listing_import_row_state not null default 'pending',
  address_fingerprint text,
  duplicate_candidate_ids uuid[] not null default '{}',
  duplicate_strategy public.listing_import_duplicate_strategy,
  duplicate_listing_id uuid references public.listings(id) on delete set null,
  responsible_agent_id uuid references public.profiles(id) on delete set null,
  office_id uuid references public.organization_offices(id) on delete set null,
  publication_selected boolean not null default false,
  resulting_listing_id uuid references public.listings(id) on delete set null,
  row_version bigint not null default 1,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, row_number)
);

create index listing_import_rows_cursor_idx
  on public.listing_import_rows(job_id, row_number, id);
create index listing_import_rows_state_idx
  on public.listing_import_rows(job_id, state, row_number);
create index listing_import_rows_address_idx
  on public.listing_import_rows(organization_id, address_fingerprint)
  where address_fingerprint is not null;

create table public.listing_import_issues (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.listing_import_jobs(id) on delete cascade,
  row_id uuid references public.listing_import_rows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  severity public.listing_import_issue_severity not null,
  code text not null,
  field text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index listing_import_issues_job_filter_idx
  on public.listing_import_issues(job_id, severity, resolved_at, row_id);
create index listing_import_issues_row_id_idx on public.listing_import_issues(row_id);

create table public.listing_import_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.listing_import_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_id uuid references public.listing_import_rows(id) on delete set null,
  state public.listing_import_asset_state not null default 'uploaded',
  source_name text,
  source_url_hash text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  archive_size_bytes bigint check (archive_size_bytes is null or archive_size_bytes between 0 and 2147483648),
  width integer,
  height integer,
  sort_order integer check (sort_order is null or sort_order between 0 and 19),
  is_cover boolean not null default false,
  match_method text,
  rejection_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listing_import_assets_job_state_idx
  on public.listing_import_assets(job_id, state, id);
create index listing_import_assets_row_sort_idx
  on public.listing_import_assets(row_id, sort_order)
  where row_id is not null;
create unique index listing_import_assets_one_cover_idx
  on public.listing_import_assets(row_id)
  where is_cover and row_id is not null;

create table public.listing_import_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.listing_import_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  stage public.listing_import_job_stage,
  cursor bigint,
  aggregate_counts jsonb not null default '{}'::jsonb,
  sanitized_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index listing_import_events_job_created_idx
  on public.listing_import_events(job_id, created_at desc, id desc);

create table public.listing_import_change_snapshots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.listing_import_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_id uuid references public.listing_import_rows(id) on delete set null,
  listing_id uuid not null,
  operation text not null check (operation in ('create', 'replace', 'merge', 'publish', 'rollback')),
  before_data jsonb,
  after_data jsonb,
  listing_updated_at_before timestamptz,
  listing_updated_at_after timestamptz,
  rolled_back_at timestamptz,
  rollback_conflict_code text,
  created_at timestamptz not null default now()
);

create index listing_import_snapshots_job_idx
  on public.listing_import_change_snapshots(job_id, listing_id, created_at desc);

create table public.listing_import_geocode_cache (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  address_fingerprint text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  confidence numeric(5,4),
  result_metadata jsonb not null default '{}'::jsonb,
  confirmed_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, address_fingerprint)
);

-- Foreign-key indexes keep membership revocation, retention cleanup, and
-- organization deletion bounded even for large import histories.
create index organizations_owner_id_idx
  on public.organizations(owner_id);
create index organization_memberships_user_id_idx
  on public.organization_memberships(user_id);
create index organization_memberships_office_id_idx
  on public.organization_memberships(office_id);
create index organization_memberships_invited_by_idx
  on public.organization_memberships(invited_by);
create index organization_invitations_organization_id_idx
  on public.organization_invitations(organization_id);
create index organization_invitations_office_id_idx
  on public.organization_invitations(office_id);
create index organization_invitations_invited_by_idx
  on public.organization_invitations(invited_by);
create index organization_invitations_accepted_by_idx
  on public.organization_invitations(accepted_by);
create index profiles_active_organization_id_idx
  on public.profiles(active_organization_id);
create index listing_import_templates_default_agent_id_idx
  on public.listing_import_templates(default_agent_id);
create index listing_import_templates_default_office_id_idx
  on public.listing_import_templates(default_office_id);
create index listing_import_templates_created_by_idx
  on public.listing_import_templates(created_by);
create index listing_import_jobs_created_by_idx
  on public.listing_import_jobs(created_by);
create index listing_import_rows_organization_id_idx
  on public.listing_import_rows(organization_id);
create index listing_import_rows_duplicate_listing_id_idx
  on public.listing_import_rows(duplicate_listing_id);
create index listing_import_rows_responsible_agent_id_idx
  on public.listing_import_rows(responsible_agent_id);
create index listing_import_rows_office_id_idx
  on public.listing_import_rows(office_id);
create index listing_import_rows_resulting_listing_id_idx
  on public.listing_import_rows(resulting_listing_id);
create index listing_import_issues_organization_id_idx
  on public.listing_import_issues(organization_id);
create index listing_import_issues_resolved_by_idx
  on public.listing_import_issues(resolved_by);
create index listing_import_assets_organization_id_idx
  on public.listing_import_assets(organization_id);
create index listing_import_events_organization_id_idx
  on public.listing_import_events(organization_id);
create index listing_import_events_actor_id_idx
  on public.listing_import_events(actor_id);
create index listing_import_snapshots_organization_id_idx
  on public.listing_import_change_snapshots(organization_id);
create index listing_import_snapshots_row_id_idx
  on public.listing_import_change_snapshots(row_id);
create index listing_import_geocode_cache_confirmed_by_idx
  on public.listing_import_geocode_cache(confirmed_by);

create or replace function private.organization_role_for(
  target_organization_id uuid,
  target_user_id uuid default auth.uid()
)
returns public.organization_role
language sql
stable
security definer
set search_path = public, private
as $$
  select role
  from public.organization_memberships
  where organization_id = target_organization_id
    and user_id = target_user_id
    and revoked_at is null
  limit 1
$$;

create or replace function private.has_organization_role(
  target_organization_id uuid,
  accepted_roles public.organization_role[],
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select coalesce(
    private.organization_role_for(target_organization_id, target_user_id) = any(accepted_roles),
    false
  )
$$;

create or replace function private.can_manage_listing(
  target_listing_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = target_listing_id
      and (
        l.landlord_id = target_user_id
        or (
          l.organization_id is not null
          and private.has_organization_role(
            l.organization_id,
            array['owner', 'admin']::public.organization_role[],
            target_user_id
          )
        )
      )
  )
$$;

revoke all on function private.organization_role_for(uuid, uuid) from public, anon, authenticated;
revoke all on function private.has_organization_role(uuid, public.organization_role[], uuid) from public, anon, authenticated;
revoke all on function private.can_manage_listing(uuid, uuid) from public, anon, authenticated;
grant execute on function private.organization_role_for(uuid, uuid) to authenticated, service_role;
grant execute on function private.has_organization_role(uuid, public.organization_role[], uuid) to authenticated, service_role;
grant execute on function private.can_manage_listing(uuid, uuid) to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_offices enable row level security;
alter table public.organization_offices force row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_invitations force row level security;
alter table public.listing_external_refs enable row level security;
alter table public.listing_external_refs force row level security;
alter table public.listing_import_templates enable row level security;
alter table public.listing_import_templates force row level security;
alter table public.listing_import_jobs enable row level security;
alter table public.listing_import_jobs force row level security;
alter table public.listing_import_rows enable row level security;
alter table public.listing_import_rows force row level security;
alter table public.listing_import_issues enable row level security;
alter table public.listing_import_issues force row level security;
alter table public.listing_import_assets enable row level security;
alter table public.listing_import_assets force row level security;
alter table public.listing_import_events enable row level security;
alter table public.listing_import_events force row level security;
alter table public.listing_import_change_snapshots enable row level security;
alter table public.listing_import_change_snapshots force row level security;
alter table public.listing_import_geocode_cache enable row level security;
alter table public.listing_import_geocode_cache force row level security;

create policy "Members can view their organizations"
  on public.organizations for select to authenticated
  using (private.has_organization_role(id, array['owner', 'admin', 'agent']::public.organization_role[]));
create policy "Owners can update organizations"
  on public.organizations for update to authenticated
  using (private.has_organization_role(id, array['owner']::public.organization_role[]))
  with check (private.has_organization_role(id, array['owner']::public.organization_role[]));

create policy "Members can view organization offices"
  on public.organization_offices for select to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin', 'agent']::public.organization_role[]));
create policy "Organization managers can manage offices"
  on public.organization_offices for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "Members can view organization membership"
  on public.organization_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
  );
create policy "Organization managers can manage non-owner memberships"
  on public.organization_memberships for update to authenticated
  using (
    role <> 'owner'
    and (
      private.has_organization_role(organization_id, array['owner']::public.organization_role[])
      or (
        role = 'agent'
        and private.has_organization_role(organization_id, array['admin']::public.organization_role[])
      )
    )
  )
  with check (
    role <> 'owner'
    and (
      private.has_organization_role(organization_id, array['owner']::public.organization_role[])
      or (
        role = 'agent'
        and private.has_organization_role(organization_id, array['admin']::public.organization_role[])
      )
    )
  );

create policy "Organization managers can view invitations"
  on public.organization_invitations for select to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can create permitted invitations"
  on public.organization_invitations for insert to authenticated
  with check (
    private.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (
      role = 'agent'
      and private.has_organization_role(organization_id, array['admin']::public.organization_role[])
    )
  );
create policy "Organization managers can update permitted invitations"
  on public.organization_invitations for update to authenticated
  using (
    private.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (
      role = 'agent'
      and private.has_organization_role(organization_id, array['admin']::public.organization_role[])
    )
  )
  with check (
    private.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (
      role = 'agent'
      and private.has_organization_role(organization_id, array['admin']::public.organization_role[])
    )
  );
create policy "Organization managers can delete permitted invitations"
  on public.organization_invitations for delete to authenticated
  using (
    private.has_organization_role(organization_id, array['owner']::public.organization_role[])
    or (
      role = 'agent'
      and private.has_organization_role(organization_id, array['admin']::public.organization_role[])
    )
  );

create policy "Organization managers can manage external references"
  on public.listing_external_refs for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "Organization managers can manage import templates"
  on public.listing_import_templates for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "Organization managers can read import jobs"
  on public.listing_import_jobs for select to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can create import jobs"
  on public.listing_import_jobs for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
  );
create policy "Organization managers can update import jobs"
  on public.listing_import_jobs for update to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can delete import jobs"
  on public.listing_import_jobs for delete to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

create policy "Organization managers can manage import rows"
  on public.listing_import_rows for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can manage import issues"
  on public.listing_import_issues for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can manage import assets"
  on public.listing_import_assets for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can read import events"
  on public.listing_import_events for select to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can read import snapshots"
  on public.listing_import_change_snapshots for select to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));
create policy "Organization managers can manage geocode cache"
  on public.listing_import_geocode_cache for all to authenticated
  using (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]))
  with check (private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[]));

drop policy if exists "Organization members can read managed listings" on public.listings;
create policy "Organization members can read managed listings"
  on public.listings for select to authenticated
  using (
    organization_id is not null
    and (
      landlord_id = (select auth.uid())
      or private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
    )
  );

drop policy if exists "Organization managers can insert managed listings" on public.listings;
create policy "Organization managers can insert managed listings"
  on public.listings for insert to authenticated
  with check (
    organization_id is not null
    and private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
    and private.has_organization_role(
      organization_id,
      array['owner', 'admin', 'agent']::public.organization_role[],
      landlord_id
    )
  );

drop policy if exists "Organization managers can update managed listings" on public.listings;
create policy "Organization managers can update managed listings"
  on public.listings for update to authenticated
  using (
    organization_id is not null
    and private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
  )
  with check (
    organization_id is not null
    and private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
    and private.has_organization_role(
      organization_id,
      array['owner', 'admin', 'agent']::public.organization_role[],
      landlord_id
    )
  );

drop policy if exists "Organization managers can delete managed listings" on public.listings;
create policy "Organization managers can delete managed listings"
  on public.listings for delete to authenticated
  using (
    organization_id is not null
    and private.has_organization_role(organization_id, array['owner', 'admin']::public.organization_role[])
  );

create policy "Organization listing managers can read images"
  on public.listing_images for select to authenticated
  using (private.can_manage_listing(listing_id));
create policy "Organization listing managers can insert images"
  on public.listing_images for insert to authenticated
  with check (private.can_manage_listing(listing_id));
create policy "Organization listing managers can update images"
  on public.listing_images for update to authenticated
  using (private.can_manage_listing(listing_id))
  with check (private.can_manage_listing(listing_id));
create policy "Organization listing managers can delete images"
  on public.listing_images for delete to authenticated
  using (private.can_manage_listing(listing_id));

create policy "Organization managers can view listing applications"
  on public.applications for select to authenticated
  using (private.can_manage_listing(listing_id));
create policy "Organization managers can update listing applications"
  on public.applications for update to authenticated
  using (private.can_manage_listing(listing_id))
  with check (private.can_manage_listing(listing_id));
create policy "Organization managers can read application documents"
  on public.documents for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = documents.application_id
        and private.can_manage_listing(a.listing_id)
    )
  );
create policy "Organization managers can read application status events"
  on public.application_status_events for select to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_status_events.application_id
        and private.can_manage_listing(a.listing_id)
    )
  );
create policy "Organization managers can manage listing viewing slots"
  on public.viewing_slots for all to authenticated
  using (private.can_manage_listing(listing_id))
  with check (private.can_manage_listing(listing_id));
create policy "Organization managers can manage listing viewings"
  on public.viewings for all to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = viewings.application_id
        and private.can_manage_listing(a.listing_id)
    )
  );

create or replace function private.guard_organization_listing_changes()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.organization_id is not null and not private.has_organization_role(
    new.organization_id,
    array['owner', 'admin', 'agent']::public.organization_role[],
    new.landlord_id
  ) then
    raise exception 'Responsible agent must be an active organization member'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.landlord_id is distinct from old.landlord_id
     and old.status = 'published'
     and (
       exists (
         select 1 from public.applications a
         where a.listing_id = old.id and a.status not in ('rejected', 'withdrawn')
       )
       or exists (
         select 1 from public.conversations c
         where c.listing_id = old.id
       )
     ) then
    raise exception 'Published listings with active conversations or applications cannot be bulk reassigned'
      using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' and new.is_featured is distinct from old.is_featured
     and not private.has_organization_role(
       new.organization_id,
       array['owner', 'admin']::public.organization_role[]
     ) then
    raise exception 'Only organization owners and admins can feature listings'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_organization_listing_changes on public.listings;
create trigger guard_organization_listing_changes
  before insert or update of organization_id, landlord_id, is_featured
  on public.listings
  for each row execute function private.guard_organization_listing_changes();

create or replace function public.accept_organization_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  invitation public.organization_invitations;
  current_email text;
  profile_role text;
begin
  select * into invitation
  from public.organization_invitations
  where token_hash = invitation_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation is invalid or has expired';
  end if;

  select lower(email), role into current_email, profile_role
  from public.profiles where id = auth.uid();

  if current_email is distinct from lower(invitation.email) then
    raise exception 'Sign in with the email address that received this invitation';
  end if;
  if profile_role is distinct from 'landlord' then
    raise exception 'Organization access requires a landlord account. Your renter profile was not changed.';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, role, office_id, invited_by
  ) values (
    invitation.organization_id, auth.uid(), invitation.role, invitation.office_id, invitation.invited_by
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role, office_id = excluded.office_id, revoked_at = null, updated_at = now();

  update public.organization_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invitation.id;

  update public.profiles
  set active_organization_id = invitation.organization_id
  where id = auth.uid();

  return invitation.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;

create or replace function public.create_organization(organization_name text, organization_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'landlord'
  ) then
    raise exception 'Create or switch to a landlord account before creating an organization';
  end if;

  insert into public.organizations(name, slug, owner_id)
  values (btrim(organization_name), lower(btrim(organization_slug)), auth.uid())
  returning id into new_organization_id;

  insert into public.organization_memberships(organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');

  update public.profiles
  set active_organization_id = new_organization_id
  where id = auth.uid();

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

create or replace function public.delete_listing_checked(target_listing_id uuid)
returns table(listing_id uuid, result text)
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  target_listing public.listings%rowtype;
begin
  select * into target_listing from public.listings where id = target_listing_id for update;
  if target_listing.id is null or not (
    (target_listing.organization_id is null and target_listing.landlord_id = auth.uid())
    or (
      target_listing.organization_id is not null
      and private.has_organization_role(
        target_listing.organization_id,
        array['owner', 'admin']::public.organization_role[]
      )
    )
  ) then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  if exists (
    select 1 from public.applications
    where applications.listing_id = target_listing_id
      and applications.status in ('submitted', 'under_review', 'shortlisted', 'approved')
  ) then
    return query select target_listing_id, 'active_applications'::text;
    return;
  end if;
  delete from public.listings where id = target_listing_id;
  return query select target_listing_id, 'deleted'::text;
end;
$$;
revoke all on function public.delete_listing_checked(uuid) from public, anon;
grant execute on function public.delete_listing_checked(uuid) to authenticated;

create or replace function public.duplicate_listing(target_listing_id uuid)
returns table(listing_id uuid, result text)
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  source_listing public.listings%rowtype;
  new_listing_id uuid := gen_random_uuid();
begin
  select * into source_listing from public.listings where id = target_listing_id;
  if source_listing.id is null or not private.can_manage_listing(target_listing_id) then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  insert into public.listings (
    id, landlord_id, organization_id, listing_type, title, description, price, sale_price,
    address, address_fingerprint, latitude, longitude, property_type, bedrooms,
    bathrooms, availability_date, lease_duration, status, water_included, water_estimate,
    water_availability, electricity_included, electricity_estimate, electricity_type,
    parking_included, parking_estimate, parking_type, parking_count, wifi_included,
    wifi_estimate, wifi_available, security_fee_estimate, metadata, is_featured
  )
  values (
    new_listing_id, source_listing.landlord_id, source_listing.organization_id,
    source_listing.listing_type,
    coalesce(nullif(trim(source_listing.title), ''), 'Untitled listing') || ' (Copy)',
    source_listing.description, source_listing.price, source_listing.sale_price,
    source_listing.address, source_listing.address_fingerprint, source_listing.latitude,
    source_listing.longitude, source_listing.property_type,
    source_listing.bedrooms, source_listing.bathrooms, source_listing.availability_date,
    source_listing.lease_duration, 'draft', source_listing.water_included,
    source_listing.water_estimate, source_listing.water_availability,
    source_listing.electricity_included, source_listing.electricity_estimate,
    source_listing.electricity_type, source_listing.parking_included,
    source_listing.parking_estimate, source_listing.parking_type,
    source_listing.parking_count, source_listing.wifi_included, source_listing.wifi_estimate,
    source_listing.wifi_available, source_listing.security_fee_estimate,
    source_listing.metadata, false
  );
  insert into public.listing_images(listing_id, bucket, path, public_url, sort_order)
  select new_listing_id, li.bucket, li.path, li.public_url, li.sort_order
  from public.listing_images li
  where li.listing_id = target_listing_id;
  return query select new_listing_id, 'duplicated'::text;
end;
$$;
revoke all on function public.duplicate_listing(uuid) from public, anon;
grant execute on function public.duplicate_listing(uuid) to authenticated;

create or replace function public.find_listing_import_coordinate_duplicates(
  target_organization_id uuid,
  target_listing_type public.listing_type,
  target_longitude double precision,
  target_latitude double precision
)
returns table(listing_id uuid, distance_metres double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    l.id,
    extensions.st_distance(
      l.location::extensions.geography,
      extensions.st_setsrid(
        extensions.st_makepoint(target_longitude, target_latitude),
        4326
      )::extensions.geography
    )
  from public.listings l
  where l.organization_id = target_organization_id
    and l.listing_type = target_listing_type
    and l.location is not null
    and extensions.st_dwithin(
      l.location::extensions.geography,
      extensions.st_setsrid(
        extensions.st_makepoint(target_longitude, target_latitude),
        4326
      )::extensions.geography,
      25
    )
  order by 2 asc, l.id asc
$$;

revoke all on function public.find_listing_import_coordinate_duplicates(uuid, public.listing_type, double precision, double precision)
from public, anon, authenticated;
grant execute on function public.find_listing_import_coordinate_duplicates(uuid, public.listing_type, double precision, double precision)
to service_role;

create or replace function public.find_listing_import_duplicate_candidates(
  target_organization_id uuid,
  provider_name text,
  candidates jsonb
)
returns table(row_number integer, listing_id uuid, match_kind text, distance_metres double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with candidate as (
    select
      (item->>'rowNumber')::integer as row_number,
      nullif(item->>'sourceReference', '') as source_reference,
      nullif(item->>'addressFingerprint', '') as address_fingerprint,
      nullif(item->>'listingType', '')::public.listing_type as listing_type,
      nullif(item->>'longitude', '')::double precision as longitude,
      nullif(item->>'latitude', '')::double precision as latitude
    from jsonb_array_elements(candidates) item
  ),
  matches(row_number, listing_id, match_kind, distance_metres) as (
  select c.row_number, r.listing_id, 'external_reference'::text, null::double precision
  from candidate c
  join public.listing_external_refs r
    on r.organization_id = target_organization_id
   and r.provider = provider_name
   and r.source_reference = c.source_reference
  where c.source_reference is not null
  union all
  select c.row_number, l.id, 'address_fingerprint'::text, null::double precision
  from candidate c
  join public.listings l
    on l.organization_id = target_organization_id
   and l.address_fingerprint = c.address_fingerprint
   and l.listing_type = c.listing_type
  where c.address_fingerprint is not null
  union all
  select
    c.row_number,
    l.id,
    'nearby_coordinates'::text,
    extensions.st_distance(
      l.location::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(c.longitude, c.latitude), 4326)::extensions.geography
    )
  from candidate c
  join public.listings l
    on l.organization_id = target_organization_id
   and l.listing_type = c.listing_type
   and l.location is not null
  where c.longitude is not null
    and c.latitude is not null
    and extensions.st_dwithin(
      l.location::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(c.longitude, c.latitude), 4326)::extensions.geography,
      25
    )
  )
  select m.row_number, m.listing_id, m.match_kind, m.distance_metres
  from matches m
  order by
    m.row_number,
    case m.match_kind
      when 'external_reference' then 1
      when 'address_fingerprint' then 2
      else 3
    end,
    m.distance_metres nulls last,
    m.listing_id
$$;

revoke all on function public.find_listing_import_duplicate_candidates(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.find_listing_import_duplicate_candidates(uuid, text, jsonb)
to service_role;

create or replace function public.claim_listing_import_chunk(
  target_job_id uuid,
  expected_stage public.listing_import_job_stage,
  expected_cursor bigint,
  expected_version bigint,
  chunk_size integer default 500
)
returns table (
  claimed boolean,
  organization_id uuid,
  created_by uuid,
  stage public.listing_import_job_stage,
  cursor bigint,
  version bigint,
  cancelled boolean
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  claimed_job public.listing_import_jobs;
begin
  if chunk_size < 1 or chunk_size > 500 then
    raise exception 'Chunk size must be between 1 and 500';
  end if;

  update public.listing_import_jobs j
  set heartbeat_at = now(), updated_at = now(), version = j.version + 1
  where j.id = target_job_id
    and j.stage = expected_stage
    and j.stage_cursor = expected_cursor
    and j.version = expected_version
    and private.has_organization_role(
      j.organization_id,
      array['owner', 'admin']::public.organization_role[],
      j.created_by
    )
  returning j.* into claimed_job;

  if not found then
    return query select false, null::uuid, null::uuid, null::public.listing_import_job_stage,
      expected_cursor, expected_version, false;
    return;
  end if;

  return query select true, claimed_job.organization_id, claimed_job.created_by,
    claimed_job.stage, claimed_job.stage_cursor, claimed_job.version,
    claimed_job.cancel_requested_at is not null;
end;
$$;

create or replace function public.apply_listing_import_row_results(
  target_job_id uuid,
  expected_stage public.listing_import_job_stage,
  from_cursor bigint,
  to_cursor bigint,
  row_results jsonb,
  aggregate_delta jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  row_result jsonb;
  affected integer := 0;
begin
  if jsonb_typeof(row_results) <> 'array' or jsonb_array_length(row_results) > 500 then
    raise exception 'Row results must be an array of at most 500 entries';
  end if;

  for row_result in select value from jsonb_array_elements(row_results)
  loop
    update public.listing_import_rows
    set
      normalized_data = coalesce(row_result->'normalizedData', normalized_data),
      state = coalesce((row_result->>'state')::public.listing_import_row_state, state),
      address_fingerprint = coalesce(row_result->>'addressFingerprint', address_fingerprint),
      duplicate_candidate_ids = coalesce(
        array(select jsonb_array_elements_text(row_result->'duplicateCandidateIds')::uuid),
        duplicate_candidate_ids
      ),
      processed_at = now(),
      updated_at = now(),
      row_version = row_version + 1
    where job_id = target_job_id
      and row_number = (row_result->>'rowNumber')::integer;
    affected := affected + case when found then 1 else 0 end;
  end loop;

  update public.listing_import_jobs
  set
    stage_cursor = to_cursor,
    processed_rows = least(25000, processed_rows + coalesce((aggregate_delta->>'processed')::integer, affected)),
    valid_rows = least(25000, valid_rows + coalesce((aggregate_delta->>'valid')::integer, 0)),
    warning_rows = least(25000, warning_rows + coalesce((aggregate_delta->>'warnings')::integer, 0)),
    blocked_rows = least(25000, blocked_rows + coalesce((aggregate_delta->>'blocked')::integer, 0)),
    failed_rows = least(25000, failed_rows + coalesce((aggregate_delta->>'failed')::integer, 0)),
    heartbeat_at = now(),
    last_progress_at = now(),
    updated_at = now(),
    version = version + 1
  where id = target_job_id
    and stage = expected_stage
    and stage_cursor = from_cursor;

  if not found then
    raise exception 'Import job cursor is stale' using errcode = '40001';
  end if;
  return to_cursor;
end;
$$;

revoke all on function public.claim_listing_import_chunk(uuid, public.listing_import_job_stage, bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.apply_listing_import_row_results(uuid, public.listing_import_job_stage, bigint, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.claim_listing_import_chunk(uuid, public.listing_import_job_stage, bigint, bigint, integer) to service_role;
grant execute on function public.apply_listing_import_row_results(uuid, public.listing_import_job_stage, bigint, bigint, jsonb, jsonb) to service_role;

create or replace function public.apply_listing_import_bulk_patch(
  target_job_id uuid,
  target_selection jsonb,
  target_patch jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
  selected_row_ids uuid[] := array[]::uuid[];
  selection_mode text := target_selection->>'mode';
  normalized_patch jsonb := target_patch - 'removeFromBatch' - 'publicationSelected' - 'responsibleAgentId';
begin
  if selection_mode not in ('explicit', 'all_matching') then
    raise exception 'Invalid import selection';
  end if;

  select coalesce(array_agg(r.id), array[]::uuid[])
  into selected_row_ids
  from public.listing_import_rows r
  where r.job_id = target_job_id
    and (
      (
        selection_mode = 'explicit'
        and r.id in (
          select value::uuid from jsonb_array_elements_text(target_selection->'included')
        )
      )
      or (
        selection_mode = 'all_matching'
        and r.id not in (
          select value::uuid from jsonb_array_elements_text(coalesce(target_selection->'excluded', '[]'::jsonb))
        )
        and (
          jsonb_array_length(coalesce(target_selection#>'{filter,states}', '[]'::jsonb)) = 0
          or r.state::text in (
            select value from jsonb_array_elements_text(target_selection#>'{filter,states}')
          )
        )
        and (
          not coalesce((target_selection#>>'{filter,duplicateOnly}')::boolean, false)
          or cardinality(r.duplicate_candidate_ids) > 0
        )
      )
    );

  update public.listing_import_rows r
  set
    normalized_data = r.normalized_data || normalized_patch,
    responsible_agent_id = coalesce(nullif(target_patch->>'responsibleAgentId', '')::uuid, r.responsible_agent_id),
    publication_selected = coalesce((target_patch->>'publicationSelected')::boolean, r.publication_selected),
    state = case
      when coalesce((target_patch->>'removeFromBatch')::boolean, false)
        then 'removed'::public.listing_import_row_state
      else r.state
    end,
    row_version = r.row_version + 1,
    updated_at = now()
  where r.id = any(selected_row_ids);
  get diagnostics affected = row_count;

  if target_patch ? 'price' or target_patch ? 'salePrice' then
    delete from public.listing_import_issues
    where row_id = any(selected_row_ids) and code = 'invalid_price';
  end if;
  if target_patch ? 'responsibleAgentId' then
    delete from public.listing_import_issues
    where row_id = any(selected_row_ids) and code = 'responsible_agent_required';
  end if;
  if target_patch ? 'availabilityDate' then
    delete from public.listing_import_issues
    where row_id = any(selected_row_ids) and code = 'invalid_date';
  end if;

  update public.listing_import_rows r
  set state = case
    when coalesce((target_patch->>'removeFromBatch')::boolean, false)
      then 'removed'::public.listing_import_row_state
    when cardinality(r.duplicate_candidate_ids) > 0
      then 'duplicate_review'::public.listing_import_row_state
    when exists (
      select 1 from public.listing_import_issues i
      where i.row_id = r.id and i.resolved_at is null and i.severity = 'blocking'
    ) then 'parse_blocked'::public.listing_import_row_state
    when exists (
      select 1 from public.listing_import_issues i
      where i.row_id = r.id and i.resolved_at is null and i.severity = 'publish_blocker'
    ) then 'publish_blocked'::public.listing_import_row_state
    when exists (
      select 1 from public.listing_import_issues i
      where i.row_id = r.id and i.resolved_at is null and i.severity = 'warning'
    ) then 'warning'::public.listing_import_row_state
    else 'draft_ready'::public.listing_import_row_state
  end
  where r.id = any(selected_row_ids);

  return affected;
end;
$$;

revoke all on function public.apply_listing_import_bulk_patch(uuid, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.apply_listing_import_bulk_patch(uuid, jsonb, jsonb)
to service_role;

create or replace function public.refresh_listing_import_job_counters(target_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.listing_import_jobs j
  set
    total_rows = counters.total_rows,
    valid_rows = counters.valid_rows,
    warning_rows = counters.warning_rows,
    blocked_rows = counters.blocked_rows,
    failed_rows = counters.failed_rows,
    updated_at = now()
  from (
    select
      count(*) filter (where state <> 'removed')::integer as total_rows,
      count(*) filter (where state in ('draft_ready', 'committed', 'published'))::integer as valid_rows,
      count(*) filter (where state in ('warning', 'publish_blocked', 'duplicate_review'))::integer as warning_rows,
      count(*) filter (where state = 'parse_blocked')::integer as blocked_rows,
      count(*) filter (where state = 'failed')::integer as failed_rows
    from public.listing_import_rows
    where job_id = target_job_id
  ) counters
  where j.id = target_job_id
$$;
revoke all on function public.refresh_listing_import_job_counters(uuid)
from public, anon, authenticated;
grant execute on function public.refresh_listing_import_job_counters(uuid)
to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-imports',
  'listing-imports',
  false,
  2147483648,
  array[
    'text/csv', 'text/plain', 'application/json', 'application/xml', 'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
strict
as $$
begin
  return value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
revoke all on function private.try_uuid(text) from public, anon;
grant execute on function private.try_uuid(text) to authenticated, service_role;

create policy "Organization managers can read listing import objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-imports'
    and private.has_organization_role(
      private.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin']::public.organization_role[]
    )
  );
create policy "Organization managers can upload listing import objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-imports'
    and private.has_organization_role(
      private.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin']::public.organization_role[]
    )
    and exists (
      select 1 from public.listing_import_jobs j
      where j.id = private.try_uuid((storage.foldername(name))[2])
        and j.organization_id = private.try_uuid((storage.foldername(name))[1])
    )
  );
create policy "Organization managers can update listing import objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-imports'
    and private.has_organization_role(
      private.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin']::public.organization_role[]
    )
  )
  with check (
    bucket_id = 'listing-imports'
    and private.has_organization_role(
      private.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin']::public.organization_role[]
    )
  );
create policy "Organization managers can delete listing import objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-imports'
    and private.has_organization_role(
      private.try_uuid((storage.foldername(name))[1]),
      array['owner', 'admin']::public.organization_role[]
    )
  );

create policy "Organization managers can upload organization listing images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = 'organizations'
    and private.has_organization_role(
      private.try_uuid((storage.foldername(name))[2]),
      array['owner', 'admin']::public.organization_role[]
    )
  );

revoke all on table
  public.organizations,
  public.organization_offices,
  public.organization_memberships,
  public.organization_invitations,
  public.listing_external_refs,
  public.listing_import_templates,
  public.listing_import_jobs,
  public.listing_import_rows,
  public.listing_import_issues,
  public.listing_import_assets,
  public.listing_import_events,
  public.listing_import_change_snapshots,
  public.listing_import_geocode_cache
from public, anon, authenticated;

grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_offices to authenticated;
grant select, update on table public.organization_memberships to authenticated;
grant select, insert, update, delete on table public.organization_invitations to authenticated;
grant select, insert, update, delete on table public.listing_external_refs to authenticated;
grant select, insert, update, delete on table public.listing_import_templates to authenticated;
grant select, insert, update on table public.listing_import_jobs to authenticated;
grant select, insert, update, delete on table public.listing_import_rows to authenticated;
grant select, insert, update, delete on table public.listing_import_issues to authenticated;
grant select, insert, update, delete on table public.listing_import_assets to authenticated;
grant select on table public.listing_import_events to authenticated;
grant select on table public.listing_import_change_snapshots to authenticated;
grant select, insert, update, delete on table public.listing_import_geocode_cache to authenticated;
grant all on table
  public.organizations,
  public.organization_offices,
  public.organization_memberships,
  public.organization_invitations,
  public.listing_external_refs,
  public.listing_import_templates,
  public.listing_import_jobs,
  public.listing_import_rows,
  public.listing_import_issues,
  public.listing_import_assets,
  public.listing_import_events,
  public.listing_import_change_snapshots,
  public.listing_import_geocode_cache
to service_role;
grant usage, select on sequence public.listing_import_events_id_seq to service_role;

insert into public.app_feature_flags (key, enabled, description)
values (
  'bulk_listing_imports',
  false,
  'Global gate for organization-scoped bulk listing imports.'
)
on conflict (key) do update
set description = excluded.description;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'listing_import_jobs'
     ) then
    alter publication supabase_realtime add table public.listing_import_jobs;
  end if;
end;
$$;

create trigger update_organizations_updated_at
  before update on public.organizations
  for each row execute function public.handle_updated_at();
create trigger update_organization_offices_updated_at
  before update on public.organization_offices
  for each row execute function public.handle_updated_at();
create trigger update_organization_memberships_updated_at
  before update on public.organization_memberships
  for each row execute function public.handle_updated_at();
create trigger update_listing_external_refs_updated_at
  before update on public.listing_external_refs
  for each row execute function public.handle_updated_at();
create trigger update_listing_import_templates_updated_at
  before update on public.listing_import_templates
  for each row execute function public.handle_updated_at();
create trigger update_listing_import_jobs_updated_at
  before update on public.listing_import_jobs
  for each row execute function public.handle_updated_at();
create trigger update_listing_import_rows_updated_at
  before update on public.listing_import_rows
  for each row execute function public.handle_updated_at();
create trigger update_listing_import_assets_updated_at
  before update on public.listing_import_assets
  for each row execute function public.handle_updated_at();
create trigger update_listing_import_geocode_cache_updated_at
  before update on public.listing_import_geocode_cache
  for each row execute function public.handle_updated_at();
