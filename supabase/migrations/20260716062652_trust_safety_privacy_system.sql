-- Pinpoint Trust, Safety, Privacy, and Legal system.
-- New policy bodies begin as drafts unless they are imported legacy documents.

create table if not exists public.trust_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (category in ('legal', 'safety', 'trust', 'community', 'accessibility', 'technology')),
  title text not null check (char_length(title) between 3 and 120),
  summary text not null check (char_length(summary) between 20 and 500),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trust_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.trust_documents(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published', 'superseded')),
  body_markdown text not null check (char_length(body_markdown) between 50 and 100000),
  change_summary text not null default '' check (char_length(change_summary) <= 1000),
  requires_reacceptance boolean not null default false,
  effective_at timestamptz,
  drafted_by uuid references auth.users(id) on delete set null,
  external_reviewer_name text check (external_reviewer_name is null or char_length(external_reviewer_name) between 2 and 200),
  counsel_reference text check (counsel_reference is null or char_length(counsel_reference) between 2 and 500),
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  supersedes_id uuid references public.trust_document_versions(id) on delete set null,
  is_legacy_import boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, version),
  constraint trust_version_publication_metadata check (
    is_legacy_import or status not in ('approved', 'published', 'superseded') or
    (external_reviewer_name is not null and counsel_reference is not null and reviewed_at is not null and approved_by is not null and approved_at is not null)
  ),
  constraint trust_version_published_metadata check (
    is_legacy_import or status not in ('published', 'superseded') or
    (published_by is not null and published_at is not null and effective_at is not null)
  )
);

alter table public.trust_documents
  add constraint trust_documents_current_version_fkey
  foreign key (current_version_id) references public.trust_document_versions(id) on delete set null;

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.trust_documents(id) on delete cascade,
  version_id uuid not null references public.trust_document_versions(id) on delete restrict,
  source text not null default 'settings' check (source in ('signup', 'reacceptance', 'settings')),
  accepted_at timestamptz not null default now(),
  unique(user_id, version_id)
);

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_key text not null check (consent_key in ('marketing', 'location_personalization')),
  granted boolean not null,
  source text not null default 'settings' check (source in ('signup', 'settings', 'privacy_request')),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  application_updates boolean not null default true,
  viewing_updates boolean not null default true,
  message_digest boolean not null default true,
  search_alerts boolean not null default true,
  marketing boolean not null default false,
  location_personalization boolean not null default false,
  digest_frequency text not null default 'daily' check (digest_frequency in ('never', 'daily', 'weekly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('export', 'correction', 'deletion', 'objection', 'withdraw_consent')),
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'waiting_on_user', 'completed', 'declined', 'cancelled')),
  details text not null default '' check (char_length(details) <= 5000),
  due_at timestamptz not null default (now() + interval '30 days'),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 5000),
  retention_decision jsonb not null default '{}'::jsonb,
  artifact_bucket text,
  artifact_path text,
  artifact_expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint privacy_export_artifact_complete check (
    (artifact_path is null and artifact_bucket is null and artifact_expires_at is null) or
    (artifact_path is not null and artifact_bucket is not null and artifact_expires_at is not null)
  )
);

create unique index if not exists privacy_requests_one_active_type_idx
  on public.privacy_requests(user_id, request_type)
  where user_id is not null and status in ('submitted', 'in_review', 'waiting_on_user');
create index if not exists privacy_requests_due_queue_idx
  on public.privacy_requests(status, due_at, created_at);

create table if not exists public.verification_checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  check_key text not null check (check_key in ('email', 'phone', 'listing_review')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'revoked')),
  public_label text check (public_label is null or char_length(public_label) between 3 and 80),
  evidence_note text check (evidence_note is null or char_length(evidence_note) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_checks_one_subject check (num_nonnulls(profile_id, listing_id) = 1),
  constraint verification_checks_verified_at check (status <> 'verified' or verified_at is not null)
);

create unique index if not exists verification_checks_profile_key_idx
  on public.verification_checks(profile_id, check_key) where profile_id is not null;
create unique index if not exists verification_checks_listing_key_idx
  on public.verification_checks(listing_id, check_key) where listing_id is not null;

create table if not exists public.transparency_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  minimum_group_size integer not null default 10 check (minimum_group_size >= 10),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  generated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_start, period_end),
  constraint transparency_period_order check (period_end >= period_start),
  constraint transparency_publication_metadata check (status <> 'published' or (published_by is not null and published_at is not null))
);

