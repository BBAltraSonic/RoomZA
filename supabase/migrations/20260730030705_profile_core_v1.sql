-- Pinpoint profile core.
-- Separates public identity from private account data, adds multi-persona
-- authorization, and provides owner-scoped activity, document, review,
-- notification, and security primitives.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'marketplace_persona') then
    create type public.marketplace_persona as enum ('renter', 'buyer', 'landlord', 'seller');
  end if;
  if not exists (select 1 from pg_type where typname = 'profile_audience') then
    create type public.profile_audience as enum ('everyone', 'members', 'interactions', 'no_one');
  end if;
  if not exists (select 1 from pg_type where typname = 'profile_activity_visibility') then
    create type public.profile_activity_visibility as enum ('private', 'public');
  end if;
  if not exists (select 1 from pg_type where typname = 'profile_review_status') then
    create type public.profile_review_status as enum ('draft', 'submitted', 'published', 'hidden', 'removed');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum ('in_app', 'email');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_frequency') then
    create type public.notification_frequency as enum ('instant', 'hourly', 'daily', 'weekly', 'never');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_category') then
    create type public.notification_category as enum (
      'messages', 'applications', 'viewings', 'offers', 'saved_searches',
      'marketing', 'security', 'account_updates', 'reviews', 'verification', 'blog_updates'
    );
  end if;
end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;

create table public.public_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null unique
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 1000),
  languages text[] not null default '{}',
  profile_audience public.profile_audience not null default 'everyone',
  message_audience public.profile_audience not null default 'members',
  phone_audience public.profile_audience not null default 'interactions'
    check (phone_audience <> 'everyone'),
  email_audience public.profile_audience not null default 'interactions'
    check (email_audience <> 'everyone'),
  reviews_visible boolean not null default true,
  activity_visible boolean not null default false,
  search_indexed boolean not null default true,
  completion_percent smallint not null default 0 check (completion_percent between 0 and 100),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index public_profiles_search_idx
  on public.public_profiles (search_indexed, lower(display_name), username)
  where profile_audience = 'everyone';

create table public.profile_personas (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  persona public.marketplace_persona not null,
  is_primary boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, persona)
);

create unique index profile_personas_one_primary_idx
  on public.profile_personas(profile_id) where is_primary;
create unique index profile_personas_one_active_idx
  on public.profile_personas(profile_id) where is_active;
create index profile_personas_persona_profile_idx
  on public.profile_personas(persona, profile_id);

create table public.renter_profile_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  occupation text check (occupation is null or char_length(occupation) <= 120),
  employer text check (employer is null or char_length(employer) <= 160),
  monthly_income numeric(12,2) check (monthly_income is null or monthly_income >= 0),
  rent_budget_min integer check (rent_budget_min is null or rent_budget_min >= 0),
  rent_budget_max integer check (rent_budget_max is null or rent_budget_max >= 0),
  preferred_areas text[] not null default '{}',
  move_in_date date,
  household_size smallint check (household_size is null or household_size between 1 and 30),
  has_pets boolean,
  smoking_preference text check (smoking_preference is null or smoking_preference in ('non_smoker', 'smoker', 'outdoors_only')),
  student_status boolean,
  nsfas_eligible boolean,
  government_assistance boolean,
  updated_at timestamptz not null default now(),
  constraint renter_budget_order check (
    rent_budget_min is null or rent_budget_max is null or rent_budget_min <= rent_budget_max
  )
);

create table public.buyer_profile_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  buying_budget integer check (buying_budget is null or buying_budget >= 0),
  deposit_saved integer check (deposit_saved is null or deposit_saved >= 0),
  bond_status text check (bond_status is null or bond_status in ('not_started', 'preparing', 'pre_approved', 'approved')),
  mortgage_provider text check (mortgage_provider is null or char_length(mortgage_provider) <= 160),
  buying_timeline text check (buying_timeline is null or buying_timeline in ('now', 'three_months', 'six_months', 'twelve_months', 'exploring')),
  preferred_suburbs text[] not null default '{}',
  property_goals text[] not null default '{}',
  purchase_purpose text check (purchase_purpose is null or purchase_purpose in ('residential', 'investment', 'both')),
  updated_at timestamptz not null default now()
);

create table public.landlord_profile_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text check (business_name is null or char_length(business_name) <= 160),
  company_logo_url text,
  portfolio_size integer check (portfolio_size is null or portfolio_size >= 0),
  years_managing smallint check (years_managing is null or years_managing between 0 and 100),
  owner_type text check (owner_type is null or owner_type in ('private_owner', 'agency')),
  office_location text check (office_location is null or char_length(office_location) <= 240),
  business_hours jsonb not null default '{}'::jsonb,
  license_details text check (license_details is null or char_length(license_details) <= 500),
  updated_at timestamptz not null default now()
);

create table public.seller_profile_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text check (business_name is null or char_length(business_name) <= 160),
  company_logo_url text,
  office_location text check (office_location is null or char_length(office_location) <= 240),
  property_specialties text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.profile_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index profile_blocks_blocked_idx on public.profile_blocks(blocked_id, blocker_id);

create table public.profile_mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
create index profile_mutes_muted_idx on public.profile_mutes(muted_id, muter_id);

create table public.profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null check (version > 0),
  public_snapshot jsonb not null default '{}'::jsonb,
  persona_snapshot jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);
create index profile_versions_profile_created_idx
  on public.profile_versions(profile_id, created_at desc, id desc);

create table public.profile_activity_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in (
    'application', 'message', 'saved_home', 'viewing', 'offer', 'document',
    'profile', 'review', 'verification', 'notification', 'listing', 'security'
  )),
  event_key text not null check (char_length(event_key) between 3 and 100),
  title text not null check (char_length(title) between 1 and 160),
  summary text check (summary is null or char_length(summary) <= 500),
  reference_type text check (reference_type is null or char_length(reference_type) <= 80),
  reference_id uuid,
  visibility public.profile_activity_visibility not null default 'private',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index profile_activity_owner_cursor_idx
  on public.profile_activity_events(profile_id, occurred_at desc, id desc);
create index profile_activity_public_cursor_idx
  on public.profile_activity_events(profile_id, occurred_at desc, id desc)
  where visibility = 'public';

