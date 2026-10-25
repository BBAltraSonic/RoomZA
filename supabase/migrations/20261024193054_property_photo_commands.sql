begin;

-- Current Gallery actions use this trusted mutation; authenticated table ACLs stay intact.
create function public.pinpoint_property_photo(
  actor_id uuid, actor_session_id uuid, target uuid,
  expected_updated_at timestamptz, photo_request jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $photo$
declare
  source_listing public.listings%rowtype;
  active_org uuid;
  membership_id uuid;
  photo public.listing_images%rowtype;
  object_name text;
  object_url text;
  command text;
  resulting_version timestamptz;
begin
  command := photo_request->>'command';
  if photo_request is null or jsonb_typeof(photo_request) <> 'object'
    or command is null or command not in ('add','remove') then
    raise exception 'Invalid photo update' using errcode='22023';
  end if;
  if not public.pinpoint_active_session(actor_id,actor_session_id) then
    raise exception 'Listing not found or access denied' using errcode='42501';
  end if;
  select p.active_organization_id into active_org from public.profiles p
    where p.id=actor_id
      and exists(select 1 from public.profile_personas pp where pp.profile_id=p.id
        and pp.persona::text in ('landlord','seller')) for share;
  if not found then raise exception 'Listing not found or access denied' using errcode='42501'; end if;
  select * into source_listing from public.listings where id=target for update;
  if not found then raise exception 'Listing not found or access denied' using errcode='42501'; end if;
  if source_listing.organization_id is not null then
    select m.id into membership_id from public.organization_memberships m
      join public.organizations o on o.id=m.organization_id
      where m.user_id=actor_id and m.organization_id=source_listing.organization_id
        and m.organization_id=active_org and m.role in ('owner','admin')
        and m.revoked_at is null and o.deleted_at is null for share of m,o;
    if membership_id is null then raise exception 'Listing not found or access denied' using errcode='42501'; end if;
  elsif source_listing.landlord_id is distinct from actor_id then
    raise exception 'Listing not found or access denied' using errcode='42501';
  end if;
  if expected_updated_at is null or source_listing.updated_at is distinct from expected_updated_at then
    raise exception 'Listing changed; reload before changing photos' using errcode='PT409';
  end if;
  perform 1 from public.listing_images where listing_id=target order by id for update;
  if command='add' then
    if (select count(*) from public.listing_images where listing_id=target)>=20 then
      raise exception 'A listing can have at most 20 photos' using errcode='PT422';
    end if;
    object_name := photo_request->>'path'; object_url := photo_request->>'publicUrl';
    if object_name is null or object_name !~ ('^'||actor_id||'/'||target||
      '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|png|webp)$')
      or object_url is null or object_url !~ '^https?://'
      or right(object_url,length('/storage/v1/object/public/listing-images/'||object_name))
        is distinct from '/storage/v1/object/public/listing-images/'||object_name then
      raise exception 'Invalid photo object' using errcode='22023';
    end if;
    perform 1 from storage.objects o where o.bucket_id='listing-images' and o.name=object_name
      and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=actor_id::text
      and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
      and case when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint else 0 end
        between 1 and 10485760 for share;
    if not found then raise exception 'Photo upload is incomplete or unavailable' using errcode='22023'; end if;
    insert into public.listing_images(listing_id,bucket,path,public_url,sort_order)
      select target,'listing-images',object_name,object_url,coalesce(max(sort_order),-1)+1
      from public.listing_images where listing_id=target returning * into photo;
  else
    if coalesce(photo_request->>'imageId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
      raise exception 'Invalid photo id' using errcode='22023';
    end if;
    select * into photo from public.listing_images
      where id=(photo_request->>'imageId')::uuid and listing_id=target for update;
    if not found then raise exception 'Photo not found or access denied' using errcode='42501'; end if;
    if source_listing.status='published' and (select count(*) from public.listing_images where listing_id=target)<=3 then
      raise exception 'Published listings need at least 3 photos' using errcode='PT422';
    end if;
    delete from public.listing_images where id=photo.id;
    -- Copies can still reference these bytes. Leave object deletion to guarded orphan cleanup.
  end if;
  update public.listings set updated_at=greatest(clock_timestamp(),source_listing.updated_at+interval '1 microsecond')
    where id=target returning updated_at into resulting_version;
  return jsonb_build_object('updatedAt',resulting_version,'image',case when command='add' then
    jsonb_build_object('id',photo.id,'public_url',photo.public_url,'sort_order',photo.sort_order) else null end);
end;
$photo$;

revoke all on function public.pinpoint_property_photo(uuid,uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.pinpoint_property_photo(uuid,uuid,uuid,timestamptz,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
