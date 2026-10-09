-- Local provider intake and explicit approval. No direct client table writes.
create table public.service_submissions (
  id uuid primary key,
  poster_id uuid not null references auth.users(id) on delete restrict,
  draft jsonb not null default '{}',
  submitted jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','withdrawn')),
  version integer not null default 1 check (version between 1 and 2147483647),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.approved_services (
  id uuid primary key references public.service_submissions(id) on delete restrict,
  area_id uuid not null references public.discovery_places(id) on delete restrict,
  content jsonb not null,
  approved_at timestamptz not null default clock_timestamp()
);
create table public.service_submission_events (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_submissions(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('create','save','submit','withdraw','approve','reject','unpublish')),
  version integer not null,
  content jsonb,
  reason text,
  occurred_at timestamptz not null default clock_timestamp(),
  unique (service_id,version)
);
create index service_submissions_poster on public.service_submissions(poster_id);
create index service_submissions_queue on public.service_submissions(status,created_at,id);
create index approved_services_area on public.approved_services(area_id,approved_at desc,id);
create index service_events_actor on public.service_submission_events(actor_id);
alter table public.service_submissions enable row level security;
alter table public.approved_services enable row level security;
alter table public.service_submission_events enable row level security;
revoke all on public.service_submissions, public.approved_services, public.service_submission_events from public, anon, authenticated;
grant select on public.service_submissions, public.service_submission_events to authenticated;
grant select on public.approved_services to anon, authenticated;

create function private.pinpoint_service_eligible() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and exists (select 1 from auth.sessions s where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id' and (s.not_after is null or s.not_after > statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s where s.user_id=auth.uid() and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id=v.id
      where v.status='published' and v.requires_reacceptance and v.effective_at<=statement_timestamp()
      and not exists(select 1 from public.policy_acceptances a where a.user_id=auth.uid() and a.version_id=v.id));
$$;
create function private.pinpoint_service_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.pinpoint_service_eligible() and coalesce(auth.jwt()->>'aal','')='aal2'
    and exists(select 1 from public.admin_memberships m where m.user_id=auth.uid() and m.revoked_at is null
      and (select count(*) from auth.mfa_factors f where f.user_id=m.user_id and f.status='verified' and f.factor_type='totp')
        >= case when m.level='owner' then 2 else 1 end);
$$;
create policy service_owner_read on public.service_submissions for select to authenticated
using ((select private.pinpoint_service_eligible()) and poster_id=(select auth.uid()));
create policy service_event_owner_read on public.service_submission_events for select to authenticated
using ((select private.pinpoint_service_eligible()) and service_id in (select id from public.service_submissions where poster_id=(select auth.uid())));
create function private.pinpoint_service_visible(service_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.service_submissions s join auth.users u on u.id=s.poster_id
    where s.id=service_id and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and not exists(select 1 from public.account_suspensions a where a.user_id=u.id and a.restored_at is null
      and (a.suspended_until is null or a.suspended_until>statement_timestamp())));
$$;
revoke all on function private.pinpoint_service_visible(uuid) from public;
grant execute on function private.pinpoint_service_visible(uuid) to anon,authenticated;
grant usage on schema private to anon,authenticated;
create policy service_public_read on public.approved_services for select to anon, authenticated using (private.pinpoint_service_visible(id));

create function private.pinpoint_service_content(payload jsonb, complete boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare field text; maximum integer; normalized jsonb := payload;
begin
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>18000
    or exists(select 1 from jsonb_object_keys(payload) k where k not in
      ('title','providerName','serviceType','description','areaId','address','latitude','longitude','phone')) then
    raise exception 'Invalid service fields' using errcode='22023';
  end if;
  foreach field in array array['title','providerName','serviceType','description','address','phone'] loop
    maximum := case field when 'description' then 4000 when 'address' then 500 when 'phone' then 24 else 160 end;
    if complete or payload ? field then
      if jsonb_typeof(payload->field) is distinct from 'string' or char_length(btrim(payload->>field)) not between 1 and maximum then
        raise exception 'Invalid service text' using errcode='22023';
      end if;
      normalized := jsonb_set(normalized,array[field],to_jsonb(btrim(payload->>field)));
    end if;
  end loop;
  if payload ? 'serviceType' and payload->>'serviceType' not in ('Plumbing','Electrical','Cleaning','Gardening','Handyman','Other') then
    raise exception 'Invalid service type' using errcode='22023';
  end if;
  if payload ? 'phone' and payload->>'phone' !~ '^\+?[0-9 ()-]{7,24}$' then
    raise exception 'Invalid phone number' using errcode='22023';
  end if;
  if complete or payload ? 'areaId' then
    if jsonb_typeof(payload->'areaId') is distinct from 'string' or (payload->>'areaId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from public.discovery_places where id=(payload->>'areaId')::uuid) then
      raise exception 'Choose a stored discovery place' using errcode='22023';
    end if;
  end if;
  foreach field in array array['latitude','longitude'] loop
    maximum := case field when 'latitude' then 90 else 180 end;
    if complete or payload ? field then
      if jsonb_typeof(payload->field) is distinct from 'number' or (payload->>field)::numeric not between -maximum and maximum then
        raise exception 'Invalid service coordinates' using errcode='22023';
      end if;
    end if;
  end loop;
  return normalized;
end;
$$;
create function private.pinpoint_service_write(command text,target uuid,expected_version integer,payload jsonb,permission_confirmed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item public.service_submissions%rowtype; content jsonb;
begin
  if not private.pinpoint_service_eligible() then raise exception 'Service account access required' using errcode='42501'; end if;
  if target is null or expected_version is null or command is null or command not in ('create','save','submit','withdraw') then
    raise exception 'Invalid service command' using errcode='22023'; end if;
  if command='create' then
    if expected_version<>0 then raise exception 'Invalid create version' using errcode='22023'; end if;
    insert into public.service_submissions(id,poster_id) values(target,auth.uid()) on conflict do nothing;
    if not found then raise exception 'Service already exists' using errcode='PT409'; end if;
    insert into public.service_submission_events(service_id,actor_id,action,version) values(target,auth.uid(),'create',1);
    return jsonb_build_object('id',target,'version',1,'status','draft');
  end if;
  select * into item from public.service_submissions where id=target for update;
  if item.id is null or item.poster_id<>auth.uid() then raise exception 'Service owner required' using errcode='42501'; end if;
  if item.version<>expected_version then raise exception 'Service changed' using errcode='PT409'; end if;
  if item.status='submitted' and command<>'withdraw' then raise exception 'Withdraw the pending submission first' using errcode='22023'; end if;
  if command='save' then
    content := private.pinpoint_service_content(payload,false);
    update public.service_submissions set draft=content,status='draft' where id=target;
  elsif command='submit' then
    if permission_confirmed is distinct from true then raise exception 'Provider publishing permission must be confirmed' using errcode='22023'; end if;
    content := private.pinpoint_service_content(item.draft,true);
    update public.service_submissions set submitted=content,status='submitted' where id=target;
  else
    delete from public.approved_services where id=target;
    update public.service_submissions set submitted=null,status='withdrawn' where id=target;
  end if;
  update public.service_submissions set version=version+1,updated_at=clock_timestamp() where id=target returning * into item;
  insert into public.service_submission_events(service_id,actor_id,action,version,content,reason) values(target,auth.uid(),command,item.version,content,case when command='submit' then 'Provider confirmed publishing permission v1' end);
  return jsonb_build_object('id',target,'version',item.version,'status',item.status);
end;
$$;
create function public.pinpoint_service_write(command text,target uuid,expected_version integer,payload jsonb default '{}',permission_confirmed boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select private.pinpoint_service_write(command,target,expected_version,payload,permission_confirmed); $$;
create function private.pinpoint_service_review_queue() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not private.pinpoint_service_reviewer() then raise exception 'Service reviewer required' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select s.id,s.version,s.status,coalesce(s.submitted,a.content) as submitted,s.updated_at,(a.id is not null) as published from public.service_submissions s left join public.approved_services a on a.id=s.id
    where s.status='submitted' or a.id is not null order by (s.status='submitted') desc,s.created_at,s.id limit 100) t);
end;
$$;
create function public.pinpoint_service_review_queue() returns jsonb language sql security invoker set search_path='' as $$ select private.pinpoint_service_review_queue(); $$;
create function private.pinpoint_service_decide(target uuid,expected_version integer,decision text,authority_notes text,location_notes text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.service_submissions%rowtype; content jsonb; explanation text;
begin
  if not private.pinpoint_service_reviewer() then raise exception 'Service reviewer required' using errcode='42501'; end if;
  if decision is null or decision not in ('approve','reject','unpublish') or expected_version is null
    or authority_notes is null or char_length(btrim(authority_notes)) not between 1 and 2000 then
    raise exception 'A review reason is required' using errcode='22023'; end if;
  select * into item from public.service_submissions where id=target for update;
  if item.id is null or item.version<>expected_version then raise exception 'Service changed' using errcode='PT409'; end if;
  if decision<>'unpublish' and item.status<>'submitted' then raise exception 'No pending service' using errcode='PT409'; end if;
  if decision='approve' then
    if location_notes is null or char_length(btrim(location_notes)) not between 1 and 2000 then raise exception 'Location review required' using errcode='22023'; end if;
    content := private.pinpoint_service_content(item.submitted,true);
    insert into public.approved_services(id,area_id,content) values(target,(content->>'areaId')::uuid,content)
      on conflict(id) do update set area_id=excluded.area_id,content=excluded.content,approved_at=clock_timestamp();
    explanation := btrim(authority_notes)||E'\nLocation: '||btrim(location_notes);
  else
    -- A rejection of an edit leaves the prior approved snapshot available.
    if decision='unpublish' then delete from public.approved_services where id=target; end if;
    explanation := btrim(authority_notes);
  end if;
  update public.service_submissions set status=case decision when 'approve' then 'approved' when 'reject' then 'rejected' else 'withdrawn' end,
    submitted=null,version=version+1,updated_at=clock_timestamp() where id=target returning * into item;
  insert into public.service_submission_events(service_id,actor_id,action,version,content,reason) values(target,auth.uid(),decision,item.version,content,explanation);
  return jsonb_build_object('id',target,'version',item.version,'status',item.status);
end;
$$;
create function public.pinpoint_service_decide(target uuid,expected_version integer,decision text,authority_notes text,location_notes text default '') returns jsonb
language sql security invoker set search_path='' as $$ select private.pinpoint_service_decide(target,expected_version,decision,authority_notes,location_notes); $$;
create function private.pinpoint_service_history_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Service history is immutable' using errcode='42501'; end; $$;
create trigger service_history_immutable before update or delete on public.service_submission_events for each row execute function private.pinpoint_service_history_immutable();
revoke all on function private.pinpoint_service_eligible(), private.pinpoint_service_reviewer(), private.pinpoint_service_content(jsonb,boolean),
  private.pinpoint_service_write(text,uuid,integer,jsonb,boolean), private.pinpoint_service_review_queue(), private.pinpoint_service_decide(uuid,integer,text,text,text),
  private.pinpoint_service_history_immutable(), public.pinpoint_service_write(text,uuid,integer,jsonb,boolean), public.pinpoint_service_review_queue(), public.pinpoint_service_decide(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function private.pinpoint_service_eligible(),private.pinpoint_service_reviewer(),private.pinpoint_service_write(text,uuid,integer,jsonb,boolean),
  private.pinpoint_service_review_queue(),private.pinpoint_service_decide(uuid,integer,text,text,text),public.pinpoint_service_write(text,uuid,integer,jsonb,boolean),
  public.pinpoint_service_review_queue(),public.pinpoint_service_decide(uuid,integer,text,text,text) to authenticated;