alter table public.verification_checks
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejected_reason text
    check (rejected_reason is null or char_length(rejected_reason) <= 2000);

alter table public.verification_checks
  drop constraint if exists verification_checks_check_key_check,
  drop constraint if exists verification_checks_status_check,
  add constraint verification_checks_check_key_check check (check_key in (
    'email', 'phone', 'identity', 'employment', 'income', 'student', 'nsfas',
    'business', 'landlord', 'address', 'previous_landlord_reference',
    'listing_review', 'listing_ownership'
  )),
  add constraint verification_checks_status_check check (status in (
    'not_started', 'submitted', 'in_review', 'verified', 'rejected', 'expired', 'revoked'
  ));

update public.verification_checks
set status = 'submitted',
    submitted_at = coalesce(submitted_at, created_at)
where status = 'pending';

create table public.verification_check_history (
  id uuid primary key default gen_random_uuid(),
  verification_check_id uuid not null references public.verification_checks(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  status text not null,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index verification_history_check_created_idx
  on public.verification_check_history(verification_check_id, created_at desc, id desc);
create index verification_history_profile_created_idx
  on public.verification_check_history(profile_id, created_at desc, id desc)
  where profile_id is not null;

create or replace function private.record_verification_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status
    or old.rejected_reason is distinct from new.rejected_reason then
    insert into public.verification_check_history(
      verification_check_id, profile_id, listing_id, status, reason, changed_by
    )
    values (
      new.id, new.profile_id, new.listing_id, new.status,
      coalesce(new.rejected_reason, new.evidence_note), (select auth.uid())
    );
  end if;
  return new;
end;
$$;
revoke all on function private.record_verification_history() from public, anon, authenticated;
grant execute on function private.record_verification_history() to service_role;

drop trigger if exists verification_checks_history on public.verification_checks;
create trigger verification_checks_history
  after insert or update on public.verification_checks
  for each row execute function private.record_verification_history();

create table public.profile_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in (
    'id', 'passport', 'drivers_license', 'payslip', 'employment_letter',
    'bank_statement', 'lease_agreement', 'proof_of_residence', 'student_proof',
    'business_registration', 'tax_document', 'other'
  )),
  display_name text not null check (char_length(display_name) between 1 and 180),
  expires_at date,
  current_version_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_documents_owner_created_idx
  on public.profile_documents(owner_id, created_at desc, id desc)
  where deleted_at is null;
create index profile_documents_expiry_idx
  on public.profile_documents(expires_at, owner_id)
  where deleted_at is null and expires_at is not null;

create table public.profile_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.profile_documents(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null check (version > 0),
  bucket text not null,
  path text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (document_id, version),
  unique (bucket, path)
);
create index profile_document_versions_owner_created_idx
  on public.profile_document_versions(owner_id, created_at desc, id desc);

alter table public.profile_documents
  add constraint profile_documents_current_version_fkey
  foreign key (current_version_id) references public.profile_document_versions(id) on delete set null;

create table public.profile_document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.profile_documents(id) on delete cascade,
  version_id uuid not null references public.profile_document_versions(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  grantee_id uuid references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  purpose text not null default 'application'
    check (purpose in ('application', 'viewing', 'offer', 'manual')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profile_document_share_scope check (
    num_nonnulls(grantee_id, application_id) = 1
  )
);
create index profile_document_shares_owner_idx
  on public.profile_document_shares(owner_id, created_at desc);
create index profile_document_shares_grantee_active_idx
  on public.profile_document_shares(grantee_id, expires_at)
  where grantee_id is not null and revoked_at is null;
create index profile_document_shares_application_active_idx
  on public.profile_document_shares(application_id, expires_at)
  where application_id is not null and revoked_at is null;

create table public.profile_review_entitlements (
  id uuid primary key default gen_random_uuid(),
  interaction_type text not null check (interaction_type in ('viewing', 'application', 'purchase')),
  interaction_id uuid not null,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  available_at timestamptz not null default now(),
  closes_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now(),
  unique (interaction_type, interaction_id, reviewer_id),
  check (reviewer_id <> subject_id and closes_at > available_at)
);
create index profile_review_entitlements_reviewer_idx
  on public.profile_review_entitlements(reviewer_id, closes_at desc, id desc);
create index profile_review_entitlements_subject_idx
  on public.profile_review_entitlements(subject_id, created_at desc, id desc);

create table public.profile_reviews (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null unique references public.profile_review_entitlements(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.profiles(id) on delete cascade,
  communication smallint check (communication between 1 and 5),
  honesty smallint check (honesty between 1 and 5),
  professionalism smallint check (professionalism between 1 and 5),
  property_accuracy smallint check (property_accuracy between 1 and 5),
  viewing_experience smallint check (viewing_experience between 1 and 5),
  responsiveness smallint check (responsiveness between 1 and 5),
  overall smallint not null check (overall between 1 and 5),
  body text not null default '' check (char_length(body) <= 3000),
  status public.profile_review_status not null default 'draft',
  submitted_at timestamptz,
  publish_after timestamptz,
  published_at timestamptz,
  moderated_at timestamptz,
  moderation_reason text check (moderation_reason is null or char_length(moderation_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reviewer_id, subject_id, entitlement_id)
);
create index profile_reviews_subject_published_idx
  on public.profile_reviews(subject_id, published_at desc, id desc)
  where status = 'published';
create index profile_reviews_due_idx
  on public.profile_reviews(publish_after, id)
  where status = 'submitted';

create table public.profile_review_helpful_votes (
  review_id uuid not null references public.profile_reviews(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, voter_id)
);
create index profile_review_votes_voter_idx
  on public.profile_review_helpful_votes(voter_id, created_at desc);

create table public.profile_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.profile_reviews(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('fraud', 'harassment', 'privacy', 'irrelevant', 'other')),
  details text not null check (char_length(details) between 20 and 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, reporter_id)
);
create index profile_review_reports_status_created_idx
  on public.profile_review_reports(status, created_at, id);

create table public.profile_contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  intent text not null check (intent in ('rent', 'buy', 'list', 'sell', 'general')),
  listing_id uuid references public.listings(id) on delete set null,
  message text not null check (char_length(message) between 10 and 1000),
  created_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create index profile_contact_requests_recipient_idx
  on public.profile_contact_requests(recipient_id, created_at desc, id desc);
create index profile_contact_requests_rate_idx
  on public.profile_contact_requests(requester_id, recipient_id, created_at desc);

create table public.notification_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.notification_category not null,
  channel public.notification_channel not null,
  enabled boolean not null default true,
  frequency public.notification_frequency not null default 'instant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category, channel),
  constraint notification_subscriptions_mandatory_in_app check (
    category not in ('security', 'account_updates')
    or channel <> 'in_app'
    or enabled
  )
);
create index notification_subscriptions_delivery_idx
  on public.notification_subscriptions(category, channel, frequency, user_id)
  where enabled;

create table public.account_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 3 and 100),
  device_label text check (device_label is null or char_length(device_label) <= 160),
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 128),
  is_suspicious boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index account_security_events_user_cursor_idx
  on public.account_security_events(user_id, occurred_at desc, id desc);
