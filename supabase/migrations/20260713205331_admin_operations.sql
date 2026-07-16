-- Pinpoints admin operations foundation.
-- All privileged tables remain server-only. RLS is still enabled and forced as
-- defence in depth because the public schema is exposed by the Data API.

do $$ begin
  create type public.admin_level as enum ('owner', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.moderation_case_status as enum ('open', 'in_review', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.moderation_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.moderation_category as enum (
    'fraud_or_scam',
    'misleading_listing',
    'duplicate_or_spam',
    'discrimination',
    'harassment',
    'safety',
    'privacy',
    'other'
  );
exception when duplicate_object then null;
end $$;

alter type public.notification_type add value if not exists 'admin_alert';
alter type public.notification_type add value if not exists 'moderation_update';

create table if not exists public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level public.admin_level not null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint admin_memberships_revoked_after_created
    check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists admin_memberships_active_level_idx
  on public.admin_memberships(level) where revoked_at is null;

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action_key text not null check (action_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  target_type text not null,
  target_id uuid,
  reason text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events(created_at desc);
create index if not exists admin_audit_events_actor_created_idx
  on public.admin_audit_events(actor_id, created_at desc);
create index if not exists admin_audit_events_target_created_idx
  on public.admin_audit_events(target_type, target_id, created_at desc);

create table if not exists public.account_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  suspended_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 2000),
  suspended_at timestamptz not null default now(),
  suspended_until timestamptz,
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  constraint account_suspensions_until_after_start
    check (suspended_until is null or suspended_until > suspended_at),
  constraint account_suspensions_restore_after_start
    check (restored_at is null or restored_at >= suspended_at)
);

create unique index if not exists account_suspensions_one_active_idx
  on public.account_suspensions(user_id) where restored_at is null;
create index if not exists account_suspensions_user_created_idx
  on public.account_suspensions(user_id, suspended_at desc);

create table if not exists public.listing_restrictions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  restricted_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 2000),
  restricted_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  constraint listing_restrictions_restore_after_start
    check (restored_at is null or restored_at >= restricted_at)
);

create unique index if not exists listing_restrictions_one_active_idx
  on public.listing_restrictions(listing_id) where restored_at is null;
create index if not exists listing_restrictions_listing_created_idx
  on public.listing_restrictions(listing_id, restricted_at desc);

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  category public.moderation_category not null,
  details text not null check (char_length(details) between 20 and 2000),
  status public.moderation_case_status not null default 'open',
  priority public.moderation_priority not null default 'normal',
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint moderation_cases_exactly_one_target
    check (num_nonnulls(listing_id, reported_user_id) = 1),
  constraint moderation_cases_no_self_report
    check (reported_user_id is null or reported_user_id <> reporter_id)
);

create unique index if not exists moderation_cases_open_listing_report_idx
  on public.moderation_cases(reporter_id, listing_id)
  where listing_id is not null and status in ('open', 'in_review');
create unique index if not exists moderation_cases_open_user_report_idx
  on public.moderation_cases(reporter_id, reported_user_id)
  where reported_user_id is not null and status in ('open', 'in_review');
create index if not exists moderation_cases_queue_idx
  on public.moderation_cases(status, priority, created_at desc);
create index if not exists moderation_cases_assignee_idx
  on public.moderation_cases(assigned_to, status, created_at desc);

create table if not exists public.moderation_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists moderation_case_notes_case_created_idx
  on public.moderation_case_notes(case_id, created_at);

create table if not exists public.sensitive_access_grants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  admin_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('conversation', 'document')),
  resource_id uuid not null,
  reason text not null check (char_length(reason) between 20 and 2000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  revoked_at timestamptz,
  constraint sensitive_access_grants_expiry_after_start check (expires_at > created_at)
);

create index if not exists sensitive_access_grants_lookup_idx
  on public.sensitive_access_grants(admin_id, case_id, resource_type, resource_id, expires_at desc);

create or replace function public.handle_admin_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_memberships_updated_at on public.admin_memberships;
create trigger admin_memberships_updated_at before update on public.admin_memberships
for each row execute function public.handle_admin_updated_at();

drop trigger if exists moderation_cases_updated_at on public.moderation_cases;
create trigger moderation_cases_updated_at before update on public.moderation_cases
for each row execute function public.handle_admin_updated_at();

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'admin_audit_events is append-only';
end;
$$;

drop trigger if exists admin_audit_events_immutable on public.admin_audit_events;
create trigger admin_audit_events_immutable
before update or delete on public.admin_audit_events
for each row execute function public.prevent_admin_audit_mutation();

