-- Supabase Data API table privileges are independent from RLS. These are the
-- narrow legacy-table privileges needed by scheduled-tour alert and reminder
-- jobs running with the server-only service client.

grant select on table public.listings to service_role;
grant select on table public.user_favorites to service_role;
grant select on table public.search_alerts to service_role;
grant select on table public.notification_preferences to service_role;
grant select, insert, update on table public.notification_events to service_role;
grant select, update on table public.live_tours to service_role;