create index account_security_events_suspicious_idx
  on public.account_security_events(user_id, occurred_at desc)
  where is_suspicious;

create table public.recognized_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  label text not null check (char_length(label) between 1 and 160),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index recognized_devices_user_active_idx
  on public.recognized_devices(user_id, last_seen_at desc)
  where revoked_at is null;

create table public.profile_sync_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entity text not null check (entity in ('profile', 'persona', 'settings', 'activity', 'document', 'review', 'verification', 'security')),
  entity_id uuid,
  version bigint not null default 1,
  created_at timestamptz not null default now()
);
create index profile_sync_events_owner_cursor_idx
  on public.profile_sync_events(profile_id, id desc);

-- Safe username generation for backfill and auth-trigger inserts.
create or replace function private.profile_username_base(
  display_name text,
  email_address text,
  profile_id uuid
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select left(
    case
      when char_length(candidate) >= 3 then candidate
      else 'member_' || left(replace(profile_id::text, '-', ''), 8)
    end,
    24
  )
  from (
    select trim(both '_' from regexp_replace(
      lower(coalesce(nullif(btrim(display_name), ''), nullif(split_part(email_address, '@', 1), ''), 'member')),
      '[^a-z0-9]+', '_', 'g'
    )) as candidate
  ) normalized;
$$;

create or replace function private.next_profile_username(
  display_name text,
  email_address text,
  profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  candidate text;
  suffix integer := 0;
begin
  base_name := private.profile_username_base(display_name, email_address, profile_id);
  candidate := base_name;
  while exists (select 1 from public.public_profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(base_name, 30 - char_length(suffix::text) - 1) || '_' || suffix::text;
  end loop;
  return candidate;
end;
$$;
revoke all on function private.profile_username_base(text, text, uuid) from public, anon, authenticated;
revoke all on function private.next_profile_username(text, text, uuid) from public, anon, authenticated;
grant execute on function private.profile_username_base(text, text, uuid) to service_role;
grant execute on function private.next_profile_username(text, text, uuid) to service_role;

insert into public.public_profiles(
  profile_id, username, display_name, avatar_url, bio, joined_at
)
select
  profile.id,
  left(
    private.profile_username_base(profile.full_name, profile.email, profile.id),
    21
  ) || '_' || left(replace(profile.id::text, '-', ''), 8),
  coalesce(nullif(btrim(profile.full_name), ''), 'Pinpoint member'),
  nullif(profile.avatar_url, ''),
  nullif(profile.about, ''),
  profile.created_at
from public.profiles profile
on conflict (profile_id) do nothing;

insert into public.profile_personas(profile_id, persona, is_primary, is_active)
select id, role::public.marketplace_persona, true, true
from public.profiles
where role in ('renter', 'landlord')
on conflict (profile_id, persona) do update
set is_primary = excluded.is_primary,
    is_active = excluded.is_active;

insert into public.profile_personas(profile_id, persona)
select distinct buyer_id, 'buyer'::public.marketplace_persona
from public.buyer_interests
on conflict do nothing;

insert into public.profile_personas(profile_id, persona)
select distinct user_id, 'buyer'::public.marketplace_persona
from public.purchase_progress
on conflict do nothing;

insert into public.profile_personas(profile_id, persona)
select distinct landlord_id, 'seller'::public.marketplace_persona
from public.listings
where listing_type = 'sale'
on conflict do nothing;

insert into public.renter_profile_details(profile_id)
select profile_id from public.profile_personas where persona = 'renter'
on conflict do nothing;
insert into public.buyer_profile_details(profile_id)
select profile_id from public.profile_personas where persona = 'buyer'
on conflict do nothing;
insert into public.landlord_profile_details(profile_id)
select profile_id from public.profile_personas where persona = 'landlord'
on conflict do nothing;
insert into public.seller_profile_details(profile_id)
select profile_id from public.profile_personas where persona = 'seller'
on conflict do nothing;

-- Adapt existing application documents into the vault without moving objects.
insert into public.profile_documents(id, owner_id, document_type, display_name, created_at)
select
  document.id,
  application.renter_id,
  case document.type::text
    when 'id' then 'id'
    when 'payslip' then 'payslip'
    else 'other'
  end,
  initcap(replace(document.type::text, '_', ' ')),
  document.created_at
from public.documents document
join public.applications application on application.id = document.application_id
on conflict (id) do nothing;

insert into public.profile_document_versions(
  document_id, owner_id, version, bucket, path, mime_type, size_bytes, checksum_sha256, created_at
)
select
  document.id,
  application.renter_id,
  1,
  coalesce(document.bucket, 'application-documents'),
  coalesce(document.path, document.file_url),
  case
    when document.mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      then document.mime_type
    else 'application/pdf'
  end,
  least(greatest(coalesce(document.byte_size, 1), 1), 20971520),
  encode(extensions.digest(coalesce(document.path, document.file_url), 'sha256'), 'hex'),
  document.created_at
from public.documents document
join public.applications application on application.id = document.application_id
on conflict (document_id, version) do nothing;

update public.profile_documents profile_document
set current_version_id = version.id
from public.profile_document_versions version
where version.document_id = profile_document.id
  and version.version = 1
  and profile_document.current_version_id is null;

insert into public.profile_document_shares(
  document_id, version_id, owner_id, application_id, purpose, created_at
)
select
  profile_document.id,
  profile_document.current_version_id,
  profile_document.owner_id,
  document.application_id,
  'application',
  document.created_at
from public.documents document
join public.profile_documents profile_document on profile_document.id = document.id
where profile_document.current_version_id is not null;

insert into public.notification_subscriptions(user_id, category, channel, enabled, frequency)
select
  profile.id,
  category.value,
  channel.value,
  case
    when category.value = 'marketing'::public.notification_category
      then coalesce(preference.marketing, false)
    when category.value = 'saved_searches'::public.notification_category
      then coalesce(preference.search_alerts, true)
    when category.value = 'messages'::public.notification_category
      then coalesce(preference.message_digest, true)
    else true
  end,
  case
    when category.value in ('security'::public.notification_category, 'account_updates'::public.notification_category)
      then 'instant'::public.notification_frequency
    when channel.value = 'in_app'::public.notification_channel
      then 'instant'::public.notification_frequency
    when coalesce(preference.digest_frequency, 'daily') = 'never'
      then 'never'::public.notification_frequency
    when coalesce(preference.digest_frequency, 'daily') = 'weekly'
      then 'weekly'::public.notification_frequency
    else 'daily'::public.notification_frequency
  end
from public.profiles profile
cross join unnest(enum_range(null::public.notification_category)) category(value)
cross join unnest(enum_range(null::public.notification_channel)) channel(value)
left join public.notification_preferences preference on preference.user_id = profile.id
on conflict do nothing;

-- New users receive a public-safe identity immediately; onboarding adds personas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Pinpoint member'
  );

  insert into public.profiles(id, email, full_name, avatar_url, email_verified_at)
  values (
    new.id,
    coalesce(new.email, ''),
    resolved_name,
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    new.email_confirmed_at
  )
  on conflict (id) do update
  set email = excluded.email,
      email_verified_at = coalesce(public.profiles.email_verified_at, excluded.email_verified_at),
      updated_at = now();

  insert into public.public_profiles(
    profile_id, username, display_name, avatar_url, joined_at
  )
  values (
    new.id,
    private.next_profile_username(resolved_name, new.email, new.id),
    resolved_name,
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(new.created_at, now())
  )
  on conflict (profile_id) do nothing;

  insert into public.notification_subscriptions(
    user_id, category, channel, enabled, frequency
  )
  select
    new.id,
    category.value,
    channel.value,
    category.value <> 'marketing'::public.notification_category,
    case
      when category.value in (
        'security'::public.notification_category,
        'account_updates'::public.notification_category
      ) then 'instant'::public.notification_frequency
      when channel.value = 'in_app'::public.notification_channel
        then 'instant'::public.notification_frequency
      else 'daily'::public.notification_frequency
    end
  from unnest(enum_range(null::public.notification_category)) category(value)
  cross join unnest(enum_range(null::public.notification_channel)) channel(value)
  on conflict do nothing;

  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

create or replace function private.sync_legacy_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.public_profiles
  set display_name = coalesce(nullif(btrim(new.full_name), ''), display_name),
      avatar_url = nullif(new.avatar_url, ''),
      bio = nullif(new.about, ''),
      updated_at = now()
  where profile_id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_legacy_public_profile() from public, anon, authenticated;
grant execute on function private.sync_legacy_public_profile() to service_role;

drop trigger if exists profiles_sync_public_identity on public.profiles;
create trigger profiles_sync_public_identity
  after update of full_name, avatar_url, about on public.profiles
  for each row execute function private.sync_legacy_public_profile();

create or replace function public.has_profile_persona(expected_persona public.marketplace_persona)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_personas
    where profile_id = (select auth.uid())
      and persona = expected_persona
  );
$$;
revoke all on function public.has_profile_persona(public.marketplace_persona) from public, anon;
grant execute on function public.has_profile_persona(public.marketplace_persona) to authenticated, service_role;

create or replace function public.has_profile_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case expected_role
    when 'renter' then public.has_profile_persona('renter')
    when 'landlord' then (
      public.has_profile_persona('landlord')
      or public.has_profile_persona('seller')
    )
    else false
  end;
$$;
revoke all on function public.has_profile_role(text) from public, anon;
grant execute on function public.has_profile_role(text) to authenticated, service_role;

create or replace function public.set_active_profile_persona(target_persona public.marketplace_persona)
returns public.marketplace_persona
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profile_personas
    where profile_id = actor and persona = target_persona
  ) then
    raise exception 'Persona is not enabled for this account' using errcode = '42501';
  end if;

  update public.profile_personas
  set is_active = false, updated_at = now()
  where profile_id = actor and is_active;

  update public.profile_personas
  set is_active = true, updated_at = now()
  where profile_id = actor and persona = target_persona;

  insert into public.profile_sync_events(profile_id, entity)
  values (actor, 'persona');

  return target_persona;
