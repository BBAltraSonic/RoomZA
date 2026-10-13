-- Add galleries without changing existing drafts or reviewed/public snapshots.
begin;

create function private.special_submission_media_validate(content jsonb) returns void
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if coalesce(jsonb_array_length(content->'mediaIds'),0) not between 1 and 10 then
    raise exception 'Add one to ten photos before submitting this Special' using errcode='22023';
  end if;
end; $$;
revoke all on function private.special_submission_media_validate(jsonb) from public,anon,authenticated,service_role;

-- Modify installed definitions so optional contact/link extensions and grants survive.
-- Abort atomically if the prerequisite definitions differ from the expected baseline.
do $$
declare source text; anchor text; name text;
begin
  name := 'private.discovery_card_validate(jsonb,boolean,boolean)';
  source := pg_get_functiondef(name::regprocedure);
  anchor := 'case when special then 1 else 20 end';
  if strpos(source,anchor)=0 then raise exception 'Expected card photo limit missing'; end if;
  execute replace(source,anchor,'case when special then 10 else 20 end');

  name := 'public.discovery_media_manage(text,text,uuid,integer,uuid,text,integer)';
  source := pg_get_functiondef(name::regprocedure);
  anchor := 'case when category=''service'' then 40 else 4 end';
  if strpos(source,anchor)=0 then raise exception 'Expected upload allowance missing'; end if;
  source := replace(source,anchor,'case when category=''service'' then 40 else 20 end');
  -- The subject helper is reviewer-only. Uploads already require the owner;
  -- check the current owner's posting capability instead of reviewer status.
  anchor := 'private.pinpoint_entry_subject_eligible(auth.uid(),category)';
  if strpos(source,anchor)=0 then raise exception 'Expected Entry upload eligibility check missing'; end if;
  execute replace(source,anchor,'private.pinpoint_entry_active(category)');

  -- Enforce the minimum on fresh submissions only. Approval/read validators must
  -- continue accepting legacy photo-less snapshots, including pending reviews.
  name := 'private.pinpoint_offer_write(text,uuid,integer,jsonb,uuid)';
  source := pg_get_functiondef(name::regprocedure);
  anchor := 'perform private.pinpoint_intake_validate(current_offer.draft, true);';
  if strpos(source,anchor)=0 then raise exception 'Expected Shopping submit validation missing'; end if;
  execute replace(source,anchor,anchor||E'\n    perform private.special_submission_media_validate(current_offer.draft);');

  name := 'private.pinpoint_entry_write(text,text,uuid,integer,jsonb,uuid)';
  source := pg_get_functiondef(name::regprocedure);
  anchor := 'content := private.pinpoint_entry_content(current_entry.draft,true);';
  if strpos(source,anchor)=0 then raise exception 'Expected Entry submit validation missing'; end if;
  execute replace(source,anchor,anchor||E'\n    perform private.special_submission_media_validate(content);');
end; $$;
commit;
