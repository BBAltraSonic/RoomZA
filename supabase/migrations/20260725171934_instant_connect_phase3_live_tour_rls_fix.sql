-- Browser reads of live_tours must not require direct privileges on the
-- service-only listing_restrictions table. Reuse the protected lookup already
-- established for listing discovery.

drop policy if exists
  "Authenticated users read public current tours and hosts read history"
  on public.live_tours;

create policy "Authenticated users read public current tours and hosts read history"
  on public.live_tours for select
  to authenticated
  using (
    host_id = (select auth.uid())
    or (
      status in ('scheduled', 'live')
      and exists (
        select 1
        from public.listings
        where listings.id = live_tours.listing_id
          and listings.status = 'published'
      )
      and (select public.is_listing_unrestricted(live_tours.listing_id))
    )
  );
