-- All ordinary Property workflows belong to one account. Existing profile
-- details, primary/active selections, and privileged memberships remain intact.
begin;
create function private.enable_marketplace_profile(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id = target for update;
  if not found then raise exception 'Profile required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profile_personas where profile_id = target) then
    insert into public.profile_personas(profile_id,persona,is_primary,is_active)
      values(target,'renter',true,true) on conflict (profile_id,persona) do nothing;
  end if;
  insert into public.profile_personas(profile_id,persona)
    select target,value from unnest(array['renter','buyer','landlord','seller']::public.marketplace_persona[]) value
    on conflict (profile_id,persona) do nothing;
  insert into public.renter_profile_details(profile_id) values(target) on conflict do nothing;
  insert into public.buyer_profile_details(profile_id) values(target) on conflict do nothing;
  insert into public.landlord_profile_details(profile_id) values(target) on conflict do nothing;
  insert into public.seller_profile_details(profile_id) values(target) on conflict do nothing;
end;
$$;
revoke all on function private.enable_marketplace_profile(uuid) from public,anon,authenticated,service_role;

create function private.initialize_marketplace_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users where id = new.id and not coalesce(is_anonymous,false)) then
    perform private.enable_marketplace_profile(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_marketplace_profile() from public,anon,authenticated,service_role;
create trigger profiles_initialize_marketplace
  after insert on public.profiles for each row execute function private.initialize_marketplace_profile();

do $$
declare target uuid;
begin
  for target in select p.id from public.profiles p join auth.users u on u.id=p.id
    where not coalesce(u.is_anonymous,false)
  loop perform private.enable_marketplace_profile(target); end loop;
end;
$$;

-- Self-only recovery; caller identity comes from Auth, never supplied metadata.
create function public.ensure_marketplace_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pinpoint_active_session(auth.uid(), (auth.jwt()->>'session_id')::uuid) then
    raise exception 'Active signed-in account required' using errcode = '42501';
  end if;
  perform private.enable_marketplace_profile(auth.uid());
end;
$$;
revoke all on function public.ensure_marketplace_account() from public,anon,authenticated,service_role;
grant execute on function public.ensure_marketplace_account() to authenticated;

-- Keep complete invitation/email, ownership and organization membership checks.
create or replace function public.accept_organization_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  invitation public.organization_invitations;
  current_email text;
begin
  select * into invitation
  from public.organization_invitations
  where token_hash = invitation_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation is invalid or has expired';
  end if;

  select lower(email) into current_email
  from public.profiles where id = auth.uid();

  if current_email is distinct from lower(invitation.email) then
    raise exception 'Sign in with the email address that received this invitation';
  end if;
  if not private.pinpoint_intake_eligible() then
    raise exception 'Eligible signed-in account required' using errcode = '42501';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, role, office_id, invited_by
  ) values (
    invitation.organization_id, auth.uid(), invitation.role, invitation.office_id, invitation.invited_by
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role, office_id = excluded.office_id, revoked_at = null, updated_at = now();

  update public.organization_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invitation.id;

  update public.profiles
  set active_organization_id = invitation.organization_id
  where id = auth.uid();

  return invitation.organization_id;
end;
$$;

create or replace function public.create_organization(organization_name text, organization_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not private.pinpoint_intake_eligible() then
    raise exception 'Eligible signed-in account required' using errcode = '42501';
  end if;

  insert into public.organizations(name, slug, owner_id)
  values (btrim(organization_name), lower(btrim(organization_slug)), auth.uid())
  returning id into new_organization_id;

  insert into public.organization_memberships(organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');

  update public.profiles
  set active_organization_id = new_organization_id
  where id = auth.uid();

  return new_organization_id;
end;
$$;
-- Draft creation uses the same trusted-server boundary as Property save/lifecycle.
-- Keep ordinary JWT table revokes; a verified server supplies actor/session/target.
create function public.pinpoint_property_create_draft(actor_id uuid, actor_session_id uuid, target uuid, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare draft public.listings%rowtype; existing public.listings%rowtype;
begin
  if target is null or not public.pinpoint_active_session(actor_id,actor_session_id)
    or not exists (select 1 from public.profile_personas p where p.profile_id=actor_id and p.persona in ('landlord','seller'))
    or exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id=v.id
      where v.status='published' and v.requires_reacceptance and v.effective_at<=statement_timestamp()
      and not exists(select 1 from public.policy_acceptances a where a.user_id=actor_id and a.version_id=v.id)) then
    raise exception 'Active eligible account required' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>20000
    or exists(select 1 from jsonb_object_keys(payload) k where k not in
      ('listing_type','title','property_type','price','sale_price','address','latitude','longitude')) then
    raise exception 'Invalid draft content' using errcode='22023';
  end if;
  draft:=jsonb_populate_record(null::public.listings,payload);
  if draft.listing_type is null or draft.title is null or char_length(btrim(draft.title))<3 or char_length(draft.title)>120
    or draft.property_type is null or draft.address is null or char_length(btrim(draft.address))=0
    or draft.latitude is null or draft.latitude not between -90 and 90
    or draft.longitude is null or draft.longitude not between -180 and 180 then
    raise exception 'Invalid property essentials' using errcode='22023';
  end if;
  draft.price:=case when draft.listing_type='sale' then draft.sale_price else draft.price end;
  if draft.price is null or draft.price<=0 then raise exception 'Positive price required' using errcode='22023'; end if;
  insert into public.listings(id,landlord_id,listing_type,title,property_type,price,sale_price,address,latitude,longitude,status)
    values(target,actor_id,draft.listing_type,btrim(draft.title),draft.property_type,draft.price,
      case when draft.listing_type='sale' then draft.price else null end,btrim(draft.address),draft.latitude,draft.longitude,'draft')
    on conflict(id) do nothing;
  select * into existing from public.listings where id=target;
  if existing.landlord_id is distinct from actor_id or existing.organization_id is not null then
    raise exception 'Draft not found or access denied' using errcode='42501';
  end if;
  return jsonb_build_object('listingId',existing.id,'updatedAt',existing.updated_at);
end;
$$;
revoke all on function public.pinpoint_property_create_draft(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.pinpoint_property_create_draft(uuid,uuid,uuid,jsonb) to service_role;

commit;
