-- Pinpoint Assistant business mode: reminders and the approvals log (proposal, "Organisations").
--
-- assistant_reminders: shown in the panel only, never sent as notifications. Private to the
-- member who set them; other organisation members never see them (not even that one exists).
--
-- assistant_action_log: one row per approval the assistant ran ("Viewing accepted by Sipho,
-- 14:02"), shown on the person card so two members don't act on the same person twice.
-- Append-only. Readable by the actor, whoever can manage the listing or service, and every
-- member of the listing's organisation. Only someone who can manage the listing or service
-- can write a row, so the log mirrors the database's existing owner and admin rules.

-- Reminders -----------------------------------------------------------------------------------

create table public.assistant_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 1 and 200),
  due_at timestamptz not null,
  -- Optional person the reminder is about: a customer on one listing or service.
  customer_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  service_id uuid references public.service_submissions(id) on delete cascade,
  subject_key text generated always as (
    case when customer_id is not null
      then customer_id::text || ':' || coalesce(listing_id, service_id)::text
    end
  ) stored,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_reminders_one_subject check (listing_id is null or service_id is null),
  constraint assistant_reminders_person_has_subject check (
    customer_id is null or listing_id is not null or service_id is not null
  )
);

create index assistant_reminders_open_idx
  on public.assistant_reminders(user_id, due_at)
  where done_at is null;

alter table public.assistant_reminders enable row level security;
alter table public.assistant_reminders force row level security;
revoke all on table public.assistant_reminders from public, anon, authenticated;
grant select, delete on table public.assistant_reminders to authenticated;
grant insert (note, due_at, customer_id, listing_id, service_id) on table public.assistant_reminders to authenticated;
-- Done and Snooze only. The subject is fixed once set.
grant update (note, due_at, done_at) on table public.assistant_reminders to authenticated;

create policy "Members read their own reminders" on public.assistant_reminders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Members set their own reminders" on public.assistant_reminders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Members change their own reminders" on public.assistant_reminders
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Members delete their own reminders" on public.assistant_reminders
  for delete to authenticated using (user_id = (select auth.uid()));

create trigger assistant_reminders_updated_at before update on public.assistant_reminders
  for each row execute function private.set_updated_at();

-- Approvals log -------------------------------------------------------------------------------

create table public.assistant_action_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  -- Copied from the listing by the trigger below, never from the caller.
  organization_id uuid references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  service_id uuid references public.service_submissions(id) on delete cascade,
  subject_key text generated always as (customer_id::text || ':' || coalesce(listing_id, service_id)::text) stored,
  action text not null check (action in (
    'viewing_accepted',
    'viewing_declined',
    'application_under_review',
    'application_shortlisted',
    'application_approved',
    'application_rejected',
    'booking_accepted',
    'booking_declined',
    'archived',
    'unarchived'
  )),
  created_at timestamptz not null default now(),
  constraint assistant_action_log_one_subject check ((listing_id is null) <> (service_id is null))
);

create index assistant_action_log_subject_idx on public.assistant_action_log(subject_key, created_at desc);
create index assistant_action_log_listing_idx on public.assistant_action_log(listing_id, created_at desc) where listing_id is not null;
create index assistant_action_log_service_idx on public.assistant_action_log(service_id, created_at desc) where service_id is not null;
create index assistant_action_log_organization_idx on public.assistant_action_log(organization_id, created_at desc) where organization_id is not null;

alter table public.assistant_action_log enable row level security;
alter table public.assistant_action_log force row level security;
revoke all on table public.assistant_action_log from public, anon, authenticated;
grant select on table public.assistant_action_log to authenticated;
grant insert (customer_id, listing_id, service_id, action) on table public.assistant_action_log to authenticated;

-- Who did it and which organisation sees it come from the session and the listing, so a
-- caller cannot write a row in someone else's name or into another organisation's log.
create function private.stamp_assistant_action() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.actor_id := auth.uid();
  new.created_at := pg_catalog.now();
  new.organization_id := null;
  if new.listing_id is not null then
    select l.organization_id into new.organization_id
    from public.listings l
    where l.id = new.listing_id;
  end if;
  return new;
end;
$$;

revoke all on function private.stamp_assistant_action() from public, anon, authenticated;

create trigger assistant_action_log_stamp before insert on public.assistant_action_log
  for each row execute function private.stamp_assistant_action();

create function private.can_manage_service(
  target_service_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_submissions s
    where s.id = target_service_id and s.poster_id = target_user_id
  )
$$;

revoke all on function private.can_manage_service(uuid, uuid) from public, anon;
grant execute on function private.can_manage_service(uuid, uuid) to authenticated;

create policy "Listers and their organisation read the approvals log" on public.assistant_action_log
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (
      organization_id is not null
      and private.has_organization_role(organization_id, array['owner', 'admin', 'agent']::public.organization_role[])
    )
    or (listing_id is not null and private.can_manage_listing(listing_id))
    or (service_id is not null and private.can_manage_service(service_id))
  );

create policy "Only people who can act on the listing log an approval" on public.assistant_action_log
  for insert to authenticated with check (
    actor_id = (select auth.uid())
    and (
      (listing_id is not null and private.can_manage_listing(listing_id))
      or (service_id is not null and private.can_manage_service(service_id))
    )
  );