create or replace function public.protect_last_admin_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  removes_owner boolean;
begin
  if tg_op = 'DELETE' then
    removes_owner := old.level = 'owner' and old.revoked_at is null;
  else
    removes_owner := old.level = 'owner' and old.revoked_at is null
      and (new.level <> 'owner' or new.revoked_at is not null);
  end if;

  if removes_owner and not exists (
    select 1 from public.admin_memberships
    where user_id <> old.user_id and level = 'owner' and revoked_at is null
  ) then
    raise exception 'cannot remove the last active owner';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists admin_memberships_last_owner on public.admin_memberships;
create trigger admin_memberships_last_owner
before update or delete on public.admin_memberships
for each row execute function public.protect_last_admin_owner();

create or replace function public.is_current_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and not exists (
    select 1 from public.account_suspensions
    where user_id = (select auth.uid())
      and restored_at is null
      and (suspended_until is null or suspended_until > now())
  );
$$;

create or replace function public.is_listing_unrestricted(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.listing_restrictions
    where listing_id = target_listing_id and restored_at is null
  );
$$;

revoke all on function public.is_current_account_active() from public, anon;
grant execute on function public.is_current_account_active() to authenticated;
revoke all on function public.is_listing_unrestricted(uuid) from public;
grant execute on function public.is_listing_unrestricted(uuid) to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'listings', 'listing_images', 'applications', 'application_status_events',
    'documents', 'conversations', 'messages', 'call_sessions', 'viewing_slots',
    'viewing_slot_offers', 'viewings', 'user_favorites', 'search_alerts',
    'notification_events', 'analytics_events', 'purchase_progress', 'buyer_interests',
    'buyer_interest_private_notes'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists "Active accounts only" on public.%I', table_name);
      execute format(
        'create policy "Active accounts only" on public.%I as restrictive for all to authenticated using (public.is_current_account_active()) with check (public.is_current_account_active())',
        table_name
      );
    end if;
  end loop;
end $$;

drop policy if exists "Unrestricted listings for anon" on public.listings;
create policy "Unrestricted listings for anon"
  on public.listings as restrictive for select to anon
  using (public.is_listing_unrestricted(id));

