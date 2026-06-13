create table public.search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  bounding_box_west double precision not null,
  bounding_box_south double precision not null,
  bounding_box_east double precision not null,
  bounding_box_north double precision not null,
  filters jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.search_alerts enable row level security;

-- Users can view their own alerts
create policy "Users can view their own search alerts"
on public.search_alerts for select
using (auth.uid() = user_id);

-- Anyone can insert an alert (anon for email capture)
create policy "Anyone can insert search alerts"
on public.search_alerts for insert
with check (true);