alter table public.moderation_cases add column if not exists message_id uuid references public.messages(id) on delete set null;
alter table public.moderation_cases add column if not exists listing_image_id uuid references public.listing_images(id) on delete set null;
alter table public.moderation_cases add column if not exists target_context jsonb not null default '{}'::jsonb;
alter table public.moderation_cases add column if not exists first_reviewed_at timestamptz;
alter table public.moderation_cases drop constraint if exists moderation_cases_exactly_one_target;
alter table public.moderation_cases add constraint moderation_cases_exactly_one_target
  check (num_nonnulls(listing_id, reported_user_id, message_id, listing_image_id) = 1);
create index if not exists moderation_cases_message_id_idx on public.moderation_cases(message_id);
create index if not exists moderation_cases_listing_image_id_idx on public.moderation_cases(listing_image_id);
create unique index if not exists moderation_cases_open_message_report_idx
  on public.moderation_cases(reporter_id, message_id)
  where message_id is not null and status in ('open', 'in_review');
create unique index if not exists moderation_cases_open_listing_image_report_idx
  on public.moderation_cases(reporter_id, listing_image_id)
  where listing_image_id is not null and status in ('open', 'in_review');

create or replace function public.set_moderation_first_reviewed_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.status = 'open' and new.status = 'in_review' and new.first_reviewed_at is null then
    new.first_reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists moderation_cases_first_reviewed_at on public.moderation_cases;
create trigger moderation_cases_first_reviewed_at before update on public.moderation_cases
for each row execute function public.set_moderation_first_reviewed_at();

create or replace function public.trust_set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_published_trust_version()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.status in ('published', 'superseded') then
    if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'superseded' then
      return new;
    end if;
    raise exception 'published trust document versions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trust_documents_updated_at on public.trust_documents;
create trigger trust_documents_updated_at before update on public.trust_documents
for each row execute function public.trust_set_updated_at();
drop trigger if exists trust_document_versions_updated_at on public.trust_document_versions;
create trigger trust_document_versions_updated_at before update on public.trust_document_versions
for each row execute function public.trust_set_updated_at();
drop trigger if exists trust_document_versions_immutable on public.trust_document_versions;
create trigger trust_document_versions_immutable before update or delete on public.trust_document_versions
for each row execute function public.protect_published_trust_version();
drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at before update on public.notification_preferences
for each row execute function public.trust_set_updated_at();
drop trigger if exists privacy_requests_updated_at on public.privacy_requests;
create trigger privacy_requests_updated_at before update on public.privacy_requests
for each row execute function public.trust_set_updated_at();
drop trigger if exists verification_checks_updated_at on public.verification_checks;
create trigger verification_checks_updated_at before update on public.verification_checks
for each row execute function public.trust_set_updated_at();
drop trigger if exists transparency_snapshots_updated_at on public.transparency_snapshots;
create trigger transparency_snapshots_updated_at before update on public.transparency_snapshots
for each row execute function public.trust_set_updated_at();

alter table public.trust_documents enable row level security;
alter table public.trust_document_versions enable row level security;
alter table public.policy_acceptances enable row level security;
alter table public.consent_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.verification_checks enable row level security;
alter table public.transparency_snapshots enable row level security;

grant select on public.trust_documents to anon, authenticated;
grant select on public.trust_document_versions to anon, authenticated;
grant select, insert on public.policy_acceptances to authenticated;
grant select, insert on public.consent_events to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.privacy_requests to authenticated;
grant select on public.transparency_snapshots to anon, authenticated;

create policy "Public trust document index" on public.trust_documents for select to anon, authenticated using (
  current_version_id is not null and exists (
    select 1 from public.trust_document_versions version
    where version.id = trust_documents.current_version_id
      and version.status = 'published'
      and version.published_at <= now()
      and version.effective_at <= now()
  )
);
create policy "Published trust document versions" on public.trust_document_versions for select to anon, authenticated
  using (status = 'published' and published_at <= now() and effective_at <= now());
create policy "Users read own policy acceptances" on public.policy_acceptances for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users record own policy acceptances" on public.policy_acceptances for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users read own consent history" on public.consent_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users append own consent history" on public.consent_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users read own notification preferences" on public.notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create own notification preferences" on public.notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own notification preferences" on public.notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users read own privacy requests" on public.privacy_requests for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Published transparency snapshots" on public.transparency_snapshots for select to anon, authenticated
  using (status = 'published' and published_at <= now());