drop policy if exists "Unrestricted listings for authenticated users" on public.listings;
create policy "Unrestricted listings for authenticated users"
  on public.listings as restrictive for select to authenticated
  using (landlord_id = (select auth.uid()) or public.is_listing_unrestricted(id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_memberships', 'admin_audit_events', 'account_suspensions',
    'listing_restrictions', 'moderation_cases', 'moderation_case_notes',
    'sensitive_access_grants'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
  end loop;
end $$;

revoke all on function public.handle_admin_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_admin_audit_mutation() from public, anon, authenticated;
revoke all on function public.protect_last_admin_owner() from public, anon, authenticated;

comment on table public.admin_memberships is 'Server-only platform authority, independent from renter and landlord personas.';
comment on table public.admin_audit_events is 'Immutable, sanitized audit trail for privileged operations.';
comment on table public.sensitive_access_grants is 'Short-lived, case-bound authorization to reveal sensitive resources.';

create or replace function public.assert_admin_actor(actor uuid, owner_only boolean default false)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_memberships
    where user_id = actor and revoked_at is null and (not owner_only or level = 'owner')
  ) then
    raise exception 'admin authorization failed' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_update_case(
  actor uuid, target_case uuid, next_status public.moderation_case_status,
  next_priority public.moderation_priority, next_assignee uuid,
  next_resolution text, audit_request_id text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_admin_actor(actor);
  update public.moderation_cases set
    status = next_status,
    priority = next_priority,
    assigned_to = next_assignee,
    resolution_note = case when next_status in ('resolved', 'dismissed') then next_resolution else null end,
    resolved_at = case when next_status in ('resolved', 'dismissed') then now() else null end
  where id = target_case;
  if not found then raise exception 'moderation case not found'; end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, request_id, metadata)
  values (actor, 'case.status_changed', 'moderation_case', target_case, audit_request_id,
    jsonb_build_object('status', next_status, 'priority', next_priority));
end;
$$;

create or replace function public.admin_add_case_note(
  actor uuid, target_case uuid, note_body text, audit_request_id text
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare note_id uuid;
begin
  perform public.assert_admin_actor(actor);
  insert into public.moderation_case_notes(case_id, author_id, body)
  values (target_case, actor, note_body) returning id into note_id;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, request_id)
  values (actor, 'case.note_added', 'moderation_case', target_case, audit_request_id);
  return note_id;
end;
$$;

create or replace function public.admin_set_listing_restriction(
  actor uuid, target_listing uuid, action_reason text, restore boolean, audit_request_id text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_admin_actor(actor);
  if restore then
    update public.listing_restrictions set restored_at = now(), restored_by = actor
    where listing_id = target_listing and restored_at is null;
    if not found then raise exception 'active listing restriction not found'; end if;
  else
    insert into public.listing_restrictions(listing_id, restricted_by, reason)
    values (target_listing, actor, action_reason);
  end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id)
  values (actor, case when restore then 'listing.restored' else 'listing.hidden' end,
    'listing', target_listing, action_reason, audit_request_id);
end;
$$;

create or replace function public.admin_set_membership(
  actor uuid, target_user uuid, next_level public.admin_level, revoke boolean,
  action_reason text, audit_request_id text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_admin_actor(actor, true);
  if revoke then
    update public.admin_memberships set revoked_at = now()
    where user_id = target_user and revoked_at is null;
    if not found then raise exception 'active membership not found'; end if;
  else
    insert into public.admin_memberships(user_id, level, invited_by, revoked_at)
    values (target_user, next_level, actor, null)
    on conflict (user_id) do update set level = excluded.level, invited_by = excluded.invited_by, revoked_at = null;
  end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
  values (actor, case when revoke then 'membership.revoked' else 'membership.granted' end,
    'user', target_user, action_reason, audit_request_id,
    case when revoke then '{}'::jsonb else jsonb_build_object('level', next_level) end);
end;
$$;

create or replace function public.admin_set_account_restriction(
  actor uuid, target_user uuid, action_reason text, until_at timestamptz,
  restore boolean, audit_request_id text
)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_admin_actor(actor);
  if restore then
    update public.account_suspensions set restored_at = now(), restored_by = actor
    where user_id = target_user and restored_at is null;
    if not found then raise exception 'active account restriction not found'; end if;
  else
    insert into public.account_suspensions(user_id, suspended_by, reason, suspended_until)
    values (target_user, actor, action_reason, until_at);
  end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
  values (actor, case when restore then 'user.restored' else 'user.suspended' end,
    'user', target_user, action_reason, audit_request_id,
    case when restore then '{}'::jsonb else jsonb_build_object('suspendedUntil', until_at) end);
end;
$$;

create or replace function public.admin_create_sensitive_grant(
  actor uuid, target_case uuid, target_resource_type text, target_resource uuid,
  action_reason text, audit_request_id text
)
returns table(id uuid, expires_at timestamptz)
language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_admin_actor(actor);
  if not exists (select 1 from public.moderation_cases where moderation_cases.id = target_case and status in ('open', 'in_review')) then
    raise exception 'active moderation case required';
  end if;
  return query
    insert into public.sensitive_access_grants(case_id, admin_id, resource_type, resource_id, reason)
    values (target_case, actor, target_resource_type, target_resource, action_reason)
    returning sensitive_access_grants.id, sensitive_access_grants.expires_at;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
  values (actor, 'sensitive_access.granted', target_resource_type, target_resource,
    action_reason, audit_request_id, jsonb_build_object('caseId', target_case));
end;
$$;

create or replace function public.admin_retry_notification(actor uuid, target_event uuid, audit_request_id text)
returns uuid language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_admin_actor(actor);
  update public.notification_events set locked_at = null, last_error = null, next_attempt_at = now()
  where id = target_event and sent_at is null;
  if not found then raise exception 'notification is not retryable'; end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, request_id)
  values (actor, 'notification.retried', 'notification_event', target_event, audit_request_id);
  return target_event;
end;
$$;

create or replace function public.admin_bootstrap_owner(target_user uuid, audit_request_id text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from public.admin_memberships where level = 'owner' and revoked_at is null)
    and not exists (select 1 from public.admin_memberships where user_id = target_user and level = 'owner' and revoked_at is null) then
    raise exception 'an active owner already exists' using errcode = '42501';
  end if;
  insert into public.admin_memberships(user_id, level, invited_by, revoked_at)
  values (target_user, 'owner', null, null)
  on conflict (user_id) do update set level = 'owner', invited_by = null, revoked_at = null;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
  values (target_user, 'bootstrap.owner_created', 'user', target_user,
    'Trusted owner bootstrap command', audit_request_id, '{"source":"admin:bootstrap"}'::jsonb);
end;
$$;

revoke all on function public.assert_admin_actor(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_update_case(uuid, uuid, public.moderation_case_status, public.moderation_priority, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_add_case_note(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_listing_restriction(uuid, uuid, text, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_set_membership(uuid, uuid, public.admin_level, boolean, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_account_restriction(uuid, uuid, text, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.admin_create_sensitive_grant(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_retry_notification(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_bootstrap_owner(uuid, text) from public, anon, authenticated;

grant execute on function public.assert_admin_actor(uuid, boolean) to service_role;
grant execute on function public.admin_update_case(uuid, uuid, public.moderation_case_status, public.moderation_priority, uuid, text, text) to service_role;
grant execute on function public.admin_add_case_note(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_set_listing_restriction(uuid, uuid, text, boolean, text) to service_role;
grant execute on function public.admin_set_membership(uuid, uuid, public.admin_level, boolean, text, text) to service_role;
grant execute on function public.admin_set_account_restriction(uuid, uuid, text, timestamptz, boolean, text) to service_role;
grant execute on function public.admin_create_sensitive_grant(uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function public.admin_retry_notification(uuid, uuid, text) to service_role;
grant execute on function public.admin_bootstrap_owner(uuid, text) to service_role;

-- Combined-release fixes surfaced by the database linter after the buy-mode
-- migration: do not write the generated location column, preserve sale mode,
-- and disambiguate the login-attempt primary-key conflict target.
create or replace function public.duplicate_listing(target_listing_id uuid)
returns table(listing_id uuid, result text)
language plpgsql security invoker set search_path = public as $$
declare
  source_listing public.listings%rowtype;
  new_listing_id uuid := gen_random_uuid();
begin
  select * into source_listing from public.listings where id = target_listing_id;
  if source_listing.id is null or source_listing.landlord_id <> auth.uid() then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  insert into public.listings (
    id, landlord_id, title, description, price, sale_price, listing_type,
    address, latitude, longitude, property_type, bedrooms, bathrooms,
    availability_date, lease_duration, status, water_included, water_estimate,
    water_availability, electricity_included, electricity_estimate,
    electricity_type, parking_included, parking_estimate, parking_type,
    parking_count, wifi_included, wifi_estimate, wifi_available,
    security_fee_estimate, metadata
  ) values (
    new_listing_id, source_listing.landlord_id,
    coalesce(nullif(trim(source_listing.title), ''), 'Untitled listing') || ' (Copy)',
    source_listing.description, source_listing.price, source_listing.sale_price,
    source_listing.listing_type, source_listing.address, source_listing.latitude,
    source_listing.longitude, source_listing.property_type, source_listing.bedrooms,
    source_listing.bathrooms, source_listing.availability_date,
    source_listing.lease_duration, 'draft', source_listing.water_included,
    source_listing.water_estimate, source_listing.water_availability,
    source_listing.electricity_included, source_listing.electricity_estimate,
    source_listing.electricity_type, source_listing.parking_included,
    source_listing.parking_estimate, source_listing.parking_type,
    source_listing.parking_count, source_listing.wifi_included,
    source_listing.wifi_estimate, source_listing.wifi_available,
    source_listing.security_fee_estimate, source_listing.metadata
  );
  insert into public.listing_images(listing_id, bucket, path, public_url, sort_order)
  select new_listing_id, image.bucket, image.path, image.public_url, image.sort_order
  from public.listing_images as image where image.listing_id = target_listing_id;
  return query select new_listing_id, 'duplicated'::text;
end;
$$;

create or replace function public.record_auth_login_failure(
  target_email_hash text, lockout_threshold integer default 5,
  lockout_seconds integer default 900
)
returns table(email_hash text, attempt_count integer, locked_until timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if target_email_hash is null or target_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid login attempt identifier' using errcode = '22023';
  end if;
  if lockout_threshold < 1 or lockout_seconds < 1 then
    raise exception 'invalid lockout configuration' using errcode = '22023';
  end if;
  return query
  insert into public.auth_login_attempts(email_hash, attempt_count, locked_until, last_failed_at, updated_at)
  values (target_email_hash, 1,
    case when lockout_threshold <= 1 then now() + make_interval(secs => lockout_seconds) else null end,
    now(), now())
  on conflict on constraint auth_login_attempts_pkey do update set
    attempt_count = case
      when auth_login_attempts.locked_until > now() then auth_login_attempts.attempt_count
      when auth_login_attempts.locked_until is not null then 1
      else auth_login_attempts.attempt_count + 1 end,
    locked_until = case
      when auth_login_attempts.locked_until > now() then auth_login_attempts.locked_until
      when auth_login_attempts.locked_until is not null then null
      when auth_login_attempts.attempt_count + 1 >= lockout_threshold then now() + make_interval(secs => lockout_seconds)
      else null end,
    last_failed_at = case when auth_login_attempts.locked_until > now() then auth_login_attempts.last_failed_at else now() end,
    updated_at = now()
  returning auth_login_attempts.email_hash, auth_login_attempts.attempt_count, auth_login_attempts.locked_until;
end;
$$;

revoke all on function public.duplicate_listing(uuid) from public, anon;
grant execute on function public.duplicate_listing(uuid) to authenticated;
revoke all on function public.record_auth_login_failure(text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_auth_login_failure(text, integer, integer) to service_role;
