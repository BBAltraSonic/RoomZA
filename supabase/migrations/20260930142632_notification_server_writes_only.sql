-- Notifications are produced by authorized server actions or trusted jobs.
-- Preserve existing rows, recipient SELECT/UPDATE/DELETE policies and service
-- role writes. No table rebuild, data deletion or delivery-state change.
drop policy if exists "Users can create relevant notifications"
  on public.notification_events;

revoke insert on table public.notification_events from public, anon, authenticated;
grant select, insert, update on table public.notification_events to service_role;

-- Defense in depth if a future migration accidentally restores INSERT grants
-- or adds a permissive ALL policy. Service role bypasses RLS server-side.
create policy "Only trusted servers can insert notifications"
  on public.notification_events as restrictive for insert
  to anon, authenticated
  with check (false);
