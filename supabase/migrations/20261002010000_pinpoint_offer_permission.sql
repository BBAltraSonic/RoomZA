-- Revision-specific shop authorization. Original intake/domain functions stay intact.
create table public.shopping_offer_permissions (
  revision_id uuid primary key,
  offer_id uuid not null,
  poster_id uuid not null,
  statement_version text not null check (statement_version = 'shop-authorization-v1'),
  statement text not null check (statement = 'I am authorized by this shop to publish this offer and its public address, and the benefit, terms and validity dates are accurate.'),
  confirmed_at timestamptz not null default clock_timestamp(),
  foreign key (offer_id, revision_id) references public.shopping_offer_revisions(offer_id, id) on delete restrict,
  foreign key (offer_id, poster_id) references public.shopping_offers(id, poster_id) on delete restrict
);
create index shopping_offer_permissions_poster_idx on public.shopping_offer_permissions(poster_id);
create trigger shopping_offer_permissions_immutable before update or delete
  on public.shopping_offer_permissions for each row execute function private.pinpoint_intake_immutable();
alter table public.shopping_offer_permissions enable row level security;
revoke all on public.shopping_offer_permissions from public, anon, authenticated, service_role;
grant select on public.shopping_offer_permissions to authenticated;
create policy shopping_offer_permissions_owner_read on public.shopping_offer_permissions
  for select to authenticated using (poster_id = (select auth.uid()) and (select private.pinpoint_intake_poster()));

create function private.pinpoint_offer_submit_permission(
  target uuid, revision uuid, expected_version integer, permission_confirmed boolean, permission_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_offer public.shopping_offers%rowtype; result jsonb;
begin
  if permission_confirmed is distinct from true or permission_version is distinct from 'shop-authorization-v1'
    or target is null or revision is null or expected_version is null or expected_version < 1 then
    raise exception 'Explicit current shop authorization confirmation required' using errcode = '22023';
  end if;
  if not private.pinpoint_intake_poster() then
    raise exception 'Poster access required' using errcode = '42501';
  end if;
  select * into current_offer from public.shopping_offers where id = target for update;
  if current_offer.id is null or current_offer.poster_id <> auth.uid() or not private.pinpoint_intake_poster() then
    raise exception 'Offer owner access required' using errcode = '42501';
  end if;
  -- Retry only an already permissioned submission. Never attach consent to an
  -- earlier unpermissioned revision or silently reuse consent from another one.
  if exists (select 1 from public.shopping_offer_revisions r where r.id = revision) then
    if current_offer.pending_revision_id = revision and current_offer.withdrawn_at is null
      and exists (select 1 from public.shopping_offer_permissions p where p.revision_id = revision
        and p.offer_id = target and p.poster_id = auth.uid() and p.statement_version = permission_version) then
      return private.pinpoint_offer_write('submit', target, expected_version, '{}'::jsonb, revision);
    end if;
    raise exception 'Fresh permissioned revision required' using errcode = '22023';
  end if;
  result := private.pinpoint_offer_write('submit', target, expected_version, '{}'::jsonb, revision);
  insert into public.shopping_offer_permissions(revision_id, offer_id, poster_id, statement_version, statement)
    values (revision, target, auth.uid(), 'shop-authorization-v1',
      'I am authorized by this shop to publish this offer and its public address, and the benefit, terms and validity dates are accurate.');
  return result;
end;
$$;
create function public.pinpoint_offer_submit_permission(
  target uuid, revision uuid, expected_version integer, permission_confirmed boolean, permission_version text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin return private.pinpoint_offer_submit_permission(target, revision, expected_version, permission_confirmed, permission_version); end;
$$;
revoke all on function private.pinpoint_offer_submit_permission(uuid,uuid,integer,boolean,text),
  public.pinpoint_offer_submit_permission(uuid,uuid,integer,boolean,text) from public, anon, authenticated, service_role;
grant execute on function private.pinpoint_offer_submit_permission(uuid,uuid,integer,boolean,text),
  public.pinpoint_offer_submit_permission(uuid,uuid,integer,boolean,text) to authenticated;
comment on table public.shopping_offer_permissions is
  'Private immutable poster authorization statements for exact revisions. Not admin evidence or publication approval.';
