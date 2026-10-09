-- Private Shopping Offer intake only. No approval or public projection yet.
create table public.offer_posters (
  user_id uuid primary key references auth.users(id) on delete restrict,
  enrolled_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
create table public.shopping_offers (
  id uuid primary key,
  poster_id uuid not null references public.offer_posters(user_id) on delete restrict,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  version integer not null default 1 check (version > 0),
  pending_revision_id uuid,
  withdrawn_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (id, poster_id),
  check (withdrawn_at is null or pending_revision_id is null)
);
create index shopping_offers_poster_idx on public.shopping_offers(poster_id);
create table public.shopping_offer_revisions (
  id uuid primary key,
  offer_id uuid not null,
  poster_id uuid not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  submitted_at timestamptz not null default clock_timestamp(),
  foreign key (offer_id, poster_id) references public.shopping_offers(id, poster_id) on delete restrict,
  unique (offer_id, id)
);
alter table public.shopping_offers add constraint shopping_offers_pending_revision_fk
  foreign key (id, pending_revision_id) references public.shopping_offer_revisions(offer_id, id) on delete restrict;
create table public.shopping_offer_events (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.offer_posters(user_id) on delete restrict,
  offer_id uuid,
  revision_id uuid,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('enroll','create','save','submit','resubmit','reject','withdraw')),
  version integer,
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 2000),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (offer_id, poster_id) references public.shopping_offers(id, poster_id) on delete restrict,
  foreign key (offer_id, revision_id) references public.shopping_offer_revisions(offer_id, id) on delete restrict,
  check ((action = 'enroll' and offer_id is null and version is null and revision_id is null)
    or (action <> 'enroll' and offer_id is not null and version is not null and version > 0)),
  check ((action = 'reject') = (reason is not null)),
  check (action not in ('submit','resubmit','reject') or revision_id is not null),
  unique (offer_id, version)
);
create index shopping_offer_events_poster_idx on public.shopping_offer_events(poster_id);
create unique index shopping_offer_events_enrollment_idx on public.shopping_offer_events(poster_id) where action = 'enroll';

