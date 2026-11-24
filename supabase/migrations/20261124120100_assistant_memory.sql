-- Pinpoint Assistant customer memory for signed-in people (proposal, "Memory").
--
-- One row per account: recent searches and saved searches as discovery addresses (chips,
-- never what was typed), confirmed preferences and "Not now" answers. Only the owner can
-- read or change it. It is never sent to the AI. "Forget everything" deletes the row.

create table public.assistant_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memory jsonb not null,
  updated_at timestamptz not null default now(),
  constraint assistant_memory_shape check (
    jsonb_typeof(memory) = 'object'
    and memory->>'version' = '1'
    and jsonb_typeof(memory->'recent') = 'array'
    and jsonb_typeof(memory->'preferences') = 'array'
  ),
  constraint assistant_memory_size check (octet_length(memory::text) <= 16384)
);

alter table public.assistant_memory enable row level security;
alter table public.assistant_memory force row level security;
revoke all on table public.assistant_memory from public, anon, authenticated;
grant select, insert, update, delete on table public.assistant_memory to authenticated;

create policy "People read their own assistant memory" on public.assistant_memory
  for select to authenticated using (user_id = (select auth.uid()));
create policy "People create their own assistant memory" on public.assistant_memory
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "People change their own assistant memory" on public.assistant_memory
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "People forget their own assistant memory" on public.assistant_memory
  for delete to authenticated using (user_id = (select auth.uid()));

create function private.touch_assistant_memory() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger assistant_memory_touch before update on public.assistant_memory
  for each row execute function private.touch_assistant_memory();
