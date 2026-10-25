-- Call access must end with its Auth session. Ring expiry and transcript
-- persistence must also work when neither browser remains open.
begin;

create function public.call_session_access() returns boolean
language sql stable security definer set search_path='' as $$
  select public.pinpoint_active_session(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function public.call_session_access() from public,anon;
grant execute on function public.call_session_access() to authenticated,service_role;

-- Retain existing participant/admin policies and narrow them with live access.
create policy "Live call sessions only" on public.call_sessions
  as restrictive for select to authenticated
  using ((select public.call_session_access()));

-- Public clients mutate calls only through the guarded state-machine RPCs.
-- Service maintenance and the existing privileged admin adapters keep access.
revoke insert,update,delete,truncate,references,trigger on public.call_sessions from public,anon,authenticated;

-- The established notification key index is partial. Its predicate must be
-- present for PostgreSQL to infer it; retain the helper's existing ownership
-- and grants while repairing the canonical enqueue path used below.
create or replace function private.notification_enqueue(recipient uuid,event_type public.notification_type,cat public.notification_category,
 unique_key text,body jsonb,actor uuid default null,source text default null,target uuid default null)
 returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid; sender_name text;
begin
 if actor is not null then
   sender_name:=private.notification_actor_label(actor);
   if sender_name is not null then
     body:=body||jsonb_build_object('senderName',sender_name,'senderUsername',(select username from public.public_profiles where profile_id=actor));
   end if;
 end if;
 insert into public.notification_events(recipient_id,type,category,idempotency_key,payload,actor_id,source_kind,source_id)
 values(recipient,event_type,cat,unique_key,body,actor,source,target)
 on conflict(idempotency_key) where idempotency_key is not null do nothing returning id into event_id;
 return event_id;
end; $$;

create function private.call_terminal_transcript() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status not in ('ringing','active') or new.status not in ('ended','declined','missed') then return new; end if;
  -- Background expiry has no application outbox caller. Use the same canonical
  -- enqueue path and key, including its eligibility and preference triggers.
  if new.status in ('missed','declined') then
    begin
      perform private.notification_enqueue(new.caller_id,'incoming_call','messages',
        'incoming_call:'||new.status::text||':'||new.id,
        jsonb_build_object('kind',new.status::text,'message',
          case when new.status='missed' then 'Your call was missed.' else 'Your call was declined.' end,
          'conversationId',new.conversation_id,'listingId',new.listing_id),new.callee_id,'call',new.id);
    exception when others then
      -- Notification storage remains optional, as it is for application
      -- outbox calls. A terminal retry can repair the alert under the same key.
      -- Log only SQLSTATE, never message bodies, account IDs or credentials.
      raise log 'Call notification enqueue failed (SQLSTATE %)',sqlstate;
    end;
  end if;
  insert into public.messages(system_call_id,conversation_id,listing_id,sender_id,content)
  values(new.id,new.conversation_id,new.listing_id,new.caller_id,
    case when new.answered_at is not null then 'Video call ended.'
      when new.status='missed' then 'Missed video call.'
      when new.status='declined' then 'Video call declined.' else 'Video call cancelled.' end)
  on conflict(system_call_id) where system_call_id is not null do nothing;
  return new;
end; $$;
revoke all on function private.call_terminal_transcript() from public,anon,authenticated;
create trigger call_terminal_transcript after update of status on public.call_sessions
  for each row execute function private.call_terminal_transcript();

create function private.expire_call_sessions(target_conversation_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  if target_conversation_id is not null then
    update public.call_sessions set status='missed',ended_at=statement_timestamp()
      where conversation_id=target_conversation_id and status='ringing'
        and started_at<=statement_timestamp()-interval '30 seconds';
  else
    with targets as (
      select id from public.call_sessions where status='ringing'
        and started_at<=statement_timestamp()-interval '30 seconds'
      order by started_at,id limit 500 for update skip locked
    )
    update public.call_sessions c set status='missed',ended_at=statement_timestamp()
      from targets t where c.id=t.id and c.status='ringing';
  end if;
  get diagnostics affected = row_count;
  return affected;
end; $$;
revoke all on function private.expire_call_sessions(uuid) from public,anon,authenticated;
grant execute on function private.expire_call_sessions(uuid) to service_role;
create index call_sessions_ring_expiry_idx on public.call_sessions(started_at,id) where status='ringing';

create or replace function public.start_call_session(target_conversation_id uuid,requested_media_mode text)
returns table(result text,session_id uuid)
language plpgsql security definer set search_path='' as $$
declare convo public.conversations%rowtype; requester uuid:=auth.uid(); new_id uuid:=extensions.gen_random_uuid(); room text;
begin
  if requester is null or not public.call_session_access() then
    return query select 'unauthenticated'::text,null::uuid; return;
  end if;
  select * into convo from public.conversations where id=target_conversation_id for no key update;
  if convo.id is null or requester not in (convo.renter_id,convo.landlord_id) then
    return query select 'access_denied'::text,null::uuid; return;
  end if;
  perform private.expire_call_sessions(convo.id);
  room:='roomza-call-'||replace(new_id::text,'-','');
  begin
    insert into public.call_sessions(id,conversation_id,listing_id,caller_id,callee_id,status,room_id,join_url,media_mode)
    values(new_id,convo.id,convo.listing_id,requester,
      case when requester=convo.renter_id then convo.landlord_id else convo.renter_id end,
      'ringing',room,'https://meet.jit.si/'||room,case when requested_media_mode='voice' then 'voice' else 'video' end);
  exception when unique_violation then
    return query select 'call_in_progress'::text,null::uuid; return;
  end;
  return query select 'started'::text,new_id;
end; $$;

create or replace function public.end_call_session(target_session_id uuid,action text)
returns table(result text,new_status text)
language plpgsql security definer set search_path='' as $$
declare sess public.call_sessions%rowtype; convo public.conversations%rowtype; requester uuid:=auth.uid(); next_status public.call_status;
begin
  if requester is null or not public.call_session_access() then
    return query select 'access_denied'::text,null::text; return;
  end if;
  select * into sess from public.call_sessions where id=target_session_id;
  if sess.id is null then return query select 'access_denied'::text,null::text; return; end if;
  -- Consistent conversation -> session locking; NO KEY UPDATE remains
  -- compatible with transcript foreign-key checks during the expiry batch.
  select * into convo from public.conversations where id=sess.conversation_id for no key update;
  if convo.id is null or requester not in (convo.renter_id,convo.landlord_id) then
    return query select 'access_denied'::text,null::text; return;
  end if;
  select * into sess from public.call_sessions where id=target_session_id for update;
  if sess.conversation_id<>convo.id or sess.listing_id<>convo.listing_id
    or not ((sess.caller_id=convo.renter_id and sess.callee_id=convo.landlord_id)
      or (sess.caller_id=convo.landlord_id and sess.callee_id=convo.renter_id)) then
    return query select 'access_denied'::text,null::text; return;
  end if;
  perform private.expire_call_sessions(convo.id);
  select * into sess from public.call_sessions where id=target_session_id;
  if sess.status in ('ended','declined','missed') then
    return query select 'noop'::text,sess.status::text; return;
  end if;
  next_status:=case
    when action='join' and sess.status='ringing' and requester=sess.callee_id then 'active'::public.call_status
    when action='decline' and sess.status='ringing' and requester=sess.callee_id then 'declined'::public.call_status
    when action='end' then 'ended'::public.call_status
    else null end;
  if next_status is null then return query select 'invalid_transition'::text,sess.status::text; return; end if;
  update public.call_sessions set status=next_status,
    answered_at=case when next_status='active' then statement_timestamp() else answered_at end,
    ended_at=case when next_status in ('ended','declined') then statement_timestamp() else ended_at end
    where id=target_session_id;
  return query select 'updated'::text,next_status::text;
end; $$;

create function public.get_active_call_session(target_conversation_id uuid)
returns setof public.call_sessions
language plpgsql security definer set search_path='' as $$
declare convo public.conversations%rowtype; requester uuid:=auth.uid();
begin
  if requester is null or not public.call_session_access() then
    raise exception 'Call session access denied' using errcode='42501';
  end if;
  select * into convo from public.conversations where id=target_conversation_id for no key update;
  if convo.id is null or requester not in (convo.renter_id,convo.landlord_id) then return; end if;
  perform private.expire_call_sessions(convo.id);
  return query select c.* from public.call_sessions c where c.conversation_id=convo.id
    and c.status in ('ringing','active') and c.listing_id=convo.listing_id
    and ((c.caller_id=convo.renter_id and c.callee_id=convo.landlord_id)
      or (c.caller_id=convo.landlord_id and c.callee_id=convo.renter_id));
end; $$;
revoke all on function public.get_active_call_session(uuid) from public,anon;
grant execute on function public.get_active_call_session(uuid) to authenticated;
-- CREATE OR REPLACE retains the prior guarded RPC ACL/ownership; assert those
-- same ordinary-role grants explicitly without granting anon/public access.
revoke all on function public.start_call_session(uuid,text),public.end_call_session(uuid,text) from public,anon;
grant execute on function public.start_call_session(uuid,text),public.end_call_session(uuid,text) to authenticated;

-- No historical calls are rewritten by the migration. The bounded job applies
-- the same terminal transition after deployment even when all tabs are closed.
select cron.schedule('pinpoint-call-session-expiry','* * * * *','select private.expire_call_sessions();');
notify pgrst,'reload schema';
commit;
