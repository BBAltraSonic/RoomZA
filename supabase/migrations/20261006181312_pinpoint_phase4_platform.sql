create function public.pinpoint_active_session(actor_id uuid, actor_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Narrow privileged bridge: service_role has no direct auth.sessions locking grant.
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=actor_session_id and s.user_id=actor_id for share of s,u;
  if not found then return false; end if;
  return exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
      join public.profiles p on p.id=u.id
    where s.id=actor_session_id and s.user_id=actor_id
      and (s.not_after is null or s.not_after > statement_timestamp())
      and u.email_confirmed_at is not null and p.email_verified_at is not null
      and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until <= statement_timestamp())
      and not exists (select 1 from public.account_suspensions a where a.user_id=u.id
        and a.restored_at is null and (a.suspended_until is null or a.suspended_until > statement_timestamp()))
  );
end;
$$;
revoke all on function public.pinpoint_active_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pinpoint_active_session(uuid,uuid) to service_role;

-- One transaction for status, private notes and the buyer's progress.
create function public.pinpoint_buyer_interest_save(
  actor_id uuid, actor_session_id uuid, target uuid, expected_updated_at timestamptz,
  next_status public.buyer_interest_status, next_viewing_date timestamptz, private_notes text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  interest public.buyer_interests%rowtype;
  progress public.purchase_progress%rowtype;
  completed public.purchase_stage[];
  stage public.purchase_stage;
  stages public.purchase_stage[] := array['property_saved','viewing_scheduled','viewing_completed','contacted_seller','negotiating','sale_agreed','purchase_complete']::public.purchase_stage[];
  current public.purchase_stage;
begin
  if not public.pinpoint_active_session(actor_id,actor_session_id)
    or not exists (select 1 from public.profile_personas where profile_id=actor_id and persona='seller') then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if next_status is null or (private_notes is not null and length(private_notes)>2000) then
    raise exception 'Invalid input' using errcode='22023';
  end if;
  select * into interest from public.buyer_interests where id=target and seller_id=actor_id for update;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if expected_updated_at is null or interest.updated_at is distinct from expected_updated_at then
    raise exception 'Interest changed; reload' using errcode='PT409';
  end if;
  update public.buyer_interests set status=next_status, viewing_date=next_viewing_date,
    updated_at=greatest(clock_timestamp(),interest.updated_at+interval '1 microsecond')
    where id=target returning * into interest;
  if private_notes is not null then
    insert into public.buyer_interest_private_notes(buyer_interest_id,seller_id,notes)
      values(target,actor_id,private_notes) on conflict(buyer_interest_id)
      do update set notes=excluded.notes,updated_at=clock_timestamp();
  end if;
  if next_status in ('negotiating','accepted') then
    stage := case when next_status='accepted' then 'sale_agreed'::public.purchase_stage else 'negotiating'::public.purchase_stage end;
    insert into public.purchase_progress(user_id,listing_id) values(interest.buyer_id,interest.listing_id)
      on conflict(user_id,listing_id) do nothing;
    -- All seller syncs for one interest serialize on the interest row lock.
    select * into progress from public.purchase_progress where user_id=interest.buyer_id and listing_id=interest.listing_id for update;
    completed := coalesce(progress.completed_stages,'{}'::public.purchase_stage[]);
    if not stage=any(completed) then completed:=array_append(completed,stage); end if;
    select item into current from unnest(stages) with ordinality as t(item,pos)
      where not item=any(completed) order by pos limit 1;
    insert into public.purchase_progress(user_id,listing_id,current_stage,completed_stages)
      values(interest.buyer_id,interest.listing_id,coalesce(current,'purchase_complete'),completed)
      on conflict(user_id,listing_id) do update set current_stage=excluded.current_stage,
        completed_stages=excluded.completed_stages,updated_at=clock_timestamp();
  end if;
  return jsonb_build_object('updatedAt',interest.updated_at);
end;
$$;
revoke all on function public.pinpoint_buyer_interest_save(uuid,uuid,uuid,timestamptz,public.buyer_interest_status,timestamptz,text) from public,anon,authenticated;
grant execute on function public.pinpoint_buyer_interest_save(uuid,uuid,uuid,timestamptz,public.buyer_interest_status,timestamptz,text) to service_role;

-- Serialize stage merging so saving a home cannot overwrite a concurrent seller milestone.
create function public.pinpoint_purchase_progress(actor_id uuid,actor_session_id uuid,target uuid,next_stage public.purchase_stage)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  progress public.purchase_progress%rowtype;
  completed public.purchase_stage[];
  current public.purchase_stage;
begin
  if not public.pinpoint_active_session(actor_id,actor_session_id)
    or not exists (select 1 from public.profile_personas where profile_id=actor_id and persona='buyer') then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if next_stage is null or not exists (select 1 from public.listings l where l.id=target
    and l.listing_type='sale' and l.landlord_id<>actor_id
    and (l.status='published' or exists (select 1 from public.buyer_interests i where i.listing_id=l.id and i.buyer_id=actor_id))) then
    raise exception 'Sale listing unavailable' using errcode='42501';
  end if;
  insert into public.purchase_progress(user_id,listing_id) values(actor_id,target) on conflict(user_id,listing_id) do nothing;
  select * into progress from public.purchase_progress where user_id=actor_id and listing_id=target for update;
  completed:=coalesce(progress.completed_stages,'{}'::public.purchase_stage[]);
  if not next_stage=any(completed) then completed:=array_append(completed,next_stage); end if;
  select item into current from unnest(array['property_saved','viewing_scheduled','viewing_completed','contacted_seller','negotiating','sale_agreed','purchase_complete']::public.purchase_stage[])
    with ordinality as t(item,pos) where not item=any(completed) order by pos limit 1;
  update public.purchase_progress set completed_stages=completed,current_stage=coalesce(current,'purchase_complete'),updated_at=clock_timestamp()
    where user_id=actor_id and listing_id=target;
  return jsonb_build_object('currentStage',coalesce(current,'purchase_complete'),'completedStages',completed);
end;
$$;
revoke all on function public.pinpoint_purchase_progress(uuid,uuid,uuid,public.purchase_stage) from public,anon,authenticated;
grant execute on function public.pinpoint_purchase_progress(uuid,uuid,uuid,public.purchase_stage) to service_role;
