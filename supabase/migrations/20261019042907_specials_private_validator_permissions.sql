begin;

-- Older intake functions belong to postgres while later administrative
-- migrations may own their new validators as supabase_admin. Keep those
-- owners and permit only the existing trusted database role to call the
-- pure validators. Client, anonymous and service-role grants are unchanged.
grant execute on function private.discovery_card_validate(jsonb,boolean,boolean),
  private.special_links_validate(jsonb),
  private.special_submission_media_validate(jsonb),
  private.pinpoint_contact_validate(jsonb,boolean) to postgres;

commit;
