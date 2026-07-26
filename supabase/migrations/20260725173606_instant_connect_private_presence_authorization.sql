-- Keep Realtime Presence authorization independent from nested public-table
-- RLS evaluation. The helper returns only a boolean and lives outside the
-- Data API exposed schema.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_access_live_tour_presence(
  target_topic text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_tour_id uuid;
begin
  if (select auth.uid()) is null
    or target_topic !~
      '^presence:tour:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  target_tour_id :=
    replace(target_topic, 'presence:tour:', '')::uuid;

  return exists (
    select 1
    from public.live_tours
    join public.listings
      on listings.id = live_tours.listing_id
    where live_tours.id = target_tour_id
      and live_tours.status = 'live'
      and listings.status = 'published'
      and not exists (
        select 1
        from public.listing_restrictions
        where listing_restrictions.listing_id = live_tours.listing_id
          and listing_restrictions.restored_at is null
      )
  );
end;
$$;

revoke all on function private.can_access_live_tour_presence(text)
  from public, anon, authenticated;
grant execute on function private.can_access_live_tour_presence(text)
  to authenticated;

drop policy if exists
  "Authenticated users receive active live tour presence"
  on realtime.messages;
create policy "Authenticated users receive active live tour presence"
  on realtime.messages for select
  to authenticated
  using (
    -- Realtime probes both read extensions when Presence is enabled. Broadcast
    -- remains read-only here; the INSERT policy below still permits Presence
    -- messages only.
    realtime.messages.extension in ('presence', 'broadcast')
    and (
      select private.can_access_live_tour_presence(
        (select realtime.topic())
      )
    )
  );

drop policy if exists
  "Authenticated users publish active live tour presence"
  on realtime.messages;
create policy "Authenticated users publish active live tour presence"
  on realtime.messages for insert
  to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (
      select private.can_access_live_tour_presence(
        (select realtime.topic())
      )
    )
  );

comment on function private.can_access_live_tour_presence(text) is
  'Authorizes authenticated Presence access to a live, published, unrestricted Instant Connect tour without exposing source rows.';
