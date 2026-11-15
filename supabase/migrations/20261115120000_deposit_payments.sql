-- Rental deposits paid through and held by RoomZA (docs/deposit-payments-proposal.md).
-- This migration holds the money rules only: tables, state changes and the
-- ledger. No payment provider is called from here.
--
-- Every amount is whole cents. Tables are reachable only through the
-- service-role functions below; browsers have no direct access.
begin;

-- One row. The rate is copied onto each deposit when checkout starts, so a
-- later change never alters a deposit already in progress.
create table public.payment_settings (
  singleton boolean primary key default true check (singleton),
  deposit_commission_bps integer not null default 1000
    check (deposit_commission_bps between 0 and 10000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);
insert into public.payment_settings default values;

create table public.owner_payout_accounts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  account_holder text not null check (char_length(btrim(account_holder)) between 2 and 120),
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 80),
  branch_code text not null check (branch_code ~ '^[0-9]{6}$'),
  account_number text not null check (account_number ~ '^[0-9]{6,16}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

-- A payment outlives the application and listing it came from, and a profile
-- with payment history cannot be deleted: these are financial records.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  purpose text not null default 'rental_deposit' check (purpose in ('rental_deposit')),
  application_id uuid references public.applications(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  renter_id uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  state text not null default 'awaiting_payment' check (state in (
    'awaiting_payment','held','disputed','releasing','released','refunding','refunded','cancelled'
  )),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  move_in_date date not null,
  provider text not null default 'paystack' check (provider in ('paystack')),
  provider_reference text not null unique,
  -- The hosted checkout page for this deposit. The provider refuses a second
  -- checkout under the same reference, so a retry reuses this link.
  checkout_url text check (checkout_url ~ '^https://' and char_length(checkout_url) <= 2048),
  -- Null when the provider did not report its fee; a cancellation then keeps nothing.
  provider_fee_cents bigint check (provider_fee_cents >= 0),
  commission_cents bigint check (commission_cents >= 0),
  cancellation_fee_cents bigint check (cancellation_fee_cents >= 0),
  refund_requested_at timestamptz,
  auto_released boolean not null default false,
  payout_reference text,
  refund_reference text,
  created_at timestamptz not null default clock_timestamp(),
  paid_at timestamptz,
  disputed_at timestamptz,
  release_started_at timestamptz,
  released_at timestamptz,
  refund_started_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check (renter_id <> owner_id)
);
create unique index payments_one_active_per_application
  on public.payments(application_id) where state <> 'cancelled';
create index payments_renter_idx on public.payments(renter_id, created_at desc);
create index payments_owner_idx on public.payments(owner_id, created_at desc);
create index payments_open_state_idx on public.payments(state, move_in_date)
  where state in ('awaiting_payment','held','disputed','releasing','refunding');

-- Append-only money trail. Amounts are signed from the point of view of the
-- money RoomZA holds for other people: the charge adds to it and everything
-- else takes from it, so a payment's entries sum to what is still held.
-- Each kind can occur once per payment, which blocks a second payout or refund.
create table public.payment_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  kind text not null check (kind in (
    'charge','commission','cancellation_fee','owner_payout','renter_refund'
  )),
  amount_cents bigint not null,
  external_reference text,
  created_at timestamptz not null default clock_timestamp(),
  unique (payment_id, kind),
  check ((kind = 'charge' and amount_cents > 0) or (kind <> 'charge' and amount_cents < 0))
);

-- Every provider notification, applied or not, so no report of money moving is lost.
create table public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack')),
  event_key text not null check (char_length(event_key) between 1 and 200),
  payment_id uuid references public.payments(id) on delete restrict,
  kind text not null,
  outcome text not null check (outcome in ('applied','needs_review')),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default clock_timestamp(),
  unique (provider, event_key)
);

alter table public.payment_settings enable row level security;
alter table public.payment_settings force row level security;
alter table public.owner_payout_accounts enable row level security;
alter table public.owner_payout_accounts force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.payment_ledger_entries enable row level security;
alter table public.payment_ledger_entries force row level security;
alter table public.payment_provider_events enable row level security;
alter table public.payment_provider_events force row level security;

revoke all on table public.payment_settings, public.owner_payout_accounts, public.payments,
  public.payment_ledger_entries, public.payment_provider_events
  from public, anon, authenticated, service_role;
