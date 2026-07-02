-- Launch-fast change: make ID + payslip documents optional on application submit.
-- Previously submit_application_atomic rejected submissions with fewer than 2
-- documents ('missing_documents'). We now accept zero or more documents and only
-- reject when the payload is structurally invalid (null or not a JSON array).
-- Re-enabling the requirement later means restoring the `< 2` length check.

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

  -- Documents are optional at launch. Reject only structurally invalid payloads.
  if document_metadata is null or jsonb_typeof(document_metadata) <> 'array' then
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
