begin;

-- Availability and heartbeats derive their caller from a live Auth session.
-- Keep privacy controls usable without adding a policy-acceptance prerequisite.
create function private.touch_presence(desired text default 'available')
returns table(result text,presence_status text)
language plpgsql security definer set search_path='' as $$
declare
  requester uuid:=auth.uid();
  prof public.profiles%rowtype;
  resolved text;
begin
  if not public.pinpoint_active_session(requester,nullif(auth.jwt()->>'session_id','')::uuid) then
    return query select 'access_denied'::text,null::text; return;
  end if;
  if desired is null or desired not in ('available','busy','offline') then desired:='available'; end if;
  select * into prof from public.profiles where id=requester for update;
  if prof.id is null then return query select 'not_found'::text,null::text; return; end if;
  resolved:=case when desired='offline' then 'offline' else case prof.availability_mode
    when 'invisible' then 'offline' when 'available' then 'available' when 'busy' then 'busy' else desired end end;
  if prof.last_seen_at is not null and prof.last_seen_at>pg_catalog.now()-interval '45 seconds'
    and prof.presence_status=resolved then
    return query select 'throttled'::text,prof.presence_status; return;
  end if;
  update public.profiles set last_seen_at=pg_catalog.now(),presence_status=resolved,updated_at=pg_catalog.now() where id=requester;
  return query select 'updated'::text,resolved;
end;
$$;
revoke all on function private.touch_presence(text) from public,anon,authenticated,service_role;
grant execute on function private.touch_presence(text) to authenticated;

create or replace function public.touch_presence(desired text default 'available')
returns table(result text,presence_status text)
language sql security invoker set search_path='' as $$ select * from private.touch_presence(desired); $$;
revoke all on function public.touch_presence(text) from public,anon,authenticated,service_role;
grant execute on function public.touch_presence(text) to authenticated;

create function private.set_availability_mode(target_mode text)
returns table(availability_mode text,presence_status text)
language plpgsql security definer set search_path='' as $$
declare requester uuid:=auth.uid();resolved text;
begin
  if not public.pinpoint_active_session(requester,nullif(auth.jwt()->>'session_id','')::uuid) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if target_mode is null or target_mode not in ('auto','available','busy','invisible') then
    raise exception 'Invalid availability mode' using errcode='22023';
  end if;
  resolved:=case target_mode when 'available' then 'available' when 'busy' then 'busy' else 'offline' end;
  update public.profiles set availability_mode=target_mode,presence_status=resolved,
    last_seen_at=case when resolved='offline' then last_seen_at else pg_catalog.now() end,
    updated_at=pg_catalog.now() where id=requester;
  if not found then raise exception 'Profile not found'; end if;
  return query select target_mode,resolved;
end;
$$;
revoke all on function private.set_availability_mode(text) from public,anon,authenticated,service_role;
grant execute on function private.set_availability_mode(text) to authenticated;

create or replace function public.set_availability_mode(target_mode text)
returns table(availability_mode text,presence_status text)
language sql security invoker set search_path='' as $$ select * from private.set_availability_mode(target_mode); $$;
revoke all on function public.set_availability_mode(text) from public,anon,authenticated,service_role;
grant execute on function public.set_availability_mode(text) to authenticated;

-- The existing application uses the guarded RPC; a raw self-row write must not
-- bypass its session check or leave mode and resolved presence inconsistent.
revoke update(availability_mode) on public.profiles from authenticated;

notify pgrst,'reload schema';
commit;
