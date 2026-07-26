-- Instant Connect Phase 3 enum additions are isolated so PostgreSQL can
-- commit them before later migration statements use the new values.

alter type public.live_tour_status
  add value if not exists 'scheduled' before 'live';

alter type public.live_tour_status
  add value if not exists 'cancelled' after 'ended';

create type public.live_tour_recording_status
  as enum ('off', 'awaiting_consent', 'recording', 'stopped', 'failed');

alter type public.notification_type
  add value if not exists 'live_tour_scheduled';

alter type public.notification_type
  add value if not exists 'live_tour_reminder';