end;
$$;
revoke all on function public.set_active_profile_persona(public.marketplace_persona) from public, anon;
grant execute on function public.set_active_profile_persona(public.marketplace_persona) to authenticated;

-- Persona-aware legacy policies.
drop policy if exists "Renters can create their own applications" on public.applications;
create policy "Renters can create their own applications"
  on public.applications for insert to authenticated
  with check (
    renter_id = (select auth.uid())
    and public.has_profile_persona('renter')
  );

drop policy if exists "Authorized users can update relevant applications" on public.applications;
create policy "Authorized users can update relevant applications"
  on public.applications for update to authenticated
  using (
    (
      renter_id = (select auth.uid())
      and public.has_profile_persona('renter')
    )
    or exists (
      select 1 from public.listings
      where listings.id = applications.listing_id
        and listings.landlord_id = (select auth.uid())
        and (
          (listings.listing_type = 'rent' and public.has_profile_persona('landlord'))
          or (listings.listing_type = 'sale' and public.has_profile_persona('seller'))
        )
    )
  )
  with check (
    (
      renter_id = (select auth.uid())
      and public.has_profile_persona('renter')
    )
    or exists (
      select 1 from public.listings
      where listings.id = applications.listing_id
        and listings.landlord_id = (select auth.uid())
        and (
          (listings.listing_type = 'rent' and public.has_profile_persona('landlord'))
          or (listings.listing_type = 'sale' and public.has_profile_persona('seller'))
        )
    )
  );

