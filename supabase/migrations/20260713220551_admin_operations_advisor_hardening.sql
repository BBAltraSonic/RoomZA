-- Advisor follow-up for the admin operations migration.
--
-- These explicit deny policies preserve the intentionally server-only model
-- while making that posture visible to automated RLS advisors. The service
-- role continues to be the sole application path for these tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_memberships',
    'admin_audit_events',
    'account_suspensions',
    'listing_restrictions',
    'moderation_cases',
    'moderation_case_notes',
    'sensitive_access_grants'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_deny_client_access', table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      table_name || '_deny_client_access',
      table_name
    );
  end loop;
end $$;

-- Cover every admin-operations foreign key used for actor/history lookups and
-- cascade maintenance. Existing target/user indexes already cover the other
-- foreign keys in these tables.
create index if not exists admin_memberships_invited_by_idx
  on public.admin_memberships(invited_by);

create index if not exists account_suspensions_suspended_by_idx
  on public.account_suspensions(suspended_by);
create index if not exists account_suspensions_restored_by_idx
  on public.account_suspensions(restored_by);

create index if not exists listing_restrictions_restricted_by_idx
  on public.listing_restrictions(restricted_by);
create index if not exists listing_restrictions_restored_by_idx
  on public.listing_restrictions(restored_by);

create index if not exists moderation_cases_listing_id_idx
  on public.moderation_cases(listing_id);
create index if not exists moderation_cases_reported_user_id_idx
  on public.moderation_cases(reported_user_id);
create index if not exists moderation_case_notes_author_id_idx
  on public.moderation_case_notes(author_id);

create index if not exists sensitive_access_grants_case_id_idx
  on public.sensitive_access_grants(case_id);
