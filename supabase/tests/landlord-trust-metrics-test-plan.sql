-- Landlord trust metric aggregation and public projection acceptance plan.
-- Run against a disposable local database after all migrations.
begin;

do $$
declare
  landlord constant uuid := '71000000-0000-4000-8000-000000000001';
  listing constant uuid := '71000000-0000-4000-8000-000000000002';
  median_seconds integer;
  sample_size integer;
begin
  if has_function_privilege('anon', 'public.refresh_landlord_trust_metrics()', 'execute')
    or has_function_privilege('authenticated', 'public.refresh_landlord_trust_metrics()', 'execute') then
    raise exception 'FAIL: browser roles can refresh landlord trust metrics';
  end if;

  insert into auth.users(id, email, email_confirmed_at) values
    (landlord, 'trust-metric-landlord@example.com', now()),
    ('71000000-0000-4000-8000-000000000011', 'trust-renter-1@example.com', now()),
    ('71000000-0000-4000-8000-000000000012', 'trust-renter-2@example.com', now()),
    ('71000000-0000-4000-8000-000000000013', 'trust-renter-3@example.com', now()),
    ('71000000-0000-4000-8000-000000000014', 'trust-renter-4@example.com', now()),
    ('71000000-0000-4000-8000-000000000015', 'trust-renter-5@example.com', now()),
    ('71000000-0000-4000-8000-000000000016', 'trust-renter-unanswered@example.com', now()),
    ('71000000-0000-4000-8000-000000000017', 'trust-renter-old@example.com', now()),
    ('71000000-0000-4000-8000-000000000018', 'trust-renter-landlord-first@example.com', now());

  update public.profiles set role = 'landlord', phone_verified = true, email_verified_at = now() where id = landlord;
  update public.profiles set role = 'renter' where id <> landlord and id::text like '71000000-%';

  insert into public.listings(id, title, landlord_id, status, price, property_type, address, latitude, longitude)
  values (listing, 'Trust metric listing', landlord, 'published', 8000, 'apartment', '5 Signal Street', -26.1, 28.0);

  insert into public.conversations(id, listing_id, renter_id, landlord_id, type, created_at) values
    ('71000000-0000-4000-8000-000000000021', listing, '71000000-0000-4000-8000-000000000011', landlord, 'inquiry', now() - interval '10 days'),
    ('71000000-0000-4000-8000-000000000022', listing, '71000000-0000-4000-8000-000000000012', landlord, 'inquiry', now() - interval '9 days'),
    ('71000000-0000-4000-8000-000000000023', listing, '71000000-0000-4000-8000-000000000013', landlord, 'inquiry', now() - interval '8 days'),
    ('71000000-0000-4000-8000-000000000024', listing, '71000000-0000-4000-8000-000000000014', landlord, 'application', now() - interval '7 days'),
    ('71000000-0000-4000-8000-000000000025', listing, '71000000-0000-4000-8000-000000000015', landlord, 'application', now() - interval '6 days'),
    ('71000000-0000-4000-8000-000000000026', listing, '71000000-0000-4000-8000-000000000016', landlord, 'inquiry', now() - interval '5 days'),
    ('71000000-0000-4000-8000-000000000027', listing, '71000000-0000-4000-8000-000000000017', landlord, 'inquiry', now() - interval '100 days'),
    ('71000000-0000-4000-8000-000000000028', listing, '71000000-0000-4000-8000-000000000018', landlord, 'inquiry', now() - interval '4 days');

  insert into public.messages(conversation_id, sender_id, listing_id, content, created_at) values
    ('71000000-0000-4000-8000-000000000021', '71000000-0000-4000-8000-000000000011', listing, 'First renter message', now() - interval '10 days'),
    ('71000000-0000-4000-8000-000000000021', landlord, listing, 'Reply', now() - interval '10 days' + interval '5 minutes'),
    ('71000000-0000-4000-8000-000000000022', '71000000-0000-4000-8000-000000000012', listing, 'First renter message', now() - interval '9 days'),
    ('71000000-0000-4000-8000-000000000022', landlord, listing, 'Reply', now() - interval '9 days' + interval '10 minutes'),
    ('71000000-0000-4000-8000-000000000023', '71000000-0000-4000-8000-000000000013', listing, 'First renter message', now() - interval '8 days'),
    ('71000000-0000-4000-8000-000000000023', landlord, listing, 'Reply', now() - interval '8 days' + interval '15 minutes'),
    ('71000000-0000-4000-8000-000000000024', '71000000-0000-4000-8000-000000000014', listing, 'First renter message', now() - interval '7 days'),
    ('71000000-0000-4000-8000-000000000024', landlord, listing, 'Reply', now() - interval '7 days' + interval '20 minutes'),
    ('71000000-0000-4000-8000-000000000025', '71000000-0000-4000-8000-000000000015', listing, 'First renter message', now() - interval '6 days'),
    ('71000000-0000-4000-8000-000000000025', landlord, listing, 'Reply', now() - interval '6 days' + interval '100 minutes'),
    ('71000000-0000-4000-8000-000000000026', '71000000-0000-4000-8000-000000000016', listing, 'Unanswered', now() - interval '5 days'),
    ('71000000-0000-4000-8000-000000000027', '71000000-0000-4000-8000-000000000017', listing, 'Old question', now() - interval '100 days'),
    ('71000000-0000-4000-8000-000000000027', landlord, listing, 'Old reply', now() - interval '100 days' + interval '1 minute'),
    ('71000000-0000-4000-8000-000000000028', landlord, listing, 'Landlord started', now() - interval '4 days'),
    ('71000000-0000-4000-8000-000000000028', '71000000-0000-4000-8000-000000000018', listing, 'Renter followed up', now() - interval '4 days' + interval '1 minute');

  perform public.refresh_landlord_trust_metrics();
  perform public.refresh_landlord_trust_metrics();

  select median_first_response_seconds, reply_sample_size
  into median_seconds, sample_size
  from public.landlord_trust_metrics
  where landlord_id = landlord;

  if median_seconds <> 900 or sample_size <> 5 then
    raise exception 'FAIL: expected five samples with a 900 second median, got % samples and % seconds', sample_size, median_seconds;
  end if;

  if not exists (select 1 from cron.job where jobname = 'refresh-landlord-trust-metrics') then
    raise exception 'FAIL: six-hour trust metric cron job is missing';
  end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare visible_rows integer; begin
  select count(*) into visible_rows
  from public.landlord_trust_metrics
  where landlord_id = '71000000-0000-4000-8000-000000000001';
  if visible_rows <> 1 then raise exception 'FAIL: published landlord trust metric is not publicly readable'; end if;
end $$;
reset role;

update public.listings set status = 'draft' where id = '71000000-0000-4000-8000-000000000002';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare visible_rows integer; begin
  select count(*) into visible_rows
  from public.landlord_trust_metrics
  where landlord_id = '71000000-0000-4000-8000-000000000001';
  if visible_rows <> 0 then raise exception 'FAIL: landlord without a published listing leaked trust metrics'; end if;
end $$;
reset role;

rollback;

select 'PASS: landlord trust metric aggregation and RLS checks' as result;
