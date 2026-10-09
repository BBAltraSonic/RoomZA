-- Extend the existing private moderation queue to reports about published
-- Shopping Offers. No public access, notification policy, or offer lifecycle
-- behavior changes here.
alter table public.moderation_cases
  add column shopping_offer_id uuid references public.shopping_offers(id) on delete cascade;

alter table public.moderation_cases
  drop constraint moderation_cases_exactly_one_target;

alter table public.moderation_cases
  add constraint moderation_cases_exactly_one_target
  check (num_nonnulls(listing_id, reported_user_id, message_id, listing_image_id, shopping_offer_id) = 1);

create index moderation_cases_shopping_offer_id_idx
  on public.moderation_cases(shopping_offer_id);

create unique index moderation_cases_open_shopping_offer_report_idx
  on public.moderation_cases(reporter_id, shopping_offer_id)
  where shopping_offer_id is not null and status in ('open', 'in_review');
