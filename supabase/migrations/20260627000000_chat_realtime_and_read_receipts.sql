-- Chat: read receipts + realtime delivery
--
-- Two gaps this closes:
--   1. `messages` was never added to the `supabase_realtime` publication, so the
--      client's postgres_changes subscription received nothing and sent messages
--      only appeared after a full page reload.
--   2. There was no "seen" concept. We add `read_at` plus an UPDATE policy that
--      lets the *recipient* (not the sender) mark inbound messages as read.

alter table public.messages
  add column if not exists read_at timestamptz;

-- Speeds up the ordered per-conversation message fetch + unread lookups.
create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

create index if not exists messages_conversation_unread_idx
  on public.messages (conversation_id)
  where read_at is null;

-- Recipients may mark inbound messages (ones they did not send) as read.
-- auth.uid() is wrapped in a subselect so it is evaluated once per query
-- (not per row) per Supabase RLS performance guidance.
drop policy if exists "Recipients can mark messages read" on public.messages;
create policy "Recipients can mark messages read"
on public.messages for update to authenticated
using (
  sender_id <> (select auth.uid()) and
  exists (
    select 1 from public.conversations
    where id = messages.conversation_id
      and (renter_id = (select auth.uid()) or landlord_id = (select auth.uid()))
  )
)
with check (
  sender_id <> (select auth.uid()) and
  exists (
    select 1 from public.conversations
    where id = messages.conversation_id
      and (renter_id = (select auth.uid()) or landlord_id = (select auth.uid()))
  )
);

-- Full replica identity so realtime UPDATE events (read receipts) carry all columns.
alter table public.messages replica identity full;

-- Add messages to the realtime publication if not already present.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end
$$;
