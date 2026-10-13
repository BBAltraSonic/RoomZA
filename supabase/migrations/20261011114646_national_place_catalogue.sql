-- Metadata stays separate: existing immutable offer reviews snapshot the entire
-- discovery_places row. Adding columns to that table would invalidate reviews.
begin;
create schema if not exists extensions;
create schema if not exists private;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;
set local search_path = pg_catalog, public, extensions;

create table public.discovery_place_metadata (
  place_id uuid primary key references public.discovery_places(id) on delete restrict,
  aliases text[] not null default '{}',
  province text not null,
  municipality text,
  extent_kind text not null check (extent_kind in ('source','viewport')),
  imported_at timestamptz not null default now()
);
create table public.discovery_place_sources (
  source_id text primary key,
  place_id uuid not null references public.discovery_places(id) on delete restrict,
  provenance jsonb not null check (jsonb_typeof(provenance)='object')
);
create index discovery_place_sources_place_idx on public.discovery_place_sources(place_id);

create function private.place_search_normalize(value text) returns text
language sql stable parallel safe set search_path = pg_catalog, extensions, public as $$
  select btrim(regexp_replace(lower(unaccent(coalesce(value,''))), '[^[:alnum:]]+', ' ', 'g'));
$$;

create table public.discovery_place_terms (
  place_id uuid not null references public.discovery_places(id) on delete restrict,
  term text not null,
  is_primary boolean not null,
  document text not null,
  tokens tsvector generated always as (to_tsvector('simple'::regconfig,document)) stored,
  primary key(place_id,term)
);
create index discovery_place_terms_prefix_idx on public.discovery_place_terms(term text_pattern_ops);
create index discovery_place_terms_trigram_idx on public.discovery_place_terms using gin(term gin_trgm_ops);
create index discovery_place_terms_tokens_idx on public.discovery_place_terms using gin(tokens);

