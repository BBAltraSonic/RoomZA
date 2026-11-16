-- Deposit payments acceptance plan (docs/deposit-payments-proposal.md, step 1).
-- Run against a disposable local database after the deposit payments
-- migration. Everything happens in one transaction that is rolled back.
-- A failed check raises 'FAIL: ...'; a clean run ends with the PASS notice.
begin;

-- Fixture helper: one rental listing with an R8,000 deposit and an approved
-- application for the plan's renter. Returns the application id.
create function pg_temp.make_application(tag text, move_in date, owner uuid, renter uuid)
returns uuid language plpgsql as $$
declare
  new_listing uuid := gen_random_uuid();
  new_application uuid := gen_random_uuid();
begin
  insert into public.listings(id, title, landlord_id, status, price, property_type, address, latitude, longitude,
      bedrooms, bathrooms, parking_type, electricity_type, water_availability, lease_duration, availability_date,
      deposit_amount, metadata)
    values (new_listing, 'Deposit plan ' || tag, owner, 'published', 8000, 'apartment', '1 Test Street',
      -26.1, 28.0, 1, 1, 'none', 'prepaid', 'municipal', '12_months', current_date + 30, 8000,
      -- Published listings must carry a public contact with consent.
      '{"publicContact":{"phone":"+27110000000"},"contactConsent":true}'::jsonb);
  insert into public.applications(id, listing_id, renter_id, status, full_name, income, employment_status, move_in_date)
    values (new_application, new_listing, renter, 'approved', 'Plan Renter', 30000, 'employed', move_in);
  return new_application;
end;
$$;

-- Ledger sum for one payment: what RoomZA still holds for other people.
create function pg_temp.held_cents(target uuid) returns bigint language sql as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.payment_ledger_entries where payment_id = target;
$$;

do $$
declare
  owner_id constant uuid := '20000000-0000-4000-8000-000000000001';
  renter_id constant uuid := '20000000-0000-4000-8000-000000000002';
  admin_id constant uuid := '20000000-0000-4000-8000-000000000003';
  stranger_id constant uuid := '20000000-0000-4000-8000-000000000004';
  owner_session constant uuid := '20000000-0000-4000-8000-0000000000a1';
  renter_session constant uuid := '20000000-0000-4000-8000-0000000000a2';
  stranger_session constant uuid := '20000000-0000-4000-8000-0000000000a4';
  table_name text;
  fn text;
  app_move_in uuid;
  app_refund uuid;
  app_owner_cancel uuid;
  app_contest uuid;
  app_unapproved uuid;
  app_no_payout uuid;
  app_expired uuid;
  app_uncontested uuid;
  app_silent uuid;
  app_fresh uuid;
  app_no_fee uuid;
  app_dispatch uuid;
  app_stale uuid;
  app_flag uuid;
  claim jsonb;
  bare_owner constant uuid := '20000000-0000-4000-8000-000000000005';
  reply jsonb;
  again jsonb;
  pay uuid;
  pay_expired uuid;
  pay_uncontested uuid;
  pay_silent uuid;
  pay_fresh uuid;
  row public.payments%rowtype;
  sweep jsonb;
