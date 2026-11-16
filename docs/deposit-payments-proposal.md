# Proposal: rental deposits paid through RoomZA

Status: approved 2026-11-15. Build steps 1 to 3 are written and tested; steps 1 and 2 are committed, step 3 is not. Nothing is applied to a shared database yet.

## Summary

An approved renter pays the listing's deposit online through RoomZA. RoomZA holds it until move-in. If the renter is not satisfied, the deposit goes back to them less a cancellation fee that covers the payment processing cost. If they move in, RoomZA keeps its commission and pays the owner the rest.

It is an ordinary online payment through Paystack. The only unusual part is that the money waits with RoomZA between payment and move-in, so the design centres on a record of who is owed what at every moment.

## How it works for each person

**Renter**
1. The owner approves the application. The journey screen shows "Pay deposit" with the amount, where it now says "Message the landlord to arrange your lease and deposit".
2. Before paying, the renter sees the cancellation fee: an estimate in rands and the rule that it is kept if they cancel. They pay on Paystack's hosted checkout and return to the journey screen, which shows "Deposit held by RoomZA" and the exact fee.
3. On or after the move-in date the renter chooses one of two buttons: "I've moved in" or "I'm not satisfied".

**Owner**
1. Before deposits can be collected on a listing, the owner publishes a deposit amount (the `deposit_amount` field added on 2026-11-14) and saves bank details for payouts.
2. The owner sees "Deposit held" on the applicant card once the renter pays.
3. After move-in is confirmed, the owner sees the payout amount and, later, the date it was paid.

**RoomZA admin**
1. A payments page lists every deposit with its state and the full money trail.
2. Payouts and refunds that need a person appear in a queue: disputes, failed refunds, and owner payouts awaiting a bank transfer.

## Money rules

All amounts are stored in cents as whole numbers. The commission is 10% of the deposit, decided on 2026-11-15. The rate is a platform setting rather than a value fixed in code, and it is copied onto each deposit when checkout starts, so a later rate change never alters a deposit already in progress.

Worked example with an R8,000 deposit:

| Outcome | Renter | Owner | RoomZA |
|---|---|---|---|
| Moved in | Paid R8,000 | Receives R7,200 | Keeps R800, pays about R268 card fee, nets about R532 |
| Renter cancels | Gets about R7,732 back | Receives nothing | Keeps a R268 cancellation fee, which covers the card fee; nets nothing |
| Owner cancels | Gets R8,000 back | Receives nothing | Loses about R268 card fee |

The card fee is 2.9% + R1 before VAT, which is about 3.35% of the deposit after VAT. Paystack does not return that fee when a payment is refunded. On a successful card deposit RoomZA keeps about 6.65% of the deposit after the card fee.

### Cancellation fee

Decided on 2026-11-15: a renter who cancels pays a cancellation fee so that a refund costs RoomZA nothing.

- **Amount:** exactly the processing fee Paystack charged on that payment, read from Paystack when the charge is confirmed and stored on the deposit. It is not a fixed percentage, because the fee differs between card and EFT.
- **Fee not reported:** Paystack's verify response allows `fees` to be null. The deposit is then held anyway with the fee recorded as unknown, a warning is logged, and a cancellation keeps no fee, so RoomZA carries the cost on that deposit. Check in test mode whether this happens for card and EFT payments in South Africa.
- **When it applies:** the renter chooses "I'm not satisfied", or abandons the deposit after paying.
- **When it does not apply:** the owner cancels or withdraws the approval, or an admin decides a dispute in the renter's favour and waives it. In those cases the renter gets the full deposit and RoomZA carries the processing fee. The owner is not billed for it (decided on 2026-11-15).
- **Disclosure:** the fee is shown before payment as an estimate and after payment as the exact amount, and it is in the renter terms. A fee the renter was not told about before paying cannot be kept.
- **Refund amount:** the deposit less the cancellation fee, sent as a partial refund.

The owner receives the deposit less commission but still owes the renter the full deposit at the end of the lease. The owner terms must say this plainly.

## Deposit states

