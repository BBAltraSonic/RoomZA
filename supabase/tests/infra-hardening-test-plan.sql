-- RoomZA production hardening database checks.

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'applications_active_renter_listing_idx'
  ) then
    raise exception 'missing active application uniqueness index';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'documents_application_type_idx'
  ) then
    raise exception 'missing document type uniqueness index';
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'idx_user_favorites_user_id',
        'idx_user_favorites_listing_id',
        'applications_active_renter_listing_uidx',
        'notification_events_idempotency_key_uidx',
        'documents_application_type_uidx',
        'viewings_meeting_room_id_uidx',
        'call_sessions_room_id_uidx',
        'call_sessions_one_active_per_convo_uidx'
      )
  ) then
    raise exception 'legacy non-conforming index names still exist';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'conversations_listing_id_idx',
        'conversations_application_id_idx',
        'conversations_landlord_id_idx',
        'conversations_renter_id_idx',
        'messages_sender_id_idx',
        'messages_listing_id_idx',
        'viewings_slot_id_idx',
        'search_alerts_user_id_idx',
        'application_status_events_actor_id_idx',
        'call_sessions_caller_id_idx',
        'call_sessions_callee_id_idx',
        'call_sessions_listing_id_idx',
        'user_favorites_user_id_idx',
        'user_favorites_listing_id_idx',
        'notification_events_idempotency_key_idx',
        'viewings_meeting_room_id_idx',
        'call_sessions_room_id_idx',
        'call_sessions_one_active_per_convo_idx'
      )
    group by schemaname
    having count(*) = 18
  ) then
    raise exception 'phase 9 lookup or convention indexes missing';
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

  if not exists (
    select 1
    from storage.buckets
    where id = 'listing-images'
      and file_size_limit = 10485760
      and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
  ) then
    raise exception 'listing image bucket upload constraints missing';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'application-documents'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array['application/pdf', 'image/jpeg', 'image/png']
  ) then
    raise exception 'application document bucket constraints missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Landlords can upload listing images',
        'Landlords can update their listing images',
        'Landlords can delete their listing images',
        'Renters can upload application documents',
        'Renters can read their application documents',
        'Renters can update their application documents',
        'Renters can delete their application documents',
        'Landlords can read application documents for their listings'
      )
    group by schemaname, tablename
    having count(*) = 8
  ) then
    raise exception 'storage object role policies missing';
  end if;

  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and prosecdef is null
  ) then
    raise exception 'public function security context inspection failed';
  end if;

  raise notice 'infra hardening checks passed';
end $$;
