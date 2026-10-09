-- Private provenance/content review only. No approval, publication or original-function changes.
create table public.shopping_offer_location_reviews (
  id uuid primary key,
  offer_id uuid not null,
  revision_id uuid not null,
  poster_id uuid not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  offer_version integer not null check (offer_version > 0),
  permission_review_id uuid not null references public.shopping_offer_permission_reviews(id) on delete restrict,
  place_id uuid not null references public.discovery_places(id) on delete restrict,
  place_snapshot jsonb not null check (jsonb_typeof(place_snapshot) = 'object'),
  provenance_reference text not null check (char_length(btrim(provenance_reference)) between 1 and 1000),
  shop_reference text not null check (char_length(btrim(shop_reference)) between 1 and 1000),
  verification_note text not null check (char_length(btrim(verification_note)) between 1 and 2000),
  statement_version text not null check (statement_version = 'admin-location-review-v1'),
  checked_at timestamptz not null default clock_timestamp(),
  foreign key (offer_id, revision_id) references public.shopping_offer_revisions(offer_id,id) on delete restrict,
  foreign key (offer_id, poster_id) references public.shopping_offers(id,poster_id) on delete restrict
);
create index shopping_offer_location_reviews_revision_idx on public.shopping_offer_location_reviews(revision_id,checked_at desc);
create index shopping_offer_location_reviews_offer_poster_idx on public.shopping_offer_location_reviews(offer_id,poster_id);
create index shopping_offer_location_reviews_reviewer_idx on public.shopping_offer_location_reviews(reviewer_id);
create index shopping_offer_location_reviews_permission_idx on public.shopping_offer_location_reviews(permission_review_id);
create index shopping_offer_location_reviews_place_idx on public.shopping_offer_location_reviews(place_id);
create trigger shopping_offer_location_reviews_immutable before update or delete on public.shopping_offer_location_reviews
  for each row execute function private.pinpoint_intake_immutable();
alter table public.shopping_offer_location_reviews enable row level security;
revoke all on public.shopping_offer_location_reviews from public, anon, authenticated, service_role;

