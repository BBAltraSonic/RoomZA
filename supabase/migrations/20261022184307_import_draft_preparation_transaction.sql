-- Prepare selected drafts through the same locked review transaction used for
-- corrections. The legacy bulk writer reclassified removed and skipped rows.
create function public.prepare_listing_import_drafts(
  target_job_id uuid,
  expected_job_version bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_job public.listing_import_jobs%rowtype;
  prepared_version bigint;
begin
  select * into target_job from public.listing_import_jobs
  where id = target_job_id for update;
  if not found or expected_job_version is null
    or target_job.version <> expected_job_version or target_job.stage <> 'preview' then
    raise exception using errcode = 'PT409', message = 'import_draft_preparation_conflict';
  end if;
  if exists (
    select 1 from public.listing_import_rows
    where job_id = target_job_id and state = 'duplicate_review' and duplicate_strategy is null
  ) then
    raise exception using errcode = 'PT409', message = 'import_duplicates_unresolved';
  end if;

  perform public.apply_listing_import_review(target_job_id, expected_job_version,
    jsonb_build_object('action', 'bulk_patch', 'selection', target_job.selection,
      'patch', jsonb_build_object('publicationSelected', true)));

  update public.listing_import_jobs set
    stage = 'committing', stage_cursor = 0,
    defaults = target_job.defaults || jsonb_build_object('commitMode', 'drafts'),
    cancel_requested_at = null, cancelled_at = null,
    message_code = null, message_detail = null, heartbeat_at = now()
  where id = target_job_id and version = expected_job_version + 1
  returning version into prepared_version;
  if not found then
    raise exception using errcode = 'PT409', message = 'import_draft_preparation_conflict';
  end if;
  return prepared_version;
end;
$$;

revoke all on function public.prepare_listing_import_drafts(uuid, bigint) from public, anon, authenticated;
grant execute on function public.prepare_listing_import_drafts(uuid, bigint) to service_role;

notify pgrst, 'reload schema';