grant select, update on table public.payment_settings to service_role;
grant select, insert, update, delete on table public.owner_payout_accounts to service_role;
grant select, insert, update on table public.payments to service_role;
grant select, insert on table public.payment_ledger_entries to service_role;
grant select, insert on table public.payment_provider_events to service_role;

-- What callers get back after any state change.
create function private.deposit_summary(payment public.payments)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object(
    'paymentId', payment.id,
    'state', payment.state,
    'amountCents', payment.amount_cents,
    'currency', payment.currency,
    'reference', payment.provider_reference,
    'checkoutUrl', payment.checkout_url,
    'commissionCents', payment.commission_cents,
    'cancellationFeeCents', payment.cancellation_fee_cents,
    'refundRequestedAt', payment.refund_requested_at,
    'contestDeadline', payment.refund_requested_at + interval '24 hours',
    'autoReleased', payment.auto_released
  );
$$;
revoke all on function private.deposit_summary(public.payments) from public, anon, authenticated, service_role;
grant execute on function private.deposit_summary(public.payments) to service_role;

-- held or disputed -> releasing. The caller holds the row lock and has checked the state.
-- Commission is rounded half a cent up, matching src/features/payments/money.ts.
create function private.deposit_start_release(target_payment_id uuid, automatic boolean)
returns public.payments language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
  commission bigint;
begin
  select * into strict payment from public.payments p where p.id = target_payment_id for update;
  commission := (payment.amount_cents * payment.commission_bps + 5000) / 10000;
  update public.payments set state = 'releasing', commission_cents = commission,
      auto_released = automatic, refund_requested_at = null,
      release_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = payment.id returning * into payment;
  if commission > 0 then
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents)
      values (payment.id, 'commission', -commission);
  end if;
  return payment;
end;
$$;
revoke all on function private.deposit_start_release(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function private.deposit_start_release(uuid, boolean) to service_role;

-- held or disputed -> refunding. The cancellation fee equals the processing fee
-- the provider charged, capped at the deposit, and is fixed at this moment.
create function private.deposit_start_refund(target_payment_id uuid, fee_applies boolean)
returns public.payments language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
  fee bigint := 0;
begin
  select * into strict payment from public.payments p where p.id = target_payment_id for update;
  if fee_applies then
    fee := least(coalesce(payment.provider_fee_cents, 0), payment.amount_cents);
  end if;
  update public.payments set state = 'refunding', cancellation_fee_cents = fee,
      refund_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = payment.id returning * into payment;
  if fee > 0 then
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents)
      values (payment.id, 'cancellation_fee', -fee);
  end if;
  return payment;