begin
  ------------------------------------------------------------------ privileges
  foreach table_name in array array['payment_settings', 'owner_payout_accounts', 'payments',
      'payment_ledger_entries', 'payment_provider_events'] loop
    if has_table_privilege('anon', 'public.' || table_name, 'select')
      or has_table_privilege('authenticated', 'public.' || table_name, 'select')
      or has_table_privilege('authenticated', 'public.' || table_name, 'insert')
      or has_table_privilege('authenticated', 'public.' || table_name, 'update') then
      raise exception 'FAIL: browser roles can reach %', table_name;
    end if;
    if not (select relrowsecurity and relforcerowsecurity from pg_class
        where oid = ('public.' || table_name)::regclass) then
      raise exception 'FAIL: row-level security is not forced on %', table_name;
    end if;
  end loop;
  if has_table_privilege('service_role', 'public.payment_ledger_entries', 'update')
    or has_table_privilege('service_role', 'public.payment_ledger_entries', 'delete')
    or has_table_privilege('service_role', 'public.payments', 'delete') then
    raise exception 'FAIL: the ledger or payments can be rewritten by the service role';
  end if;
  foreach fn in array array[
      'public.pinpoint_deposit_start(uuid,uuid,uuid)',
      'public.pinpoint_deposit_attach_checkout(uuid,text,text)',
      'public.pinpoint_deposit_record_charge(text,text,bigint,text,bigint,jsonb)',
      'public.pinpoint_deposit_confirm_move_in(uuid,uuid,uuid)',
      'public.pinpoint_deposit_request_refund(uuid,uuid,uuid)',
      'public.pinpoint_deposit_contest_refund(uuid,uuid,uuid)',
      'public.pinpoint_deposit_owner_cancel(uuid,uuid,uuid)',
      'public.pinpoint_deposit_resolve_dispute(uuid,uuid,text,boolean,text,text)',
      'public.pinpoint_deposit_record_payout(uuid,uuid,text,text)',
      'public.pinpoint_deposit_record_refund(uuid,text,uuid,text)',
      'public.pinpoint_deposit_sweep()',
      'public.pinpoint_owner_payout_account_get(uuid)',
      'public.pinpoint_deposit_claim_refunds(integer,uuid)',
      'public.pinpoint_deposit_finish_refund_dispatch(uuid,text,text,text)',
      'public.pinpoint_deposit_flag_refund(text,text)',
      'public.pinpoint_owner_payout_account_save(uuid,uuid,text,text,text,text)'] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute')
      or not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FAIL: wrong execute boundary on %', fn;
    end if;
  end loop;

  -------------------------------------------------------------------- fixtures
  insert into auth.users(id, email, email_confirmed_at) values
    (owner_id, 'deposit-plan-owner@example.com', now()),
    (renter_id, 'deposit-plan-renter@example.com', now()),
    (admin_id, 'deposit-plan-admin@example.com', now()),
    (stranger_id, 'deposit-plan-stranger@example.com', now()),
    (bare_owner, 'deposit-plan-bare-owner@example.com', now());
  insert into auth.sessions(id, user_id) values
    (owner_session, owner_id), (renter_session, renter_id), (stranger_session, stranger_id);
  insert into public.admin_memberships(user_id, level) values (admin_id, 'admin');
  insert into public.owner_payout_accounts(owner_id, account_holder, bank_name, branch_code, account_number)
    values (owner_id, 'Plan Owner', 'Test Bank', '250655', '62000000001');

  app_move_in := pg_temp.make_application('move-in', current_date + 30, owner_id, renter_id);
  app_refund := pg_temp.make_application('refund', current_date + 30, owner_id, renter_id);
  app_owner_cancel := pg_temp.make_application('owner-cancel', current_date + 30, owner_id, renter_id);
  app_contest := pg_temp.make_application('contest', current_date - 1, owner_id, renter_id);
  app_unapproved := pg_temp.make_application('unapproved', current_date + 30, owner_id, renter_id);
  update public.applications set status = 'shortlisted' where id = app_unapproved;
  app_no_payout := pg_temp.make_application('no-payout', current_date + 30, bare_owner, renter_id);
  app_expired := pg_temp.make_application('expired', current_date + 30, owner_id, renter_id);
  app_uncontested := pg_temp.make_application('uncontested', current_date - 2, owner_id, renter_id);
  app_silent := pg_temp.make_application('silent', current_date - 10, owner_id, renter_id);
  app_fresh := pg_temp.make_application('fresh', current_date + 30, owner_id, renter_id);
  app_no_fee := pg_temp.make_application('no-fee', current_date + 30, owner_id, renter_id);
  app_dispatch := pg_temp.make_application('dispatch', current_date + 30, owner_id, renter_id);
  app_stale := pg_temp.make_application('stale', current_date + 30, owner_id, renter_id);
  app_flag := pg_temp.make_application('flag', current_date + 30, owner_id, renter_id);

  set local role service_role;

  ----------------------------------------------------------------------- start
  begin
    perform public.pinpoint_deposit_start(stranger_id, stranger_session, app_move_in);
    raise exception 'FAIL: a stranger started checkout on someone else''s application';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pinpoint_deposit_start(renter_id, stranger_session, app_move_in);
    raise exception 'FAIL: checkout started with a session that is not the renter''s';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pinpoint_deposit_start(renter_id, renter_session, app_unapproved);
    raise exception 'FAIL: checkout started before the application was approved';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.pinpoint_deposit_start(renter_id, renter_session, app_no_payout);
    raise exception 'FAIL: checkout started for an owner with no payout account';
  exception when sqlstate 'PT409' then null;
  end;

  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_move_in);
  pay := (reply->>'paymentId')::uuid;
  select * into row from public.payments where id = pay;
  if row.state <> 'awaiting_payment' or row.amount_cents <> 800000 or row.commission_bps <> 1000
    or row.owner_id <> owner_id or row.renter_id <> renter_id or row.move_in_date <> current_date + 30 then
    raise exception 'FAIL: a started deposit has the wrong amount, rate or parties';
  end if;
  again := public.pinpoint_deposit_start(renter_id, renter_session, app_move_in);
  if again->>'paymentId' <> reply->>'paymentId' or (select count(*) from public.payments where application_id = app_move_in) <> 1 then
    raise exception 'FAIL: starting checkout twice created a second deposit';
  end if;

  ------------------------------------------------------------- checkout link
  if reply->>'checkoutUrl' is not null then
    raise exception 'FAIL: a new deposit already has a checkout link';
  end if;
  begin
    perform public.pinpoint_deposit_attach_checkout(pay, 'dep_wrong', 'https://checkout.paystack.com/a');
    raise exception 'FAIL: a checkout link was attached under the wrong reference';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pinpoint_deposit_attach_checkout(pay, reply->>'reference', 'http://checkout.paystack.com/a');
    raise exception 'FAIL: a checkout link that is not https was accepted';
  exception when invalid_parameter_value then null;
  end;
  again := public.pinpoint_deposit_attach_checkout(pay, reply->>'reference', 'https://checkout.paystack.com/first');
  if again->>'checkoutUrl' <> 'https://checkout.paystack.com/first' then
    raise exception 'FAIL: the checkout link was not stored';
  end if;
  again := public.pinpoint_deposit_attach_checkout(pay, reply->>'reference', 'https://checkout.paystack.com/second');
  if again->>'checkoutUrl' <> 'https://checkout.paystack.com/first' then
    raise exception 'FAIL: a second checkout attempt replaced the first link';
  end if;
  again := public.pinpoint_deposit_start(renter_id, renter_session, app_move_in);
  if again->>'checkoutUrl' <> 'https://checkout.paystack.com/first' then
    raise exception 'FAIL: restarting checkout did not return the stored link';
  end if;

  ---------------------------------------------------------------------- charge
  begin
    perform public.pinpoint_deposit_confirm_move_in(renter_id, renter_session, pay);
    raise exception 'FAIL: an unpaid deposit was released';
  exception when sqlstate 'PT409' then null;
  end;
  again := public.pinpoint_deposit_record_charge(row.provider_reference, 'evt-short', 700000, 'ZAR', 26795, '{}');
  if again->>'outcome' <> 'needs_review' or again->>'reason' <> 'amount_mismatch'
    or (select state from public.payments where id = pay) <> 'awaiting_payment' then
    raise exception 'FAIL: a charge for the wrong amount was accepted';
  end if;
  again := public.pinpoint_deposit_record_charge('dep_unknown', 'evt-unknown', 800000, 'ZAR', 26795, '{}');
  if again->>'outcome' <> 'needs_review' or again->>'reason' <> 'unknown_reference' then
    raise exception 'FAIL: a charge for an unknown reference was not flagged';
  end if;
  again := public.pinpoint_deposit_record_charge(row.provider_reference, 'evt-paid', 800000, 'ZAR', 26795, '{"id":1}');
  if again->>'outcome' <> 'applied' or (again->>'duplicate')::boolean then
    raise exception 'FAIL: a correct charge was not applied';
  end if;
  again := public.pinpoint_deposit_record_charge(row.provider_reference, 'evt-paid', 800000, 'ZAR', 26795, '{"id":1}');
  if again->>'outcome' <> 'applied' or not (again->>'duplicate')::boolean then
    raise exception 'FAIL: a repeated charge notification was not recognised as a duplicate';
  end if;
  select * into row from public.payments where id = pay;
  if row.state <> 'held' or row.provider_fee_cents <> 26795 or row.paid_at is null
    or pg_temp.held_cents(pay) <> 800000
    or (select count(*) from public.payment_ledger_entries where payment_id = pay) <> 1 then
    raise exception 'FAIL: a paid deposit is not held exactly once';
  end if;
  begin
    perform public.pinpoint_deposit_start(renter_id, renter_session, app_move_in);
    raise exception 'FAIL: checkout restarted on a deposit that is already paid';
  exception when sqlstate 'PT409' then null;
  end;

  --------------------------------------------------------- move-in and payout
  begin
    perform public.pinpoint_deposit_confirm_move_in(stranger_id, stranger_session, pay);
    raise exception 'FAIL: a stranger confirmed move-in';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pinpoint_deposit_confirm_move_in(owner_id, owner_session, pay);
    raise exception 'FAIL: the owner confirmed move-in on the renter''s behalf';
  exception when insufficient_privilege then null;
  end;
  reply := public.pinpoint_deposit_confirm_move_in(renter_id, renter_session, pay);
  again := public.pinpoint_deposit_confirm_move_in(renter_id, renter_session, pay);
  if reply->>'state' <> 'releasing' or (reply->>'commissionCents')::bigint <> 80000
    or again->>'state' <> 'releasing' or pg_temp.held_cents(pay) <> 720000 then
    raise exception 'FAIL: move-in did not take 10%% commission exactly once';
  end if;
  begin
    perform public.pinpoint_deposit_request_refund(renter_id, renter_session, pay);
    raise exception 'FAIL: a deposit was refunded after move-in was confirmed';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.pinpoint_deposit_record_payout(renter_id, pay, 'EFT-1', 'req-1');
    raise exception 'FAIL: a non-admin recorded an owner payout';
  exception when insufficient_privilege then null;
  end;
  reply := public.pinpoint_deposit_record_payout(admin_id, pay, 'EFT-1', 'req-1');
  if reply->>'state' <> 'released' or pg_temp.held_cents(pay) <> 0
    or (select amount_cents from public.payment_ledger_entries where payment_id = pay and kind = 'owner_payout') <> -720000 then
    raise exception 'FAIL: the owner payout is not R7,200 or the ledger does not balance';
  end if;
  begin
    perform public.pinpoint_deposit_record_payout(admin_id, pay, 'EFT-2', 'req-2');
    raise exception 'FAIL: the owner was paid twice';
  exception when sqlstate 'PT409' then null;
  end;

  ------------------------------------------- renter cancels before move-in date
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_refund);
  pay := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-refund', 800000, 'ZAR', 26795, '{}');
  begin
    perform public.pinpoint_deposit_request_refund(owner_id, owner_session, pay);
    raise exception 'FAIL: the owner requested the renter''s refund';
  exception when insufficient_privilege then null;
  end;
  reply := public.pinpoint_deposit_request_refund(renter_id, renter_session, pay);
  again := public.pinpoint_deposit_request_refund(renter_id, renter_session, pay);
  if reply->>'state' <> 'refunding' or (reply->>'cancellationFeeCents')::bigint <> 26795
    or again->>'state' <> 'refunding' or pg_temp.held_cents(pay) <> 773205 then
    raise exception 'FAIL: a renter cancellation did not keep the processing fee exactly once';
  end if;
  begin
    perform public.pinpoint_deposit_confirm_move_in(renter_id, renter_session, pay);
    raise exception 'FAIL: a deposit being refunded was released';
  exception when sqlstate 'PT409' then null;
  end;
  reply := public.pinpoint_deposit_record_refund(pay, 'rf-1');
  again := public.pinpoint_deposit_record_refund(pay, 'rf-1');
  if reply->>'state' <> 'refunded' or again->>'state' <> 'refunded' or pg_temp.held_cents(pay) <> 0
    or (select amount_cents from public.payment_ledger_entries where payment_id = pay and kind = 'renter_refund') <> -773205 then
    raise exception 'FAIL: the renter refund is not the deposit less the fee, or was recorded twice';
  end if;
  begin
    perform public.pinpoint_deposit_record_refund(pay, 'rf-2');
    raise exception 'FAIL: a second, different refund was recorded';
  exception when sqlstate 'PT409' then null;
  end;

  ----------------------------------------------------------------- owner cancels
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_owner_cancel);
  pay := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-owner-cancel', 800000, 'ZAR', 26795, '{}');
  begin
    perform public.pinpoint_deposit_owner_cancel(renter_id, renter_session, pay);
    raise exception 'FAIL: the renter used the owner''s cancellation';
  exception when insufficient_privilege then null;
  end;
  reply := public.pinpoint_deposit_owner_cancel(owner_id, owner_session, pay);
  if reply->>'state' <> 'refunding' or (reply->>'cancellationFeeCents')::bigint <> 0
    or pg_temp.held_cents(pay) <> 800000 then
    raise exception 'FAIL: an owner cancellation charged the renter a fee';
  end if;
  begin
    perform public.pinpoint_deposit_record_refund(pay, 'manual-eft', renter_id, 'req-3');
    raise exception 'FAIL: a non-admin recorded a manual refund';
  exception when insufficient_privilege then null;
  end;
  perform public.pinpoint_deposit_record_refund(pay, 'manual-eft', admin_id, 'req-3');
  if pg_temp.held_cents(pay) <> 0
    or not exists (select 1 from public.admin_audit_events
      where action_key = 'payment.refund_recorded' and target_id = pay and actor_id = admin_id) then
    raise exception 'FAIL: a manual full refund did not balance or was not audited';
  end if;

  -------------------------------------- renter cancels after move-in; owner contests
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_contest);
  pay := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-contest', 800000, 'ZAR', 26795, '{}');
  begin
    perform public.pinpoint_deposit_contest_refund(owner_id, owner_session, pay);
    raise exception 'FAIL: the owner contested a refund nobody asked for';
  exception when sqlstate 'PT409' then null;
  end;
  reply := public.pinpoint_deposit_request_refund(renter_id, renter_session, pay);
  if reply->>'state' <> 'held' or reply->>'refundRequestedAt' is null or reply->>'contestDeadline' is null then
    raise exception 'FAIL: a late cancellation skipped the owner''s contest window';
  end if;
  begin
    perform public.pinpoint_deposit_contest_refund(stranger_id, stranger_session, pay);
    raise exception 'FAIL: a stranger contested a refund';
  exception when insufficient_privilege then null;
  end;
  reply := public.pinpoint_deposit_contest_refund(owner_id, owner_session, pay);
  if reply->>'state' <> 'disputed' then
    raise exception 'FAIL: a contested refund did not become a dispute';
  end if;
  begin
    perform public.pinpoint_deposit_confirm_move_in(renter_id, renter_session, pay);
    raise exception 'FAIL: a disputed deposit was released without an admin';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.pinpoint_deposit_resolve_dispute(owner_id, pay, 'release', false, 'Owner deciding their own dispute', 'req-4');
    raise exception 'FAIL: a non-admin decided a dispute';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pinpoint_deposit_resolve_dispute(admin_id, pay, 'refund', true, 'short', 'req-4');
    raise exception 'FAIL: a dispute was decided without a proper reason';
  exception when invalid_parameter_value then null;
  end;
  reply := public.pinpoint_deposit_resolve_dispute(admin_id, pay, 'refund', true,
    'Photos show the unit did not match the listing', 'req-4');
  if reply->>'state' <> 'refunding' or (reply->>'cancellationFeeCents')::bigint <> 0
    or not exists (select 1 from public.admin_audit_events
      where action_key = 'payment.dispute_resolved' and target_id = pay
        and (metadata->>'cancellationFeeWaived')::boolean) then
    raise exception 'FAIL: an admin could not refund a dispute with the fee waived and audited';
  end if;

  ---------------------------------------- provider did not report its fee
  -- The money is still held; the fee is unknown, so a cancellation keeps nothing.
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_no_fee);
  pay := (reply->>'paymentId')::uuid;
  again := public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-no-fee', 800000, 'ZAR', null, '{}');
  select * into row from public.payments where id = pay;
  if again->>'outcome' <> 'applied' or row.state <> 'held' or row.provider_fee_cents is not null then
    raise exception 'FAIL: a charge without a reported fee was not held with the fee left unknown';
  end if;
  reply := public.pinpoint_deposit_request_refund(renter_id, renter_session, pay);
  if reply->>'state' <> 'refunding' or (reply->>'cancellationFeeCents')::bigint <> 0 then
    raise exception 'FAIL: a cancellation kept a fee the provider never reported';
  end if;
  perform public.pinpoint_deposit_attach_checkout(pay, reply->>'reference', 'https://checkout.paystack.com/late');
  if (select checkout_url from public.payments where id = pay) is not null then
    raise exception 'FAIL: a checkout link was attached to a deposit that is already paid';
  end if;

  ----------------------------------------------------------------------- sweep
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_expired);
  pay_expired := (reply->>'paymentId')::uuid;
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_uncontested);
  pay_uncontested := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-uncontested', 800000, 'ZAR', 26795, '{}');
  perform public.pinpoint_deposit_request_refund(renter_id, renter_session, pay_uncontested);
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_silent);
  pay_silent := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-silent', 800000, 'ZAR', 26795, '{}');
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_fresh);
  pay_fresh := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-fresh', 800000, 'ZAR', 26795, '{}');

  sweep := public.pinpoint_deposit_sweep();
  if (sweep->>'cancelled')::int <> 0 or (sweep->>'refundsStarted')::int <> 0 or (sweep->>'autoReleased')::int <> 1 then
    raise exception 'FAIL: the sweep acted before its deadlines: %', sweep;
  end if;
  select * into row from public.payments where id = pay_silent;
  if row.state <> 'releasing' or not row.auto_released or row.commission_cents <> 80000 then
    raise exception 'FAIL: a deposit the renter never answered was not released automatically';
  end if;

  -- Age the unpaid checkout and the refund request past their 24-hour limits.
  reset role;
  update public.payments set created_at = created_at - interval '25 hours' where id = pay_expired;
  update public.payments set refund_requested_at = refund_requested_at - interval '25 hours' where id = pay_uncontested;
  set local role service_role;

  begin
    perform public.pinpoint_deposit_contest_refund(owner_id, owner_session, pay_uncontested);
    raise exception 'FAIL: the owner contested after the 24-hour window closed';
  exception when sqlstate 'PT409' then null;
  end;
  sweep := public.pinpoint_deposit_sweep();
  if (sweep->>'cancelled')::int <> 1 or (sweep->>'refundsStarted')::int <> 1 or (sweep->>'autoReleased')::int <> 0 then
    raise exception 'FAIL: the sweep missed an expired checkout or an uncontested refund: %', sweep;
  end if;
  if (select state from public.payments where id = pay_expired) <> 'cancelled'
    or (select state from public.payments where id = pay_fresh) <> 'held' then
    raise exception 'FAIL: the sweep cancelled or moved the wrong deposits';
  end if;
  select * into row from public.payments where id = pay_uncontested;
  if row.state <> 'refunding' or row.cancellation_fee_cents <> 26795 then
    raise exception 'FAIL: an uncontested refund did not start with the cancellation fee';
  end if;

  -- A payment that lands after the checkout expired is still real money.
  select * into row from public.payments where id = pay_expired;
  again := public.pinpoint_deposit_record_charge(row.provider_reference, 'evt-late', 800000, 'ZAR', 26795, '{}');
  if again->>'outcome' <> 'applied' or (select state from public.payments where id = pay_expired) <> 'held' then
    raise exception 'FAIL: a late payment on an expired checkout was not held';
  end if;

  ------------------------------------------------------------ refund dispatch
  -- Paystack refunds have no idempotency key, so each deposit is sent to
  -- Paystack at most once; anything unclear goes to a person.
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_dispatch);
  pay := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-dispatch', 800000, 'ZAR', 26795, '{}');
  if jsonb_array_length(public.pinpoint_deposit_claim_refunds(10, pay)) <> 0 then
    raise exception 'FAIL: a held deposit was claimed for a refund';
  end if;
  perform public.pinpoint_deposit_request_refund(renter_id, renter_session, pay);
  claim := public.pinpoint_deposit_claim_refunds(10, pay);
  if jsonb_array_length(claim) <> 1 or (claim->0->>'paymentId')::uuid <> pay
    or (claim->0->>'refundCents')::bigint <> 773205
    or claim->0->>'reference' <> (select provider_reference from public.payments where id = pay) then
    raise exception 'FAIL: a deposit awaiting refund was not claimed for the deposit less the fee: %', claim;
  end if;
  if jsonb_array_length(public.pinpoint_deposit_claim_refunds(10, pay)) <> 0 then
    raise exception 'FAIL: a refund was claimed twice';
  end if;
  begin
    perform public.pinpoint_deposit_finish_refund_dispatch(pay, 'resend', null, null);
    raise exception 'FAIL: an unknown dispatch outcome was accepted';
  exception when sqlstate '22023' then null;
  end;
  reply := public.pinpoint_deposit_finish_refund_dispatch(pay, 'submitted', '15581137', null);
  again := public.pinpoint_deposit_finish_refund_dispatch(pay, 'submitted', '15581137', null);
  select * into row from public.payments where id = pay;
  if row.refund_dispatch <> 'submitted' or row.provider_refund_id <> '15581137' or reply <> again then
    raise exception 'FAIL: a submitted refund was not recorded once';
  end if;
  begin
    perform public.pinpoint_deposit_finish_refund_dispatch(pay, 'manual', null, 'late');
    raise exception 'FAIL: a submitted refund was moved to the manual queue';
  exception when sqlstate 'PT409' then null;
  end;
  perform public.pinpoint_deposit_record_refund(pay, 'paystack:132013318360');
  if (select state from public.payments where id = pay) <> 'refunded' then
    raise exception 'FAIL: a dispatched refund could not be recorded';
  end if;

  -- A claim with no outcome may have reached Paystack, so it is never resent.
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_stale);
  pay := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-stale', 800000, 'ZAR', 26795, '{}');
  perform public.pinpoint_deposit_owner_cancel(owner_id, owner_session, pay);
  claim := public.pinpoint_deposit_claim_refunds(10, pay);
  if (claim->0->>'refundCents')::bigint <> 800000 then
    raise exception 'FAIL: an owner cancellation was not claimed for the full deposit';
  end if;
  update public.payments set refund_dispatched_at = clock_timestamp() - interval '11 minutes' where id = pay;
  if jsonb_array_length(public.pinpoint_deposit_claim_refunds(10, pay)) <> 0 then
    raise exception 'FAIL: an unfinished refund claim was sent again';
  end if;
  select * into row from public.payments where id = pay;
  if row.refund_dispatch <> 'manual' or row.refund_manual_reason <> 'claim_expired' then
    raise exception 'FAIL: an unfinished refund claim did not go to the manual queue';
  end if;

  -- Paystack reporting a failed refund sends it to a person.
  reply := public.pinpoint_deposit_start(renter_id, renter_session, app_flag);
  pay := (reply->>'paymentId')::uuid;
  perform public.pinpoint_deposit_record_charge(reply->>'reference', 'evt-flag', 800000, 'ZAR', 26795, '{}');
  perform public.pinpoint_deposit_owner_cancel(owner_id, owner_session, pay);
  perform public.pinpoint_deposit_claim_refunds(10, pay);
  perform public.pinpoint_deposit_finish_refund_dispatch(pay, 'submitted', '15581138', null);
  -- Read the row in a later statement: a statement does not see its own function's update.
  again := public.pinpoint_deposit_flag_refund(reply->>'reference', 'refund.failed');
  if (again->>'flagged')::boolean is not true
    or (select refund_dispatch from public.payments where id = pay) <> 'manual'
    or (select refund_manual_reason from public.payments where id = pay) <> 'refund.failed' then
    raise exception 'FAIL: a refund Paystack reported as failed did not go to the manual queue';
  end if;
  if (public.pinpoint_deposit_flag_refund('dep_unknown', 'refund.failed')->>'flagged')::boolean then
    raise exception 'FAIL: a failed refund for an unknown deposit was flagged';
  end if;

  ------------------------------------------------------------- payout account
  begin
    perform public.pinpoint_owner_payout_account_save(stranger_id, renter_session,
      'Plan Stranger', 'Test Bank', '250655', '62000000042');
    raise exception 'FAIL: bank details were saved with another person''s session';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.pinpoint_owner_payout_account_save(stranger_id, stranger_session,
      'Plan Stranger', 'Test Bank', '25065', '62000000042');
    raise exception 'FAIL: a branch code that is not six digits was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.pinpoint_owner_payout_account_save(stranger_id, stranger_session,
      ' ', 'Test Bank', '250655', '62000000042');
    raise exception 'FAIL: a blank account holder was accepted';
  exception when sqlstate '22023' then null;
  end;
  if public.pinpoint_owner_payout_account_get(stranger_id) is not null then
    raise exception 'FAIL: an owner with no bank details has a payout account';
  end if;
  reply := public.pinpoint_owner_payout_account_save(stranger_id, stranger_session,
    '  Plan Stranger ', 'Test Bank', '250655', '62000000042');
  if reply->>'accountLast4' <> '0042' or reply->>'accountHolder' <> 'Plan Stranger'
    or reply->>'branchCode' <> '250655' or reply ? 'accountNumber'
    or reply::text like '%62000000042%' then
    raise exception 'FAIL: saving bank details did not return a masked summary: %', reply;
  end if;
  again := public.pinpoint_owner_payout_account_save(stranger_id, stranger_session,
    'Plan Stranger', 'Other Bank', '470010', '1234567890');
  if again->>'accountLast4' <> '7890' or again->>'bankName' <> 'Other Bank'
    or (select count(*) from public.owner_payout_accounts o where o.owner_id = stranger_id) <> 1
    or (select account_number from public.owner_payout_accounts o where o.owner_id = stranger_id) <> '1234567890' then
    raise exception 'FAIL: replacing bank details did not update the one account';
  end if;
  if public.pinpoint_owner_payout_account_get(stranger_id) <> again then
    raise exception 'FAIL: reading bank details does not match what was saved';
  end if;

  ------------------------------------------------------------------ invariants
  begin
    insert into public.payments(application_id, listing_id, renter_id, owner_id, amount_cents, commission_bps,
        move_in_date, provider_reference)
      select p.application_id, p.listing_id, p.renter_id, p.owner_id, p.amount_cents, p.commission_bps,
        p.move_in_date, 'dep_dupe'
      from public.payments p where p.id = pay_fresh;
    raise exception 'FAIL: an application has two active deposits';
  exception when unique_violation then null;
  end;
  begin
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents) values (pay_fresh, 'charge', 800000);
    raise exception 'FAIL: a deposit was charged to the ledger twice';
  exception when unique_violation then null;
  end;
  begin
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents) values (pay_fresh, 'owner_payout', 100);
    raise exception 'FAIL: a payout was written with the wrong sign';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.payments p
      where p.state in ('released', 'refunded') and pg_temp.held_cents(p.id) <> 0) then
    raise exception 'FAIL: a finished deposit still shows money held';
  end if;

  reset role;
  raise notice 'PASS: deposit payments acceptance plan';
end $$;

rollback;
