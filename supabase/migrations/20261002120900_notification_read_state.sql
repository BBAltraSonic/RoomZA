-- Existing private profile counts and notification reads already select read_at.
-- Align storage without changing events, delivery state, grants or RLS policies.
alter table public.notification_events add column read_at timestamptz;
