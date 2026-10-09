-- Local policy regression test. Run with psql -v ON_ERROR_STOP=1.
-- All disposable records, grants and trigger effects roll back. No enqueueing.
begin;
create temporary table notification_fixture as
select gen_random_uuid() as actor, gen_random_uuid() as recipient,
       gen_random_uuid() as event;
grant select on notification_fixture to authenticated, anon, service_role;
insert into auth.users(id, email)
select actor, actor::text || '@pinpoint.invalid' from notification_fixture
union all select recipient, recipient::text || '@pinpoint.invalid' from notification_fixture;

set local role service_role;
insert into public.notification_events(id, recipient_id, type, payload, idempotency_key)
select event, recipient, 'incoming_call', '{"message":"B1 policy fixture"}',
       'b1-policy:' || event::text from notification_fixture;
reset role;

do $$ begin
  if has_table_privilege('authenticated', 'public.notification_events', 'INSERT')
     or has_table_privilege('anon', 'public.notification_events', 'INSERT') then
    raise exception 'Client INSERT grant remains';
  end if;
end $$;

select set_config('request.jwt.claim.sub', actor::text, true) from notification_fixture;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.notification_events where id = (select event from notification_fixture)) then
    raise exception 'Actor can read another recipient notification';
  end if;
  begin
    insert into public.notification_events(recipient_id, type, payload)
    select recipient, 'incoming_call', '{}' from notification_fixture;
    raise exception 'Cross-recipient direct INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notification_events(recipient_id, type, payload)
    select actor, 'incoming_call', '{}' from notification_fixture;
    raise exception 'Self-recipient direct INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Verify the restrictive policy independently of the revoked table grant.
grant insert on public.notification_events to authenticated;
set local role authenticated;
do $$ begin
  begin
    insert into public.notification_events(recipient_id, type, payload)
    select recipient, 'incoming_call', '{}' from notification_fixture;
    raise exception 'Restrictive INSERT policy failed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select set_config('request.jwt.claim.sub', recipient::text, true) from notification_fixture;
set local role authenticated;
do $$ begin
  if (select count(*) from public.notification_events where id = (select event from notification_fixture)) <> 1 then
    raise exception 'Recipient cannot reload their event';
  end if;
end $$;
update public.notification_events set digest_at = now()
where id = (select event from notification_fixture);
reset role;

set local role anon;
do $$ begin
  begin
    if exists(select 1 from public.notification_events where id = (select event from notification_fixture)) then
      raise exception 'Anonymous notification read unexpectedly succeeded';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notification_events(recipient_id, type, payload)
    select recipient, 'incoming_call', '{}' from notification_fixture;
    raise exception 'Anonymous INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.notification_events where id = (select event from notification_fixture)) <> 1 then
    raise exception 'Denied inserts changed stored events';
  end if;
  if not exists(select 1 from public.notification_events
    where id = (select event from notification_fixture) and digest_at is not null) then
    raise exception 'Recipient update failed';
  end if;
  raise notice 'PASS: server INSERT, recipient read/update, cross-recipient isolation, client denial, restrictive policy';
end $$;
rollback;