| State | Meaning | Moves to |
|---|---|---|
| `awaiting_payment` | Checkout started, no confirmed charge | `held`, `cancelled` |
| `held` | Paystack confirmed the charge; RoomZA holds the money | `releasing`, `refunding`, `disputed` |
| `disputed` | Renter and owner disagree about move-in; an admin decides | `releasing`, `refunding` |
| `releasing` | Commission taken; owner payout queued | `released` |
| `released` | Owner payout recorded as sent | final |
| `refunding` | Refund requested from Paystack or queued for manual transfer | `refunded` |
| `refunded` | Renter refund confirmed | final |
| `cancelled` | Checkout abandoned or expired | final |

Rules that decide the path out of `held`:

- **Renter confirms move-in:** move to `releasing` immediately.
- **Renter says not satisfied before the move-in date:** move to `refunding` immediately.
- **Renter says not satisfied on or after the move-in date:** the owner has 24 hours to contest. No contest means `refunding`; a contest means `disputed`.
- **Owner withdraws the approval or cancels:** move to `refunding`, with no cancellation fee.

Every move to `refunding` records whether the cancellation fee applies, so the refund amount is fixed at that moment.
- **Renter does nothing:** reminders on the move-in date and 24 hours later, then automatic release 48 hours after the move-in date ends, South African time. This is an assumption; see open decisions.
- **Payment arrives after the checkout expired:** the deposit is held anyway, because the money is real, unless a newer deposit has replaced it. That case goes to the admin queue.

## Data model

Five new tables, all with row-level security forced and writable only through service-role database functions, matching the existing `pinpoint_rental_viewing_propose` pattern.

- **`payments`**: one row per deposit. Holds application, listing, renter, owner, amount in cents, commission rate, the processing fee Paystack charged, state, Paystack reference, and timestamps for each state change. A `purpose` column starts with one value, `rental_deposit`, so event bookings can reuse the table later.
- **`payment_ledger_entries`**: append-only money trail. Each row has a payment, a kind (`charge`, `commission`, `cancellation_fee`, `owner_payout`, `renter_refund`), a signed amount in cents, and an external reference. Rows are never updated or deleted, and each kind can occur once per payment. The sum of a payment's entries is what RoomZA still holds for it. Paystack's processing fee is a RoomZA cost, not held money, so it sits on the payment row instead of in the ledger.
- **`payment_provider_events`**: every Paystack webhook received, keyed uniquely by Paystack's event reference so a repeated delivery is ignored.
- **`owner_payout_accounts`**: account holder, bank, branch code and account number. Readable only by the service role; screens show the last four digits.
- **`payment_settings`**: one row holding the commission rate.

A profile with any payment cannot be deleted, because payments are financial records. The account deletion flow must handle that case before deposits go live.

State changes run inside database functions that lock the payment row, check the current state, write the ledger entries and the new state together, and return the same result if called twice with the same request id.

## Server pieces

