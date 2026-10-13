select jsonb_build_object(
 'postgres',version(),
 'place_columns',(select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type) order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='discovery_places'),
 'places',(select jsonb_agg(to_jsonb(p) order by id) from public.discovery_places p where p.id=any(array['50b5bc43-1465-4c1d-b6d4-1840183f7809','b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb','c075298e-b2fb-47eb-82a8-b454d1d4ea4d','ed74274f-81ae-4f00-9dfd-c19ef8ecbe9a','fc84cd38-c245-4b5c-92d5-eb6473e958bf']::uuid[])),
 'fingerprints',(select jsonb_object_agg(name,value) from (
 select 'listings' name,jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),''))) value from public.listings t union all
 select 'user_favorites',jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by user_id,listing_id),''))) from public.user_favorites t union all
 select 'shopping_offers',jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),''))) from public.shopping_offers t union all
 select 'service_submissions',jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),''))) from public.service_submissions t
 ) fingerprints),
 'extensions',(select jsonb_agg(jsonb_build_object('name',extname,'schema',extnamespace::regnamespace::text)) from pg_extension where extname in ('pg_trgm','unaccent','fuzzystrmatch')),
 'catalogue_exists',to_regclass('public.discovery_place_metadata')
 ) as preflight;
