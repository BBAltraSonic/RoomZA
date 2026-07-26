-- Supabase Realtime probes SELECT authorization for both Presence and
-- Broadcast whenever Presence is enabled on a private channel. Allow the
-- read-only Broadcast probe for valid live-tour topics while keeping
-- Broadcast publishing denied.

drop policy if exists
  "Authenticated users receive active live tour presence"
  on realtime.messages;
create policy "Authenticated users receive active live tour presence"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('presence', 'broadcast')
    and (
      select private.can_access_live_tour_presence(
        (select realtime.topic())
      )
    )
  );