create function private.pinpoint_offer_location_review_read(target uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; content jsonb; place jsonb; permission_review uuid; evidence jsonb;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode='42501';
  end if;
  select * into current_offer from public.shopping_offers where id=target;
  if current_offer.id is null or current_offer.pending_revision_id is null or current_offer.withdrawn_at is not null then return null; end if;
  if not private.pinpoint_offer_poster_eligible(current_offer.poster_id) then
    raise exception 'Poster is inactive' using errcode='42501';
  end if;
  select r.content into content from public.shopping_offer_revisions r where r.id=current_offer.pending_revision_id and r.offer_id=target;
  select to_jsonb(p) into place from public.discovery_places p where p.id=(content->>'areaId')::uuid;
  select r.id into permission_review from public.shopping_offer_permission_reviews r
    join public.shopping_offer_permissions p on p.revision_id=r.revision_id and p.offer_id=r.offer_id and p.poster_id=r.poster_id
    where r.offer_id=target and r.revision_id=current_offer.pending_revision_id and r.poster_id=current_offer.poster_id
      and r.offer_version=current_offer.version order by r.checked_at desc,r.id desc limit 1;
  select jsonb_build_object('id',r.id,'reviewerId',r.reviewer_id,'offerVersion',r.offer_version,'permissionReviewId',r.permission_review_id,
    'placeSnapshot',r.place_snapshot,'provenanceReference',r.provenance_reference,'shopReference',r.shop_reference,
    'verificationNote',r.verification_note,'statementVersion',r.statement_version,'checkedAt',r.checked_at)
    into evidence from public.shopping_offer_location_reviews r where r.offer_id=target and r.revision_id=current_offer.pending_revision_id
    order by r.checked_at desc,r.id desc limit 1;
  return jsonb_build_object('offerId',target,'revisionId',current_offer.pending_revision_id,'version',current_offer.version,
    'content',content,'place',place,'permissionReviewId',permission_review,'evidence',evidence);
end;
$$;

create function private.pinpoint_offer_location_review_write(
  target uuid, revision uuid, expected_version integer, request_id uuid, permission_review_id uuid, place_snapshot jsonb,
  provenance_reference text, shop_reference text, verification_note text,
  provenance_checked boolean, shop_checked boolean, content_checked boolean, dates_checked boolean, statement_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; content jsonb; current_place public.discovery_places%rowtype;
  prior public.shopping_offer_location_reviews%rowtype; stored public.shopping_offer_location_reviews%rowtype;
begin
  if not private.pinpoint_intake_reviewer() then
    raise exception 'Admin membership and MFA required' using errcode='42501';
  end if;
  if target is null or revision is null or request_id is null or permission_review_id is null or expected_version is null or expected_version < 1
    or place_snapshot is null or jsonb_typeof(place_snapshot) <> 'object' or octet_length(place_snapshot::text) > 12000
    or provenance_reference is null or char_length(btrim(provenance_reference)) not between 1 and 1000
    or shop_reference is null or char_length(btrim(shop_reference)) not between 1 and 1000
    or verification_note is null or char_length(btrim(verification_note)) not between 1 and 2000
    or provenance_checked is distinct from true or shop_checked is distinct from true
    or content_checked is distinct from true or dates_checked is distinct from true
    or statement_version is distinct from 'admin-location-review-v1' then
    raise exception 'Complete place, shop, content and date evidence required' using errcode='22023';
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
  if not exists (select 1 from public.shopping_offer_permission_reviews r
    join public.shopping_offer_permissions p on p.revision_id=r.revision_id and p.offer_id=r.offer_id and p.poster_id=r.poster_id
    where r.id=permission_review_id and r.offer_id=target and r.revision_id=revision and r.poster_id=current_offer.poster_id
      and r.offer_version=expected_version and r.statement_version='admin-permission-review-v1'
      and p.statement_version='shop-authorization-v1') then
    raise exception 'Current revision authorization evidence required' using errcode='22023';
  end if;
  select r.content into content from public.shopping_offer_revisions r where r.id=revision and r.offer_id=target;
  select * into current_place from public.discovery_places p where p.id=(content->>'areaId')::uuid for share;
  if current_place.id is null or to_jsonb(current_place) is distinct from place_snapshot then
    raise exception 'Catalogue place changed' using errcode='PT409';
  end if;
  if char_length(btrim(current_place.provider_id))=0 then
    raise exception 'Provider provenance reference required' using errcode='22023';
  end if;
  -- Bounds alone never prove provenance or shop identity. Independent source
  -- checks above are recorded for the exact catalogue/revision reviewed.
  perform private.pinpoint_intake_validate(content,true);
  select * into prior from public.shopping_offer_location_reviews r where r.id=request_id;
  if prior.id is not null then
    if prior.offer_id is distinct from target or prior.revision_id is distinct from revision or prior.reviewer_id is distinct from auth.uid()
      or prior.offer_version is distinct from expected_version or prior.permission_review_id is distinct from permission_review_id
      or prior.place_snapshot is distinct from place_snapshot or prior.provenance_reference is distinct from btrim(provenance_reference)
      or prior.shop_reference is distinct from btrim(shop_reference) or prior.verification_note is distinct from btrim(verification_note)
      or prior.statement_version is distinct from statement_version then
      raise exception 'Review request ID already used' using errcode='22023';
    end if;
    return jsonb_build_object('id',prior.id,'offerId',target,'revisionId',revision,'version',current_offer.version,'checkedAt',prior.checked_at);
  end if;
  insert into public.shopping_offer_location_reviews(id,offer_id,revision_id,poster_id,reviewer_id,offer_version,permission_review_id,
    place_id,place_snapshot,provenance_reference,shop_reference,verification_note,statement_version)
    values(request_id,target,revision,current_offer.poster_id,auth.uid(),expected_version,permission_review_id,current_place.id,
      to_jsonb(current_place),btrim(provenance_reference),btrim(shop_reference),btrim(verification_note),'admin-location-review-v1') returning * into stored;
  return jsonb_build_object('id',stored.id,'offerId',target,'revisionId',revision,'version',current_offer.version,'checkedAt',stored.checked_at);
end;
$$;
create function public.pinpoint_offer_location_review_read(target uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin return private.pinpoint_offer_location_review_read(target); end;
$$;
create function public.pinpoint_offer_location_review_write(
  target uuid, revision uuid, expected_version integer, request_id uuid, permission_review_id uuid, place_snapshot jsonb,
  provenance_reference text, shop_reference text, verification_note text,
  provenance_checked boolean, shop_checked boolean, content_checked boolean, dates_checked boolean, statement_version text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_offer_location_review_write(target,revision,expected_version,request_id,permission_review_id,place_snapshot,
  provenance_reference,shop_reference,verification_note,provenance_checked,shop_checked,content_checked,dates_checked,statement_version); end;
$$;
revoke all on function private.pinpoint_offer_location_review_read(uuid),public.pinpoint_offer_location_review_read(uuid),
  private.pinpoint_offer_location_review_write(uuid,uuid,integer,uuid,uuid,jsonb,text,text,text,boolean,boolean,boolean,boolean,text),
  public.pinpoint_offer_location_review_write(uuid,uuid,integer,uuid,uuid,jsonb,text,text,text,boolean,boolean,boolean,boolean,text)
  from public, anon, authenticated, service_role;
grant execute on function private.pinpoint_offer_location_review_read(uuid),public.pinpoint_offer_location_review_read(uuid),
  private.pinpoint_offer_location_review_write(uuid,uuid,integer,uuid,uuid,jsonb,text,text,text,boolean,boolean,boolean,boolean,text),
  public.pinpoint_offer_location_review_write(uuid,uuid,integer,uuid,uuid,jsonb,text,text,text,boolean,boolean,boolean,boolean,text) to authenticated;
comment on table public.shopping_offer_location_reviews is 'Private immutable MFA-reviewed catalogue provenance, shop point/address, content and date evidence. Does not approve or publish.';
