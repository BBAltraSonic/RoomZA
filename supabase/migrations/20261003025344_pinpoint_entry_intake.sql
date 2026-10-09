-- Separate, private Tourism/Event intake. No approval or public projection.
-- Reuse only the existing account/session eligibility guard, never Offer poster
-- enrollment or publishing permission. Controlled writers need private Auth
-- reads and table locks; public wrappers remain invoker with explicit ACLs.
create table public.entry_posters (
  user_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('tourism','event')),
  enrolled_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  primary key (user_id, category)
);
create table public.pinpoint_entries (
  id uuid primary key,
  poster_id uuid not null,
  category text not null,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  version integer not null default 1 check (version between 1 and 2147483647),
  pending_revision_id uuid,
  withdrawn_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (poster_id,category) references public.entry_posters(user_id,category) on delete restrict,
  unique (id,poster_id,category)
);
create table public.pinpoint_entry_revisions (
  id uuid primary key,
  entry_id uuid not null,
  poster_id uuid not null,
  category text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  submitted_at timestamptz not null default clock_timestamp(),
  foreign key (entry_id,poster_id,category) references public.pinpoint_entries(id,poster_id,category) on delete restrict,
  unique (entry_id,id)
);
alter table public.pinpoint_entries add constraint pinpoint_entries_pending_revision_fkey
  foreign key (id,pending_revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict;
create table public.pinpoint_entry_events (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null,
  category text not null,
  entry_id uuid,
  revision_id uuid,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('enroll','create','save','submit','withdraw')),
  version integer,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (poster_id,category) references public.entry_posters(user_id,category) on delete restrict,
  foreign key (entry_id,poster_id,category) references public.pinpoint_entries(id,poster_id,category) on delete restrict,
  foreign key (entry_id,revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict,
  check ((action = 'enroll' and entry_id is null and revision_id is null and version is null)
    or (action <> 'enroll' and entry_id is not null and version is not null and version > 0)),
  check (action <> 'submit' or revision_id is not null),
  check (actor_id = poster_id),
  unique (entry_id,version)
);
create unique index pinpoint_entry_enrollment_once on public.pinpoint_entry_events(poster_id,category) where action = 'enroll';
create index pinpoint_entries_poster_category on public.pinpoint_entries(poster_id,category);
create index pinpoint_entries_pending_revision on public.pinpoint_entries(id,pending_revision_id);
create index pinpoint_entry_revisions_owner on public.pinpoint_entry_revisions(poster_id,category);
create index pinpoint_entry_revisions_entry_owner on public.pinpoint_entry_revisions(entry_id,poster_id,category);
create index pinpoint_entry_events_owner on public.pinpoint_entry_events(poster_id,category);
create index pinpoint_entry_events_entry_owner on public.pinpoint_entry_events(entry_id,poster_id,category);
create index pinpoint_entry_events_revision on public.pinpoint_entry_events(entry_id,revision_id);
create index pinpoint_entry_events_actor on public.pinpoint_entry_events(actor_id);

create function private.pinpoint_entry_category(category text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if category is null or category not in ('tourism','event') then
    raise exception 'Invalid entry category' using errcode = '22023';
  end if;
end;
$$;
create function private.pinpoint_entry_active(category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.pinpoint_intake_eligible() and exists (
    select 1 from public.entry_posters p
    where p.user_id = auth.uid() and p.category = $1 and p.revoked_at is null
  );
$$;
create function private.pinpoint_entry_poster(category text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.pinpoint_entry_category(category);
  if not private.pinpoint_entry_active(category) then
    raise exception 'Category poster access required' using errcode = '42501';
  end if;
  select jsonb_build_object('userId',p.user_id,'category',p.category,
    'enrolledAt',p.enrolled_at,'revokedAt',p.revoked_at) into result
    from public.entry_posters p where p.user_id = auth.uid() and p.category = $1 and p.revoked_at is null;
  return result;
end;
$$;
create function private.pinpoint_entry_immutable() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin raise exception 'Entry history is immutable' using errcode = '42501'; end;
$$;
create trigger pinpoint_entry_revisions_immutable before update or delete on public.pinpoint_entry_revisions
  for each row execute function private.pinpoint_entry_immutable();
create trigger pinpoint_entry_events_immutable before update or delete on public.pinpoint_entry_events
  for each row execute function private.pinpoint_entry_immutable();

-- Validate ordinary JWT RPC payloads independently of the server domain.
-- Canonical timestamps match the domain's UTC millisecond serialization.
create function private.pinpoint_entry_content(content jsonb, complete boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare field text; maximum integer; normalized jsonb := content; start_time timestamptz; end_time timestamptz;
begin
  if content is null or jsonb_typeof(content) <> 'object' or octet_length(content::text) > 30000 then
    raise exception 'Invalid entry content' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(content) k where k not in
    ('title','description','venueName','areaId','address','latitude','longitude','startsAt','endsAt')) then
    raise exception 'Unknown entry fields' using errcode = '22023';
  end if;
  foreach field in array array['title','description','venueName','address'] loop
    maximum := case field when 'description' then 4000 when 'address' then 500 else 160 end;
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'string'
        or char_length(btrim(content->>field)) not between 1 and maximum then
        raise exception 'Invalid entry text: %', field using errcode = '22023';
      end if;
      normalized := jsonb_set(normalized,array[field],to_jsonb(btrim(content->>field)));
    end if;
  end loop;
  if complete or content ? 'areaId' then
    if jsonb_typeof(content->'areaId') is distinct from 'string'
      or (content->>'areaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid entry place ID' using errcode = '22023';
    end if;
    normalized := jsonb_set(normalized,'{areaId}',to_jsonb(((content->>'areaId')::uuid)::text));
  end if;
  foreach field in array array['latitude','longitude'] loop
    maximum := case field when 'latitude' then 90 else 180 end;
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'number' then
        raise exception 'Invalid entry coordinate' using errcode = '22023';
      end if;
      if (content->>field)::numeric not between -maximum and maximum then
        raise exception 'Invalid entry coordinate' using errcode = '22023';
      end if;
    end if;
  end loop;
  foreach field in array array['startsAt','endsAt'] loop
    if complete or content ? field then
      if jsonb_typeof(content->field) is distinct from 'string' or (content->>field) !~
        '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$' then
        raise exception 'Invalid entry timestamp' using errcode = '22023';
      end if;
      begin
        normalized := jsonb_set(normalized,array[field],to_jsonb(to_char(
          (content->>field)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'Invalid entry timestamp' using errcode = '22023';
      end;
    end if;
  end loop;
  if complete then
    start_time := (normalized->>'startsAt')::timestamptz; end_time := (normalized->>'endsAt')::timestamptz;
    if start_time >= end_time or end_time <= clock_timestamp() then
      raise exception 'Entry must have an ordered future end' using errcode = '22023';
    end if;
    -- Catalogue geometry consistency is not proof of venue/provenance/authority.
    if not exists (select 1 from public.discovery_places p
      where p.id = (normalized->>'areaId')::uuid and p.level in ('neighbourhood','locality','place','municipality')
        and (normalized->>'latitude')::double precision between p.south and p.north
        and (normalized->>'longitude')::double precision between p.west and p.east) then
      raise exception 'Stored place and venue point must agree' using errcode = '22023';
    end if;
  end if;
  return normalized;
end;
$$;

create function private.pinpoint_entry_enroll(category text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare enrolled uuid;
begin
  perform private.pinpoint_entry_category(category);
  if not private.pinpoint_intake_eligible() then
    raise exception 'Eligible signed-in account required' using errcode = '42501';
  end if;
  insert into public.entry_posters(user_id,category) values (auth.uid(),category)
    on conflict on constraint entry_posters_pkey do nothing returning user_id into enrolled;
  -- Serialize enrollment and controlled writes with category revocation.
  perform 1 from public.entry_posters p where p.user_id = auth.uid() and p.category = $1 for update;
  if not private.pinpoint_entry_active(category) then
    raise exception 'Category poster access revoked' using errcode = '42501';
  end if;
  if enrolled is not null then
    insert into public.pinpoint_entry_events(poster_id,category,actor_id,action) values (enrolled,category,auth.uid(),'enroll');
  end if;
  return private.pinpoint_entry_poster(category);
end;
$$;
create function private.pinpoint_entry_write(command text, category text, target uuid, expected_version integer,
  payload jsonb default '{}'::jsonb, revision uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_entry public.pinpoint_entries%rowtype; content jsonb; event_revision uuid;
begin
  perform private.pinpoint_entry_category(category);
  if target is null or expected_version is null or command is null or command not in ('create','save','submit','withdraw') then
    raise exception 'Invalid entry mutation' using errcode = '22023';
  end if;
  -- Reject unused arguments, including caller-created publication/capability data.
  if (command <> 'save' and payload is distinct from '{}'::jsonb) or (command <> 'submit' and revision is not null) then
    raise exception 'Unexpected entry mutation fields' using errcode = '22023';
  end if;
  if not private.pinpoint_entry_active(category) then
    raise exception 'Category poster access required' using errcode = '42501';
  end if;
  perform 1 from public.entry_posters p where p.user_id = auth.uid() and p.category = $2 for update;
  if not private.pinpoint_entry_active(category) then
    raise exception 'Category poster access required' using errcode = '42501';
  end if;
  if command = 'create' then
    if expected_version <> 0 then raise exception 'Entry version conflict' using errcode = 'PT409'; end if;
    insert into public.pinpoint_entries(id,poster_id,category) values (target,auth.uid(),category) on conflict (id) do nothing;
    if not found then raise exception 'Entry version conflict' using errcode = 'PT409'; end if;
  end if;
  select * into current_entry from public.pinpoint_entries e where e.id = target for update;
  if current_entry.id is null or current_entry.poster_id <> auth.uid() or current_entry.category <> category then
    raise exception 'Entry owner access required' using errcode = '42501';
  end if;
  if not private.pinpoint_entry_active(category) then
    raise exception 'Category poster access required' using errcode = '42501';
  end if;
  if command <> 'create' and (current_entry.version <> expected_version or expected_version not between 1 and 2147483646) then
    raise exception 'Entry version conflict' using errcode = 'PT409';
  end if;
  if command = 'save' then
    content := private.pinpoint_entry_content(payload,false);
    update public.pinpoint_entries set draft = content where id = target;
  elsif command = 'submit' then
    if revision is null or current_entry.pending_revision_id is not null
      or exists (select 1 from public.pinpoint_entry_revisions r where r.id = revision) then
      raise exception 'Fresh revision required and entry must not be awaiting review' using errcode = '22023';
    end if;
    content := private.pinpoint_entry_content(current_entry.draft,true);
    insert into public.pinpoint_entry_revisions(id,entry_id,poster_id,category,content)
      values (revision,target,auth.uid(),category,content);
    event_revision := revision;
    update public.pinpoint_entries set pending_revision_id = revision, withdrawn_at = null where id = target;
  elsif command = 'withdraw' then
    if current_entry.withdrawn_at is not null then
      return jsonb_build_object('entryId',target,'category',category,'version',current_entry.version,'pendingRevisionId',null);
    end if;
    event_revision := current_entry.pending_revision_id;
    update public.pinpoint_entries set pending_revision_id = null, withdrawn_at = clock_timestamp() where id = target;
  end if;
  if command <> 'create' then
    update public.pinpoint_entries set version = version + 1, updated_at = clock_timestamp()
      where id = target returning * into current_entry;
  end if;
  insert into public.pinpoint_entry_events(poster_id,category,entry_id,revision_id,actor_id,action,version)
    values (auth.uid(),category,target,event_revision,auth.uid(),command,current_entry.version);
  return jsonb_build_object('entryId',target,'category',category,'version',current_entry.version,
    'pendingRevisionId',current_entry.pending_revision_id);
end;
$$;

alter table public.entry_posters enable row level security;
alter table public.pinpoint_entries enable row level security;
alter table public.pinpoint_entry_revisions enable row level security;
alter table public.pinpoint_entry_events enable row level security;
revoke all on public.entry_posters,public.pinpoint_entries,public.pinpoint_entry_revisions,public.pinpoint_entry_events
  from public,anon,authenticated,service_role;
grant select on public.entry_posters,public.pinpoint_entries,public.pinpoint_entry_revisions,public.pinpoint_entry_events
  to authenticated,service_role;
create policy entry_posters_owner_read on public.entry_posters for select to authenticated
  using (user_id = (select auth.uid()) and (select private.pinpoint_intake_eligible()));
create policy pinpoint_entries_owner_read on public.pinpoint_entries for select to authenticated
  using (poster_id = (select auth.uid()) and private.pinpoint_entry_active(category));
create policy pinpoint_entry_revisions_owner_read on public.pinpoint_entry_revisions for select to authenticated
  using (poster_id = (select auth.uid()) and private.pinpoint_entry_active(category));
create policy pinpoint_entry_events_owner_read on public.pinpoint_entry_events for select to authenticated
  using (poster_id = (select auth.uid()) and private.pinpoint_entry_active(category));

create function public.pinpoint_entry_poster(category text) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin return private.pinpoint_entry_poster(category); end; $$;
create function public.pinpoint_entry_enroll(category text) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin return private.pinpoint_entry_enroll(category); end; $$;
create function public.pinpoint_entry_write(command text, category text, target uuid, expected_version integer,
  payload jsonb default '{}'::jsonb, revision uuid default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_entry_write(command,category,target,expected_version,payload,revision); end;
$$;
revoke all on function private.pinpoint_entry_category(text),private.pinpoint_entry_active(text),
  private.pinpoint_entry_poster(text),private.pinpoint_entry_immutable(),private.pinpoint_entry_content(jsonb,boolean),
  private.pinpoint_entry_enroll(text),private.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid),
  public.pinpoint_entry_poster(text),public.pinpoint_entry_enroll(text),public.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.pinpoint_entry_active(text),private.pinpoint_entry_poster(text),
  private.pinpoint_entry_enroll(text),private.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid),
  public.pinpoint_entry_poster(text),public.pinpoint_entry_enroll(text),public.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid)
  to authenticated;
comment on table public.pinpoint_entries is 'Private Tourism/Event intake only. No review, approval, media, publication permission or public projection.';