- **Provider adapter** in `src/features/payments/paystack.ts`: start a transaction, verify a transaction, request a refund, verify a webhook signature. It uses `fetch` and Web Crypto so it runs on Cloudflare Workers without Paystack's Node library. A 4xx from Paystack is a "rejected" error (for example a refund the balance cannot cover, which goes to the manual queue); network failures, timeouts, 5xx and unexpected bodies are "unavailable".
- **Start checkout**: `startDepositCheckout` in `src/features/payments/actions.ts`. It checks the renter's session, creates or reuses the `awaiting_payment` row, opens a Paystack checkout for the stored amount and returns its link; the journey screen (step 3) sends the browser there. The amount always comes from the database, never from the browser. Paystack refuses a second checkout under the same reference, so the first link is stored on the deposit (`payments.checkout_url`, set once by `pinpoint_deposit_attach_checkout`) and every retry reuses it. It refuses to run with a live key (`sk_live_`) until step 6 removes that check, and is rate limited to 10 attempts per renter per 10 minutes.
- **Webhook route** at `src/app/api/payments/paystack/webhook/route.ts`, logic in `src/features/payments/webhook.ts`: checks the signature against the raw request body, then verifies the transaction with Paystack and records what Paystack reports, never what the event says. The database compares that amount and currency with the stored deposit. `charge.success` marks the deposit `held`; `refund.processed` records the refund. Temporary failures answer 5xx so Paystack retries; events RoomZA does not act on answer 200. Only facts about the money are stored, never the renter's email or card details.
- **Return page**: Paystack sends the renter to `/applications?view=progress&deposit=<payment id>`. While that deposit is still `awaiting_payment` the journey says "Confirming your payment", offers the checkout again in case they did not finish, and the page re-reads itself every 3 seconds for up to two minutes (the payments tables are not on Realtime). It never marks a deposit as paid; only the webhook does.
- **Reading deposits for screens** in `src/features/payments/deposit-data.ts`: the payments tables are service-role only, so the server reads them for an identity it has already checked (the renter's id, or a listing the user may manage). Deposit wording for both sides lives in `deposit-view.ts`; the rules for when a renter may pay online are in `deposit-records.ts`.
- **Bank details**: `/settings/payouts`, saved by `saveOwnerPayoutAccount` through `pinpoint_owner_payout_account_save` (active session required, rate limited to 5 changes per 10 minutes) and read through `pinpoint_owner_payout_account_get`. Both return a masked summary; the full account number never leaves the database or reaches a log.
- **Sweep job** at `src/app/api/cron/payments/sweep/route.ts`: cancels abandoned checkouts, sends reminders, and performs the automatic release. It follows the existing pattern of `pg_cron` plus an HTTP fallback guarded by `CRON_SECRET`.
- **Notifications**: new event types for deposit paid, deposit held, refund sent and payout sent, through the existing notification system.
- **Configuration**: `PAYSTACK_SECRET_KEY` added to `src/lib/env.ts` and set as a Cloudflare secret.

## Money leaving RoomZA

Paystack settles payments into RoomZA's bank account automatically, and it refuses a refund when the pending Paystack balance is smaller than the refund. A deposit can be held for weeks, so a refund through Paystack will sometimes be refused.

**First release:**
- **Refunds:** try the Paystack refund first, for the deposit less any cancellation fee. If it is refused, the refund goes to the admin queue for a manual bank transfer, and the admin records the bank reference.
- **Owner payouts:** an admin makes the bank transfer and records the reference. The system calculates the amount and queues it; a person sends it.

**Later:** automate owner payouts with Paystack Transfers, which costs R1 per transfer plus R3 to validate each new bank account. This waits until volume justifies it, because a person approving each outgoing payment is a useful check while the system is new.

## Screens that change

- **Journey screen** (`src/features/applications/journey.ts`): the approved step gains deposit states and the pay, moved-in and not-satisfied actions. Move-in gets a real signal for the first time.
- **Applicant card** (owner side): deposit status and payout amount.
- **Listing form**: a prompt to publish a deposit amount and add payout details to enable online deposits.
- **Owner settings**: bank details form.
- **Admin**: new payments page with the ledger and the action queue.
- **Listing detail**: the move-in cost panel says the deposit is paid through and held by RoomZA.

## Safety checks

- The webhook is the only thing that can mark a deposit paid, and only after a signature check and a server-side verification with Paystack.
- One active deposit per application, enforced by a unique index.
- Every state change is idempotent and locked, so double clicks and repeated webhooks cannot pay twice or release twice.
- Refunds and releases are recorded in the admin audit log with the actor.
- Bank details never reach the browser in full and are never logged.
- Start-checkout and the renter's action buttons are rate limited with the existing limiter.

## Testing

Tests are written before the code they cover.

- **Unit (Vitest):** commission, cancellation fee and rounding maths, including refunds with and without the fee, the state table, webhook signature checks with known-good and tampered bodies, amount-mismatch rejection.
- **Database (`supabase/tests`):** each function rejects the wrong actor and the wrong state, repeated calls return the first result, ledger entries always sum correctly, row-level security denies direct access.
- **Integration:** pay, hold, release; pay, refund; contested refund to dispute; abandoned checkout; duplicate webhook.
- **End to end (Playwright):** the full renter and owner journey against Paystack test mode.

## Build order

1. Tables, database functions, money maths and state table, with tests. No provider yet. **Built on 2026-11-15**: `supabase/migrations/20261115120000_deposit_payments.sql`, `supabase/tests/deposit-payments-test-plan.sql`, `src/features/payments/`. Not yet applied to any database.
2. Paystack adapter, start-checkout action and webhook, in test mode. **Built on 2026-11-15**: `src/features/payments/paystack.ts`, `actions.ts`, `webhook.ts` and their tests, `src/app/api/payments/paystack/webhook/route.ts`, `PAYSTACK_SECRET_KEY` in `src/lib/env.ts` and `.env.example`, and a `checkout_url` column with `pinpoint_deposit_attach_checkout` in the step 1 migration. Not yet run against Paystack's test environment; that needs a test secret key and the webhook URL set in the Paystack dashboard.
3. Journey screen and applicant card; owner bank details. **Built on 2026-11-16**: deposit states and "Pay deposit" on the journey screen and the applications list, the deposit notice on the applicant card (including the prompt to add bank details), and `/settings/payouts`. The before-payment estimate assumes the unconfirmed 2.9% + R1 card rate plus VAT (`estimateCardFeeCents`). Not yet done: the listing-form prompt, the listing-detail copy, and showing the moved-in and not-satisfied buttons (step 4). Organisation managers see the bank-details prompt but the link sets their own account, not the listing owner's.
4. Moved-in, not-satisfied, contest and dispute paths; sweep job.
5. Admin payments page and manual payout recording.
6. Terms, trust copy and the launch plan updated; live keys; a first real deposit on a test listing.

Event bookings follow as a separate proposal that reuses `payments` with a second `purpose`.

## Documents this replaces

- `docs/roomza-public-mvp-launch-plan.md` says RoomZA does not collect deposits or rent at launch. That line and the related disclaimer are removed in step 6.
- The terms and trust pages need a deposits section covering holding, refunds, the cancellation fee, the commission and the owner's obligation to return the full deposit.

## Open decisions

1. **Renter goes silent.** Assumed: automatic release to the owner 48 hours after the move-in date. The alternative is to hold until an admin decides, which is safer for renters and slower for owners.
2. **Deposit only, or deposit plus first month's rent.** Assumed: deposit only. Adding first month's rent raises both the commission base and the card fee.
3. **Listings without a published deposit.** Assumed: online deposits are off for that listing and the current "message the landlord" step stays.

## Risk accepted

Holding renters' deposits is being treated as a standard online payment. South African rules on rental deposits and on holding other people's money have not been checked for this design. That check is still worth doing before live keys are switched on.

## Provider facts used

Checked on 2026-11-15:

- Paystack does not return its transaction fee on a refund, and refuses a refund when the pending payout balance is too small: [Paystack refunds help page](https://support.paystack.com/hc/en-us/articles/360009882120-How-do-I-refund-a-customer-).
- Transfers in South Africa cost R1 each plus R3 per account validation, to `basa` recipients in ZAR: [Paystack transfers help page](https://support.paystack.com/hc/en-us/articles/360012276559-Transfers), [Paystack transfers documentation](https://paystack.com/docs/transfers/bulk-transfers/).
- The 2.9% + R1 card rate comes from a third-party page that mirrors Paystack's pricing. Confirm it, the EFT rate and the settlement schedule on Paystack's own pricing page before going live.
Checked on 2026-11-15 for step 2, against Paystack's official OpenAPI spec ([PaystackOSS/openapi](https://github.com/PaystackOSS/openapi), `dist/paystack.yaml`) and its documentation snippets ([PaystackOSS/doc-code-snippets](https://github.com/PaystackOSS/doc-code-snippets)). paystack.com/docs was behind a bot check and could not be read directly.

- Verify Transaction (`GET /transaction/verify/{reference}`) returns `fees` as an integer in subunits that may be null, beside `amount`, `currency`, `status`, `reference` and `id`.
- Create Refund (`POST /refund`) takes `transaction` (the reference) and an optional `amount` in subunits that "cannot be more than the original transaction amount", so a partial refund is allowed. ZAR is a listed currency.
- Initialize Transaction (`POST /transaction/initialize`) takes `email`, `amount` in subunits, `currency`, `reference`, `callback_url` and `metadata`, and returns `authorization_url`, `access_code` and `reference`.
- Webhook signature: `x-paystack-signature` is the hex HMAC-SHA512 of the raw body under the secret key. This is what is built. Paystack added a newer scheme on 2026-11-02: a `paystack-signature` header with a timestamp and key id, signed with a separate per-endpoint `whsec_` secret and checked within five minutes. Its endpoint-management API answers "not available for this integration" for some accounts, so it was not adopted; it adds replay protection and is worth moving to once the RoomZA account has it.
- Event names: `charge.success`; refunds send `refund.pending`, `refund.processing`, `refund.processed`, `refund.failed` and `refund.needs-attention`. Paystack's own samples send the refund `amount` as a number in one event and a string in another, so both are accepted.
- Not yet confirmed: the `fees` value Paystack actually returns for South African card and EFT test payments.
