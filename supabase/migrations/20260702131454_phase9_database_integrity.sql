-- Phase 9 database integrity hardening.
-- Forward-only migration: closes FK/index/RLS/naming audit findings without
-- rewriting historical migrations or applying remote changes.

-- Relationship and lookup indexes used by joins, filters, and RLS predicates.
create index if not exists conversations_listing_id_idx
  on public.conversations(listing_id);

create index if not exists conversations_application_id_idx
  on public.conversations(application_id);

create index if not exists conversations_landlord_id_idx
  on public.conversations(landlord_id);

create index if not exists conversations_renter_id_idx
  on public.conversations(renter_id);

create index if not exists messages_sender_id_idx
  on public.messages(sender_id);

create index if not exists messages_listing_id_idx
  on public.messages(listing_id);

create index if not exists viewings_slot_id_idx
  on public.viewings(slot_id);

create index if not exists search_alerts_user_id_idx
  on public.search_alerts(user_id);

create index if not exists application_status_events_actor_id_idx
  on public.application_status_events(actor_id);

create index if not exists call_sessions_caller_id_idx
  on public.call_sessions(caller_id);

create index if not exists call_sessions_callee_id_idx
  on public.call_sessions(callee_id);

create index if not exists call_sessions_listing_id_idx
  on public.call_sessions(listing_id);

-- Canonical index names. Old index names are left in place where dropping them
-- could disrupt a live deployment; these aliases make the current convention true.
create index if not exists user_favorites_user_id_idx
  on public.user_favorites(user_id);

create index if not exists user_favorites_listing_id_idx
  on public.user_favorites(listing_id);

create unique index if not exists applications_active_renter_listing_idx
  on public.applications(renter_id, listing_id)
  where status in ('submitted', 'under_review', 'shortlisted', 'approved');

