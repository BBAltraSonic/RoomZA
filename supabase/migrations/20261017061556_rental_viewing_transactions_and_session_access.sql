begin;

-- Request receipts contain no documents. They bind an owner's attempt to its
-- exact proposal and let an uncertain committed response be retried safely.
create table public.rental_viewing_proposals (
  id uuid primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  application_ids uuid[] not null,
  mode public.viewing_mode not null,
  slots jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.rental_viewing_proposals enable row level security;
alter table public.rental_viewing_proposals force row level security;
revoke all on table public.rental_viewing_proposals from public,anon,authenticated;
grant select,insert on table public.rental_viewing_proposals to service_role;

create function private.rental_viewing_account_eligible(actor_id uuid,actor_session_id uuid)
returns boolean language sql security invoker set search_path='' as $$
  select public.pinpoint_active_session(actor_id,actor_session_id)
    and not exists (
      select 1 from public.trust_document_versions v
      join public.trust_documents d on d.current_version_id=v.id
      where v.status='published' and v.requires_reacceptance
        and v.effective_at<=statement_timestamp()
        and not exists(select 1 from public.policy_acceptances a where a.user_id=actor_id and a.version_id=v.id)
    );
$$;
revoke all on function private.rental_viewing_account_eligible(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.rental_viewing_account_eligible(uuid,uuid) to service_role;

create function public.pinpoint_rental_viewing_propose(
  actor_id uuid,actor_session_id uuid,proposal_id uuid,target_listing_id uuid,
  target_application_ids uuid[],proposed_mode public.viewing_mode,proposed_slots jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  listing public.listings%rowtype;
  receipt public.rental_viewing_proposals%rowtype;
  application public.applications%rowtype;
  recipients uuid[];
  locked_count integer:=0;
  slot jsonb;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_id uuid;
  slot_booked boolean;
  slot_ids uuid[]:='{}';
  reply jsonb;
begin
  if not private.rental_viewing_account_eligible(actor_id,actor_session_id)
    or not exists(select 1 from public.profile_personas p where p.profile_id=actor_id and p.persona in ('landlord','seller')) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if proposal_id is null or target_listing_id is null or proposed_mode is null
    or target_application_ids is null or cardinality(target_application_ids)=0
    or array_position(target_application_ids,null) is not null
    or proposed_slots is null or jsonb_typeof(proposed_slots)<>'array' then
    raise exception 'Invalid proposal' using errcode='22023';
  end if;
  select array_agg(distinct target order by target) into recipients from unnest(target_application_ids) target;
  if cardinality(recipients)<>cardinality(target_application_ids) or jsonb_array_length(proposed_slots) not between 1 and 20 then
    raise exception 'Invalid proposal' using errcode='22023';
  end if;
  -- Every proposal for one home uses this lock, including retries with a new
  -- form instance. Exact existing slots/offers can be reused without duplicates.
  select * into listing from public.listings l where l.id=target_listing_id for update;
  if not found or listing.listing_type<>'rent' or exists(select 1 from public.listing_restrictions r where r.listing_id=listing.id and r.restored_at is null) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if listing.organization_id is null then
    if listing.landlord_id<>actor_id then raise exception 'Access denied' using errcode='42501'; end if;
  else
    perform 1 from public.organization_memberships m
      join public.organizations o on o.id=m.organization_id
      join public.profiles p on p.id=m.user_id and p.active_organization_id=m.organization_id
      where m.user_id=actor_id and m.organization_id=listing.organization_id
        and m.role in ('owner','admin') and m.revoked_at is null and o.deleted_at is null for share of m,o,p;
    if not found then raise exception 'Access denied' using errcode='42501'; end if;
  end if;
  for application in select * from public.applications a where a.id=any(recipients) order by a.id for share loop
    if application.listing_id<>listing.id or application.status in ('withdrawn','rejected') then
      raise exception 'Application unavailable' using errcode='42501';
    end if;
    locked_count:=locked_count+1;
  end loop;
  if locked_count<>cardinality(recipients) then raise exception 'Application unavailable' using errcode='42501'; end if;
  select * into receipt from public.rental_viewing_proposals p where p.id=proposal_id;
  if found then
    if receipt.actor_id<>actor_id or receipt.listing_id<>listing.id or receipt.application_ids<>recipients
      or receipt.mode<>proposed_mode or receipt.slots<>proposed_slots then
      raise exception 'Proposal changed; reload before sending different times' using errcode='PT409';
    end if;
    return receipt.result;
  end if;
  if exists(select 1 from jsonb_array_elements(proposed_slots) s group by s->>'startTime',s->>'endTime' having count(*)>1) then
    raise exception 'Duplicate slots' using errcode='22023';
  end if;
  for slot in select value from jsonb_array_elements(proposed_slots) loop
    slot_start:=(slot->>'startTime')::timestamptz;slot_end:=(slot->>'endTime')::timestamptz;
    if slot_start is null or slot_end is null or not isfinite(slot_start) or not isfinite(slot_end)
      or slot_start<=statement_timestamp() or slot_end<=slot_start then
      raise exception 'Invalid viewing time' using errcode='22023';
    end if;
    select s.id,s.is_booked into slot_id,slot_booked from public.viewing_slots s
      where s.listing_id=listing.id and s.start_time=slot_start and s.end_time=slot_end and s.mode=proposed_mode
      order by s.created_at,s.id limit 1 for update;
    if found and slot_booked then raise exception 'Viewing time is already booked' using errcode='PT409'; end if;
    if not found then
      insert into public.viewing_slots(listing_id,created_by,start_time,end_time,mode,is_booked)
        values(listing.id,actor_id,slot_start,slot_end,proposed_mode,false) returning id into slot_id;
    end if;
    insert into public.viewing_slot_offers(slot_id,application_id)
      select slot_id,target from unnest(recipients) target
      on conflict on constraint unique_slot_offer do nothing;
    slot_ids:=array_append(slot_ids,slot_id);
  end loop;
  reply:=jsonb_build_object('slotIds',slot_ids);
  insert into public.rental_viewing_proposals(id,actor_id,listing_id,application_ids,mode,slots,result)
    values(proposal_id,actor_id,listing.id,recipients,proposed_mode,proposed_slots,reply);
  return reply;
end;
$$;
revoke all on function public.pinpoint_rental_viewing_propose(uuid,uuid,uuid,uuid,uuid[],public.viewing_mode,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.pinpoint_rental_viewing_propose(uuid,uuid,uuid,uuid,uuid[],public.viewing_mode,jsonb) to service_role;

-- The unexposed helper is the sole ordinary-account booking mutation boundary.
-- Its caller identity always comes from verified JWT claims, never parameters.
-- Encapsulation permits revoking raw table writes while preserving the public
-- two-argument RPC contract and its existing row-lock concurrency semantics.
create function private.book_rental_viewing_slot(target_slot_id uuid,target_application_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid();
  actor_session_id uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  application public.applications%rowtype;
  listing public.listings%rowtype;
  slot public.viewing_slots%rowtype;
  previous public.viewings%rowtype;
  new_id uuid;
  room_id text;
begin
  if not private.rental_viewing_account_eligible(actor_id,actor_session_id) then
    raise exception 'Active signed-in account required' using errcode='42501';
  end if;
  select * into application from public.applications a where a.id=target_application_id and a.renter_id=actor_id;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select * into listing from public.listings l where l.id=application.listing_id for share;
  if not found or listing.listing_type<>'rent' or exists(select 1 from public.listing_restrictions r where r.listing_id=listing.id and r.restored_at is null) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  select * into application from public.applications a
    where a.id=target_application_id and a.renter_id=actor_id and a.listing_id=listing.id for update;
  if not found or application.status in ('withdrawn','rejected') then raise exception 'Application unavailable' using errcode='42501'; end if;
  select * into slot from public.viewing_slots s where s.id=target_slot_id and s.listing_id=listing.id for update;
  if not found then raise exception 'Slot unavailable' using errcode='42501'; end if;
  perform 1 from public.viewing_slot_offers o where o.slot_id=slot.id and o.application_id=application.id for share;
  if not found then raise exception 'Slot was not offered to this applicant' using errcode='42501'; end if;
  select * into previous from public.viewings v where v.slot_id=slot.id;
  if found then
    if previous.application_id=application.id and previous.status<>'cancelled' then return previous.id; end if;
    raise exception 'Slot already booked' using errcode='PT409';
  end if;
  if slot.is_booked or slot.start_time<=statement_timestamp() or slot.end_time<=slot.start_time then
    raise exception 'Slot no longer available' using errcode='PT409';
  end if;
  new_id:=gen_random_uuid();
  if slot.mode='video_call' then room_id:='roomza-'||replace(new_id::text,'-',''); end if;
  update public.viewing_slots set is_booked=true where id=slot.id;
  insert into public.viewings(id,application_id,slot_id,status,meeting_provider,meeting_room_id,meeting_join_url,meeting_starts_at,meeting_ends_at)
    values(new_id,application.id,slot.id,'booked',case when slot.mode='video_call' then 'jitsi' end,room_id,
      case when slot.mode='video_call' then 'https://meet.jit.si/'||room_id end,
      case when slot.mode='video_call' then slot.start_time end,case when slot.mode='video_call' then slot.end_time end);
  return new_id;
end;
$$;
revoke all on function private.book_rental_viewing_slot(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.book_rental_viewing_slot(uuid,uuid) to authenticated;

create or replace function public.book_viewing_slot_atomic(target_slot_id uuid,target_application_id uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.book_rental_viewing_slot(target_slot_id,target_application_id);
$$;
revoke all on function public.book_viewing_slot_atomic(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.book_viewing_slot_atomic(uuid,uuid) to authenticated;

-- Buyer booking shares the same tables and must retain an authorized mutation
-- boundary when raw writes are removed. Keep its existing public signature.
create function private.book_buyer_viewing_slot(target_slot_id uuid,target_buyer_interest_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid();
  actor_session_id uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
  interest public.buyer_interests%rowtype;
  listing public.listings%rowtype;
  slot public.viewing_slots%rowtype;
  previous public.viewings%rowtype;
  new_id uuid;
  room_id text;
begin
  if not private.rental_viewing_account_eligible(actor_id,actor_session_id) then
    raise exception 'Active signed-in account required' using errcode='42501';
  end if;
  -- The seller proposal transaction also locks interest before listing.
  select * into interest from public.buyer_interests i
    where i.id=target_buyer_interest_id and i.buyer_id=actor_id for update;
  if not found or interest.status='declined' then raise exception 'Buyer interest unavailable' using errcode='42501'; end if;
  select * into listing from public.listings l where l.id=interest.listing_id for share;
  if not found or listing.listing_type<>'sale' or listing.landlord_id=actor_id
    or listing.landlord_id<>interest.seller_id
    or exists(select 1 from public.listing_restrictions r where r.listing_id=listing.id and r.restored_at is null) then
    raise exception 'Sale listing unavailable' using errcode='42501';
  end if;
  select * into slot from public.viewing_slots s where s.id=target_slot_id and s.listing_id=listing.id for update;
  if not found then raise exception 'Slot unavailable' using errcode='42501'; end if;
  perform 1 from public.viewing_slot_offers o where o.slot_id=slot.id and o.buyer_interest_id=interest.id for share;
  if not found then raise exception 'Slot was not offered to this buyer' using errcode='42501'; end if;
  select * into previous from public.viewings v where v.slot_id=slot.id;
  if found then
    if previous.buyer_interest_id=interest.id and previous.status<>'cancelled' then return previous.id; end if;
    raise exception 'Slot already booked' using errcode='PT409';
  end if;
  if slot.is_booked or slot.start_time<=statement_timestamp() or slot.end_time<=slot.start_time then
    raise exception 'Slot no longer available' using errcode='PT409';
  end if;
  new_id:=gen_random_uuid();
  if slot.mode='video_call' then room_id:='roomza-'||replace(new_id::text,'-',''); end if;
  update public.viewing_slots set is_booked=true where id=slot.id;
  insert into public.viewings(id,buyer_interest_id,slot_id,status,meeting_provider,meeting_room_id,meeting_join_url,meeting_starts_at,meeting_ends_at)
    values(new_id,interest.id,slot.id,'booked',case when slot.mode='video_call' then 'jitsi' end,room_id,
      case when slot.mode='video_call' then 'https://meet.jit.si/'||room_id end,
      case when slot.mode='video_call' then slot.start_time end,case when slot.mode='video_call' then slot.end_time end);
  return new_id;
end;
$$;
revoke all on function private.book_buyer_viewing_slot(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.book_buyer_viewing_slot(uuid,uuid) to authenticated;

create or replace function public.book_buyer_viewing_slot_atomic(target_slot_id uuid,target_buyer_interest_id uuid)
returns uuid language sql security invoker set search_path='' as $$
  select private.book_buyer_viewing_slot(target_slot_id,target_buyer_interest_id);
$$;
revoke all on function public.book_buyer_viewing_slot_atomic(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.book_buyer_viewing_slot_atomic(uuid,uuid) to authenticated;

-- Application writes now use the guarded proposal/booking transaction APIs.
-- Read grants and RLS stay in place; no historical row is rewritten.
revoke insert,update,delete on public.viewing_slots,public.viewing_slot_offers,public.viewings from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
