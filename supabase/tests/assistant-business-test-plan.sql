-- Pinpoint Assistant business mode: private reminders and the organisation approvals log.
-- Run against a disposable local database after all migrations. Everything is rolled back.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.assistant_reminders', 'select')
    or has_table_privilege('anon', 'public.assistant_action_log', 'select')
    or has_table_privilege('authenticated', 'public.assistant_action_log', 'update')
    or has_table_privilege('authenticated', 'public.assistant_action_log', 'delete')
    or has_column_privilege('authenticated', 'public.assistant_action_log', 'actor_id', 'insert')
    or has_column_privilege('authenticated', 'public.assistant_action_log', 'organization_id', 'insert')
    or has_column_privilege('authenticated', 'public.assistant_reminders', 'user_id', 'insert')
    or has_column_privilege('authenticated', 'public.assistant_reminders', 'user_id', 'update')
    or has_function_privilege('authenticated', 'private.stamp_assistant_action()', 'execute') then
    raise exception 'FAIL: assistant business privileges are incorrect';
  end if;
end;
$$;

-- O owns the organisation, D is its admin, A its agent. S is a solo lister, X an outsider,
-- C a customer.
insert into auth.users(id, email, email_confirmed_at) values
  ('75000000-0000-4000-8000-000000000001', 'assistant-owner@example.com', now()),
  ('75000000-0000-4000-8000-000000000002', 'assistant-admin@example.com', now()),
  ('75000000-0000-4000-8000-000000000003', 'assistant-agent@example.com', now()),
  ('75000000-0000-4000-8000-000000000004', 'assistant-solo@example.com', now()),
  ('75000000-0000-4000-8000-000000000005', 'assistant-outsider@example.com', now()),
  ('75000000-0000-4000-8000-000000000006', 'assistant-customer@example.com', now());

insert into public.organizations(id, name, slug, owner_id) values
  ('75000000-0000-4000-8000-000000000100', 'Assistant Plan Realty', 'assistant-plan-realty', '75000000-0000-4000-8000-000000000001');
insert into public.organization_memberships(organization_id, user_id, role) values
  ('75000000-0000-4000-8000-000000000100', '75000000-0000-4000-8000-000000000001', 'owner'),
  ('75000000-0000-4000-8000-000000000100', '75000000-0000-4000-8000-000000000002', 'admin'),
  ('75000000-0000-4000-8000-000000000100', '75000000-0000-4000-8000-000000000003', 'agent');

insert into public.listings(id, title, landlord_id, organization_id, status, price, property_type, address, latitude, longitude, metadata) values
  ('75000000-0000-4000-8000-000000000010', 'Organisation home', '75000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000100', 'published', 8500, 'apartment', '1 Plan Street', -26.1, 28.0, '{"publicContact":{"phone":"+27215550100"},"contactConsent":true}'),
  ('75000000-0000-4000-8000-000000000011', 'Solo home', '75000000-0000-4000-8000-000000000004', null, 'published', 4200, 'room', '2 Plan Street', -26.1, 28.0, '{"publicContact":{"phone":"+27215550100"},"contactConsent":true}');

create temp table plan_state(reminder_id uuid);
grant all on plan_state to authenticated;

-- Admin approves a viewing on the organisation listing. Who and which organisation come from
-- the session and the listing, not the caller.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"75000000-0000-4000-8000-000000000002"}', true);
do $$
declare
  logged public.assistant_action_log%rowtype;
begin
  insert into public.assistant_action_log(customer_id, listing_id, action)
  values ('75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000010', 'viewing_accepted')
  returning * into logged;
  if logged.actor_id <> '75000000-0000-4000-8000-000000000002'
    or logged.organization_id is distinct from '75000000-0000-4000-8000-000000000100'
    or logged.subject_key <> '75000000-0000-4000-8000-000000000006:75000000-0000-4000-8000-000000000010' then
    raise exception 'FAIL: approval was not stamped from the session and listing: %', row_to_json(logged);
  end if;
  begin
    insert into public.assistant_action_log(customer_id, listing_id, action)
    values ('75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000010', 'listing_deleted');
    raise exception 'FAIL: an unknown action was logged';
  exception when check_violation then null;
  end;
  begin
    insert into public.assistant_action_log(customer_id, action)
    values ('75000000-0000-4000-8000-000000000006', 'archived');
    raise exception 'FAIL: an approval without a listing was logged';
  exception when not_null_violation or insufficient_privilege then null;
  end;
  begin
    insert into public.assistant_action_log(customer_id, listing_id, action)
    values ('75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000011', 'archived');
    raise exception 'FAIL: an admin logged an action on a listing outside the organisation';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Agent: sees the organisation's approvals, but cannot approve anything.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"75000000-0000-4000-8000-000000000003"}', true);