end;
$$;
revoke all on function private.deposit_start_refund(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function private.deposit_start_refund(uuid, boolean) to service_role;

-- Renter starts checkout for an approved application. Calling it again while
-- the deposit is unpaid returns the same deposit instead of creating another.
create function public.pinpoint_deposit_start(
  actor_id uuid, actor_session_id uuid, target_application_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  application public.applications%rowtype;
  listing public.listings%rowtype;
  payment public.payments%rowtype;
  rate integer;
  new_id uuid;
begin
  if not public.pinpoint_active_session(actor_id, actor_session_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  -- The application lock serialises concurrent checkout attempts.
  select * into application from public.applications a
    where a.id = target_application_id and a.renter_id = actor_id for update;
  if not found then
    raise exception 'Application not found or access denied' using errcode = '42501';
  end if;
  if application.status <> 'approved' then
    raise exception 'Application is not approved' using errcode = 'PT409';
  end if;
  select * into payment from public.payments p
    where p.application_id = application.id and p.state <> 'cancelled';
  if found then
    if payment.state = 'awaiting_payment' then return private.deposit_summary(payment); end if;
    raise exception 'Deposit already paid' using errcode = 'PT409';
  end if;
  select * into listing from public.listings l where l.id = application.listing_id for share;
  if not found or listing.listing_type <> 'rent' or listing.landlord_id = actor_id
    or exists (select 1 from public.listing_restrictions r
      where r.listing_id = listing.id and r.restored_at is null) then
    raise exception 'Listing unavailable' using errcode = '42501';
  end if;
  if listing.deposit_amount is null or listing.deposit_amount <= 0
    or not exists (select 1 from public.owner_payout_accounts o where o.owner_id = listing.landlord_id) then
    raise exception 'Online deposits are not enabled for this listing' using errcode = 'PT409';
  end if;
  select s.deposit_commission_bps into strict rate from public.payment_settings s;
  new_id := gen_random_uuid();
  insert into public.payments(
      id, application_id, listing_id, renter_id, owner_id, amount_cents, commission_bps,
      move_in_date, provider_reference)
    values (
      new_id, application.id, listing.id, actor_id, listing.landlord_id,
      listing.deposit_amount::bigint * 100, rate, application.move_in_date,
      'dep_' || replace(new_id::text, '-', ''))
    returning * into payment;
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_start(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_start(uuid, uuid, uuid) to service_role;

-- Store the provider's checkout link for an unpaid deposit. The first link
-- wins, so two checkout attempts racing each other send the renter to one page.
-- Called by the server right after pinpoint_deposit_start, which checked the renter.
create function public.pinpoint_deposit_attach_checkout(
  target_payment_id uuid, target_reference text, new_checkout_url text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  if new_checkout_url is null or new_checkout_url !~ '^https://'
    or char_length(new_checkout_url) > 2048 then
    raise exception 'Invalid checkout link' using errcode = '22023';
  end if;
  select * into payment from public.payments p
    where p.id = target_payment_id and p.provider_reference = target_reference for update;
  if not found then
    raise exception 'Deposit not found' using errcode = '42501';
  end if;
  if payment.state = 'awaiting_payment' and payment.checkout_url is null then
    update public.payments set checkout_url = new_checkout_url, updated_at = clock_timestamp()
      where id = payment.id returning * into payment;
  end if;
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_attach_checkout(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_attach_checkout(uuid, text, text) to service_role;

-- The provider confirmed a charge. Called only after the server has verified
-- the notification with the provider. It never raises for a charge it cannot
-- apply: the event is stored as needs_review so the money is not lost track of.
-- A null fee_cents means the provider did not report its fee.
create function public.pinpoint_deposit_record_charge(
  target_reference text, charge_event_key text, paid_amount_cents bigint,
  paid_currency text, fee_cents bigint, event_payload jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
  prior public.payment_provider_events%rowtype;
  decided_outcome text := 'needs_review';
  decided_reason text;
  inserted_id uuid;
begin
  if target_reference is null or charge_event_key is null
    or char_length(charge_event_key) not between 1 and 200
    or paid_amount_cents is null or paid_amount_cents <= 0 or paid_currency is null
    or fee_cents < 0 then
    raise exception 'Invalid charge' using errcode = '22023';
  end if;
  select * into payment from public.payments p where p.provider_reference = target_reference for update;
  if not found then
    decided_reason := 'unknown_reference';
  elsif payment.amount_cents <> paid_amount_cents or payment.currency <> paid_currency then
    decided_reason := 'amount_mismatch';
  elsif payment.state = 'awaiting_payment' then
    decided_outcome := 'applied';
  elsif payment.state = 'cancelled' then
    -- Paid after the checkout expired or was cancelled. The money is real, so
    -- hold it unless a newer deposit has replaced this one.
    if payment.application_id is not null and not exists (
        select 1 from public.payments other
        where other.application_id = payment.application_id
          and other.id <> payment.id and other.state <> 'cancelled') then
      decided_outcome := 'applied';
    else
      decided_reason := 'superseded';
    end if;
  else
    decided_reason := 'already_paid';
  end if;
  -- A repeated delivery loses this insert and reports the first result.
  insert into public.payment_provider_events(provider, event_key, payment_id, kind, outcome, reason, payload)
    values ('paystack', charge_event_key, payment.id, 'charge', decided_outcome, decided_reason,
      coalesce(event_payload, '{}'::jsonb))
    on conflict (provider, event_key) do nothing
    returning id into inserted_id;
  if inserted_id is null then
    select * into strict prior from public.payment_provider_events e
      where e.provider = 'paystack' and e.event_key = charge_event_key;
    return jsonb_build_object('outcome', prior.outcome, 'reason', prior.reason,
      'paymentId', prior.payment_id, 'duplicate', true);
  end if;
  if decided_outcome = 'applied' then
    update public.payments set state = 'held', provider_fee_cents = fee_cents,
        paid_at = clock_timestamp(), cancelled_at = null, updated_at = clock_timestamp()
      where id = payment.id;
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents, external_reference)
      values (payment.id, 'charge', payment.amount_cents, charge_event_key);
  end if;
  return jsonb_build_object('outcome', decided_outcome, 'reason', decided_reason,
    'paymentId', payment.id, 'duplicate', false);
end;
$$;
revoke all on function public.pinpoint_deposit_record_charge(text, text, bigint, text, bigint, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_record_charge(text, text, bigint, text, bigint, jsonb) to service_role;

-- Renter: "I've moved in".
create function public.pinpoint_deposit_confirm_move_in(
  actor_id uuid, actor_session_id uuid, target_payment_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  if not public.pinpoint_active_session(actor_id, actor_session_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select * into payment from public.payments p
    where p.id = target_payment_id and p.renter_id = actor_id for update;
  if not found then
    raise exception 'Deposit not found or access denied' using errcode = '42501';
  end if;
  if payment.state in ('releasing', 'released') then return private.deposit_summary(payment); end if;
  if payment.state <> 'held' then
    raise exception 'Deposit cannot be released' using errcode = 'PT409';
  end if;
  return private.deposit_summary(private.deposit_start_release(payment.id, false));
end;
$$;
revoke all on function public.pinpoint_deposit_confirm_move_in(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_confirm_move_in(uuid, uuid, uuid) to service_role;

-- Renter: "I'm not satisfied". Before the move-in date (South African time)
-- the refund starts at once. From the move-in date the owner gets 24 hours to
-- contest, and the deposit stays held until the sweep or a contest moves it.
create function public.pinpoint_deposit_request_refund(
  actor_id uuid, actor_session_id uuid, target_payment_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  if not public.pinpoint_active_session(actor_id, actor_session_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select * into payment from public.payments p
    where p.id = target_payment_id and p.renter_id = actor_id for update;
  if not found then
    raise exception 'Deposit not found or access denied' using errcode = '42501';
  end if;
  if payment.state in ('refunding', 'refunded', 'disputed') then
    return private.deposit_summary(payment);
  end if;
  if payment.state <> 'held' then
    raise exception 'Deposit cannot be refunded' using errcode = 'PT409';
  end if;
  if statement_timestamp() < (payment.move_in_date::timestamp at time zone 'Africa/Johannesburg') then
    payment := private.deposit_start_refund(payment.id, true);
  elsif payment.refund_requested_at is null then
    update public.payments set refund_requested_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = payment.id returning * into payment;
  end if;
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_request_refund(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_request_refund(uuid, uuid, uuid) to service_role;

-- Owner: "they did move in". Only inside the 24-hour window after a refund request.
create function public.pinpoint_deposit_contest_refund(
  actor_id uuid, actor_session_id uuid, target_payment_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  if not public.pinpoint_active_session(actor_id, actor_session_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select * into payment from public.payments p
    where p.id = target_payment_id and p.owner_id = actor_id for update;
  if not found then
    raise exception 'Deposit not found or access denied' using errcode = '42501';
  end if;
  if payment.state = 'disputed' then return private.deposit_summary(payment); end if;
  if payment.state <> 'held' or payment.refund_requested_at is null then
    raise exception 'There is no refund request to contest' using errcode = 'PT409';
  end if;
  if statement_timestamp() >= payment.refund_requested_at + interval '24 hours' then
    raise exception 'The time to contest this refund has passed' using errcode = 'PT409';
  end if;
  update public.payments set state = 'disputed', disputed_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = payment.id returning * into payment;
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_contest_refund(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_contest_refund(uuid, uuid, uuid) to service_role;

-- Owner cancels. An unpaid deposit is cancelled; a held one is refunded in
-- full with no cancellation fee, because the renter did not choose this.
create function public.pinpoint_deposit_owner_cancel(
  actor_id uuid, actor_session_id uuid, target_payment_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  if not public.pinpoint_active_session(actor_id, actor_session_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  select * into payment from public.payments p
    where p.id = target_payment_id and p.owner_id = actor_id for update;
  if not found then
    raise exception 'Deposit not found or access denied' using errcode = '42501';
  end if;
  if payment.state in ('cancelled', 'refunding', 'refunded') then
    return private.deposit_summary(payment);
  end if;
  if payment.state = 'awaiting_payment' then
    update public.payments set state = 'cancelled', cancelled_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = payment.id returning * into payment;
  elsif payment.state = 'held' then
    payment := private.deposit_start_refund(payment.id, false);
  else
    raise exception 'Deposit cannot be cancelled' using errcode = 'PT409';
  end if;
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_owner_cancel(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_owner_cancel(uuid, uuid, uuid) to service_role;

-- Admin decides a dispute. Refunding in the renter's favour can waive the fee.
create function public.pinpoint_deposit_resolve_dispute(
  actor uuid, target_payment_id uuid, resolution text, waive_cancellation_fee boolean,
  action_reason text, audit_request_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
begin
  perform public.assert_admin_actor(actor);
  if resolution is null or resolution not in ('release', 'refund')
    or action_reason is null or char_length(btrim(action_reason)) not between 10 and 2000 then
    raise exception 'Invalid dispute decision' using errcode = '22023';
  end if;
  select * into payment from public.payments p where p.id = target_payment_id for update;
  if not found then
    raise exception 'Deposit not found' using errcode = '42501';
  end if;
  if payment.state <> 'disputed' then
    raise exception 'Deposit is not in dispute' using errcode = 'PT409';
  end if;
  if resolution = 'release' then
    payment := private.deposit_start_release(payment.id, false);
  else
    payment := private.deposit_start_refund(payment.id, not coalesce(waive_cancellation_fee, false));
  end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
    values (actor, 'payment.dispute_resolved', 'payment', payment.id, btrim(action_reason), audit_request_id,
      jsonb_build_object('resolution', resolution,
        'cancellationFeeWaived', resolution = 'refund' and coalesce(waive_cancellation_fee, false)));
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_resolve_dispute(uuid, uuid, text, boolean, text, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_resolve_dispute(uuid, uuid, text, boolean, text, text) to service_role;

-- Admin records the bank transfer that paid the owner.
create function public.pinpoint_deposit_record_payout(
  actor uuid, target_payment_id uuid, bank_reference text, audit_request_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  payment public.payments%rowtype;
  payout bigint;
begin
  perform public.assert_admin_actor(actor);
  if bank_reference is null or char_length(btrim(bank_reference)) not between 1 and 200 then
    raise exception 'A bank reference is required' using errcode = '22023';
  end if;
  select * into payment from public.payments p where p.id = target_payment_id for update;
  if not found then
    raise exception 'Deposit not found' using errcode = '42501';
  end if;
  if payment.state <> 'releasing' then
    raise exception 'Deposit is not awaiting an owner payout' using errcode = 'PT409';
  end if;
  payout := payment.amount_cents - payment.commission_cents;
  update public.payments set state = 'released', payout_reference = btrim(bank_reference),
      released_at = clock_timestamp(), updated_at = clock_timestamp()
    where id = payment.id returning * into payment;
  if payout > 0 then
    insert into public.payment_ledger_entries(payment_id, kind, amount_cents, external_reference)
      values (payment.id, 'owner_payout', -payout, btrim(bank_reference));
  end if;
  insert into public.admin_audit_events(actor_id, action_key, target_type, target_id, reason, request_id, metadata)
    values (actor, 'payment.payout_recorded', 'payment', payment.id, null, audit_request_id,
      jsonb_build_object('payoutCents', payout));
  return private.deposit_summary(payment);
end;
$$;
revoke all on function public.pinpoint_deposit_record_payout(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_record_payout(uuid, uuid, text, text) to service_role;

-- The refund reached the renter. The provider reports it with no actor; an
-- admin recording a manual bank transfer passes their id and is audited.
create function public.pinpoint_deposit_record_refund(
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
revoke all on function public.pinpoint_deposit_record_refund(uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_record_refund(uuid, text, uuid, text) to service_role;

-- Timed rules, run on a schedule:
--   unpaid checkouts older than 24 hours are cancelled;
--   refund requests the owner did not contest within 24 hours become refunds;
--   deposits the renter never responded to release 48 hours after the move-in date ends.
create function public.pinpoint_deposit_sweep()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  target uuid;
  cancelled_count integer := 0;
  refund_count integer := 0;
  release_count integer := 0;
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
      and ((p.move_in_date + 3)::timestamp at time zone 'Africa/Johannesburg') <= statement_timestamp()
    for update skip locked
  loop
    perform private.deposit_start_release(target, true);
    release_count := release_count + 1;
  end loop;
  return jsonb_build_object('cancelled', cancelled_count, 'refundsStarted', refund_count,
    'autoReleased', release_count);
end;
$$;
revoke all on function public.pinpoint_deposit_sweep() from public, anon, authenticated, service_role;
grant execute on function public.pinpoint_deposit_sweep() to service_role;

notify pgrst, 'reload schema';
commit;
