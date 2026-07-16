begin;

-- Anonymous visitors can call the bounded read-only projection.
set local role anon;
select count(*)
from public.get_published_listings_in_bbox_with_query(
  16.0, -35.0, 33.0, -22.0, null, null, null, null, null, null, 'rent'
);

-- Invalid or unbounded coordinates are rejected before querying data.
do $$
begin
  perform *
  from public.get_published_listings_in_bbox_with_query(
    -181.0, -35.0, 33.0, -22.0, null, null, null, null, null, null, 'rent'
  );
  raise exception 'Expected invalid bounds to fail';
exception
  when sqlstate '22023' then null;
end;
$$;

reset role;

-- The public function result has no private contact or authorization fields.
do $$
declare
  result_definition text;
begin
  select pg_get_function_result(p.oid)
  into result_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_published_listings_in_bbox_with_query'
  order by p.oid desc
  limit 1;

  if result_definition ~* '(email|phone_number|raw_user|app_metadata|role)' then
    raise exception 'Public discovery projection contains a private profile field: %', result_definition;
  end if;
end;
$$;

rollback;
