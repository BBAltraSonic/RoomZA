-- Historical organization function definitions only; additive account rows and helpers remain. A database rollback requires a separate decision.
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(invitation_token_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  invitation public.organization_invitations;
  current_email text;
  profile_role text;
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

  select lower(email), role into current_email, profile_role
  from public.profiles where id = auth.uid();

  if current_email is distinct from lower(invitation.email) then
    raise exception 'Sign in with the email address that received this invitation';
  end if;
  if profile_role is distinct from 'landlord' then
    raise exception 'Organization access requires a landlord account. Your renter profile was not changed.';
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
$function$
;
CREATE OR REPLACE FUNCTION public.create_organization(organization_name text, organization_slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'landlord'
  ) then
    raise exception 'Create or switch to a landlord account before creating an organization';
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
$function$
;