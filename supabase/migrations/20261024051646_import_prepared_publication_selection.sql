-- Keep the reviewed commit scope outside caller-editable mapping defaults.
alter table public.listing_import_jobs
  add column prepared_selection jsonb;

comment on column public.listing_import_jobs.prepared_selection is
  'Service-written selection captured atomically when preparing private drafts.';

alter table public.listing_import_rows
  add column prepared_state public.listing_import_row_state;

comment on column public.listing_import_rows.prepared_state is
  'Service-written reviewed state retained across private draft creation for final selection narrowing.';

create function public.prepare_listing_import_drafts_with_selection(
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
  target_row_id uuid;
  prepared_version bigint;
begin
  select * into target_job from public.listing_import_jobs
  where id = target_job_id for update;
  if not found or expected_job_version is null
    or target_job.version <> expected_job_version or target_job.stage <> 'preview' then
    raise exception using errcode = 'PT409', message = 'import_draft_preparation_conflict';
  end if;

  -- The job lock and stable row order match the existing review/asset writers.
  -- Source publication flags must not mark excluded rows as prepared.
  for target_row_id in
    select id from public.listing_import_rows
    where job_id = target_job_id and (
      publication_selected or normalized_data @> '{"publicationSelected":true}'::jsonb
      or prepared_state is not null
    ) order by row_number, id for update
  loop
    update public.listing_import_rows set
      publication_selected = false,
      prepared_state = null,
      normalized_data = normalized_data || '{"publicationSelected":false}'::jsonb,
      row_version = row_version + 1,
      updated_at = now()
    where id = target_row_id;
  end loop;

  -- Retain the existing selection, validation, duplicate and stage guards.
  prepared_version := public.prepare_listing_import_drafts(target_job_id, expected_job_version);
  -- Review has fixed the selected membership and validation state. Capture it
  -- before draft processing changes eligible rows to committed.
  for target_row_id in
    select id from public.listing_import_rows
    where job_id = target_job_id and publication_selected
    order by row_number, id for update
  loop
    update public.listing_import_rows set prepared_state = state
    where id = target_row_id;
  end loop;
  update public.listing_import_jobs set prepared_selection = target_job.selection
  where id = target_job_id and version = prepared_version and stage = 'committing';
  if not found or prepared_version <> expected_job_version + 1 then
    raise exception using errcode = 'PT409', message = 'import_draft_preparation_conflict';
  end if;
  return prepared_version;
end;
$$;

revoke all on function public.prepare_listing_import_drafts_with_selection(uuid, bigint)
from public, anon, authenticated;
grant execute on function public.prepare_listing_import_drafts_with_selection(uuid, bigint)
to service_role;

notify pgrst, 'reload schema';
