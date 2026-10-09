-- Private admin permission evidence only. No approval or public projection.
create table public.shopping_offer_permission_reviews (
  id uuid primary key,
  offer_id uuid not null,
  revision_id uuid not null references public.shopping_offer_permissions(revision_id) on delete restrict,
  poster_id uuid not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  offer_version integer not null check (offer_version > 0),
  evidence_kind text not null check (evidence_kind in ('written_authorization','existing_business_permission')),
  source_reference text not null check (char_length(btrim(source_reference)) between 1 and 1000),
  verification_note text not null check (char_length(btrim(verification_note)) between 1 and 2000),
  statement_version text not null check (statement_version = 'admin-permission-review-v1'),
  checked_at timestamptz not null default clock_timestamp(),
  foreign key (offer_id, revision_id) references public.shopping_offer_revisions(offer_id, id) on delete restrict,
  foreign key (offer_id, poster_id) references public.shopping_offers(id, poster_id) on delete restrict
);
create index shopping_offer_permission_reviews_revision_idx on public.shopping_offer_permission_reviews(revision_id, checked_at desc);
create index shopping_offer_permission_reviews_offer_poster_idx on public.shopping_offer_permission_reviews(offer_id, poster_id);
create index shopping_offer_permission_reviews_reviewer_idx on public.shopping_offer_permission_reviews(reviewer_id);
create trigger shopping_offer_permission_reviews_immutable before update or delete
  on public.shopping_offer_permission_reviews for each row execute function private.pinpoint_intake_immutable();
alter table public.shopping_offer_permission_reviews enable row level security;
revoke all on public.shopping_offer_permission_reviews from public, anon, authenticated, service_role;

-- Durable poster eligibility; a poster need not remain logged in while admins
-- review, but current capability/account/policy gates still apply.
create function private.pinpoint_offer_poster_eligible(poster uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.offer_posters p join auth.users u on u.id=p.user_id
    join public.profiles profile on profile.id=u.id
    where p.user_id=poster and p.revoked_at is null and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until <= statement_timestamp()))
    and not exists (select 1 from public.account_suspensions s where s.user_id=poster and s.restored_at is null
      and (s.suspended_until is null or s.suspended_until > statement_timestamp()))
    and not exists (select 1 from public.trust_document_versions v join public.trust_documents d on d.current_version_id=v.id
      where v.status='published' and v.requires_reacceptance and v.effective_at <= statement_timestamp()
        and not exists (select 1 from public.policy_acceptances a where a.user_id=poster and a.version_id=v.id));
$$;
revoke all on function private.pinpoint_offer_poster_eligible(uuid) from public, anon, authenticated, service_role;