revoke all on public.verification_checks from public, anon, authenticated;
grant select, insert, update, delete on public.verification_checks to service_role;
grant select, insert, update, delete on public.privacy_requests to service_role;
grant select, insert, update, delete on public.trust_documents to service_role;
grant select, insert, update, delete on public.trust_document_versions to service_role;
grant select, insert, update, delete on public.transparency_snapshots to service_role;

create or replace function public.get_public_listing_trust_signals(target_listing_ids uuid[])
returns table(listing_id uuid, public_label text, verified_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select check_row.listing_id, check_row.public_label, check_row.verified_at, check_row.expires_at
  from public.verification_checks check_row
  join public.listings listing on listing.id = check_row.listing_id
  where check_row.listing_id = any(coalesce(target_listing_ids, array[]::uuid[]))
    and check_row.check_key = 'listing_review'
    and check_row.status = 'verified'
    and check_row.verified_at is not null
    and (check_row.expires_at is null or check_row.expires_at > now())
    and listing.status = 'published'
    and not exists (select 1 from public.listing_restrictions restriction where restriction.listing_id = listing.id and restriction.restored_at is null);
$$;

revoke all on function public.get_public_listing_trust_signals(uuid[]) from public;
grant execute on function public.get_public_listing_trust_signals(uuid[]) to anon, authenticated, service_role;

create or replace function public.get_my_auth_sessions()
returns table(id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip inet, is_current boolean)
language sql stable security definer set search_path = public, auth as $$
  select session.id, session.created_at, session.updated_at, session.user_agent, session.ip,
    session.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  from auth.sessions session
  where session.user_id = auth.uid()
  order by session.updated_at desc nulls last;
$$;

revoke all on function public.get_my_auth_sessions() from public, anon;
grant execute on function public.get_my_auth_sessions() to authenticated;

revoke all on function public.trust_set_updated_at() from public, anon, authenticated;
revoke all on function public.protect_published_trust_version() from public, anon, authenticated;
revoke all on function public.set_moderation_first_reviewed_at() from public, anon, authenticated;

create or replace function public.admin_publish_trust_version(
  actor uuid,
  target_version uuid,
  audit_request_id text
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  source_version public.trust_document_versions%rowtype;
  prior_version uuid;
begin
  perform public.assert_admin_actor(actor, true);
  select * into source_version from public.trust_document_versions where id = target_version for update;
  if source_version.id is null then raise exception 'trust version not found'; end if;
  if source_version.status <> 'approved' then raise exception 'trust version must be approved before publication'; end if;

  select current_version_id into prior_version from public.trust_documents where id = source_version.document_id for update;
  if prior_version is not null and prior_version <> target_version then
    update public.trust_document_versions set status = 'superseded' where id = prior_version and status = 'published';
  end if;

  update public.trust_document_versions set
    status = 'published',
    published_by = actor,
    published_at = now(),
    effective_at = coalesce(effective_at, now()),
    supersedes_id = prior_version
  where id = target_version;
  update public.trust_documents set current_version_id = target_version where id = source_version.document_id;

  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, request_id, metadata)
  values (actor, 'trust.version_published', 'trust_document_version', target_version, audit_request_id, jsonb_build_object('document_id', source_version.document_id, 'version', source_version.version));
end;
$$;

revoke all on function public.admin_publish_trust_version(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_publish_trust_version(uuid, uuid, text) to service_role;

create or replace function public.admin_rollback_trust_version(
  actor uuid,
  source_version_id uuid,
  audit_request_id text,
  require_reacceptance boolean default false
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  source_version public.trust_document_versions%rowtype;
  prior_version uuid;
  next_version integer;
  rollback_version uuid;
begin
  perform public.assert_admin_actor(actor, true);
  select * into source_version from public.trust_document_versions where id = source_version_id for update;
  if source_version.id is null then raise exception 'trust version not found'; end if;
  if source_version.status not in ('published', 'superseded') then raise exception 'only historical published versions can be restored'; end if;
  if source_version.external_reviewer_name is null or source_version.counsel_reference is null or source_version.reviewed_at is null then
    raise exception 'the historical version has no recorded counsel approval';
  end if;

  select current_version_id into prior_version from public.trust_documents where id = source_version.document_id for update;
  select coalesce(max(version), 0) + 1 into next_version from public.trust_document_versions where document_id = source_version.document_id;

  insert into public.trust_document_versions(
    document_id, version, status, body_markdown, change_summary, requires_reacceptance,
    effective_at, external_reviewer_name, counsel_reference, reviewed_at,
    drafted_by, approved_by, approved_at, published_by, published_at, supersedes_id
  ) values (
    source_version.document_id, next_version, 'approved', source_version.body_markdown,
    format('Rollback to version %s after owner review.', source_version.version), require_reacceptance,
    now(), source_version.external_reviewer_name, source_version.counsel_reference, source_version.reviewed_at,
    actor, actor, now(), null, null, prior_version
  ) returning id into rollback_version;

  if prior_version is not null then
    update public.trust_document_versions set status = 'superseded' where id = prior_version and status = 'published';
  end if;
  update public.trust_document_versions set status = 'published', published_by = actor, published_at = now() where id = rollback_version;
  update public.trust_documents set current_version_id = rollback_version where id = source_version.document_id;

  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, request_id, metadata)
  values (actor, 'trust.version_rolled_back', 'trust_document_version', rollback_version, audit_request_id,
    jsonb_build_object('document_id', source_version.document_id, 'restored_from_version_id', source_version_id, 'restored_from_version', source_version.version, 'requires_reacceptance', require_reacceptance));
  return rollback_version;
end;
$$;

revoke all on function public.admin_rollback_trust_version(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_rollback_trust_version(uuid, uuid, text, boolean) to service_role;

create or replace function public.admin_revoke_user_sessions(
  actor uuid,
  target_user uuid,
  audit_request_id text
)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.assert_admin_actor(actor, false);
  delete from auth.sessions where user_id = target_user;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, request_id)
  values (actor, 'privacy.sessions_revoked', 'user', target_user, audit_request_id);
end;
$$;

revoke all on function public.admin_revoke_user_sessions(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_revoke_user_sessions(uuid, uuid, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('privacy-exports', 'privacy-exports', false, 157286400, array['application/zip'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

revoke all on table public.policy_acceptances, public.consent_events, public.notification_preferences from anon;

insert into public.trust_documents(slug, category, title, summary)
values
  ('privacy', 'legal', 'Privacy Policy', 'How Pinpoint collects, uses, protects, retains, and deletes personal information under POPIA.'),
  ('terms', 'legal', 'Terms of Service', 'The rules for using Pinpoint and the responsibilities of renters, landlords, and the platform.'),
  ('cookies', 'legal', 'Cookie Policy', 'The essential authentication, map, and interface storage technologies used by Pinpoint.'),
  ('payments-refunds', 'legal', 'Payments and Refunds', 'The rules that will apply before Pinpoint introduces paid products, subscriptions, or verification fees.'),
  ('community-guidelines', 'community', 'Community Guidelines', 'Clear standards for respectful, honest, and safe participation on Pinpoint.'),
  ('content-policy', 'community', 'Listing and Content Policy', 'What may be listed on Pinpoint and how misleading, duplicate, or unlawful content is handled.'),
  ('messaging-policy', 'community', 'Messaging Policy', 'Rules that keep property conversations useful and protect people from abuse, spam, phishing, and fraud.'),
  ('reporting-policy', 'safety', 'Reporting Policy', 'What can be reported, how Pinpoint investigates, and the possible outcomes of a review.'),
  ('copyright', 'legal', 'Copyright Policy', 'How rights holders can request removal of copied photos, descriptions, and floor plans.'),
  ('accessibility', 'accessibility', 'Accessibility Statement', 'Pinpoint''s commitment to keyboard access, assistive technology, readable content, and inclusive product design.'),
  ('ai-policy', 'technology', 'AI Policy', 'How Pinpoint will disclose and govern recommendation, fraud-detection, and moderation assistance using AI.'),
  ('safety', 'safety', 'Safety Centre', 'Practical guidance for safer viewings, applications, listings, conversations, and scam avoidance.'),
  ('verification', 'trust', 'Verification Centre', 'What each Pinpoint trust signal proves, what it does not prove, and how checks can expire or be removed.'),
  ('transparency', 'trust', 'Transparency Centre', 'How discovery ordering, verification, reporting, moderation, and published platform metrics work.')
on conflict (slug) do update set category = excluded.category, title = excluded.title, summary = excluded.summary;

with legacy(slug, body_markdown) as (values
  ('privacy', $privacy$
## Who we are

Pinpoint is a South African property marketplace connecting renters and landlords. This notice explains how personal information is handled under the Protection of Personal Information Act.

## Information we collect

We process account and profile information, listing details, application information and documents, messages, viewing activity, device and security information, and location information supplied when a location feature is used.

## Why we use it

We use information to provide accounts, discovery, applications, messaging and viewings; prevent fraud; secure the service; send requested notifications; comply with law; and improve Pinpoint.

## Service providers

Pinpoint uses Supabase for authentication, data and storage; Google for maps; Cloudflare for hosting and security; and Resend for transactional email. We limit sharing to what is needed to provide each service.

## Retention and security

Information is retained while an account is active and for longer only where a legal, safety, dispute, or operational reason applies. Pinpoint uses access controls, encrypted transport, private storage and audited administrative access.

## Your choices and rights

You may request access, correction, deletion, objection or withdrawal of consent from Privacy & Data settings. Eligible requests are targeted for response within 30 calendar days. Some records may be retained where Pinpoint has a lawful obligation or active legal hold.

## Contact

Privacy questions can be sent to [privacy@pinpoint.co.za](mailto:privacy@pinpoint.co.za).
$privacy$),
  ('terms', $terms$
## Using Pinpoint

You must be at least 18 years old, provide accurate account information, protect your credentials, and use Pinpoint only for lawful property activity in South Africa.

## Marketplace role

Pinpoint provides discovery, application, messaging and viewing tools. Pinpoint is not a landlord, tenant, estate agency, party to a lease, or guarantor of a transaction between users.

## Honest participation

Fake identities, scams, discriminatory conduct, harassment, spam, illegal rentals, misleading prices or photos, and listings submitted without authority are prohibited.

## Listings and applications

Landlords must have authority to list and must accurately state price, deposit, availability, property condition and rules. Renters must submit truthful application information. Users should independently verify a property and agreement before payment.

## Content and moderation

You retain ownership of content you submit and grant Pinpoint permission to host and display it for operating the service. Pinpoint may restrict content or accounts after reports, safety checks, or policy violations.

## Fees

Pinpoint does not currently offer paid marketplace products. Paid features may launch only after applicable payment and refund terms are published.

## Liability and termination

Pinpoint does not guarantee a listing, applicant, viewing or agreement. Users may stop using Pinpoint, and Pinpoint may suspend or terminate access for policy violations, fraud, safety threats, or legal requirements.

## Contact and law

These terms are governed by South African law. Questions can be sent to [support@pinpoint.co.za](mailto:support@pinpoint.co.za).
$terms$)
), inserted as (
  insert into public.trust_document_versions(
    document_id, version, status, body_markdown, change_summary, requires_reacceptance,
    effective_at, external_reviewer_name, counsel_reference, reviewed_at,
    approved_by, approved_at, published_by, published_at, is_legacy_import
  )
  select d.id, 1, 'published', legacy.body_markdown, 'Imported from the existing public page.', false,
    '2025-06-26 00:00:00+02', 'Legacy publication', 'Imported pre-governance content',
    '2025-06-26 00:00:00+02', null, '2025-06-26 00:00:00+02', null, '2025-06-26 00:00:00+02', true
  from legacy join public.trust_documents d using (slug)
  on conflict (document_id, version) do nothing
  returning id, document_id
)
update public.trust_documents d set current_version_id = v.id
from public.trust_document_versions v
where v.document_id = d.id and v.version = 1 and v.status = 'published' and d.slug in ('privacy', 'terms');

with drafts(slug, body_markdown) as (values
  ('cookies', $body$## Current technologies

Pinpoint uses essential Supabase authentication cookies, functional Google Maps technology, and local browser storage for preferences such as theme, recent searches and interface position.

## Your controls

You can clear locally stored discovery history from Privacy & Data settings. Pinpoint does not currently use advertising cookies or third-party behavioural analytics. A consent control must be introduced before any non-essential technology is enabled.
$body$),
  ('payments-refunds', $body$## Current position

Pinpoint does not currently charge renters or landlords for marketplace features. There are no active subscriptions, premium listing charges or verification fees to cancel or refund.

## Before paid features launch

Pinpoint will publish the price, billing period, cancellation method, refund eligibility and contact process before accepting payment for a new product.
$body$),
  ('community-guidelines', $body$## Respect everyone

Treat renters, landlords, applicants and staff professionally. Hate speech, discrimination, intimidation, harassment and threats are not permitted.

## Be honest

Use your real account, advertise only properties you are authorised to list, and keep rent, deposits, rules, photos and availability accurate.

## Keep people safe

Do not pressure someone to pay before a viewing, move a conversation into a suspicious payment flow, impersonate another person, or misuse private application information.
$body$),
  ('content-policy', $body$## Allowed property content

Pinpoint supports genuine houses, apartments, rooms and student accommodation available through the marketplace.

## Not allowed

Fake or duplicate listings, unlawful properties, unsupported holiday rentals, misleading prices, stolen media, hidden mandatory costs and listings submitted without authority may be restricted or removed.

## Listing quality

Content must accurately describe the property, location, availability, costs and material rules. Verification or accreditation labels may be used only when Pinpoint has an active check for that exact claim.
$body$),
  ('messaging-policy', $body$## Property conversations only

Pinpoint messaging is for legitimate questions, applications, viewings and next steps connected to a property.

## Prohibited messages

Abuse, harassment, spam, unrelated advertising, phishing, fraudulent payment requests and attempts to obtain unnecessary personal or banking information are prohibited.

## Review after a report

Messages are private by default. Authorised staff may access relevant conversation content only after a report and a time-limited, audited access grant.
$body$),
  ('reporting-policy', $body$## What you can report

Signed-in users can report a listing, profile, message or listing photo for fraud, misleading information, duplicates, discrimination, harassment, safety, privacy or another policy concern.

## What happens next

Pinpoint acknowledges the report, prioritises urgent safety and fraud concerns, reviews relevant evidence and records a reasoned outcome. Possible outcomes include no action, a warning, content restriction, temporary suspension or permanent removal.

## Privacy

Reporters can see a simple status but cannot see internal notes, sensitive evidence or private enforcement details.
$body$),
  ('copyright', $body$## Rights-holder requests

If a listing uses a photo, description or floor plan without permission, the rights holder can submit the location of the content, proof of ownership, contact details and a good-faith statement.

## Review and restoration

Pinpoint may restrict the content while reviewing the request, notify the uploader where appropriate, and restore material if a valid counter-notice or permission is supplied.
$body$),
  ('accessibility', $body$## Our commitment

Pinpoint aims for WCAG 2.2 AA across core journeys. Controls should support keyboards, screen readers, visible focus, sufficient contrast, zoom, reduced motion and touch targets of at least 44 pixels.

## Tell us about a barrier

Accessibility problems can be reported with the page, device, assistive technology and expected result so the team can reproduce and prioritise the issue.
$body$),
  ('ai-policy', $body$## Current position

Pinpoint does not currently use a consequential AI system to decide access to housing, remove accounts, verify identity, or determine eligibility. Current discovery sorting uses documented product rules rather than an AI-generated housing decision.

## Safeguards

Pinpoint will not present automated output as verified fact. A new consequential AI feature cannot launch until its purpose, data use, review path, retention model and appeal process are reviewed and published.
$body$),
  ('safety', $body$## Renting safely

View the property, confirm who is authorised to rent it, inspect the agreement and avoid paying under pressure. Meet in an appropriate location and tell someone where you are going.

## Listing safely

Use structured viewing and application tools, request only necessary documents, keep banking details out of chat and report suspicious applicant behaviour.

## Common scams

Warning signs include fake deposits, impersonation, copied listings, advance-fee requests, urgent WhatsApp payment instructions and refusal to allow a reasonable viewing or verification step.
$body$),
  ('verification', $body$## What signals mean

Email confirmed means the account completed email confirmation. Phone confirmed means the account completed Pinpoint's phone check. NSFAS accredited means an authorised administrator recorded current accreditation for that listing. Listing reviewed means Pinpoint completed the stated listing check.

## What signals do not mean

These signals do not guarantee identity, ownership, property condition, payment safety or a successful agreement unless the exact label says so. Checks may expire or be revoked when evidence changes.
$body$),
  ('transparency', $body$## Discovery ordering

Pinpoint shows properties inside the active map area and applies the user's filters. List view defaults to newest listings, while map-oriented results can use distance from the current search origin. Users can select price, latest or closest sorting where available.

## Moderation and metrics

Pinpoint will publish monthly report and enforcement aggregates only after a group contains at least ten cases. Smaller groups display “not enough data to publish” to avoid exposing individual activity.
$body$)
)
insert into public.trust_document_versions(document_id, version, status, body_markdown, change_summary)
select d.id, 1, 'draft', drafts.body_markdown, 'Initial counsel-review draft.'
from drafts join public.trust_documents d using (slug)
on conflict (document_id, version) do nothing;