drop policy if exists "Landlords can insert their listings" on public.listings;
create policy "Providers can insert their listings"
  on public.listings for insert to authenticated
  with check (
    landlord_id = (select auth.uid())
    and (
      (listing_type = 'rent' and public.has_profile_persona('landlord'))
      or (listing_type = 'sale' and public.has_profile_persona('seller'))
    )
  );

drop policy if exists "Landlords can update their listings" on public.listings;
create policy "Providers can update their listings"
  on public.listings for update to authenticated
  using (
    landlord_id = (select auth.uid())
    and (
      (listing_type = 'rent' and public.has_profile_persona('landlord'))
      or (listing_type = 'sale' and public.has_profile_persona('seller'))
    )
  )
  with check (
    landlord_id = (select auth.uid())
    and (
      (listing_type = 'rent' and public.has_profile_persona('landlord'))
      or (listing_type = 'sale' and public.has_profile_persona('seller'))
    )
  );

drop policy if exists "Landlords can delete their listings" on public.listings;
create policy "Providers can delete their listings"
  on public.listings for delete to authenticated
  using (
    landlord_id = (select auth.uid())
    and (
      (listing_type = 'rent' and public.has_profile_persona('landlord'))
      or (listing_type = 'sale' and public.has_profile_persona('seller'))
    )
  );

drop policy if exists "Buyers can create sale interest" on public.buyer_interests;
create policy "Buyers can create sale interest"
  on public.buyer_interests for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and public.has_profile_persona('buyer')
    and exists (
      select 1 from public.listings
      where listings.id = buyer_interests.listing_id
        and listings.landlord_id = buyer_interests.seller_id
        and listings.listing_type = 'sale'
        and listings.status = 'published'
    )
  );

-- Review entitlement generation from verified platform interactions.
create or replace function private.create_review_pair(
  target_interaction_type text,
  target_interaction_id uuid,
  first_profile uuid,
  second_profile uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if first_profile is null or second_profile is null or first_profile = second_profile then
    return;
  end if;
  insert into public.profile_review_entitlements(
    interaction_type, interaction_id, reviewer_id, subject_id
  )
  values
    (target_interaction_type, target_interaction_id, first_profile, second_profile),
    (target_interaction_type, target_interaction_id, second_profile, first_profile)
  on conflict do nothing;
end;
$$;
revoke all on function private.create_review_pair(text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.create_review_pair(text, uuid, uuid, uuid) to service_role;

create or replace function private.entitle_completed_viewing_reviews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_profile uuid;
  second_profile uuid;
begin
  if new.status <> 'completed' or (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;
  if new.application_id is not null then
    select application.renter_id, listing.landlord_id
    into first_profile, second_profile
    from public.applications application
    join public.listings listing on listing.id = application.listing_id
    where application.id = new.application_id;
  elsif new.buyer_interest_id is not null then
    select buyer_id, seller_id into first_profile, second_profile
    from public.buyer_interests where id = new.buyer_interest_id;
  end if;
  perform private.create_review_pair('viewing', new.id, first_profile, second_profile);
  return new;
end;
$$;

create or replace function private.entitle_approved_application_reviews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_id uuid;
begin
  if new.status <> 'approved' or (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;
  select landlord_id into provider_id from public.listings where id = new.listing_id;
  perform private.create_review_pair('application', new.id, new.renter_id, provider_id);
  return new;
end;
$$;

create or replace function private.entitle_completed_purchase_reviews()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_id uuid;
begin
  if new.current_stage <> 'purchase_complete'
    or (tg_op = 'UPDATE' and old.current_stage = new.current_stage) then
    return new;
  end if;
  select landlord_id into provider_id from public.listings where id = new.listing_id;
  perform private.create_review_pair('purchase', new.id, new.user_id, provider_id);
  return new;
end;
$$;

revoke all on function private.entitle_completed_viewing_reviews() from public, anon, authenticated;
revoke all on function private.entitle_approved_application_reviews() from public, anon, authenticated;
revoke all on function private.entitle_completed_purchase_reviews() from public, anon, authenticated;
grant execute on function private.entitle_completed_viewing_reviews() to service_role;
grant execute on function private.entitle_approved_application_reviews() to service_role;
grant execute on function private.entitle_completed_purchase_reviews() to service_role;

drop trigger if exists viewings_profile_review_entitlement on public.viewings;
create trigger viewings_profile_review_entitlement
  after insert or update of status on public.viewings
  for each row execute function private.entitle_completed_viewing_reviews();
drop trigger if exists applications_profile_review_entitlement on public.applications;
create trigger applications_profile_review_entitlement
  after insert or update of status on public.applications
  for each row execute function private.entitle_approved_application_reviews();
drop trigger if exists purchases_profile_review_entitlement on public.purchase_progress;
create trigger purchases_profile_review_entitlement
  after insert or update of current_stage on public.purchase_progress
  for each row execute function private.entitle_completed_purchase_reviews();

create or replace function public.publish_due_profile_reviews()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_count integer;
begin
  update public.profile_reviews review
  set status = 'published',
      published_at = now(),
      updated_at = now()
  where review.status = 'submitted'
    and (
      review.publish_after <= now()
      or exists (
        select 1
        from public.profile_review_entitlements own_entitlement
        join public.profile_review_entitlements peer_entitlement
          on peer_entitlement.interaction_type = own_entitlement.interaction_type
         and peer_entitlement.interaction_id = own_entitlement.interaction_id
         and peer_entitlement.reviewer_id = own_entitlement.subject_id
        join public.profile_reviews peer_review
          on peer_review.entitlement_id = peer_entitlement.id
        where own_entitlement.id = review.entitlement_id
          and peer_review.status in ('submitted', 'published')
      )
    );
  get diagnostics published_count = row_count;
  return published_count;
end;
$$;
revoke all on function public.publish_due_profile_reviews() from public, anon, authenticated;
grant execute on function public.publish_due_profile_reviews() to service_role;

-- Updated-at triggers.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'public_profiles', 'profile_personas', 'renter_profile_details',
    'buyer_profile_details', 'landlord_profile_details', 'seller_profile_details',
    'profile_documents', 'profile_reviews', 'profile_review_reports',
    'notification_subscriptions'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

-- RLS and grants. Private account/profile records remain owner scoped.
alter table public.profiles enable row level security;
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users read their private profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

revoke select, update on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  email, updated_at, phone, full_name, avatar_url, about, availability_mode
) on public.profiles to authenticated;

alter table public.public_profiles enable row level security;
alter table public.profile_personas enable row level security;
alter table public.renter_profile_details enable row level security;
alter table public.buyer_profile_details enable row level security;
alter table public.landlord_profile_details enable row level security;
alter table public.seller_profile_details enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.profile_mutes enable row level security;
alter table public.profile_versions enable row level security;
alter table public.profile_activity_events enable row level security;
alter table public.verification_check_history enable row level security;
alter table public.profile_documents enable row level security;
alter table public.profile_document_versions enable row level security;
alter table public.profile_document_shares enable row level security;
alter table public.profile_review_entitlements enable row level security;
alter table public.profile_reviews enable row level security;
alter table public.profile_review_helpful_votes enable row level security;
alter table public.profile_review_reports enable row level security;
alter table public.profile_contact_requests enable row level security;
alter table public.notification_subscriptions enable row level security;
alter table public.account_security_events enable row level security;
alter table public.recognized_devices enable row level security;
alter table public.profile_sync_events enable row level security;

create policy "Anonymous users read public profiles"
  on public.public_profiles for select to anon
  using (profile_audience = 'everyone');
create policy "Visible public profiles"
  on public.public_profiles for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (
      not exists (
        select 1 from public.profile_blocks block
        where (block.blocker_id = profile_id and block.blocked_id = (select auth.uid()))
           or (block.blocker_id = (select auth.uid()) and block.blocked_id = profile_id)
      )
      and (
        profile_audience = 'everyone'
        or (profile_audience = 'members' and (select auth.uid()) is not null)
        or (
          profile_audience = 'interactions'
          and (select auth.uid()) is not null
          and (
            exists (
              select 1 from public.conversations conversation
              where (conversation.renter_id = profile_id and conversation.landlord_id = (select auth.uid()))
                 or (conversation.landlord_id = profile_id and conversation.renter_id = (select auth.uid()))
            )
            or exists (
              select 1
              from public.applications application
              join public.listings listing on listing.id = application.listing_id
              where (application.renter_id = profile_id and listing.landlord_id = (select auth.uid()))
                 or (application.renter_id = (select auth.uid()) and listing.landlord_id = profile_id)
            )
            or exists (
              select 1 from public.buyer_interests interest
              where (interest.buyer_id = profile_id and interest.seller_id = (select auth.uid()))
                 or (interest.buyer_id = (select auth.uid()) and interest.seller_id = profile_id)
            )
          )
        )
      )
    )
  );
create policy "Owners update public profile"
  on public.public_profiles for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "Owners read personas"
  on public.profile_personas for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "Owners add personas"
  on public.profile_personas for insert to authenticated
  with check (profile_id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'renter_profile_details', 'buyer_profile_details',
    'landlord_profile_details', 'seller_profile_details'
  ] loop
    execute format(
      'create policy "Owners manage %1$s" on public.%1$I for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()))',
      table_name
    );
  end loop;
end;
$$;

create policy "Block participants read relationships"
  on public.profile_blocks for select to authenticated
  using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));
