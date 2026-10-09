-- Add a bounded pending-submission queue without exposing private drafts or
-- changing the original intake tables, functions, lifecycle or permission revokes.
create function private.pinpoint_offer_review_queue(queue_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode = '42501';
  end if;
  if queue_page is null or queue_page < 1 or queue_page > 10000 then
    raise exception 'Invalid review queue page' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(row_content order by submitted_at, offer_id), '[]'::jsonb)
    into result from (
      select o.id as offer_id, r.submitted_at,
        jsonb_build_object('offerId', o.id, 'version', o.version,
          'revisionId', r.id, 'content', r.content, 'submittedAt', r.submitted_at) as row_content
      from public.shopping_offers o
      join public.shopping_offer_revisions r on r.offer_id = o.id and r.id = o.pending_revision_id
      where o.withdrawn_at is null
      order by r.submitted_at, o.id
      limit 21 offset ((queue_page - 1) * 20)
    ) pending;
  return result;
end;
$$;

create function public.pinpoint_offer_review_queue(queue_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin return private.pinpoint_offer_review_queue(queue_page); end;
$$;

revoke all on function private.pinpoint_offer_review_queue(integer), public.pinpoint_offer_review_queue(integer)
  from public, anon, authenticated, service_role;
grant execute on function private.pinpoint_offer_review_queue(integer), public.pinpoint_offer_review_queue(integer)
  to authenticated;
comment on function public.pinpoint_offer_review_queue(integer) is
  'MFA-gated pending immutable submissions, 20 plus one lookahead. No private drafts or publication.';
