-- Private pending review/correction only. No approval or public projection.
create table public.pinpoint_entry_corrections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  revision_id uuid not null,
  poster_id uuid not null,
  category text not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 1),
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  reviewed_at timestamptz not null default clock_timestamp(),
  foreign key (entry_id,poster_id,category) references public.pinpoint_entries(id,poster_id,category) on delete restrict,
  foreign key (entry_id,revision_id) references public.pinpoint_entry_revisions(entry_id,id) on delete restrict,
  unique (revision_id), unique (entry_id,version)
);
create index pinpoint_entry_corrections_entry_owner on public.pinpoint_entry_corrections(entry_id,poster_id,category);
create index pinpoint_entry_corrections_revision on public.pinpoint_entry_corrections(entry_id,revision_id);
create index pinpoint_entry_corrections_owner on public.pinpoint_entry_corrections(poster_id,category);
create index pinpoint_entry_corrections_reviewer on public.pinpoint_entry_corrections(reviewer_id);
create trigger pinpoint_entry_corrections_immutable before update or delete on public.pinpoint_entry_corrections
  for each row execute function private.pinpoint_entry_immutable();

alter table public.pinpoint_entry_events drop constraint pinpoint_entry_events_action_check;
alter table public.pinpoint_entry_events add constraint pinpoint_entry_events_action_check
  check (action in ('enroll','create','save','submit','withdraw','reject'));
-- Preserve owner-only intake events; only the controlled reviewer can append a
-- rejection. Find the generated intake check by its exact expression, fail
-- closed if the source constraint has drifted, and leave all other checks alone.
do $$
declare actor_constraint text;
begin
  select conname into strict actor_constraint from pg_constraint
    where conrelid = 'public.pinpoint_entry_events'::regclass and contype = 'c'
      and pg_get_expr(conbin,conrelid) = '(actor_id = poster_id)';
  execute format('alter table public.pinpoint_entry_events drop constraint %I',actor_constraint);
end;
$$;
alter table public.pinpoint_entry_events add constraint pinpoint_entry_events_actor_check
  check (action = 'reject' or actor_id = poster_id);
alter table public.pinpoint_entry_events add constraint pinpoint_entry_events_review_revision_check
  check (action <> 'reject' or revision_id is not null);

create function private.pinpoint_entry_subject_eligible(poster uuid, category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.pinpoint_intake_reviewer()
    and exists (select 1 from public.entry_posters p join auth.users u on u.id = p.user_id
      join public.profiles profile on profile.id = u.id
      where p.user_id = $1 and p.category = $2 and p.revoked_at is null and u.email_confirmed_at is not null
        and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s where s.user_id = $1 and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id = v.id
      where v.status = 'published' and v.requires_reacceptance and v.effective_at <= statement_timestamp()
        and not exists (select 1 from public.policy_acceptances a where a.user_id = $1 and a.version_id = v.id));
$$;
create function private.pinpoint_entry_review_read(category text, target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  perform private.pinpoint_entry_category(category);
  if target is null then raise exception 'Entry target required' using errcode = '22023'; end if;
  -- Submitted snapshot only; never expose later private draft edits. Inactive
  -- subject snapshots can remain visible for investigation, not publication.
  select jsonb_build_object('entryId',e.id,'category',e.category,'version',e.version,
    'posterId',e.poster_id,'revisionId',r.id,'content',r.content,'submittedAt',r.submitted_at)
    into result from public.pinpoint_entries e join public.pinpoint_entry_revisions r on r.id = e.pending_revision_id
    where e.id = target and e.category = $1 and e.withdrawn_at is null;
  return result;
end;
$$;
create function private.pinpoint_entry_reject(category text, target uuid, revision uuid, expected_version integer, reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_entry public.pinpoint_entries%rowtype; subject uuid;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  perform private.pinpoint_entry_category(category);
  if target is null or revision is null or expected_version is null or expected_version not between 1 and 2147483646
    or reason is null or char_length(btrim(reason)) not between 1 and 2000 then
    raise exception 'Invalid entry correction' using errcode = '22023';
  end if;
  select e.poster_id into subject from public.pinpoint_entries e where e.id = target and e.category = $1;
  if subject is null then raise exception 'Entry version conflict' using errcode = 'PT409'; end if;
  -- Same enrollment-before-entry order as poster writes. Enrollment/category
  -- identity cannot be changed by any exposed mutation; check again under lock.
  perform 1 from public.entry_posters p where p.user_id = subject and p.category = $1 for update;
  select * into current_entry from public.pinpoint_entries e where e.id = target for update;
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  if current_entry.id is null or current_entry.poster_id <> subject or current_entry.category <> category
    or current_entry.version <> expected_version then
    raise exception 'Entry version conflict' using errcode = 'PT409';
  end if;
  if current_entry.withdrawn_at is not null or current_entry.pending_revision_id is distinct from revision then
    raise exception 'Entry revision is not awaiting review' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pinpoint_entry_revisions r
    where r.entry_id = target and r.id = revision and r.submitted_at <= clock_timestamp()) then
    raise exception 'Review predates submission' using errcode = '22023';
  end if;
  if not private.pinpoint_entry_subject_eligible(subject,category) then
    raise exception 'Poster is inactive' using errcode = '42501';
  end if;
  update public.pinpoint_entries set pending_revision_id = null,version = version + 1,updated_at = clock_timestamp()
    where id = target returning * into current_entry;
  insert into public.pinpoint_entry_corrections(entry_id,revision_id,poster_id,category,reviewer_id,version,reason)
    values (target,revision,subject,category,auth.uid(),current_entry.version,btrim(reason));
  insert into public.pinpoint_entry_events(poster_id,category,entry_id,revision_id,actor_id,action,version)
    values (subject,category,target,revision,auth.uid(),'reject',current_entry.version);
  return jsonb_build_object('entryId',target,'category',category,'version',current_entry.version,'pendingRevisionId',null);
end;
$$;

alter table public.pinpoint_entry_corrections enable row level security;
revoke all on public.pinpoint_entry_corrections from public,anon,authenticated,service_role;
grant select on public.pinpoint_entry_corrections to authenticated,service_role;
create policy pinpoint_entry_corrections_read on public.pinpoint_entry_corrections for select to authenticated
  using ((poster_id = (select auth.uid()) and private.pinpoint_entry_active(category)) or (select private.pinpoint_intake_reviewer()));
create function public.pinpoint_entry_review_read(category text, target uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin return private.pinpoint_entry_review_read(category,target); end; $$;
create function public.pinpoint_entry_reject(category text, target uuid, revision uuid, expected_version integer, reason text) returns jsonb
language plpgsql security invoker set search_path = '' as $$ begin return private.pinpoint_entry_reject(category,target,revision,expected_version,reason); end; $$;
revoke all on function private.pinpoint_entry_subject_eligible(uuid,text),private.pinpoint_entry_review_read(text,uuid),
  private.pinpoint_entry_reject(text,uuid,uuid,integer,text),public.pinpoint_entry_review_read(text,uuid),
  public.pinpoint_entry_reject(text,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.pinpoint_entry_review_read(text,uuid),private.pinpoint_entry_reject(text,uuid,uuid,integer,text),
  public.pinpoint_entry_review_read(text,uuid),public.pinpoint_entry_reject(text,uuid,uuid,integer,text) to authenticated;
comment on table public.pinpoint_entry_corrections is 'Immutable private pending-revision corrections, current membership and actual MFA required. No approval or publication.';
