-- A showing booked into one of the landlord's calendar slots. Postgres cannot
-- use a new enum value in the transaction that adds it, so the schema that
-- relies on 'scheduled' follows in the next migration.
alter type public.showing_window add value if not exists 'scheduled';
