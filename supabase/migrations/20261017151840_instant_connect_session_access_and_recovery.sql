begin;

-- A JWT must stop exposing or changing private showings when its live Auth
-- session ends. Caller identity is read only from the verified request claims.
create function public.showing_session_access() returns boolean
language sql stable security definer set search_path='' as $$
  select private.rental_viewing_account_eligible(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function public.showing_session_access() from public,anon,authenticated,service_role;
grant execute on function public.showing_session_access() to authenticated,service_role;
create policy "Live showing sessions only" on public.showing_requests
  as restrictive for select to authenticated using ((select public.showing_session_access()));

create function private.request_showing(target_listing_id uuid,window_choice public.showing_window,eta_minutes int default null)
returns table(result text,request_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  requester uuid:=auth.uid();
  listing public.listings%rowtype;
  owner public.profiles%rowtype;
  existing public.showing_requests%rowtype;
  new_id uuid;
  available_now boolean;
begin
  if requester is null or not public.showing_session_access() then
    return query select 'access_denied'::text,null::uuid;return;
  end if;
  if window_choice is null or (eta_minutes is not null and eta_minutes not between 0 and 1440) then
    return query select 'invalid_input'::text,null::uuid;return;
  end if;
  -- Serialize same-home insert/retry/expiry decisions and publication changes.
  -- No network or provider work occurs inside this short transaction.
  select * into listing from public.listings l where l.id=target_listing_id for update;
  if not found or listing.status<>'published'
    or exists(select 1 from public.listing_restrictions r where r.listing_id=listing.id and r.restored_at is null) then
    return query select 'listing_unavailable'::text,null::uuid;return;
  end if;
  if listing.landlord_id=requester then
    return query select 'own_listing'::text,null::uuid;return;
  end if;
  if exists(select 1 from public.profile_blocks b
    where (b.blocker_id=requester and b.blocked_id=listing.landlord_id)
       or (b.blocker_id=listing.landlord_id and b.blocked_id=requester)) then
    return query select 'access_denied'::text,null::uuid;return;
  end if;
  select * into owner from public.profiles p where p.id=listing.landlord_id for share;
  if not found or exists(select 1 from public.account_suspensions s where s.user_id=owner.id
    and s.restored_at is null and (s.suspended_until is null or s.suspended_until>statement_timestamp()))
    or exists(select 1 from auth.users u where u.id=owner.id and u.banned_until>statement_timestamp()) then
    return query select 'listing_unavailable'::text,null::uuid;return;
  end if;
  select * into existing from public.showing_requests s
    where s.listing_id=listing.id and s.renter_id=requester and s.status in ('requested','accepted','checked_in')
    order by s.requested_at desc,s.id limit 1 for update;
  if found then
    if existing.status='requested' and existing.expires_at<statement_timestamp() then
      update public.showing_requests set status='expired' where id=existing.id;
    else
      -- Retain the established result tag, but include the canonical ID so a
      -- caller can recover an uncertain committed response without a new row.
      return query select 'request_in_progress'::text,existing.id;return;
    end if;
  end if;
  available_now:=
    (owner.availability_mode='available' and owner.last_seen_at>=statement_timestamp()-interval '20 minutes')
    or (owner.availability_mode='auto' and owner.last_seen_at>=statement_timestamp()-interval '90 seconds'
      and not exists(select 1 from public.call_sessions c where c.status in ('ringing','active') and owner.id in (c.caller_id,c.callee_id))
      and not exists(select 1 from public.showing_requests s where s.landlord_id=owner.id and s.status in ('accepted','checked_in')));
  if window_choice='now' and not coalesce(available_now,false) then
    return query select 'landlord_unavailable'::text,null::uuid;return;
  end if;
  new_id:=gen_random_uuid();
  insert into public.showing_requests(id,listing_id,renter_id,landlord_id,status,window_choice,eta_minutes,expires_at)
    values(new_id,listing.id,requester,listing.landlord_id,'requested',window_choice,eta_minutes,public.showing_window_expiry(window_choice));
  return query select 'requested'::text,new_id;
end;
$$;
revoke all on function private.request_showing(uuid,public.showing_window,int) from public,anon,authenticated,service_role;
grant execute on function private.request_showing(uuid,public.showing_window,int) to authenticated;

create or replace function public.request_showing(target_listing_id uuid,window_choice public.showing_window,eta_minutes int default null)
returns table(result text,request_id uuid)
language sql security invoker set search_path='' as $$
  select * from private.request_showing(target_listing_id,window_choice,eta_minutes);
$$;
revoke all on function public.request_showing(uuid,public.showing_window,int) from public,anon,authenticated,service_role;
grant execute on function public.request_showing(uuid,public.showing_window,int) to authenticated;

create function private.respond_showing(target_request_id uuid,action text)
returns table(result text,new_status text)
language plpgsql security definer set search_path='' as $$
declare
  req public.showing_requests%rowtype;
  listing public.listings%rowtype;
  requester uuid:=auth.uid();
  next_status public.showing_status;
  resolved_conversation_id uuid;
begin
  if requester is null or not public.showing_session_access() then
    return query select 'access_denied'::text,null::text;return;
  end if;
  if action is null or action not in ('accept','decline','check_in','complete','cancel') then
    return query select 'invalid_transition'::text,null::text;return;
  end if;
  select * into req from public.showing_requests s where s.id=target_request_id;
  if not found or requester not in (req.renter_id,req.landlord_id) then
    return query select 'access_denied'::text,null::text;return;
  end if;
  -- Same listing -> request lock order as request creation/expiry recovery.
  select * into listing from public.listings l where l.id=req.listing_id for share;
  if not found then return query select 'access_denied'::text,null::text;return;end if;
  select * into req from public.showing_requests s where s.id=target_request_id and s.listing_id=listing.id for update;
  if not found or requester not in (req.renter_id,req.landlord_id)
    or (action in ('accept','decline') and requester<>req.landlord_id)
    or (action='check_in' and requester<>req.renter_id) then
    return query select 'access_denied'::text,null::text;return;
  end if;
  if req.status in ('declined','completed','cancelled','expired') then
    return query select 'noop'::text,req.status::text;return;
  end if;
  if req.status='requested' and req.expires_at<statement_timestamp() then
    update public.showing_requests set status='expired' where id=req.id;
    return query select 'noop'::text,'expired'::text;return;
  end if;
  -- Cancellation/completion remain available to eligible participants after
  -- listing withdrawal or a block; new coordination may not cross that guard.
  if action in ('accept','check_in') and (listing.status<>'published' or listing.landlord_id<>req.landlord_id
    or exists(select 1 from public.listing_restrictions r where r.listing_id=listing.id and r.restored_at is null)
    or exists(select 1 from public.profile_blocks b where (b.blocker_id=req.renter_id and b.blocked_id=req.landlord_id)
      or (b.blocker_id=req.landlord_id and b.blocked_id=req.renter_id))) then
    return query select 'access_denied'::text,null::text;return;
  end if;
  if (action='accept' and req.status in ('accepted','checked_in')) or (action='check_in' and req.status='checked_in') then
    return query select 'noop'::text,req.status::text;return;
  end if;
  next_status:=case
    when action='accept' and req.status='requested' then 'accepted'
    when action='decline' and req.status='requested' then 'declined'
    when action='check_in' and req.status='accepted' then 'checked_in'
    when action='complete' and req.status='checked_in' then 'completed'
    when action='cancel' then 'cancelled'
    else null end;
  if next_status is null then return query select 'invalid_transition'::text,req.status::text;return;end if;
  if next_status='accepted' then
    insert into public.conversations(listing_id,renter_id,landlord_id,type)
      values(req.listing_id,req.renter_id,req.landlord_id,'inquiry')
      on conflict(listing_id,renter_id) do update set landlord_id=excluded.landlord_id returning id into resolved_conversation_id;
  end if;
  update public.showing_requests set status=next_status,
    conversation_id=case when next_status='accepted' then resolved_conversation_id else conversation_id end,
    responded_at=case when next_status in ('accepted','declined') then statement_timestamp() else responded_at end,
    checked_in_at=case when next_status='checked_in' then statement_timestamp() else checked_in_at end,
    completed_at=case when next_status='completed' then statement_timestamp() else completed_at end
    where id=req.id;
  return query select 'updated'::text,next_status::text;
end;
$$;
revoke all on function private.respond_showing(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.respond_showing(uuid,text) to authenticated;

create or replace function public.respond_showing(target_request_id uuid,action text)
returns table(result text,new_status text)
language sql security invoker set search_path='' as $$
  select * from private.respond_showing(target_request_id,action);
$$;
revoke all on function public.respond_showing(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.respond_showing(uuid,text) to authenticated;

-- Keep existing participant policies, reads, indexes and history. No raw
-- mutations are granted and no historical request is rewritten by migration.
notify pgrst,'reload schema';
commit;