create policy "Owners create blocks"
  on public.profile_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "Owners remove blocks"
  on public.profile_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy "Mute participants read relationships"
  on public.profile_mutes for select to authenticated
  using (muter_id = (select auth.uid()));
create policy "Owners create mutes"
  on public.profile_mutes for insert to authenticated
  with check (muter_id = (select auth.uid()));
create policy "Owners remove mutes"
  on public.profile_mutes for delete to authenticated
  using (muter_id = (select auth.uid()));

create policy "Owners read profile versions"
  on public.profile_versions for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Owners read activity"
  on public.profile_activity_events for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "Public activity follows profile visibility"
  on public.profile_activity_events for select to anon, authenticated
  using (
    visibility = 'public'
    and exists (
      select 1 from public.public_profiles profile
      where profile.profile_id = profile_activity_events.profile_id
        and profile.activity_visible
    )
  );

create policy "Owners read verification history"
  on public.verification_check_history for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Owners manage document metadata"
  on public.profile_documents for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners read document versions"
  on public.profile_document_versions for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Owners create document versions"
  on public.profile_document_versions for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Authorized users read document shares"
  on public.profile_document_shares for select to authenticated
  using (
    owner_id = (select auth.uid())
    or grantee_id = (select auth.uid())
    or exists (
      select 1
      from public.applications application
      join public.listings listing on listing.id = application.listing_id
      where application.id = profile_document_shares.application_id
        and (
          application.renter_id = (select auth.uid())
          or listing.landlord_id = (select auth.uid())
        )
    )
  );
create policy "Owners manage document shares"
  on public.profile_document_shares for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Reviewers read entitlements"
  on public.profile_review_entitlements for select to authenticated
  using (reviewer_id = (select auth.uid()));
create policy "Authors read own reviews"
  on public.profile_reviews for select to authenticated
  using (reviewer_id = (select auth.uid()));
create policy "Published reviews are public"
  on public.profile_reviews for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.public_profiles profile
      where profile.profile_id = profile_reviews.subject_id
        and profile.reviews_visible
    )
  );
create policy "Authors create entitled reviews"
  on public.profile_reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.profile_review_entitlements entitlement
      where entitlement.id = entitlement_id
        and entitlement.reviewer_id = (select auth.uid())
        and entitlement.subject_id = profile_reviews.subject_id
        and entitlement.available_at <= now()
        and entitlement.closes_at > now()
    )
  );
create policy "Authors update unpublished reviews"
  on public.profile_reviews for update to authenticated
  using (reviewer_id = (select auth.uid()) and status in ('draft', 'submitted'))
  with check (reviewer_id = (select auth.uid()) and status in ('draft', 'submitted'));

create policy "Helpful votes are readable"
  on public.profile_review_helpful_votes for select to anon, authenticated
  using (true);
