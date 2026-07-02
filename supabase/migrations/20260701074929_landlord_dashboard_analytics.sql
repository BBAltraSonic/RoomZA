-- Landlord dashboard analytics:
-- allow listing owners to read listing_view events for their own listings.

create index if not exists analytics_events_listing_view_listing_id_idx
  on public.analytics_events ((properties ->> 'listingId'))
  where event_name = 'listing_view';

drop policy if exists "Landlords can view listing analytics" on public.analytics_events;
create policy "Landlords can view listing analytics"
  on public.analytics_events for select
  to authenticated
  using (
    event_name = 'listing_view'
    and exists (
      select 1
      from public.listings
      where listings.id::text = (analytics_events.properties ->> 'listingId')
        and listings.landlord_id = (select auth.uid())
    )
  );
