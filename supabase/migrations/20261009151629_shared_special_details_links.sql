-- Optional links belong to the immutable, reviewed content snapshot.
-- No existing drafts, revisions, public rows or authorization grants are changed.
begin;
create function private.special_links_validate(content jsonb) returns void
language plpgsql immutable security invoker set search_path = '' as $$
declare field text; value text;
begin
  foreach field in array array['visitUrl','bookingUrl'] loop
    if content ? field then
      value := content->>field;
      if jsonb_typeof(content->field) is distinct from 'string'
        or char_length(value) not between 1 and 2048
        or value <> btrim(value)
        or value !~* '^https://[^/?#[:space:]@\\]+([/?#][^[:space:]\\]*)?$'
      then raise exception 'Use an absolute HTTPS link without embedded credentials: %',field using errcode='22023';
      end if;
    end if;
  end loop;
end; $$;
revoke all on function private.special_links_validate(jsonb) from public, anon, authenticated, service_role;

-- Extend the installed media validators. Contact support is preserved when installed,
-- but the separate guest-contact release is not a prerequisite for Specials links.
do $$
declare name text; source text; anchor text;
begin
  foreach name in array array['private.pinpoint_intake_validate(jsonb,boolean)','private.pinpoint_entry_content(jsonb,boolean)'] loop
    source := pg_get_functiondef(name::regprocedure);
    anchor := case when strpos(source,'''publicContact'',''contactConsent''')>0
      then '''publicContact'',''contactConsent''' else '''mediaIds'',''mediaRightsConfirmed''' end;
    if strpos(source,anchor)=0 then raise exception 'Expected media/contact whitelist missing: %',name; end if;
    source := replace(source,anchor,anchor||',''visitUrl'',''bookingUrl''');
    anchor := case when strpos(source,'perform private.pinpoint_contact_validate(content,false);')>0
      then 'perform private.pinpoint_contact_validate(content,false);'
      else 'perform private.discovery_card_validate(content,complete,true);' end;
    if strpos(source,anchor)=0 then raise exception 'Expected validation call missing: %',name; end if;
    source := replace(source,anchor,anchor||' perform private.special_links_validate(content);');
    execute source;
  end loop;
  source := pg_get_functiondef('private.pinpoint_offer_public_snapshot(uuid,timestamptz)'::regprocedure);
  anchor := 'jsonb_object_keys(content - ''publicContact'' - ''contactConsent'' - ''mediaIds'' - ''mediaRightsConfirmed'' - ''priceCents'' - ''originalPriceCents'')';
  if strpos(source,anchor)=0 then raise exception 'Expected public snapshot field check missing'; end if;
  source := replace(source,anchor,'jsonb_object_keys(content - ''publicContact'' - ''contactConsent'' - ''mediaIds'' - ''mediaRightsConfirmed'' - ''priceCents'' - ''originalPriceCents'' - ''visitUrl'' - ''bookingUrl'')');
  execute source;
end; $$;
commit;