create policy "Members add helpful votes"
  on public.profile_review_helpful_votes for insert to authenticated
  with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from public.profile_reviews review
      where review.id = review_id
        and review.status = 'published'
        and review.reviewer_id <> (select auth.uid())
    )
  );
create policy "Members remove helpful votes"
  on public.profile_review_helpful_votes for delete to authenticated
  using (voter_id = (select auth.uid()));

create policy "Reporters read review reports"
  on public.profile_review_reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy "Members report reviews"
  on public.profile_review_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "Contact participants read requests"
  on public.profile_contact_requests for select to authenticated
  using (
    requester_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );
create policy "Members create contact requests"
  on public.profile_contact_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and not exists (
      select 1 from public.profile_blocks block
      where (block.blocker_id = recipient_id and block.blocked_id = (select auth.uid()))
         or (block.blocker_id = (select auth.uid()) and block.blocked_id = recipient_id)
    )
  );

create policy "Owners manage notification subscriptions"
  on public.notification_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Owners read security events"
  on public.account_security_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Owners manage recognized devices"
  on public.recognized_devices for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Owners read sync events"
  on public.profile_sync_events for select to authenticated
  using (profile_id = (select auth.uid()));

revoke all on table
  public.public_profiles,
  public.profile_personas,
  public.renter_profile_details,
  public.buyer_profile_details,
  public.landlord_profile_details,
  public.seller_profile_details,
  public.profile_blocks,
  public.profile_mutes,
  public.profile_versions,
  public.profile_activity_events,
  public.verification_check_history,
  public.profile_documents,
  public.profile_document_versions,
  public.profile_document_shares,
  public.profile_review_entitlements,
  public.profile_reviews,
  public.profile_review_helpful_votes,
  public.profile_review_reports,
  public.profile_contact_requests,
  public.notification_subscriptions,
  public.account_security_events,
  public.recognized_devices,
  public.profile_sync_events
from anon, authenticated;

grant select on public.public_profiles, public.profile_activity_events,
  public.profile_reviews, public.profile_review_helpful_votes to anon;
grant select, update on public.public_profiles to authenticated;
grant select, insert on public.profile_personas to authenticated;
grant select, insert, update, delete on
  public.renter_profile_details,
  public.buyer_profile_details,
  public.landlord_profile_details,
  public.seller_profile_details,
  public.profile_blocks,
  public.profile_mutes,
  public.profile_documents,
  public.profile_document_shares,
  public.profile_reviews,
  public.profile_review_helpful_votes,
  public.profile_review_reports,
  public.profile_contact_requests,
  public.notification_subscriptions,
  public.recognized_devices
to authenticated;
grant select on
  public.profile_versions,
  public.profile_activity_events,
  public.verification_check_history,
  public.profile_document_versions,
  public.profile_review_entitlements,
  public.account_security_events,
  public.profile_sync_events
to authenticated;
grant insert on public.profile_document_versions to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-documents',
  'profile-documents',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload profile documents" on storage.objects;
create policy "Owners upload profile documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Owners read profile documents" on storage.objects;
create policy "Owners read profile documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-documents'
    and owner_id = (select auth.uid())::text
  );
drop policy if exists "Owners replace profile documents" on storage.objects;
create policy "Owners replace profile documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-documents'
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-documents'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Owners delete profile documents" on storage.objects;
create policy "Owners delete profile documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-documents'
    and owner_id = (select auth.uid())::text
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profile_sync_events'
  ) then
    alter publication supabase_realtime add table public.profile_sync_events;
  end if;
end;
$$;

comment on table public.public_profiles is
  'Public-safe profile identity. Never contains email, phone, financial, document, or security data.';
comment on table public.profile_personas is
  'Marketplace capabilities for one account. Admin and organization roles remain separate.';
comment on table public.profile_documents is
  'Owner-scoped document vault metadata; bytes remain in private Storage buckets.';
comment on function public.publish_due_profile_reviews() is
  'Publishes blind reviews after both parties submit or the fourteen-day window elapses.';

-- Database-enforced document retention while an application remains active.
create or replace function private.guard_profile_document_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_document_id uuid := coalesce(new.id, old.id);
begin
  if tg_op = 'UPDATE' and new.deleted_at is null then
    return new;
  end if;
  if exists (
    select 1
    from public.profile_document_shares share
    join public.applications application on application.id = share.application_id
    where share.document_id = target_document_id
      and share.revoked_at is null
      and (share.expires_at is null or share.expires_at > now())
      and application.status not in ('rejected', 'withdrawn')
  ) then
    raise exception 'document_attached_to_active_application'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.guard_profile_document_deletion() from public, anon, authenticated;
grant execute on function private.guard_profile_document_deletion() to service_role;

drop trigger if exists profile_documents_guard_delete on public.profile_documents;
create trigger profile_documents_guard_delete
  before delete or update of deleted_at on public.profile_documents
  for each row execute function private.guard_profile_document_deletion();

-- Transactional owner activity projection for existing marketplace writes.
create or replace function private.record_profile_core_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_profile uuid;
  second_profile uuid;
  activity_category text;
  activity_key text;
  activity_title text;
  activity_summary text;
  activity_visibility public.profile_activity_visibility := 'private';
  reference_kind text := tg_table_name;
  reference_value uuid;
  conversation_row public.conversations%rowtype;
  application_row public.applications%rowtype;
  listing_row public.listings%rowtype;
  interest_row public.buyer_interests%rowtype;
