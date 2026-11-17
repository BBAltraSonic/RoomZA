-- Deposit operations (docs/deposit-payments-proposal.md, build steps 4 to 6):
-- notices to renters, owners and admins as a deposit moves; move-in reminders;
-- the admin tools for paying owners and finishing refunds by hand; and the
-- automatic release counted from payment when the renter paid after the move-in date.
begin;

---------------------------------------------------------------------- notices

-- Rands for notices: R8,000 or R7,732.05.
create function private.deposit_rands(cents bigint)
returns text language sql immutable security invoker set search_path='' as $$
  select 'R' || case when cents % 100 = 0 then to_char(cents / 100, 'FM999,999,999,990')
    else to_char(cents / 100.0, 'FM999,999,999,990.00') end;
$$;

-- The moment the renter can first answer "did you move in?": the start of the
-- move-in date in South Africa, or the payment if it came later. The deposit
-- releases to the owner 72 hours after this if the renter never answers.
create function private.deposit_answer_from(payment public.payments)
returns timestamptz language sql stable security invoker set search_path='' as $$
  select greatest(payment.move_in_date::timestamp at time zone 'Africa/Johannesburg',
    coalesce(payment.paid_at, '-infinity'::timestamptz));
$$;

-- Queue one notice. A notice that cannot be stored never blocks the money
-- moving: the failure is logged by SQLSTATE only and the state change stands.
create function private.deposit_notice(
  recipient uuid, event_type public.notification_type, unique_key text, body jsonb
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  event_id uuid;
begin
  event_id := private.notification_enqueue(recipient, event_type,
    (case when event_type = 'admin_alert' then 'security' else 'account_updates' end)::public.notification_category,
    unique_key, body, null, 'payments', (body->>'paymentId')::uuid);
  return event_id is not null;
exception when others then
  raise log 'Deposit notice was not queued (SQLSTATE %)', sqlstate;
  return false;
end;
$$;

-- Tell every active admin about a deposit that needs a person.
create function private.deposit_alert_admins(payment public.payments, event_name text, title text, message text)
returns void language plpgsql security definer set search_path='' as $$
declare
  admin_id uuid;
begin
  for admin_id in select m.user_id from public.admin_memberships m where m.revoked_at is null loop
    perform private.deposit_notice(admin_id, 'admin_alert',
      'deposit-admin:' || payment.id || ':' || event_name || ':' || admin_id,
      jsonb_build_object('title', title, 'message', message, 'paymentId', payment.id));
  end loop;
end;
$$;

create function private.deposit_notify()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  place text;
  amount text := private.deposit_rands(new.amount_cents);
  refund bigint;
  payout bigint;
  renter_body jsonb := jsonb_build_object('paymentId', new.id, 'applicationId', new.application_id,
    'depositRole', 'renter');
  owner_body jsonb := jsonb_build_object('paymentId', new.id, 'listingId', new.listing_id,
    'depositRole', 'owner');
  key_prefix text := 'deposit:' || new.id || ':';
begin
  select coalesce(nullif(btrim(l.title), ''), 'your rental') into place
    from public.listings l where l.id = new.listing_id;
  place := coalesce(place, 'your rental');

  if new.state = 'held' and old.state is distinct from 'held' then
    perform private.deposit_notice(new.renter_id, 'deposit_update', key_prefix || 'held:renter',
      renter_body || jsonb_build_object('title', 'Deposit paid',
        'message', 'RoomZA is holding your ' || amount || ' deposit for ' || place || ' until you move in.'));
    perform private.deposit_notice(new.owner_id, 'deposit_update', key_prefix || 'held:owner',
      owner_body || jsonb_build_object('title', 'Deposit paid',
        'message', 'The renter paid the ' || amount || ' deposit for ' || place
          || '. RoomZA holds it until they move in.'));
  end if;

  if new.state = 'held' and old.refund_requested_at is null and new.refund_requested_at is not null then
    perform private.deposit_notice(new.owner_id, 'deposit_update', key_prefix || 'refund-requested:owner',
      owner_body || jsonb_build_object('title', 'The renter is not satisfied',
        'message', 'The renter of ' || place || ' asked for their deposit back. If they moved in, tell us by '
          || to_char((new.refund_requested_at + interval '24 hours') at time zone 'Africa/Johannesburg',
            'FMDD Mon YYYY, HH24:MI')
          || ' and RoomZA will review it. Otherwise their refund starts then.'));
  end if;

  if new.state = 'disputed' and old.state is distinct from 'disputed' then
    perform private.deposit_notice(new.renter_id, 'deposit_update', key_prefix || 'disputed:renter',
      renter_body || jsonb_build_object('title', 'Deposit under review',
        'message', 'The landlord says you moved in at ' || place
          || '. RoomZA is reviewing what happened and will tell you the decision.'));
    perform private.deposit_notice(new.owner_id, 'deposit_update', key_prefix || 'disputed:owner',
      owner_body || jsonb_build_object('title', 'Deposit under review',
        'message', 'RoomZA is reviewing the deposit for ' || place || ' and will tell you the decision.'));
    perform private.deposit_alert_admins(new, 'disputed', 'Deposit dispute to decide',
      'A renter and owner disagree about a move-in. Decide where the ' || amount || ' deposit goes.');
  end if;

  if new.state = 'releasing' and old.state is distinct from 'releasing' then
    payout := new.amount_cents - coalesce(new.commission_cents, 0);
    perform private.deposit_notice(new.owner_id, 'deposit_update', key_prefix || 'releasing:owner',
      owner_body || jsonb_build_object('title', 'Payout on its way',
        'message', case
            when old.state = 'disputed' then 'RoomZA reviewed the deposit for ' || place || ' and decided it goes to you. '
            when new.auto_released then 'The renter did not respond after the move-in date at ' || place || ', so the deposit goes to you. '
            else 'The renter confirmed they moved in at ' || place || '. '
          end
          || 'RoomZA sends you ' || private.deposit_rands(payout)
          || ' by bank transfer: the deposit less its commission. You still owe the renter the full '
          || amount || ' at the end of the lease.'));
    if old.state = 'disputed' or new.auto_released then
      perform private.deposit_notice(new.renter_id, 'deposit_update', key_prefix || 'releasing:renter',
        renter_body || jsonb_build_object('title', 'Deposit paid to the landlord',
          'message', case when old.state = 'disputed'
              then 'RoomZA reviewed your deposit for ' || place || ' and decided it goes to the landlord.'
              else 'We did not hear from you after your move-in date at ' || place || ', so your deposit went to the landlord.'
            end
            || ' The landlord returns it at the end of your lease under its terms.'));
    end if;
    perform private.deposit_alert_admins(new, 'releasing', 'Owner payout to send',
      'Send ' || private.deposit_rands(payout) || ' to the owner by bank transfer and record the reference.');
  end if;

  if new.state = 'released' and old.state is distinct from 'released' then
    perform private.deposit_notice(new.owner_id, 'deposit_update', key_prefix || 'released:owner',
      owner_body || jsonb_build_object('title', 'Payout sent',
        'message', 'RoomZA sent ' || private.deposit_rands(new.amount_cents - coalesce(new.commission_cents, 0))
          || ' for ' || place || ' to your bank account. Reference: ' || coalesce(new.payout_reference, 'none') || '.'));
  end if;

  if new.state = 'refunding' and old.state is distinct from 'refunding' then
    refund := new.amount_cents - coalesce(new.cancellation_fee_cents, 0);
    perform private.deposit_notice(new.renter_id, 'deposit_update', key_prefix || 'refunding:renter',
      renter_body || jsonb_build_object('title', 'Refund on its way',
        'message', case when old.state = 'disputed'
            then 'RoomZA reviewed your deposit for ' || place || ' and decided it comes back to you. '
            else ''
          end
          || 'We are returning ' || private.deposit_rands(refund) || ' to the card you paid with.'
          || case when coalesce(new.cancellation_fee_cents, 0) > 0
              then ' We kept ' || private.deposit_rands(new.cancellation_fee_cents) || ' to cover the card processing fee.'
              else '' end));
    perform private.deposit_notice(new.owner_id, 'deposit_update', key_prefix || 'refunding:owner',
      owner_body || jsonb_build_object('title', 'Deposit going back to the renter',
        'message', 'The ' || amount || ' deposit for ' || place || ' is being refunded to the renter.'));
  end if;

  if new.state = 'refunded' and old.state is distinct from 'refunded' then
    refund := new.amount_cents - coalesce(new.cancellation_fee_cents, 0);
    if refund > 0 then
      perform private.deposit_notice(new.renter_id, 'deposit_update', key_prefix || 'refunded:renter',
        renter_body || jsonb_build_object('title', 'Refund sent',
          'message', private.deposit_rands(refund) || ' of your deposit for ' || place
            || ' was sent back to you. Your bank may take a few days to show it.'));
    end if;
  end if;

  if new.state = 'refunding' and new.refund_dispatch = 'manual'
    and old.refund_dispatch is distinct from 'manual'
    and new.refund_manual_reason is distinct from 'admin_takeover' then
    perform private.deposit_alert_admins(new, 'manual-refund', 'Refund needs a person',
      'Paystack did not take a ' || private.deposit_rands(new.amount_cents - coalesce(new.cancellation_fee_cents, 0))
        || ' refund (' || coalesce(new.refund_manual_reason, 'no reason given')
        || '). Check Paystack, then refund by hand and record the reference.');
  end if;

  return null;
end;
$$;

create trigger payments_notify
  after update on public.payments
  for each row
  when (old.state is distinct from new.state
    or old.refund_requested_at is distinct from new.refund_requested_at
    or old.refund_dispatch is distinct from new.refund_dispatch)
  execute function private.deposit_notify();

-- A reminder to answer "did you move in?". Returns true when it was queued now.
create function private.deposit_remind(payment public.payments, reminder integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  place text;
begin
  select coalesce(nullif(btrim(l.title), ''), 'your rental') into place
    from public.listings l where l.id = payment.listing_id;
  return private.deposit_notice(payment.renter_id, 'deposit_update',
    'deposit:' || payment.id || ':reminder:' || reminder,
    jsonb_build_object('paymentId', payment.id, 'applicationId', payment.application_id, 'depositRole', 'renter',
      'title', case when reminder = 1 then 'Did you move in?' else 'Reminder: did you move in?' end,
      'message', 'Tell us you moved in at ' || coalesce(place, 'your rental')
        || ' so we can pay the landlord, or say you are not satisfied. If we do not hear from you, the deposit goes to the landlord on '
        || to_char((private.deposit_answer_from(payment) + interval '72 hours') at time zone 'Africa/Johannesburg', 'FMDD Mon YYYY')
        || '.'));
end;
$$;

revoke all on function private.deposit_rands(bigint) from public, anon, authenticated, service_role;
revoke all on function private.deposit_answer_from(public.payments) from public, anon, authenticated, service_role;
revoke all on function private.deposit_notice(uuid, public.notification_type, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.deposit_alert_admins(public.payments, text, text, text) from public, anon, authenticated, service_role;
revoke all on function private.deposit_notify() from public, anon, authenticated, service_role;
revoke all on function private.deposit_remind(public.payments, integer) from public, anon, authenticated, service_role;
grant execute on function private.deposit_answer_from(public.payments) to service_role;
grant execute on function private.deposit_remind(public.payments, integer) to service_role;

----------------------------------------------------------------- timed rules

-- Replaces the step 1 sweep. Changes: the automatic release counts from the
-- payment when it came after the move-in date, so a late payer still gets
-- 72 hours to answer; and renters are reminded from that moment and 24 hours later.
create or replace function public.pinpoint_deposit_sweep()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  target uuid;
  payment public.payments%rowtype;
  cancelled_count integer := 0;
  refund_count integer := 0;
  release_count integer := 0;
  reminder_count integer := 0;
begin
  for target in
    select p.id from public.payments p
    where p.state = 'awaiting_payment' and p.created_at < statement_timestamp() - interval '24 hours'
    for update skip locked
  loop
    update public.payments set state = 'cancelled', cancelled_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = target;
    cancelled_count := cancelled_count + 1;
  end loop;
  for target in
    select p.id from public.payments p
    where p.state = 'held' and p.refund_requested_at is not null
      and p.refund_requested_at + interval '24 hours' <= statement_timestamp()
    for update skip locked
  loop
    perform private.deposit_start_refund(target, true);
    refund_count := refund_count + 1;
  end loop;
  for target in
    select p.id from public.payments p
    where p.state = 'held' and p.refund_requested_at is null
      and private.deposit_answer_from(p) + interval '72 hours' <= statement_timestamp()
    for update skip locked
  loop
    perform private.deposit_start_release(target, true);
    release_count := release_count + 1;
  end loop;
  for payment in
    select * from public.payments p
    where p.state = 'held' and p.refund_requested_at is null
      and private.deposit_answer_from(p) <= statement_timestamp()
  loop
    if private.deposit_remind(payment, 1) then reminder_count := reminder_count + 1; end if;
    if private.deposit_answer_from(payment) + interval '24 hours' <= statement_timestamp()
      and private.deposit_remind(payment, 2) then
      reminder_count := reminder_count + 1;
    end if;
  end loop;
  return jsonb_build_object('cancelled', cancelled_count, 'refundsStarted', refund_count,
    'autoReleased', release_count, 'reminders', reminder_count);
end;
$$;

--------------------------------------------------------------- admin: refunds

-- Admin takes a waiting refund out of the automatic path to send it by bank
-- transfer. Only a refund nobody has sent yet: one claimed or accepted by
-- Paystack may already be moving money.
create function public.pinpoint_deposit_take_refund(
  actor uuid, target_payment_id uuid, audit_request_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  perform public.assert_admin_actor(actor);
  select * into payment from public.payments p where p.id = target_payment_id for update;
  if not found then
    raise exception 'Deposit not found' using errcode = '42501';
  end if;
  if payment.state <> 'refunding' then
    raise exception 'Deposit is not awaiting a refund' using errcode = 'PT409';
  end if;
  if payment.refund_dispatch = 'manual' then return private.deposit_summary(payment); end if;
  if payment.refund_dispatch = 'claimed' then
    raise exception 'The refund is being sent to Paystack' using errcode = 'PT409';
  end if;
  if payment.refund_dispatch = 'submitted' then
    raise exception 'Paystack has accepted this refund' using errcode = 'PT409';
  end if;
  update public.payments set refund_dispatch = 'manual', refund_manual_reason = 'admin_takeover',
      updated_at = clock_timestamp()
    where id = payment.id returning * into payment;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
    values (actor, 'payment.refund_taken_over', 'payment', payment.id, null, audit_request_id, '{}'::jsonb);
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_take_refund(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_take_refund(uuid, uuid, text) to service_role;

-- Replaces the step 1 function. Change: an admin may record a refund only once
-- it is marked for manual handling, so a refund Paystack is sending cannot
-- also be paid by bank transfer.
create or replace function public.pinpoint_deposit_record_refund(
  target_payment_id uuid, external_reference text, actor uuid default null,
  audit_request_id text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
  refund bigint;
begin
  if actor is not null then perform public.assert_admin_actor(actor); end if;
  if external_reference is null or char_length(btrim(external_reference)) not between 1 and 200 then
    raise exception 'A refund reference is required' using errcode = '22023';
  end if;
  select * into payment from public.payments p where p.id = target_payment_id for update;
  if not found then
    raise exception 'Deposit not found' using errcode = '42501';
  end if;
  if payment.state = 'refunded' and payment.refund_reference = btrim(external_reference) then
    return private.deposit_summary(payment);
  end if;
  if payment.state <> 'refunding' then
    raise exception 'Deposit is not awaiting a refund' using errcode = 'PT409';
  end if;
  if actor is not null and payment.refund_dispatch is distinct from 'manual' then
    raise exception 'Refund is not marked for manual handling' using errcode = 'PT409';
  end if;
  refund := payment.amount_cents - payment.cancellation_fee_cents;
  update public.payments set state = 'refunded', refund_reference = btrim(external_reference),
      refunded_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = payment.id returning * into payment;
  if refund > 0 then
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents, external_reference)
      values (payment.id, 'renter_refund', -refund, btrim(external_reference));
  end if;
  if actor is not null then
    insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
      values (actor, 'payment.refund_recorded', 'payment', payment.id, null, audit_request_id,
        jsonb_build_object('refundCents', refund));
  end if;
  return private.deposit_summary(payment);
end;
$$;

-------------------------------------------------------------- admin: payouts

-- The owner's full bank details, for the admin making the payout transfer.
-- Only while a payout is due, and every view is audited. Says whether the
-- details changed after the renter paid, a sign the owner's account may have
-- been taken over.
create function public.pinpoint_owner_payout_account_reveal(
  actor uuid, target_payment_id uuid, audit_request_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
  account public.owner_payout_accounts%rowtype;
begin
  perform public.assert_admin_actor(actor);
  select * into payment from public.payments p where p.id = target_payment_id;
  if not found then
    raise exception 'Deposit not found' using errcode = '42501';
  end if;
  if payment.state <> 'releasing' then
    raise exception 'Deposit is not awaiting an owner payout' using errcode = 'PT409';
  end if;
  select * into account from public.owner_payout_accounts o where o.owner_id = payment.owner_id;
  if not found then
    raise exception 'The owner has no bank details' using errcode = 'PT409';
  end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
    values (actor, 'payment.payout_account_viewed', 'payment', payment.id, null, audit_request_id,
      jsonb_build_object('ownerId', payment.owner_id));
  return jsonb_build_object(
    'accountHolder', account.account_holder,
    'bankName', account.bank_name,
    'branchCode', account.branch_code,
    'accountNumber', account.account_number,
    'updatedAt', account.updated_at,
    'changedAfterPayment', payment.paid_at is not null and account.updated_at > payment.paid_at,
    'payoutCents', payment.amount_cents - payment.commission_cents
  );
end;
$$;
revoke all on function public.pinpoint_owner_payout_account_reveal(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_owner_payout_account_reveal(uuid, uuid, text) to service_role;

-------------------------------------------------- admin: provider events

-- A charge RoomZA could not apply (unknown reference, wrong amount, paid
-- twice, replaced deposit) is money that arrived without a home. An admin
-- settles it on Paystack and records here what was done, which clears it from
-- the queue. The event itself is never changed otherwise.
alter table public.payment_provider_events
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column review_note text check (char_length(review_note) <= 2000);
grant update (reviewed_at, reviewed_by, review_note) on table public.payment_provider_events to service_role;
create index payment_provider_events_unreviewed_idx on public.payment_provider_events(received_at desc)
  where outcome = 'needs_review' and reviewed_at is null;

create function public.pinpoint_payment_event_mark_reviewed(
  actor uuid, target_event_id uuid, note text, audit_request_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  event public.payment_provider_events%rowtype;
begin
  perform public.assert_admin_actor(actor);
  if note is null or char_length(btrim(note)) not between 10 and 2000 then
    raise exception 'Say what was done about this payment' using errcode = '22023';
  end if;
  select * into event from public.payment_provider_events e where e.id = target_event_id for update;
  if not found then
    raise exception 'Payment event not found' using errcode = '42501';
  end if;
  if event.outcome <> 'needs_review' then
    raise exception 'Payment event does not need review' using errcode = 'PT409';
  end if;
  if event.reviewed_at is null then
    update public.payment_provider_events set reviewed_at = clock_timestamp(), reviewed_by = actor,
        review_note = btrim(note)
      where id = event.id returning * into event;
    insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
      values (actor, 'payment.provider_event_reviewed', 'payment_provider_event', event.id, btrim(note),
        audit_request_id, jsonb_build_object('paymentId', event.payment_id, 'reason', event.reason));
  end if;
  return jsonb_build_object('eventId', event.id, 'paymentId', event.payment_id, 'reviewedAt', event.reviewed_at);
end;
$$;
revoke all on function public.pinpoint_payment_event_mark_reviewed(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_payment_event_mark_reviewed(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
