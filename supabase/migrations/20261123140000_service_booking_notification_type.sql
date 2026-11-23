-- Booking notices between customers and service providers.
-- On its own because a new enum value cannot be used in the transaction that adds it.
alter type public.notification_type add value if not exists 'service_booking_update';
