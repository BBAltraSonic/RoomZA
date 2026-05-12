create type public.conversation_type as enum ('inquiry', 'application');

create table public.conversations (
    id uuid default gen_random_uuid() primary key,
    listing_id uuid references public.listings(id) not null,
    renter_id uuid references public.profiles(id) not null,
    landlord_id uuid references public.profiles(id) not null,
    application_id uuid references public.applications(id),
    type public.conversation_type not null,
    created_at timestamp with time zone default now() not null,
    unique(listing_id, renter_id)
);

create table public.messages (
    id uuid default gen_random_uuid() primary key,
    conversation_id uuid references public.conversations(id) on delete cascade not null,
    sender_id uuid references public.profiles(id) not null,
    listing_id uuid references public.listings(id) not null,
    content text not null,
    created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Policies for conversations
create policy "Users can view their own conversations"
on public.conversations for select to authenticated
using (renter_id = auth.uid() or landlord_id = auth.uid());

create policy "Users can insert conversations they are part of"
on public.conversations for insert to authenticated
with check (renter_id = auth.uid() or landlord_id = auth.uid());

create policy "Users can update conversations they are part of"
on public.conversations for update to authenticated
using (renter_id = auth.uid() or landlord_id = auth.uid());

-- Policies for messages
create policy "Users can view messages of their conversations"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.conversations
    where id = messages.conversation_id
    and (renter_id = auth.uid() or landlord_id = auth.uid())
  )
);

create policy "Users can insert messages to their conversations"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid() and
  exists (
    select 1 from public.conversations
    where id = messages.conversation_id
    and (renter_id = auth.uid() or landlord_id = auth.uid())
  )
);