-- Called by trusted writes only. Invoker permissions apply to every table.
create function private.refresh_place_terms(target uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.discovery_place_terms where place_id=target;
  insert into public.discovery_place_terms(place_id,term,is_primary,document)
  select p.id,private.place_search_normalize(a.name),bool_or(a.name=p.name),
    private.place_search_normalize(concat_ws(' ',a.name,p.region,m.province,m.municipality))
  from public.discovery_places p left join public.discovery_place_metadata m on m.place_id=p.id
  cross join lateral unnest(array[p.name] || coalesce(m.aliases,'{}')) a(name)
  where p.id=target and private.place_search_normalize(a.name)<>''
  group by p.id,private.place_search_normalize(a.name),
    private.place_search_normalize(concat_ws(' ',a.name,p.region,m.province,m.municipality))
  on conflict(place_id,term) do update set is_primary=excluded.is_primary,document=excluded.document;
end;
$$;
create function private.refresh_place_terms_trigger() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' and tg_table_name='discovery_place_metadata' then
    if old.aliases is not distinct from new.aliases
      and old.province is not distinct from new.province and old.municipality is not distinct from new.municipality then return new; end if;
  end if;
  if tg_table_name='discovery_places' then perform private.refresh_place_terms(new.id);
  else perform private.refresh_place_terms(new.place_id); end if;
  return new;
end;
$$;
create trigger discovery_places_refresh_terms after insert or update of name,region
  on public.discovery_places for each row execute function private.refresh_place_terms_trigger();
create trigger discovery_metadata_refresh_terms after insert or update
  on public.discovery_place_metadata for each row execute function private.refresh_place_terms_trigger();
select private.refresh_place_terms(id) from public.discovery_places;

create function public.read_discovery_places(place_ids uuid[])
returns table(id uuid,provider_id text,name text,region text,full_address text,
  center_lat double precision,center_lng double precision,west double precision,
  south double precision,east double precision,north double precision,extent_kind text)
language sql stable security invoker set search_path = '' as $$
  select p.id,p.provider_id,p.name,
    case when m.place_id is null then p.region else concat_ws(', ',m.municipality,m.province,'South Africa') end,
    p.full_address,p.center_lat,p.center_lng,p.west,p.south,p.east,p.north,m.extent_kind
  from public.discovery_places p left join public.discovery_place_metadata m on m.place_id=p.id
  where p.id=any(place_ids) and cardinality(place_ids)<=6;
$$;

create function public.search_discovery_places(search_query text)
returns table(id uuid,provider_id text,name text,region text,full_address text,
  center_lat double precision,center_lng double precision,west double precision,
  south double precision,east double precision,north double precision,extent_kind text)
language plpgsql stable security invoker
set search_path = pg_catalog, extensions, public
set pg_trgm.similarity_threshold = '0.2' as $$
declare q text := private.place_search_normalize(search_query); words text[]; token_query tsquery;
begin
  if char_length(search_query)>100 or (q<>'' and char_length(q)<2) then
    raise exception 'Enter two to one hundred characters' using errcode='22023';
  end if;
  if q='' then
    if btrim(coalesce(search_query,''))<>'' then return; end if;
    return query select r.* from public.read_discovery_places(array(
      select p.id from public.discovery_places p order by p.name,p.id limit 6)) r;
    return;
  end if;
  words := string_to_array(q,' ');
  -- Normalized alphanumeric tokens, quoted before tsquery construction.
  select to_tsquery('simple',string_agg(quote_literal(w)||':*',' & ')) into token_query from unnest(words) w;
  return query
  with lexical as materialized (
    select t.place_id,
      case when t.term=q and t.is_primary then 0
           when t.term like q||'%' and t.is_primary then 1
           when t.term=q then 2 when t.term like q||'%' then 3
           else 4 end as tier,
      similarity(t.term,q) as sim
    from public.discovery_place_terms t
    where t.term like q||'%' or t.tokens @@ token_query
  ), candidates as (
    select * from lexical
    union all
    select t.place_id,5,similarity(t.term,q) from public.discovery_place_terms t
    where not exists(select 1 from lexical) and char_length(q)>=5 and t.term % q
        and abs(char_length(t.term)-char_length(q))<=2
        and (levenshtein(t.term,q)<=1
          or (char_length(q)>=8 and levenshtein(t.term,q)<=2)
          or (char_length(q)=char_length(t.term) and exists(
            select 1 from generate_series(1,char_length(q)-1) i
            where left(q,i-1)||substr(q,i+1,1)||substr(q,i,1)||substr(q,i+2)=t.term)))
  ), ranked as (
    select c.place_id,min(c.tier) tier,max(c.sim) sim from candidates c group by c.place_id
  ), top_places as (
    select r.place_id,r.tier,r.sim,p.name from ranked r join public.discovery_places p on p.id=r.place_id
    order by r.tier,r.sim desc,p.name,r.place_id limit 6
  )
  select r.* from top_places t cross join lateral public.read_discovery_places(array[t.place_id]) r
    order by t.tier,t.sim desc,t.name,t.place_id;
end;
$$;

-- Import batches are atomic and never update/delete the existing base rows.
-- Links to an existing UUID must be explicitly present in the reviewed manifest.
create function public.import_discovery_place_batch(records jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; ref jsonb; target uuid; linked uuid; existing uuid; added integer:=0; linked_count integer:=0;
begin
  if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>250 then
    raise exception 'Expected at most 250 place records' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    if item->>'country_code' is distinct from 'ZA' or coalesce(item->>'province','') not in
      ('Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape')
      or coalesce(char_length(btrim(item->>'name')),0) not between 1 and 200
      or jsonb_typeof(item->'sources') is distinct from 'array' or jsonb_array_length(item->'sources')=0
      or jsonb_typeof(item->'aliases') is distinct from 'array' or jsonb_array_length(item->'aliases')>100
      or coalesce(item->>'extent_kind','') not in ('source','viewport')
      or coalesce(item->>'level','') not in ('place','locality','neighbourhood','municipality')
      or coalesce(item->>'provider_id','') !~ '^(geonames:[0-9]+|osm:(node|way|relation):[0-9]+)$'
      or exists(select 1 from jsonb_array_elements(item->'aliases') a where jsonb_typeof(a)<>'string' or char_length(a#>>'{}')>200)
      or not coalesce(((item->>'center_lat')::float8 between -35 and -22 and (item->>'center_lng')::float8 between 16 and 33
        and (item->>'west')::float8 < (item->>'east')::float8 and (item->>'south')::float8 < (item->>'north')::float8
        and (item->>'west')::float8 between -180 and 180 and (item->>'east')::float8 between -180 and 180
        and (item->>'south')::float8 between -90 and 90 and (item->>'north')::float8 between -90 and 90
        and (item->>'center_lat')::float8 between (item->>'south')::float8 and (item->>'north')::float8
        and (item->>'center_lng')::float8 between (item->>'west')::float8 and (item->>'east')::float8),false) then
      raise exception 'Invalid South African place record' using errcode='22023';
    end if;
    target := nullif(item->>'target_id','')::uuid;
    linked := null;
    for ref in select value from jsonb_array_elements(item->'sources') loop
      if coalesce(ref->>'id','') !~ '^(geonames:[0-9]+|osm:(node|way|relation):[0-9]+)$'
        or coalesce(ref->>'url','') !~ '^https://' or coalesce(ref->>'license','') not in ('CC-BY-4.0','ODbL-1.0')
        or coalesce(ref->>'downloaded_at','')='' or coalesce(ref->>'sha256','')='' then raise exception 'Missing source provenance' using errcode='22023'; end if;
      select s.place_id into existing from public.discovery_place_sources s where s.source_id=ref->>'id';
      if existing is not null then
        if linked is not null and linked<>existing then raise exception 'Conflicting source mappings' using errcode='22023'; end if;
        linked := existing;
      end if;
    end loop;
    if target is not null and linked is not null and target<>linked then
      raise exception 'Source already belongs to another UUID' using errcode='22023';
    end if;
    target := coalesce(target,linked);
    if target is null then
      insert into public.discovery_places(provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north)
      values(item->>'provider_id',item->>'level',item->>'name',item->>'region',item->>'full_address',
        (item->>'center_lat')::float8,(item->>'center_lng')::float8,(item->>'west')::float8,(item->>'south')::float8,
        (item->>'east')::float8,(item->>'north')::float8) returning discovery_places.id into target;
      added:=added+1;
    elsif not exists(select 1 from public.discovery_places p where p.id=target) then
      raise exception 'Reviewed target UUID does not exist' using errcode='22023';
    else linked_count:=linked_count+1;
    end if;
    insert into public.discovery_place_metadata(place_id,aliases,province,municipality,extent_kind)
    values(target,array(select distinct x from jsonb_array_elements_text(item->'aliases') x order by x),item->>'province',nullif(item->>'municipality',''),
      case when exists(select 1 from public.discovery_places p where p.id=target and p.provider_id<>item->>'provider_id') then 'source' else item->>'extent_kind' end)
    on conflict(place_id) do update set aliases=array(select distinct x from unnest(
      discovery_place_metadata.aliases||excluded.aliases) x order by x),imported_at=now();
    for ref in select value from jsonb_array_elements(item->'sources') loop
      insert into public.discovery_place_sources(source_id,place_id,provenance) values(ref->>'id',target,ref)
      on conflict(source_id) do update set provenance=excluded.provenance;
    end loop;
  end loop;
  return jsonb_build_object('inserted',added,'linked',linked_count);
end;
$$;

alter table public.discovery_place_metadata enable row level security;
alter table public.discovery_place_sources enable row level security;
alter table public.discovery_place_terms enable row level security;
create policy "Public place metadata" on public.discovery_place_metadata for select to anon,authenticated using(true);
create policy "Public place provenance" on public.discovery_place_sources for select to anon,authenticated using(true);
create policy "Public place search terms" on public.discovery_place_terms for select to anon,authenticated using(true);
revoke all on public.discovery_place_metadata,public.discovery_place_sources,public.discovery_place_terms from public,anon,authenticated;
grant select on public.discovery_place_metadata,public.discovery_place_sources,public.discovery_place_terms to anon,authenticated;
grant select,insert,update,delete on public.discovery_place_metadata,public.discovery_place_sources,public.discovery_place_terms to service_role;
revoke all on function public.search_discovery_places(text),public.read_discovery_places(uuid[]),public.import_discovery_place_batch(jsonb) from public,anon,authenticated;
grant execute on function public.search_discovery_places(text),public.read_discovery_places(uuid[]) to anon,authenticated,service_role;
grant execute on function public.import_discovery_place_batch(jsonb) to service_role;
revoke all on function private.place_search_normalize(text),private.refresh_place_terms(uuid),private.refresh_place_terms_trigger() from public,anon,authenticated;
grant usage on schema private to anon,authenticated,service_role;
grant usage on schema extensions to anon,authenticated,service_role;
grant execute on function private.place_search_normalize(text) to anon,authenticated,service_role;
grant execute on function private.refresh_place_terms(uuid),private.refresh_place_terms_trigger() to service_role;
comment on table public.discovery_place_metadata is 'Open-data named areas. Viewport extents are nearby viewing boxes, not legal boundaries.';
commit;
