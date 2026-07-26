-- Safe lifecycle projection used as a low-frequency fallback when a waiting
-- room misses a Postgres Changes event. It exposes no room URL, roster, host,
-- recording metadata, or other tour details.

create or replace function public.get_public_live_tour_status(
  target_tour_id uuid
)
returns table(status public.live_tour_status)
language sql
stable
security definer
set search_path = ''
as $$
  select live_tours.status
  from public.live_tours
  join public.listings
    on listings.id = live_tours.listing_id
  where live_tours.id = target_tour_id
    and listings.status = 'published'
    and not exists (
      select 1
      from public.listing_restrictions
      where listing_restrictions.listing_id = live_tours.listing_id
        and listing_restrictions.restored_at is null
    )
  limit 1;
$$;

revoke all on function public.get_public_live_tour_status(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_live_tour_status(uuid)
  to authenticated;

comment on function public.get_public_live_tour_status(uuid) is
  'Authenticated status-only fallback for scheduled/live tour lifecycle transitions.';
