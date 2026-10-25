begin;

-- A valid access token can outlive its live session. Private preferences use
-- the existing account/session/policy guard, without requiring poster enrollment.
-- Keep saved rows intact so an eligible fresh login restores the same choices.
create policy saved_specials_live_session_read on public.saved_specials
  as restrictive for select to authenticated
  using ((select private.pinpoint_intake_eligible()));
create policy saved_specials_live_session_delete on public.saved_specials
  as restrictive for delete to authenticated
  using ((select private.pinpoint_intake_eligible()));

create function private.saved_specials_read(state_only boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare targets jsonb := '[]'; items jsonb := '[]'; item record; snapshot jsonb;
begin
  if not private.pinpoint_intake_eligible() then
    return jsonb_build_object('authenticated',false,'targets','[]'::jsonb,'items','[]'::jsonb,'serverNow',statement_timestamp());
  end if;
  for item in
    select coalesce(s.offer_id,s.entry_id) as id,
      case when s.offer_id is not null then 'shopping' else e.category end as category
    from public.saved_specials s left join public.pinpoint_entries e on e.id=s.entry_id
    where s.user_id=auth.uid() order by s.created_at desc
  loop
    targets := targets || jsonb_build_array(jsonb_build_object('id',item.id,'category',item.category));
    if not state_only then
      snapshot := private.discovery_special_snapshot(item.category,item.id);
      items := items || jsonb_build_array(jsonb_build_object('id',item.id,'category',item.category,'item',snapshot));
    end if;
  end loop;
  return jsonb_build_object('authenticated',true,'targets',targets,'items',items,'serverNow',statement_timestamp());
end;
$$;

create function private.saved_specials_write(category text,target uuid,save boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare total bigint;
begin
  if not private.pinpoint_intake_eligible() then
    raise exception 'Eligible signed-in account required to save Specials' using errcode='42501';
  end if;
  if category is null or category not in ('shopping','tourism','event') or target is null or save is null then
    raise exception 'Explicit Special and save choice required' using errcode='22023';
  end if;
  if category='shopping' then
    perform 1 from public.shopping_offers where id=target for update;
  else
    perform 1 from public.pinpoint_entries e where e.id=target and e.category=$1 for update;
  end if;
  if not private.pinpoint_intake_eligible() then
    raise exception 'Eligible signed-in account required to save Specials' using errcode='42501';
  end if;
  if save then
    if private.discovery_special_snapshot(category,target) is null then
      raise exception 'Special is unavailable' using errcode='22023';
    end if;
    insert into public.saved_specials(user_id,offer_id,entry_id)
      values(auth.uid(),case when category='shopping' then target end,case when category<>'shopping' then target end)
      on conflict do nothing;
  else
    delete from public.saved_specials s where s.user_id=auth.uid()
      and ((category='shopping' and s.offer_id=target) or (category in ('tourism','event') and s.entry_id=target));
  end if;
  select count(*) into total from public.saved_specials s
    where (category='shopping' and s.offer_id=target) or (category in ('tourism','event') and s.entry_id=target);
  return jsonb_build_object('saved',save,'savedCount',total);
end;
$$;

-- Guests receive the existing empty DTO without needing private-schema access.
-- Signed-in callers already have private USAGE; the private helper revalidates
-- their live account/session before touching preference data.
create or replace function public.saved_specials_read(state_only boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated',false,'targets','[]'::jsonb,'items','[]'::jsonb,'serverNow',statement_timestamp());
  end if;
  return private.saved_specials_read(state_only);
end;
$$;
create or replace function public.saved_specials_write(category text,target uuid,save boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select private.saved_specials_write(category,target,save);
$$;

revoke all on function private.saved_specials_read(boolean),private.saved_specials_write(text,uuid,boolean),
  public.saved_specials_read(boolean),public.saved_specials_write(text,uuid,boolean)
  from public,anon,authenticated,service_role;
grant execute on function private.saved_specials_read(boolean),private.saved_specials_write(text,uuid,boolean),
  public.saved_specials_read(boolean),public.saved_specials_write(text,uuid,boolean) to authenticated;
grant execute on function public.saved_specials_read(boolean) to anon;

commit;
