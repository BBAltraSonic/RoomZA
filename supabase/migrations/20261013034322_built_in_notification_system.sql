-- Commit enum additions before the next migration uses them.
alter type public.notification_channel add value if not exists 'push';
alter type public.notification_type add value if not exists 'interaction_update';
alter type public.notification_type add value if not exists 'automatic_reminder';
alter type public.notification_type add value if not exists 'saved_item_update';
alter type public.notification_type add value if not exists 'search_match';
