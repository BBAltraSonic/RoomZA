-- Renewal reminders share the established partial notification key index.
-- Match its predicate while retaining the existing function ACL and schedule.
begin;
create or replace function public.enqueue_profile_document_expiry_reminders() returns integer
 language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
 insert into public.notification_events(recipient_id,type,category,payload,idempotency_key,source_kind,source_id)
 select d.owner_id,'profile_document_expiry','verification',
   jsonb_build_object('message',d.display_name||' expires in '||(d.expires_at-current_date)::text||' day'||case when d.expires_at-current_date=1 then '' else 's' end||'.','documentId',d.id,'expiresAt',d.expires_at),
   'profile-document-expiry:'||d.id||':'||d.expires_at||':'||(d.expires_at-current_date),'document',d.id
 from public.profile_documents d where d.deleted_at is null and d.expires_at-current_date in (30,7,1,0)
 on conflict(idempotency_key) where idempotency_key is not null do nothing;
 get diagnostics inserted_count=row_count;return inserted_count;
end; $$;
commit;
