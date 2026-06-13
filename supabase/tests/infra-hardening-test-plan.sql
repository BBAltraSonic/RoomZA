-- RoomZA production hardening database checks.

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'applications_active_renter_listing_uidx'
  ) then
    raise exception 'missing active application uniqueness index';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'documents_application_type_uidx'
  ) then
    raise exception 'missing document type uniqueness index';
  end if;

  if not exists (
    select 1
    from pg_proc
    where proname = 'submit_application_atomic'
  ) then
    raise exception 'missing submit_application_atomic rpc';
  end if;

  if not exists (
    select 1
    from pg_proc
    where proname = 'update_application_status_checked'
  ) then
    raise exception 'missing update_application_status_checked rpc';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notification_events'
      and column_name = 'next_attempt_at'
  ) then
    raise exception 'notification retry columns missing';
  end if;

  raise notice 'infra hardening checks passed';
end $$;
