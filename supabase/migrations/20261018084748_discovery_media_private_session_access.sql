begin;

-- Private media uses the same current-session, account and policy eligibility
-- as its intake. An unexpired JWT alone must not mint new private download links.
-- Approved, currently visible photos remain readable by guests.
create or replace function private.discovery_media_access(object_path text,upload boolean default false)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare item public.discovery_media%rowtype;
begin
  select * into item from public.discovery_media where path=object_path;
  if item.id is null then return false; end if;
  if upload is not true and private.discovery_media_published(item.id) then return true; end if;
  if not private.pinpoint_intake_eligible() then return false; end if;
  if upload is true then
    return item.owner_id=auth.uid() and not item.ready and case item.category
      when 'service' then private.pinpoint_service_eligible()
      when 'shopping' then private.pinpoint_intake_poster()
      else private.pinpoint_entry_active(item.category)
    end;
  end if;
  return item.owner_id=auth.uid()
    or ((private.pinpoint_intake_reviewer() or private.pinpoint_service_reviewer())
      and private.discovery_media_referenced(item.id));
end;
$$;
revoke all on function private.discovery_media_access(text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.discovery_media_access(text,boolean) to anon,authenticated;

create function private.discovery_media_list(category text,target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.pinpoint_intake_eligible() then
    raise exception 'Active photo account required' using errcode='42501';
  end if;
  if category is null or category not in ('shopping','tourism','event','service') or target is null then
    raise exception 'Invalid photo target' using errcode='22023';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'path',m.path) order by m.created_at),'[]')
    from public.discovery_media m
    where m.category=$1 and coalesce(m.offer_id,m.entry_id,m.service_id)=$2 and m.ready
      and (m.owner_id=auth.uid() or ((private.pinpoint_intake_reviewer() or private.pinpoint_service_reviewer())
        and private.discovery_media_referenced(m.id))));
end;
$$;
revoke all on function private.discovery_media_list(text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.discovery_media_list(text,uuid) to authenticated;

-- Preserve the existing public signature and result while keeping privileged
-- table reads in the private schema. Caller identity comes only from Auth.
create or replace function public.discovery_media_list(category text,target uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.discovery_media_list(category,target);
$$;
revoke all on function public.discovery_media_list(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.discovery_media_list(text,uuid) to authenticated;

commit;