begin
  if tg_table_name = 'applications' then
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    first_profile := new.renter_id;
    select * into listing_row from public.listings where id = new.listing_id;
    second_profile := listing_row.landlord_id;
    activity_category := 'application';
    activity_key := 'application.' || new.status::text;
    activity_title := 'Application ' || replace(new.status::text, '_', ' ');
    reference_value := new.id;
  elsif tg_table_name = 'messages' then
    select * into conversation_row from public.conversations where id = new.conversation_id;
    first_profile := new.sender_id;
    second_profile := case
      when conversation_row.renter_id = new.sender_id then conversation_row.landlord_id
      else conversation_row.renter_id
    end;
    activity_category := 'message';
    activity_key := 'message.sent';
    activity_title := 'Message sent';
    reference_value := new.id;
  elsif tg_table_name = 'viewings' then
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    if new.application_id is not null then
      select * into application_row from public.applications where id = new.application_id;
      select * into listing_row from public.listings where id = application_row.listing_id;
      first_profile := application_row.renter_id;
      second_profile := listing_row.landlord_id;
    elsif new.buyer_interest_id is not null then
      select * into interest_row from public.buyer_interests where id = new.buyer_interest_id;
      first_profile := interest_row.buyer_id;
      second_profile := interest_row.seller_id;
    end if;
    activity_category := 'viewing';
    activity_key := 'viewing.' || new.status::text;
    activity_title := 'Viewing ' || replace(new.status::text, '_', ' ');
    reference_value := new.id;
  elsif tg_table_name = 'buyer_interests' then
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    first_profile := new.buyer_id;
    second_profile := new.seller_id;
    activity_category := 'offer';
    activity_key := 'offer.' || new.status::text;
    activity_title := 'Purchase interest ' || replace(new.status::text, '_', ' ');
    reference_value := new.id;
  elsif tg_table_name = 'listings' then
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    first_profile := new.landlord_id;
    activity_category := 'listing';
    activity_key := 'listing.' || new.status::text;
    activity_title := case when new.status = 'published' then 'New listing published' else 'Listing ' || new.status::text end;
    activity_visibility := case when new.status = 'published' then 'public' else 'private' end;
    reference_value := new.id;
  elsif tg_table_name = 'profile_documents' then
    first_profile := new.owner_id;
    activity_category := 'document';
    activity_key := case when new.deleted_at is null then 'document.saved' else 'document.deleted' end;
    activity_title := case when new.deleted_at is null then 'Document saved' else 'Document removed' end;
    activity_summary := new.display_name;
    reference_value := new.id;
  elsif tg_table_name = 'profile_reviews' then
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    first_profile := new.reviewer_id;
    second_profile := new.subject_id;
    activity_category := 'review';
    activity_key := 'review.' || new.status::text;
    activity_title := 'Review ' || replace(new.status::text, '_', ' ');
    reference_value := new.id;
  elsif tg_table_name = 'verification_checks' then
    if new.profile_id is null then return new; end if;
    if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
    first_profile := new.profile_id;
    activity_category := 'verification';
    activity_key := 'verification.' || new.status;
    activity_title := case when new.status = 'verified' then 'Verification approved' else 'Verification ' || replace(new.status, '_', ' ') end;
    activity_summary := replace(new.check_key, '_', ' ');
    activity_visibility := case when new.status = 'verified' then 'public' else 'private' end;
    reference_value := new.id;
  elsif tg_table_name = 'notification_events' then
    first_profile := new.recipient_id;
    activity_category := 'notification';
    activity_key := 'notification.' || new.type::text;
    activity_title := 'Notification received';
    reference_value := new.id;
  else
    return new;
  end if;

  if first_profile is not null then
    insert into public.profile_activity_events(
      profile_id, category, event_key, title, summary,
      reference_type, reference_id, visibility
    ) values (
      first_profile, activity_category, activity_key, activity_title, activity_summary,
      reference_kind, reference_value, activity_visibility
    );
    insert into public.profile_sync_events(profile_id, entity, entity_id)
    values (first_profile, 'activity', reference_value);
  end if;
  if second_profile is not null and second_profile <> first_profile then
    insert into public.profile_activity_events(
      profile_id, category, event_key, title, summary,
      reference_type, reference_id, visibility
    ) values (
      second_profile, activity_category, activity_key, activity_title, activity_summary,
      reference_kind, reference_value, activity_visibility
    );
    insert into public.profile_sync_events(profile_id, entity, entity_id)
    values (second_profile, 'activity', reference_value);
  end if;
  return new;
end;
$$;
revoke all on function private.record_profile_core_activity() from public, anon, authenticated;
grant execute on function private.record_profile_core_activity() to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'applications', 'messages', 'viewings', 'buyer_interests', 'listings',
    'profile_documents', 'profile_reviews', 'verification_checks',
    'notification_events'
  ] loop
    execute format('drop trigger if exists %I_profile_activity on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_profile_activity after insert or update on public.%I for each row execute function private.record_profile_core_activity()',
      table_name, table_name
    );
  end loop;
end;
$$;

-- Blocking is enforced at the database boundary for new conversations,
-- messages, reviews, votes, and review reports.
drop policy if exists "Users can insert conversations they are part of" on public.conversations;
create policy "Unblocked users create conversations"
  on public.conversations for insert to authenticated
  with check (
    ((renter_id = (select auth.uid()) and public.has_profile_persona('renter'))
      or (landlord_id = (select auth.uid()) and (
        public.has_profile_persona('landlord') or public.has_profile_persona('seller')
      )))
    and not exists (
      select 1 from public.profile_blocks block
      where (block.blocker_id = renter_id and block.blocked_id = landlord_id)
         or (block.blocker_id = landlord_id and block.blocked_id = renter_id)
    )
  );

drop policy if exists "Users can insert messages to their conversations" on public.messages;
create policy "Unblocked participants create messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations conversation
      where conversation.id = messages.conversation_id
        and (conversation.renter_id = (select auth.uid()) or conversation.landlord_id = (select auth.uid()))
        and not exists (
          select 1 from public.profile_blocks block
          where (block.blocker_id = conversation.renter_id and block.blocked_id = conversation.landlord_id)
             or (block.blocker_id = conversation.landlord_id and block.blocked_id = conversation.renter_id)
        )
    )
  );

drop policy if exists "Authors create entitled reviews" on public.profile_reviews;
create policy "Unblocked authors create entitled reviews"
  on public.profile_reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and not exists (
      select 1 from public.profile_blocks block
      where (block.blocker_id = reviewer_id and block.blocked_id = subject_id)
         or (block.blocker_id = subject_id and block.blocked_id = reviewer_id)
    )
    and exists (
      select 1 from public.profile_review_entitlements entitlement
      where entitlement.id = entitlement_id
        and entitlement.reviewer_id = (select auth.uid())
        and entitlement.subject_id = profile_reviews.subject_id
        and entitlement.available_at <= now()
        and entitlement.closes_at > now()
    )
  );
