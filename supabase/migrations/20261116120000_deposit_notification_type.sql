-- Deposit notices to renters and owners (docs/deposit-payments-proposal.md).
-- On its own because a new enum value cannot be used in the transaction that adds it.
alter type public.notification_type add value if not exists 'deposit_update';
