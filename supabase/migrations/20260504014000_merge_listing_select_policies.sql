drop policy if exists "Anyone can read published listings" on public.listings;
drop policy if exists "Landlords can read their listings" on public.listings;
drop policy if exists "Anyone can read published listing images" on public.listing_images;
drop policy if exists "Landlords can read their listing images" on public.listing_images;

create policy "Anon can read published listings"
  on public.listings
  for select
  to anon
  using (status = 'published');

create policy "Authenticated can read available listings"
  on public.listings
  for select
  to authenticated
  using (
    status = 'published'
    or landlord_id = (select auth.uid())
  );

create policy "Anon can read published listing images"
  on public.listing_images
  for select
  to anon
  using (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and listings.status = 'published'
    )
  );

create policy "Authenticated can read available listing images"
  on public.listing_images
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.listings
      where listings.id = listing_images.listing_id
        and (
          listings.status = 'published'
          or listings.landlord_id = (select auth.uid())
        )
    )
  );
