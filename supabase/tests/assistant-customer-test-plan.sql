-- Pinpoint Assistant customer mode: account memory.
-- Run against a disposable local database after all migrations. Everything is rolled back.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.assistant_memory', 'select')
    or has_table_privilege('anon', 'public.assistant_memory', 'insert') then
    raise exception 'FAIL: assistant customer privileges are incorrect';
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('76000000-0000-4000-8000-000000000001', 'assistant-customer-one@example.com', now()),
  ('76000000-0000-4000-8000-000000000002', 'assistant-customer-two@example.com', now());

-- Memory: each account reads and changes only its own row.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001"}', true);
do $$
begin
  insert into public.assistant_memory(user_id, memory)
  values ('76000000-0000-4000-8000-000000000001', '{"version":1,"recent":[],"preferences":[],"saved":[]}');
  -- now() is fixed inside this transaction, so prove the trigger overrides a stale time instead.
  update public.assistant_memory set memory = '{"version":1,"recent":["beds=2"],"preferences":[],"saved":[]}', updated_at = '2000-01-01';
  if (select updated_at from public.assistant_memory) <> now() then
    raise exception 'FAIL: changing memory did not touch updated_at';
  end if;
  begin
    insert into public.assistant_memory(user_id, memory)
    values ('76000000-0000-4000-8000-000000000002', '{"version":1,"recent":[],"preferences":[]}');
    raise exception 'FAIL: an account wrote memory for someone else';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  begin
    insert into public.assistant_memory(user_id, memory) values ('76000000-0000-4000-8000-000000000002', '{"version":2,"recent":[],"preferences":[]}');
    raise exception 'FAIL: memory with the wrong version was saved';
  exception when check_violation then null;
  end;
  begin
    insert into public.assistant_memory(user_id, memory)
    values ('76000000-0000-4000-8000-000000000002', jsonb_build_object('version', 1, 'recent', jsonb_build_array(repeat('x', 17000)), 'preferences', '[]'::jsonb));
    raise exception 'FAIL: oversized memory was saved';
  exception when check_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000002"}', true);
do $$
declare
  touched integer;
begin
  if exists (select 1 from public.assistant_memory) then
    raise exception 'FAIL: an account can read someone else''s memory';
  end if;
  update public.assistant_memory set memory = '{"version":1,"recent":[],"preferences":[]}';
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'FAIL: an account changed someone else''s memory';
  end if;
  delete from public.assistant_memory;
  get diagnostics touched = row_count;
  if touched <> 0 then
    raise exception 'FAIL: an account deleted someone else''s memory';
  end if;
end;
$$;

-- "Forget everything" removes the owner's row.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"76000000-0000-4000-8000-000000000001"}', true);
do $$
declare
  touched integer;
begin
  delete from public.assistant_memory;
  get diagnostics touched = row_count;
  if touched <> 1 then
    raise exception 'FAIL: an account could not forget its own memory';
  end if;
end;
$$;

reset role;
select 'PASS: assistant customer plan' as result;
rollback;
