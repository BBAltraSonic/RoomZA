-- Services "Open now" quick filter (Pinpoint Assistant proposal, "Quick filters").
--
-- A service counts as open when the current South African time falls inside its weekly
-- booking hours. Customers never read `service_hours` directly; this returns only which of
-- the given visible, approved services are open, nothing about the hours themselves.

create function public.services_open_now(service_ids uuid[])
returns uuid[]
language sql stable security definer set search_path = '' as $$
  with local_now as (
    select pg_catalog.timezone('Africa/Johannesburg', pg_catalog.statement_timestamp()) as value
  )
  select coalesce(array_agg(distinct h.service_id), '{}'::uuid[])
  from public.service_hours h
  join public.approved_services a on a.id = h.service_id
  cross join local_now
  where service_ids is not null
    and pg_catalog.cardinality(service_ids) <= 250
    and h.service_id = any(service_ids)
    and private.pinpoint_service_visible(a.id)
    and h.weekday = extract(dow from local_now.value)::smallint
    and (extract(hour from local_now.value) * 60 + extract(minute from local_now.value))::integer >= h.start_minute
    and (extract(hour from local_now.value) * 60 + extract(minute from local_now.value))::integer < h.end_minute;
$$;

revoke all on function public.services_open_now(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.services_open_now(uuid[]) to anon, authenticated;