create unique index if not exists notification_events_idempotency_key_idx
  on public.notification_events(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists documents_application_type_idx
  on public.documents(application_id, type);

create unique index if not exists viewings_meeting_room_id_idx
  on public.viewings(meeting_room_id)
  where meeting_room_id is not null;

create unique index if not exists call_sessions_room_id_idx
  on public.call_sessions(room_id);

create unique index if not exists call_sessions_one_active_per_convo_idx
  on public.call_sessions(conversation_id)
  where status in ('ringing', 'active');

drop index if exists public.idx_user_favorites_user_id;
drop index if exists public.idx_user_favorites_listing_id;
drop index if exists public.applications_active_renter_listing_uidx;
drop index if exists public.notification_events_idempotency_key_uidx;
drop index if exists public.documents_application_type_uidx;
drop index if exists public.viewings_meeting_room_id_uidx;
drop index if exists public.call_sessions_room_id_uidx;
drop index if exists public.call_sessions_one_active_per_convo_uidx;

-- RLS operation coverage. Policies either grant the application-supported
-- operation or explicitly preserve deny-by-default for unsupported direct writes.

drop policy if exists "Users cannot delete profiles directly" on public.profiles;
create policy "Users cannot delete profiles directly"
  on public.profiles for delete
  to authenticated
  using (false);

drop policy if exists "Renters can delete withdrawn applications" on public.applications;
create policy "Renters can delete withdrawn applications"
  on public.applications for delete
  to authenticated
  using (
    renter_id = (select auth.uid())
    and status = 'withdrawn'
    and public.has_profile_role('renter')
  );

drop policy if exists "Authorized users can update relevant documents" on public.documents;
create policy "Authorized users can update relevant documents"
  on public.documents for update
  to authenticated
  using (
    exists (
      select 1
      from public.applications
      where applications.id = documents.application_id
        and applications.renter_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.applications
      where applications.id = documents.application_id
        and applications.renter_id = (select auth.uid())
    )
  );

drop policy if exists "Authorized users can delete relevant documents" on public.documents;
create policy "Authorized users can delete relevant documents"
  on public.documents for delete
  to authenticated
  using (
    exists (
      select 1
      from public.applications
      where applications.id = documents.application_id
        and applications.renter_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create relevant notifications" on public.notification_events;
create policy "Users can create relevant notifications"
  on public.notification_events for insert
  to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists "Users can delete their own notifications" on public.notification_events;
create policy "Users can delete their own notifications"
  on public.notification_events for delete
  to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "Users can delete their own conversations" on public.conversations;
create policy "Users can delete their own conversations"
  on public.conversations for delete
  to authenticated
  using (
    renter_id = (select auth.uid())
    or landlord_id = (select auth.uid())
  );

drop policy if exists "Users cannot delete messages directly" on public.messages;
create policy "Users cannot delete messages directly"
  on public.messages for delete
  to authenticated
  using (false);

drop policy if exists "Users can update their own analytics events" on public.analytics_events;
create policy "Users can update their own analytics events"
  on public.analytics_events for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own analytics events" on public.analytics_events;
create policy "Users can delete their own analytics events"
  on public.analytics_events for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users cannot update favorites directly" on public.user_favorites;
create policy "Users cannot update favorites directly"
  on public.user_favorites for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "Users cannot insert neighborhoods directly" on public.neighborhoods;
create policy "Users cannot insert neighborhoods directly"
  on public.neighborhoods for insert
  to authenticated
  with check (false);

drop policy if exists "Users cannot update neighborhoods directly" on public.neighborhoods;
create policy "Users cannot update neighborhoods directly"
  on public.neighborhoods for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "Users cannot delete neighborhoods directly" on public.neighborhoods;
create policy "Users cannot delete neighborhoods directly"
  on public.neighborhoods for delete
  to authenticated
  using (false);

drop policy if exists "Users can update their own search alerts" on public.search_alerts;
create policy "Users can update their own search alerts"
  on public.search_alerts for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own search alerts" on public.search_alerts;
create policy "Users can delete their own search alerts"
  on public.search_alerts for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Landlords can insert status events for owned listing applications" on public.application_status_events;
create policy "Landlords can insert status events for owned listing applications"
  on public.application_status_events for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and exists (
      select 1
      from public.applications
      join public.listings on listings.id = applications.listing_id
      where applications.id = application_status_events.application_id
        and listings.landlord_id = (select auth.uid())
    )
  );

drop policy if exists "Users cannot update application status events directly" on public.application_status_events;
create policy "Users cannot update application status events directly"
  on public.application_status_events for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "Users cannot delete application status events directly" on public.application_status_events;
create policy "Users cannot delete application status events directly"
  on public.application_status_events for delete
  to authenticated
  using (false);

drop policy if exists "Participants can insert call sessions" on public.call_sessions;
create policy "Participants can insert call sessions"
  on public.call_sessions for insert
  to authenticated
  with check (
    caller_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations
      where conversations.id = call_sessions.conversation_id
        and (
          conversations.renter_id = (select auth.uid())
          or conversations.landlord_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Participants can update call sessions" on public.call_sessions;
create policy "Participants can update call sessions"
  on public.call_sessions for update
  to authenticated
  using (
    caller_id = (select auth.uid())
    or callee_id = (select auth.uid())
  )
  with check (
    caller_id = (select auth.uid())
    or callee_id = (select auth.uid())
  );

drop policy if exists "Participants cannot delete call sessions directly" on public.call_sessions;
create policy "Participants cannot delete call sessions directly"
  on public.call_sessions for delete
  to authenticated
  using (false);

-- Supabase Data API explicit grants. RLS remains the row-level authority.
grant usage on schema public to anon, authenticated;
grant select on table public.neighborhoods to anon, authenticated;
grant select on table public.listings to anon, authenticated;
grant select on table public.listing_images to anon, authenticated;
grant insert on table public.search_alerts to anon;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.applications to authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
grant select, insert, update, delete on table public.notification_events to authenticated;
grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.viewing_slots to authenticated;
grant select, insert, update, delete on table public.viewing_slot_offers to authenticated;
grant select, insert, update, delete on table public.viewings to authenticated;
grant select, insert, update, delete on table public.analytics_events to authenticated;
grant select, insert, update, delete on table public.user_favorites to authenticated;
grant select, insert, update, delete on table public.search_alerts to authenticated;
grant select, insert, update, delete on table public.application_status_events to authenticated;
grant select, insert, update, delete on table public.call_sessions to authenticated;