do $$
begin
  if (select count(*) from public.assistant_action_log) <> 1 then
    raise exception 'FAIL: an agent cannot see the organisation approvals log';
  end if;
  begin
    insert into public.assistant_action_log(customer_id, listing_id, action)
    values ('75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000010', 'archived');
    raise exception 'FAIL: an agent logged an approval';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.assistant_action_log(actor_id, customer_id, listing_id, action)
    values ('75000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000010', 'archived');
    raise exception 'FAIL: a caller named someone else as the actor';
  exception when insufficient_privilege then null;
  end;
  -- The agent's own reminder about the same person.
  insert into public.assistant_reminders(note, due_at, customer_id, listing_id)
  values ('Follow up after the viewing', now() + interval '1 day', '75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000010');
  insert into plan_state select id from public.assistant_reminders;
  begin
    insert into public.assistant_reminders(note, due_at, customer_id)
    values ('About nobody in particular', now(), '75000000-0000-4000-8000-000000000006');
    raise exception 'FAIL: a person reminder without a listing was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.assistant_reminders(note, due_at) values ('   ', now());
    raise exception 'FAIL: a blank reminder was saved';
  exception when check_violation then null;
  end;
  -- Snooze, then Done.
  update public.assistant_reminders set due_at = now() + interval '7 days' where id = (select reminder_id from plan_state);
  update public.assistant_reminders set done_at = now() where id = (select reminder_id from plan_state);
  if (select done_at from public.assistant_reminders where id = (select reminder_id from plan_state)) is null then
    raise exception 'FAIL: an agent cannot mark their own reminder done';
  end if;
end;
$$;

-- Owner: sees the log, never the agent's reminder.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"75000000-0000-4000-8000-000000000001"}', true);
do $$
declare
  updated integer;
  deleted integer;
begin
  if (select count(*) from public.assistant_action_log) <> 1 then
    raise exception 'FAIL: the owner cannot see the organisation approvals log';
  end if;
  if exists (select 1 from public.assistant_reminders) then
    raise exception 'FAIL: the owner can see an agent''s private reminder';
  end if;
  update public.assistant_reminders set note = 'changed' where id = (select reminder_id from plan_state);
  get diagnostics updated = row_count;
  delete from public.assistant_reminders where id = (select reminder_id from plan_state);
  get diagnostics deleted = row_count;
  if updated + deleted <> 0 then
    raise exception 'FAIL: the owner changed an agent''s private reminder';
  end if;
end;
$$;

-- Solo lister: logs on their own listing, and sees none of the organisation's log.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"75000000-0000-4000-8000-000000000004"}', true);
do $$
declare
  logged public.assistant_action_log%rowtype;
begin
  if exists (select 1 from public.assistant_action_log) then
    raise exception 'FAIL: a solo lister can see another organisation''s approvals';
  end if;
  insert into public.assistant_action_log(customer_id, listing_id, action)
  values ('75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000011', 'archived')
  returning * into logged;
  if logged.organization_id is not null then
    raise exception 'FAIL: a solo listing approval was given an organisation';
  end if;
  if (select count(*) from public.assistant_action_log) <> 1 then
    raise exception 'FAIL: a solo lister cannot read their own approvals';
  end if;
end;
$$;

-- Outsider and the customer: see nothing, write nothing.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"75000000-0000-4000-8000-000000000005"}', true);
do $$
begin
  if exists (select 1 from public.assistant_action_log) or exists (select 1 from public.assistant_reminders) then
    raise exception 'FAIL: an outsider can read assistant business data';
  end if;
  begin
    insert into public.assistant_action_log(customer_id, listing_id, action)
    values ('75000000-0000-4000-8000-000000000006', '75000000-0000-4000-8000-000000000011', 'archived');
    raise exception 'FAIL: an outsider logged an action on someone else''s listing';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"75000000-0000-4000-8000-000000000006"}', true);
do $$
begin
  if exists (select 1 from public.assistant_action_log) then
    raise exception 'FAIL: a customer can read the lister''s approvals log about them';
  end if;
end;
$$;

reset role;
select 'PASS: assistant business plan' as result;
rollback;
