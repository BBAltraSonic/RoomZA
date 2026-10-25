-- PostgREST GET/HEAD and STABLE RPC requests are read-only. Both notification
-- RLS and push authorization use this bridge. Reads validate the same live
-- session predicates; mutating transactions retain their session/user locks.
begin;

create or replace function public.pinpoint_active_session(actor_id uuid, actor_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('transaction_read_only') = 'off' then
    -- Keep the privileged locking bridge and its existing service-only ACL.
    perform 1 from auth.sessions s join auth.users u on u.id=s.user_id
      where s.id=actor_session_id and s.user_id=actor_id for share of s,u;
    if not found then return false; end if;
  end if;
  return exists (
    select 1 from auth.sessions s
      join auth.users u on u.id=s.user_id
      join public.profiles p on p.id=u.id
    where s.id=actor_session_id and s.user_id=actor_id
      and (s.not_after is null or s.not_after>statement_timestamp())
      and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until<=statement_timestamp())
      and not exists (
        select 1 from public.account_suspensions a where a.user_id=u.id
          and a.restored_at is null
          and (a.suspended_until is null or a.suspended_until>statement_timestamp())
      )
  );
end;
$$;

-- CREATE OR REPLACE preserves ownership and grants. Do not expose the bridge
-- to ordinary users or alter the self-only notification wrapper's ACL.
comment on function public.pinpoint_active_session(uuid,uuid) is
  'Live-session validation: snapshot reads, locked session and user rows for mutating transactions.';

notify pgrst,'reload schema';
commit;
