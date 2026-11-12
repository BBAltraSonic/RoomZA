-- Services may publish an optional starting price so map pins can lead with it.
-- Extends the installed validator in place, like earlier content field additions.
-- Deploy the application first: it must be able to read these fields before an
-- approved service can carry them.
do $$
declare
  source text;
  whitelist text := $literal$'mediaIds','mediaRightsConfirmed'$literal$;
  checks text := $literal$
 if payload ? 'priceFromCents' and (jsonb_typeof(payload->'priceFromCents') is distinct from 'number'
   or (payload->>'priceFromCents')::numeric <> trunc((payload->>'priceFromCents')::numeric)
   or (payload->>'priceFromCents')::numeric not between 1 and 2147483647) then
   raise exception 'Invalid service price' using errcode='22023';
 end if;
 if payload ? 'priceUnit' and (jsonb_typeof(payload->'priceUnit') is distinct from 'string'
   or payload->>'priceUnit' not in ('job','hour','callout')) then
   raise exception 'Invalid service price unit' using errcode='22023';
 end if;$literal$;
  position integer;
begin
  source := pg_get_functiondef('private.pinpoint_service_content(jsonb,boolean)'::regprocedure);
  if strpos(source, whitelist) = 0 then
    raise exception 'Expected service content whitelist missing';
  end if;
  source := replace(source, whitelist, whitelist || $literal$,'priceFromCents','priceUnit'$literal$);
  position := strpos(source, E'\nbegin\n');
  if position = 0 then
    raise exception 'Expected service validator body missing';
  end if;
  source := overlay(source placing checks from position + 6 for 0);
  execute source;
end;
$$;
