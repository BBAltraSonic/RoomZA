-- A proposal is one transaction. The expected buyer revision also identifies a
-- retry after a committed request whose response was lost. No ordinary-role API
-- access is granted to the receipt table or privileged actor/session function.
create table public.buyer_viewing_proposals (
  buyer_interest_id uuid not null references public.buyer_interests(id) on delete cascade,
  expected_updated_at timestamptz not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  mode public.viewing_mode not null,
  slots jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (buyer_interest_id, expected_updated_at)
);
alter table public.buyer_viewing_proposals enable row level security;
alter table public.buyer_viewing_proposals force row level security;
revoke all on table public.buyer_viewing_proposals from public, anon, authenticated;
grant select, insert on table public.buyer_viewing_proposals to service_role;

create function public.pinpoint_buyer_viewing_propose(
  actor_id uuid, actor_session_id uuid, target uuid,
  expected_updated_at timestamptz, proposed_mode public.viewing_mode, proposed_slots jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  interest public.buyer_interests%rowtype;
  listing public.listings%rowtype;
  receipt public.buyer_viewing_proposals%rowtype;
  slot jsonb;
  slot_start timestamptz;
  slot_end timestamptz;
  first_start timestamptz;
  slot_id uuid;
  reply jsonb;
begin
  if not public.pinpoint_active_session(actor_id,actor_session_id)
    or not exists (select 1 from public.profile_personas p where p.profile_id=actor_id and p.persona='seller') then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if expected_updated_at is null or proposed_mode is null or proposed_slots is null
    or jsonb_typeof(proposed_slots) <> 'array' then
    raise exception 'Invalid proposal' using errcode='22023';
  end if;
  if jsonb_array_length(proposed_slots) not between 1 and 20 then
    raise exception 'Invalid proposal' using errcode='22023';
  end if;
  select * into interest from public.buyer_interests i where i.id=target and i.seller_id=actor_id for update;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select * into listing from public.listings l where l.id=interest.listing_id and l.landlord_id=actor_id and l.listing_type='sale' for share;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  -- Keep organization ownership/revocation checks even for the original creator.
  if listing.organization_id is not null then
    perform 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
      join public.profiles p on p.id=m.user_id and p.active_organization_id=m.organization_id
      where m.user_id=actor_id and m.organization_id=listing.organization_id
        and m.role in ('owner','admin') and m.revoked_at is null and o.deleted_at is null for share of m,o,p;
    if not found then raise exception 'Access denied' using errcode='42501'; end if;
  end if;
  select * into receipt from public.buyer_viewing_proposals p
    where p.buyer_interest_id=target and p.expected_updated_at=pinpoint_buyer_viewing_propose.expected_updated_at;
  if found then
    -- Never advance a stale editor over an unrelated edit during a replay.
    if receipt.actor_id is distinct from actor_id or receipt.mode is distinct from proposed_mode
      or receipt.slots is distinct from proposed_slots
      or interest.updated_at is distinct from (receipt.result->>'updatedAt')::timestamptz then
      raise exception 'Interest changed; reload' using errcode='PT409';
    end if;
    return receipt.result;
  end if;
  if interest.updated_at is distinct from expected_updated_at then
    raise exception 'Interest changed; reload' using errcode='PT409';
  end if;
  if exists (select 1 from jsonb_array_elements(proposed_slots) s group by s->>'startTime',s->>'endTime' having count(*)>1) then
    raise exception 'Duplicate slots' using errcode='22023';
  end if;
  for slot in select value from jsonb_array_elements(proposed_slots) loop
    slot_start := (slot->>'startTime')::timestamptz;
    slot_end := (slot->>'endTime')::timestamptz;
    if slot_start is null or slot_end is null or not isfinite(slot_start) or not isfinite(slot_end)
      or slot_start <= statement_timestamp() or slot_end <= slot_start then
      raise exception 'Invalid viewing time' using errcode='22023';
    end if;
    if first_start is null then first_start:=slot_start; end if;
    insert into public.viewing_slots(listing_id,created_by,start_time,end_time,mode,is_booked)
      values(interest.listing_id,actor_id,slot_start,slot_end,proposed_mode,false) returning id into slot_id;
    insert into public.viewing_slot_offers(slot_id,buyer_interest_id) values(slot_id,target);
  end loop;
  update public.buyer_interests i set viewing_date=first_start,
    updated_at=greatest(clock_timestamp(),interest.updated_at+interval '1 microsecond')
    where i.id=target returning * into interest;
  reply:=jsonb_build_object('updatedAt',interest.updated_at,'viewingDate',interest.viewing_date);
  insert into public.buyer_viewing_proposals(buyer_interest_id,expected_updated_at,actor_id,mode,slots,result)
    values(target,expected_updated_at,actor_id,proposed_mode,proposed_slots,reply);
  return reply;
end;
$$;
revoke all on function public.pinpoint_buyer_viewing_propose(uuid,uuid,uuid,timestamptz,public.viewing_mode,jsonb) from public,anon,authenticated;
grant execute on function public.pinpoint_buyer_viewing_propose(uuid,uuid,uuid,timestamptz,public.viewing_mode,jsonb) to service_role;
