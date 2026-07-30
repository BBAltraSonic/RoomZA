create or replace function public.enqueue_profile_document_expiry_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.notification_events(
    recipient_id, type, payload, idempotency_key
  )
  select
    document.owner_id,
    'profile_document_expiry'::public.notification_type,
    jsonb_build_object(
      'message',
      document.display_name || ' expires in ' ||
        (document.expires_at - current_date)::text || ' day' ||
        case when document.expires_at - current_date = 1 then '' else 's' end || '.',
      'documentId', document.id,
      'expiresAt', document.expires_at
    ),
    'profile-document-expiry:' || document.id::text || ':' ||
      (document.expires_at - current_date)::text
  from public.profile_documents document
  where document.deleted_at is null
    and document.expires_at - current_date in (30, 7, 1, 0)
  on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_profile_document_expiry_reminders()
  from public, anon, authenticated;
grant execute on function public.enqueue_profile_document_expiry_reminders()
  to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'profile-document-expiry-reminders';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'profile-document-expiry-reminders',
    '15 5 * * *',
    'select public.enqueue_profile_document_expiry_reminders()'
  );
end;
$$;

comment on function public.enqueue_profile_document_expiry_reminders() is
  'Creates idempotent 30, 7, 1, and 0 day document expiry reminders for the existing notification outbox.';
