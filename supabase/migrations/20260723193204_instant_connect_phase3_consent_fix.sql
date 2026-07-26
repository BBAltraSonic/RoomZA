-- Use the named primary-key constraint so RETURNS TABLE output variables do
-- not collide with the recording-consent column names in PL/pgSQL.

create or replace function public.set_live_tour_recording_consent(
  target_tour_id uuid,
  target_granted boolean,
  target_policy_version text default 'phase3-v1'
)
returns table (
  result text,
  tour_id uuid,
  granted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester uuid := auth.uid();
  tour public.live_tours%rowtype;
begin
  if requester is null then
    return query
      select 'unauthenticated'::text, null::uuid, false;
    return;
  end if;

  select *
  into tour
  from public.live_tours
  where id = target_tour_id;

  if tour.id is null
    or tour.status <> 'live'
    or not exists (
      select 1
      from public.listings
      where listings.id = tour.listing_id
        and listings.status = 'published'
    ) then
    return query
      select 'tour_unavailable'::text, null::uuid, false;
    return;
  end if;

  if target_granted is null
    or target_policy_version is null
    or char_length(target_policy_version) not between 3 and 80 then
    return query
      select 'invalid_consent'::text, null::uuid, false;
    return;
  end if;

  insert into public.live_tour_recording_consents (
    tour_id,
    user_id,
    granted,
    policy_version,
    consented_at,
    revoked_at,
    updated_at
  )
  values (
    target_tour_id,
    requester,
    target_granted,
    target_policy_version,
    case when target_granted then now() else null end,
    case when target_granted then null else now() end,
    now()
  )
  on conflict on constraint live_tour_recording_consents_pkey do update
  set
    granted = excluded.granted,
    policy_version = excluded.policy_version,
    consented_at = excluded.consented_at,
    revoked_at = excluded.revoked_at,
    updated_at = excluded.updated_at;

  insert into public.consent_events (
    user_id,
    consent_key,
    granted,
    source
  )
  values (
    requester,
    'live_tour_recording',
    target_granted,
    'live_tour'
  );

  return query
    select 'updated'::text, target_tour_id, target_granted;
end;
$$;

revoke all on function public.set_live_tour_recording_consent(
  uuid, boolean, text
) from public, anon, authenticated;
grant execute on function public.set_live_tour_recording_consent(
  uuid, boolean, text
) to authenticated;