create function private.pinpoint_intake_eligible()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from auth.users u join public.profiles p on p.id = u.id
      where u.id = auth.uid() and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous, false)
        and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and exists (select 1 from auth.sessions s where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id'
      and (s.not_after is null or s.not_after > statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s
      where s.user_id = auth.uid() and s.restored_at is null
        and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v
      join public.trust_documents d on d.current_version_id = v.id
      where v.status = 'published' and v.requires_reacceptance
        and v.effective_at <= statement_timestamp()
        and not exists (select 1 from public.policy_acceptances a
          where a.user_id = auth.uid() and a.version_id = v.id));
$$;
create function private.pinpoint_intake_poster()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pinpoint_intake_eligible() and exists (
    select 1 from public.offer_posters where user_id = auth.uid() and revoked_at is null);
$$;
create function private.pinpoint_intake_reviewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pinpoint_intake_eligible() and coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and exists (select 1 from public.admin_memberships m where m.user_id = auth.uid()
      and m.revoked_at is null and (
        select count(*) from auth.mfa_factors f where f.user_id = m.user_id
          and f.status = 'verified' and f.factor_type = 'totp'
      ) >= case when m.level = 'owner' then 2 else 1 end);
$$;

create function private.pinpoint_intake_immutable()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Shopping Offer revisions and events are immutable' using errcode = '42501';
end;
$$;
create trigger shopping_offer_revisions_immutable before update or delete
  on public.shopping_offer_revisions for each row execute function private.pinpoint_intake_immutable();
create trigger shopping_offer_events_immutable before update or delete
  on public.shopping_offer_events for each row execute function private.pinpoint_intake_immutable();

-- Validate even direct authenticated RPC calls, independently of Zod/server UI.
create function private.pinpoint_intake_validate(content jsonb, complete boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  field text;
  maximum integer;
  start_time timestamptz;
  end_time timestamptz;
begin
  if content is null or jsonb_typeof(content) <> 'object' or octet_length(content::text) > 30000 then
    raise exception 'Invalid offer content' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(content) k where k not in
    ('title','benefit','terms','shopName','areaId','address','latitude','longitude','startsAt','endsAt')) then
    raise exception 'Unknown offer fields' using errcode = '22023';
  end if;
  foreach field in array array['title','benefit','terms','shopName','address'] loop
    maximum := case field when 'title' then 160 when 'shopName' then 160 when 'terms' then 4000 else 500 end;
    if (complete or content ? field) and (jsonb_typeof(content->field) is distinct from 'string'
      or char_length(btrim(content->>field)) not between 1 and maximum) then
      raise exception 'Invalid offer text: %', field using errcode = '22023';
    end if;
  end loop;
  if complete or content ? 'areaId' then
    if jsonb_typeof(content->'areaId') is distinct from 'string'
      or (content->>'areaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid offer place ID' using errcode = '22023';
    end if;
  end if;
  foreach field in array array['latitude','longitude'] loop
    maximum := case field when 'latitude' then 90 else 180 end;
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'number' then
        raise exception 'Invalid offer coordinate' using errcode = '22023';
      end if;
      if (content->>field)::numeric not between -maximum and maximum then
        raise exception 'Invalid offer coordinate' using errcode = '22023';
      end if;
    end if;
  end loop;
  foreach field in array array['startsAt','endsAt'] loop
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'string' or (content->>field) !~
        '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
        raise exception 'Invalid offer timestamp' using errcode = '22023';
      end if;
      -- Reject impossible dates as well as missing offsets/infinity.
      perform (content->>field)::timestamptz;
    end if;
  end loop;
  if complete then
    start_time := (content->>'startsAt')::timestamptz;
    end_time := (content->>'endsAt')::timestamptz;
    if start_time >= end_time or end_time <= clock_timestamp() then
      raise exception 'Offer must have an ordered future end' using errcode = '22023';
    end if;
    if not exists (select 1 from public.discovery_places p
      where p.id = (content->>'areaId')::uuid
        and p.level in ('neighbourhood','locality','place','municipality')
        and (content->>'latitude')::double precision between p.south and p.north
        and (content->>'longitude')::double precision between p.west and p.east) then
      raise exception 'Stored place and shop point must agree' using errcode = '22023';
    end if;
  end if;
end;
$$;

create function private.pinpoint_offer_enroll()
returns uuid language plpgsql security definer set search_path = '' as $$
declare enrolled uuid;
begin
  if not private.pinpoint_intake_eligible() then
    raise exception 'Eligible signed-in account required' using errcode = '42501';
  end if;
  insert into public.offer_posters(user_id) values (auth.uid())
    on conflict (user_id) do nothing returning user_id into enrolled;
  if enrolled is not null then
    insert into public.shopping_offer_events(poster_id, actor_id, action) values (enrolled, auth.uid(), 'enroll');
  end if;
  if not private.pinpoint_intake_poster() then
    raise exception 'Poster access revoked' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function private.pinpoint_offer_write(
  command text, target uuid, expected_version integer, payload jsonb default '{}'::jsonb, revision uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_offer public.shopping_offers%rowtype;
  event_action text := command;
  event_revision uuid;
begin
  if target is null or expected_version is null or command is null
    or command not in ('create','save','submit','withdraw') then
    raise exception 'Invalid offer mutation' using errcode = '22023';
  end if;
  if not private.pinpoint_intake_poster() then
    raise exception 'Poster access required' using errcode = '42501';
  end if;
  if command = 'create' then
    if expected_version <> 0 then raise exception 'Offer version conflict' using errcode = 'PT409'; end if;
    insert into public.shopping_offers(id, poster_id) values (target, auth.uid()) on conflict (id) do nothing;
    -- An existing ID is a conflict, never an ownership reassignment or draft reset.
    if not found then raise exception 'Offer version conflict' using errcode = 'PT409'; end if;
    select * into current_offer from public.shopping_offers where id = target for update;
  else
    select * into current_offer from public.shopping_offers where id = target for update;
    if current_offer.id is null or current_offer.poster_id <> auth.uid() then
      raise exception 'Offer owner access required' using errcode = '42501';
    end if;
  end if;
  -- Fresh check after waiting for a concurrent row lock; no actor flags accepted.
  if not private.pinpoint_intake_poster() then
    raise exception 'Poster access required' using errcode = '42501';
  end if;
  if command = 'submit' and revision is not null
    and exists (select 1 from public.shopping_offer_revisions where id = revision) then
    if current_offer.pending_revision_id = revision and current_offer.withdrawn_at is null then
      return jsonb_build_object('offerId', target, 'version', current_offer.version, 'pendingRevisionId', revision);
    end if;
    raise exception 'Revision ID already used' using errcode = '22023';
  end if;
  if command <> 'create' and current_offer.version <> expected_version then
    raise exception 'Offer version conflict' using errcode = 'PT409';
  end if;
  if command = 'save' then
    perform private.pinpoint_intake_validate(payload, false);
    update public.shopping_offers set draft = payload where id = target;
  elsif command = 'submit' then
    if revision is null or current_offer.pending_revision_id is not null then
      raise exception 'Fresh revision required and offer must not be awaiting review' using errcode = '22023';
    end if;
    perform private.pinpoint_intake_validate(current_offer.draft, true);
    insert into public.shopping_offer_revisions(id, offer_id, poster_id, content)
      values (revision, target, auth.uid(), current_offer.draft);
    if current_offer.withdrawn_at is not null then event_action := 'resubmit'; end if;
    event_revision := revision;
    update public.shopping_offers set pending_revision_id = revision, withdrawn_at = null where id = target;
  elsif command = 'withdraw' then
    if current_offer.withdrawn_at is not null then
      return jsonb_build_object('offerId', target, 'version', current_offer.version, 'pendingRevisionId', null);
    end if;
    event_revision := current_offer.pending_revision_id;
    update public.shopping_offers set pending_revision_id = null, withdrawn_at = clock_timestamp() where id = target;
  end if;
  if command <> 'create' then
    update public.shopping_offers set version = version + 1, updated_at = clock_timestamp()
      where id = target returning * into current_offer;
  end if;
  insert into public.shopping_offer_events(poster_id, offer_id, revision_id, actor_id, action, version)
    values (auth.uid(), target, event_revision, auth.uid(), event_action, current_offer.version);
  return jsonb_build_object('offerId', target, 'version', current_offer.version,
    'pendingRevisionId', current_offer.pending_revision_id);
end;
$$;

create function private.pinpoint_offer_review_read(target uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  select jsonb_build_object('offerId', o.id, 'version', o.version,
    'revisionId', r.id, 'content', r.content, 'submittedAt', r.submitted_at)
    into result from public.shopping_offers o join public.shopping_offer_revisions r on r.id = o.pending_revision_id
    where o.id = target and o.withdrawn_at is null;
  return result;
end;
$$;
create function private.pinpoint_offer_reject(target uuid, revision uuid, expected_version integer, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  if target is null or revision is null or expected_version is null or reason is null
    or char_length(btrim(reason)) not between 1 and 2000 then
    raise exception 'Invalid review correction' using errcode = '22023';
  end if;
  select * into current_offer from public.shopping_offers where id = target for update;
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  if current_offer.id is null or current_offer.version <> expected_version then
    raise exception 'Offer version conflict' using errcode = 'PT409';
  end if;
  if current_offer.pending_revision_id is distinct from revision or current_offer.withdrawn_at is not null then
    raise exception 'Revision is not awaiting review' using errcode = '22023';
  end if;
  if not exists (select 1 from public.offer_posters p where p.user_id = current_offer.poster_id and p.revoked_at is null)
    or exists (select 1 from public.account_suspensions s where s.user_id = current_offer.poster_id and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > clock_timestamp())) then
    raise exception 'Poster is inactive' using errcode = '42501';
  end if;
  update public.shopping_offers set pending_revision_id = null, version = version + 1, updated_at = clock_timestamp()
    where id = target returning * into current_offer;
  insert into public.shopping_offer_events(poster_id, offer_id, revision_id, actor_id, action, version, reason)
    values (current_offer.poster_id, target, revision, auth.uid(), 'reject', current_offer.version, btrim(reason));
  return jsonb_build_object('offerId', target, 'version', current_offer.version, 'pendingRevisionId', null);
end;
$$;

-- Read-only client grants, explicit RLS, no direct writes or anonymous reads.
alter table public.offer_posters enable row level security;
alter table public.shopping_offers enable row level security;
alter table public.shopping_offer_revisions enable row level security;
alter table public.shopping_offer_events enable row level security;
revoke all on public.offer_posters, public.shopping_offers, public.shopping_offer_revisions,
  public.shopping_offer_events from public, anon, authenticated, service_role;
grant select on public.offer_posters, public.shopping_offers, public.shopping_offer_revisions,
  public.shopping_offer_events to authenticated, service_role;
create policy offer_posters_owner_read on public.offer_posters for select to authenticated
  using (user_id = (select auth.uid()) and (select private.pinpoint_intake_eligible()));
create policy shopping_offers_owner_read on public.shopping_offers for select to authenticated
  using (poster_id = (select auth.uid()) and (select private.pinpoint_intake_poster()));
create policy shopping_offer_revisions_read on public.shopping_offer_revisions for select to authenticated
  using ((poster_id = (select auth.uid()) and (select private.pinpoint_intake_poster()))
    or (select private.pinpoint_intake_reviewer()));
create policy shopping_offer_events_read on public.shopping_offer_events for select to authenticated
  using ((poster_id = (select auth.uid()) and (select private.pinpoint_intake_poster()))
    or (select private.pinpoint_intake_reviewer()));

-- Invoker wrappers expose only the authenticated, internally checked operations.
create function public.pinpoint_offer_enroll() returns uuid language plpgsql security invoker set search_path = ''
  as $$ begin return private.pinpoint_offer_enroll(); end; $$;
create function public.pinpoint_offer_write(command text, target uuid, expected_version integer,
  payload jsonb default '{}'::jsonb, revision uuid default null)
returns jsonb language plpgsql security invoker set search_path = ''
  as $$ begin return private.pinpoint_offer_write(command, target, expected_version, payload, revision); end; $$;
create function public.pinpoint_offer_review_read(target uuid) returns jsonb language plpgsql security invoker set search_path = ''
  as $$ begin return private.pinpoint_offer_review_read(target); end; $$;
create function public.pinpoint_offer_reject(target uuid, revision uuid, expected_version integer, reason text)
returns jsonb language plpgsql security invoker set search_path = ''
  as $$ begin return private.pinpoint_offer_reject(target, revision, expected_version, reason); end; $$;

-- Revoke defaults individually; never change privileges on existing private code.
revoke all on function private.pinpoint_intake_eligible(), private.pinpoint_intake_poster(),
  private.pinpoint_intake_reviewer(), private.pinpoint_intake_immutable(), private.pinpoint_intake_validate(jsonb, boolean),
  private.pinpoint_offer_enroll(), private.pinpoint_offer_write(text, uuid, integer, jsonb, uuid),
  private.pinpoint_offer_review_read(uuid), private.pinpoint_offer_reject(uuid, uuid, integer, text)
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.pinpoint_intake_eligible(), private.pinpoint_intake_poster(),
  private.pinpoint_intake_reviewer(), private.pinpoint_offer_enroll(),
  private.pinpoint_offer_write(text, uuid, integer, jsonb, uuid), private.pinpoint_offer_review_read(uuid),
  private.pinpoint_offer_reject(uuid, uuid, integer, text) to authenticated;
revoke all on function public.pinpoint_offer_enroll(), public.pinpoint_offer_write(text, uuid, integer, jsonb, uuid),
  public.pinpoint_offer_review_read(uuid), public.pinpoint_offer_reject(uuid, uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_offer_enroll(), public.pinpoint_offer_write(text, uuid, integer, jsonb, uuid),
  public.pinpoint_offer_review_read(uuid), public.pinpoint_offer_reject(uuid, uuid, integer, text) to authenticated;
comment on table public.shopping_offers is 'Private offer intake. No publication, public reads or Property integration in this slice.';
