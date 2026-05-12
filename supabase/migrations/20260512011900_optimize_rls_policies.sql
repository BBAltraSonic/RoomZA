-- =============================================================================
-- Migration: Optimize RLS Policies
-- Purpose: Fix Supabase Performance Advisor warnings:
--   1. Wrap bare auth.uid() calls in (select auth.uid()) to prevent per-row re-evaluation
--   2. Consolidate multiple permissive policies for same role+action into single policies
-- No access-control semantics are changed.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- APPLICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix INSERT (bare auth.uid → select auth.uid)
drop policy if exists "Renters can create their own applications" on public.applications;
create policy "Renters can create their own applications"
  on public.applications for insert
  to authenticated
  with check (
    (select auth.uid()) = renter_id
    and has_profile_role('renter')
  );

-- Consolidate SELECT (two permissive policies → one)
drop policy if exists "Renters can view their own applications" on public.applications;
drop policy if exists "Landlords can view applications to their listings" on public.applications;
create policy "Authorized users can view relevant applications"
  on public.applications for select
  to authenticated
  using (
    (select auth.uid()) = renter_id
    or exists (
      select 1 from public.listings
      where listings.id = applications.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  );

-- Consolidate UPDATE (two permissive policies → one)
drop policy if exists "Renters can update their own applications" on public.applications;
drop policy if exists "Landlords can update application statuses" on public.applications;
create policy "Authorized users can update relevant applications"
  on public.applications for update
  to authenticated
  using (
    ((select auth.uid()) = renter_id and has_profile_role('renter'))
    or exists (
      select 1 from public.listings
      where listings.id = applications.listing_id
        and listings.landlord_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Users can view their own conversations" on public.conversations;
create policy "Users can view their own conversations"
  on public.conversations for select
  to authenticated
  using (
    renter_id = (select auth.uid())
    or landlord_id = (select auth.uid())
  );

drop policy if exists "Users can insert conversations they are part of" on public.conversations;
create policy "Users can insert conversations they are part of"
  on public.conversations for insert
  to authenticated
  with check (
    renter_id = (select auth.uid())
    or landlord_id = (select auth.uid())
  );

drop policy if exists "Users can update conversations they are part of" on public.conversations;
create policy "Users can update conversations they are part of"
  on public.conversations for update
  to authenticated
  using (
    renter_id = (select auth.uid())
    or landlord_id = (select auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix INSERT (bare auth.uid → select auth.uid)
drop policy if exists "Renters can insert documents for their applications" on public.documents;
create policy "Renters can insert documents for their applications"
  on public.documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications
      where applications.id = documents.application_id
        and applications.renter_id = (select auth.uid())
    )
  );

-- Consolidate SELECT (two permissive policies → one)
drop policy if exists "Renters can view their own documents" on public.documents;
drop policy if exists "Landlords can view documents for applications to their listings" on public.documents;
create policy "Authorized users can view relevant documents"
  on public.documents for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      left join public.listings l on l.id = a.listing_id
      where a.id = documents.application_id
        and (
          a.renter_id = (select auth.uid())
          or l.landlord_id = (select auth.uid())
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Users can view messages of their conversations" on public.messages;
create policy "Users can view messages of their conversations"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (
          conversations.renter_id = (select auth.uid())
          or conversations.landlord_id = (select auth.uid())
        )
    )
  );

drop policy if exists "Users can insert messages to their conversations" on public.messages;
create policy "Users can insert messages to their conversations"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and (
          conversations.renter_id = (select auth.uid())
          or conversations.landlord_id = (select auth.uid())
        )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTIFICATION_EVENTS
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Users can view their own notifications" on public.notification_events;
create policy "Users can view their own notifications"
  on public.notification_events for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Users can update their own notifications" on public.notification_events;
create policy "Users can update their own notifications"
  on public.notification_events for update
  to authenticated
  using ((select auth.uid()) = recipient_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWING_SLOTS
-- Replace landlord FOR ALL with per-action policies, consolidate shared actions
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Landlords can manage viewings for their listings" on public.viewing_slots;
drop policy if exists "Renters can view slots offered to them" on public.viewing_slots;
drop policy if exists "Renters can book offered slots" on public.viewing_slots;

-- Combined SELECT: landlord (owns slot) OR renter (slot offered to them)
create policy "Users can view relevant viewing slots"
  on public.viewing_slots for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
  );

-- Combined UPDATE: landlord (owns slot) OR renter (slot offered → booking)
create policy "Users can update relevant viewing slots"
  on public.viewing_slots for update
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.viewing_slot_offers vso
      join public.applications a on a.id = vso.application_id
      where vso.slot_id = viewing_slots.id
        and a.renter_id = (select auth.uid())
    )
  );

-- Landlord-only INSERT
create policy "Landlords can insert viewing slots"
  on public.viewing_slots for insert
  to authenticated
  with check (created_by = (select auth.uid()));

-- Landlord-only DELETE
create policy "Landlords can delete viewing slots"
  on public.viewing_slots for delete
  to authenticated
  using (created_by = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWING_SLOT_OFFERS
-- Replace landlord FOR ALL with per-action policies, consolidate SELECT
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Landlords can view/create offers for their slots" on public.viewing_slot_offers;
drop policy if exists "Renters can view their slot offers" on public.viewing_slot_offers;

-- Combined SELECT: landlord (owns underlying slot) OR renter (applied)
create policy "Users can view relevant slot offers"
  on public.viewing_slot_offers for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.applications
      where applications.id = viewing_slot_offers.application_id
        and applications.renter_id = (select auth.uid())
    )
  );

-- Landlord-only INSERT
create policy "Landlords can insert slot offers"
  on public.viewing_slot_offers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
  );

-- Landlord-only UPDATE
create policy "Landlords can update slot offers"
  on public.viewing_slot_offers for update
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
  );

-- Landlord-only DELETE
create policy "Landlords can delete slot offers"
  on public.viewing_slot_offers for delete
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewing_slot_offers.application_id
        and l.landlord_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWINGS
-- Replace landlord FOR ALL with per-action policies, consolidate shared actions
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Landlords can view/manage viewings on their listings" on public.viewings;
drop policy if exists "Renters can create their own viewings" on public.viewings;
drop policy if exists "Renters can view their own viewings" on public.viewings;

-- Combined SELECT: landlord (owns listing) OR renter (applied)
create policy "Users can view relevant viewings"
  on public.viewings for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewings.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.applications
      where applications.id = viewings.application_id
        and applications.renter_id = (select auth.uid())
    )
  );

-- Combined INSERT: landlord (owns listing) OR renter (slot offered to them)
create policy "Users can create viewings"
  on public.viewings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewings.application_id
        and l.landlord_id = (select auth.uid())
    )
    or exists (
      select 1 from public.applications a
      join public.viewing_slot_offers vso
        on vso.application_id = a.id
       and vso.slot_id = viewings.slot_id
      where a.id = viewings.application_id
        and a.renter_id = (select auth.uid())
    )
  );

-- Landlord-only UPDATE
create policy "Landlords can update viewings"
  on public.viewings for update
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewings.application_id
        and l.landlord_id = (select auth.uid())
    )
  );

-- Landlord-only DELETE
create policy "Landlords can delete viewings"
  on public.viewings for delete
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      join public.listings l on l.id = a.listing_id
      where a.id = viewings.application_id
        and l.landlord_id = (select auth.uid())
    )
  );