create function private.pinpoint_offer_permission_review_read(target uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; permission jsonb; evidence jsonb;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode='42501';
  end if;
  select * into current_offer from public.shopping_offers where id=target;
  if current_offer.id is null or current_offer.pending_revision_id is null or current_offer.withdrawn_at is not null then return null; end if;
  if not private.pinpoint_offer_poster_eligible(current_offer.poster_id) then
    raise exception 'Poster is inactive' using errcode='42501';
  end if;
  select jsonb_build_object('posterId',p.poster_id,'statement',p.statement,'statementVersion',p.statement_version,'confirmedAt',p.confirmed_at)
    into permission from public.shopping_offer_permissions p
    where p.revision_id=current_offer.pending_revision_id and p.offer_id=target and p.poster_id=current_offer.poster_id;
  select jsonb_build_object('id',r.id,'reviewerId',r.reviewer_id,'offerVersion',r.offer_version,'evidenceKind',r.evidence_kind,
    'sourceReference',r.source_reference,'verificationNote',r.verification_note,'statementVersion',r.statement_version,'checkedAt',r.checked_at)
    into evidence from public.shopping_offer_permission_reviews r
    where r.offer_id=target and r.revision_id=current_offer.pending_revision_id order by r.checked_at desc,r.id desc limit 1;
  return jsonb_build_object('offerId',target,'revisionId',current_offer.pending_revision_id,'version',current_offer.version,'permission',permission,'evidence',evidence);
end;
$$;

create function private.pinpoint_offer_permission_review_write(
  target uuid, revision uuid, expected_version integer, request_id uuid,
  evidence_kind text, source_reference text, verification_note text, authorization_checked boolean, statement_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; prior public.shopping_offer_permission_reviews%rowtype; stored public.shopping_offer_permission_reviews%rowtype;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode='42501';
  end if;
  if target is null or revision is null or request_id is null or expected_version is null or expected_version < 1
    or authorization_checked is distinct from true or statement_version is distinct from 'admin-permission-review-v1'
    or evidence_kind is null or evidence_kind not in ('written_authorization','existing_business_permission')
    or source_reference is null or char_length(btrim(source_reference)) not between 1 and 1000
    or verification_note is null or char_length(btrim(verification_note)) not between 1 and 2000 then
    raise exception 'Complete authorization evidence required' using errcode='22023';
  end if;
  select * into current_offer from public.shopping_offers where id=target for update;
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode='42501';
  end if;
  if current_offer.id is null or current_offer.version <> expected_version then
    raise exception 'Offer version conflict' using errcode='PT409';
  end if;
  if current_offer.pending_revision_id is distinct from revision or current_offer.withdrawn_at is not null then
    raise exception 'Revision is not awaiting review' using errcode='22023';
  end if;
  if not private.pinpoint_offer_poster_eligible(current_offer.poster_id) then
    raise exception 'Poster is inactive' using errcode='42501';
  end if;
  if not exists (select 1 from public.shopping_offer_permissions p where p.revision_id=revision
    and p.offer_id=target and p.poster_id=current_offer.poster_id and p.statement_version='shop-authorization-v1') then
    raise exception 'Fresh poster authorization confirmation required' using errcode='22023';
  end if;
  select * into prior from public.shopping_offer_permission_reviews r where r.id=request_id;
  if prior.id is not null then
    if prior.offer_id is distinct from target or prior.revision_id is distinct from revision or prior.reviewer_id is distinct from auth.uid()
      or prior.offer_version is distinct from expected_version or prior.evidence_kind is distinct from evidence_kind
      or prior.source_reference is distinct from btrim(source_reference) or prior.verification_note is distinct from btrim(verification_note)
      or prior.statement_version is distinct from statement_version then
      raise exception 'Review request ID already used' using errcode='22023';
    end if;
    return jsonb_build_object('id',prior.id,'offerId',target,'revisionId',revision,'version',current_offer.version,'checkedAt',prior.checked_at);
  end if;
  insert into public.shopping_offer_permission_reviews(id,offer_id,revision_id,poster_id,reviewer_id,offer_version,evidence_kind,source_reference,verification_note,statement_version)
    values (request_id,target,revision,current_offer.poster_id,auth.uid(),expected_version,evidence_kind,btrim(source_reference),btrim(verification_note),'admin-permission-review-v1') returning * into stored;
  return jsonb_build_object('id',stored.id,'offerId',target,'revisionId',revision,'version',current_offer.version,'checkedAt',stored.checked_at);
end;
$$;
create function public.pinpoint_offer_permission_review_read(target uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin return private.pinpoint_offer_permission_review_read(target); end;
$$;
create function public.pinpoint_offer_permission_review_write(
  target uuid, revision uuid, expected_version integer, request_id uuid,
  evidence_kind text, source_reference text, verification_note text, authorization_checked boolean, statement_version text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_offer_permission_review_write(target,revision,expected_version,request_id,evidence_kind,source_reference,verification_note,authorization_checked,statement_version); end;
$$;
revoke all on function private.pinpoint_offer_permission_review_read(uuid),public.pinpoint_offer_permission_review_read(uuid),
  private.pinpoint_offer_permission_review_write(uuid,uuid,integer,uuid,text,text,text,boolean,text),
  public.pinpoint_offer_permission_review_write(uuid,uuid,integer,uuid,text,text,text,boolean,text) from public, anon, authenticated, service_role;
grant execute on function private.pinpoint_offer_permission_review_read(uuid),public.pinpoint_offer_permission_review_read(uuid),
  private.pinpoint_offer_permission_review_write(uuid,uuid,integer,uuid,text,text,text,boolean,text),
  public.pinpoint_offer_permission_review_write(uuid,uuid,integer,uuid,text,text,text,boolean,text) to authenticated;
comment on table public.shopping_offer_permission_reviews is 'Private immutable MFA-reviewed shop authorization evidence. Does not approve or publish an offer.';
