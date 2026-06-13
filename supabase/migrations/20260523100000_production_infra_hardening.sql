alter table public.documents
  add column if not exists bucket text not null default 'application-documents',
  add column if not exists path text,
  add column if not exists mime_type text,
  add column if not exists byte_size integer,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists scan_status text not null default 'pending';

update public.documents
set path = file_url
where path is null;

alter table public.documents
  alter column path set not null,
  add constraint documents_scan_status_check
    check (scan_status in ('pending', 'clean', 'infected', 'failed')),
  add constraint documents_byte_size_check
    check (byte_size is null or byte_size >= 0);

create unique index if not exists documents_application_type_uidx
  on public.documents(application_id, type);

create unique index if not exists applications_active_renter_listing_uidx
  on public.applications(renter_id, listing_id)
  where status in ('submitted', 'under_review', 'shortlisted', 'approved');

alter table public.notification_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists last_error text,
  add column if not exists idempotency_key text;

create unique index if not exists notification_events_idempotency_key_uidx
  on public.notification_events(idempotency_key)
  where idempotency_key is not null;

create index if not exists notification_events_retry_idx
  on public.notification_events(next_attempt_at, created_at)
  where sent_at is null and digest_at is null;

alter table public.search_alerts
  add constraint search_alerts_email_check
    check (position('@' in email) > 1),
  add constraint search_alerts_bbox_check
    check (
      bounding_box_west between -180 and 180
      and bounding_box_east between -180 and 180
      and bounding_box_south between -90 and 90
      and bounding_box_north between -90 and 90
    );

drop policy if exists "Anyone can insert search alerts" on public.search_alerts;
create policy "Anon can insert anonymous search alerts"
  on public.search_alerts for insert
  to anon
  with check (user_id is null);

create policy "Authenticated users can insert their own search alerts"
  on public.search_alerts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create or replace function public.submit_application_atomic(
  target_application_id uuid,
  target_listing_id uuid,
  full_name text,
  income numeric,
  employment_status text,
  move_in_date date,
  household_size integer,
  document_metadata jsonb
)
returns table(application_id uuid, result text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  requesting_user uuid := auth.uid();
  active_count integer;
begin
  if requesting_user is null then
    return query select null::uuid, 'unauthorized'::text;
    return;
  end if;

  perform 1
  from public.profiles
  where id = requesting_user
    and role = 'renter'
  for update;

  if not found then
    return query select null::uuid, 'not_renter'::text;
    return;
  end if;

  if document_metadata is null or jsonb_typeof(document_metadata) <> 'array' or jsonb_array_length(document_metadata) < 2 then
    return query select null::uuid, 'missing_documents'::text;
    return;
  end if;

  select count(*)
  into active_count
  from public.applications
  where renter_id = requesting_user
    and status in ('submitted', 'under_review', 'shortlisted', 'approved');

  if active_count >= 5 then
    return query select null::uuid, 'cap_reached'::text;
    return;
  end if;

  if exists (
    select 1
    from public.applications
    where renter_id = requesting_user
      and listing_id = target_listing_id
      and status in ('submitted', 'under_review', 'shortlisted', 'approved')
  ) then
    return query select null::uuid, 'duplicate_active'::text;
    return;
  end if;

  insert into public.applications (
    id,
    listing_id,
    renter_id,
    status,
    full_name,
    income,
    employment_status,
    move_in_date,
    household_size
  )
  values (
    target_application_id,
    target_listing_id,
    requesting_user,
    'submitted',
    full_name,
    income,
    employment_status,
    move_in_date,
    household_size
  );

  insert into public.documents (
    application_id,
    type,
    file_url,
    bucket,
    path,
    mime_type,
    byte_size,
    uploaded_by,
    scan_status
  )
  select
    target_application_id,
    (doc->>'type')::public.document_type,
    doc->>'path',
    coalesce(doc->>'bucket', 'application-documents'),
    doc->>'path',
    doc->>'mimeType',
    nullif(doc->>'byteSize', '')::integer,
    requesting_user,
    'pending'
  from jsonb_array_elements(document_metadata) as doc;

  return query select target_application_id, 'created'::text;
end;
$$;

revoke all on function public.submit_application_atomic(uuid, uuid, text, numeric, text, date, integer, jsonb) from public, anon;
grant execute on function public.submit_application_atomic(uuid, uuid, text, numeric, text, date, integer, jsonb) to authenticated;

create or replace function public.update_application_status_checked(
  target_application_id uuid,
  target_status public.application_status
)
returns table(application_id uuid, result text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status public.application_status;
begin
  select status
  into current_status
  from public.applications
  where id = target_application_id
  for update;

  if current_status is null then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;

  if current_status in ('withdrawn', 'rejected', 'approved') then
    return query select target_application_id, 'terminal_status'::text;
    return;
  end if;

  if current_status = 'submitted' and target_status not in ('under_review', 'shortlisted', 'rejected', 'approved') then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  if current_status = 'under_review' and target_status not in ('shortlisted', 'rejected', 'approved') then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  if current_status = 'shortlisted' and target_status not in ('rejected', 'approved') then
    return query select target_application_id, 'invalid_transition'::text;
    return;
  end if;

  update public.applications
  set status = target_status,
      updated_at = now()
  where id = target_application_id;

  return query select target_application_id, 'updated'::text;
end;
$$;

revoke all on function public.update_application_status_checked(uuid, public.application_status) from public, anon;
grant execute on function public.update_application_status_checked(uuid, public.application_status) to authenticated;
