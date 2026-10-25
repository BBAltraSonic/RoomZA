begin;

-- Validate literal object names before any privileged operation or RLS grant.
create function private.application_document_path_matches(renter uuid, object_path text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    renter is not null and object_path is not null
    and split_part(object_path,'/',1)=renter::text
    and length(object_path)>length(renter::text)+1
    and object_path !~ '(^|/)([.]{1,2}|)(/|$)'
    and strpos(object_path,chr(92))=0
    and object_path !~ '[%?#[:cntrl:]]', false);
$$;
revoke all on function private.application_document_path_matches(uuid,text) from public,anon,authenticated;
grant execute on function private.application_document_path_matches(uuid,text) to authenticated,service_role;

create function private.pinpoint_application_document_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare renter uuid; object_path text;
begin
  -- Trusted maintenance/imports still have their existing privileged access.
  if current_user <> 'authenticated' then return new; end if;
  if tg_op='UPDATE' then
    if new is distinct from old then
      raise exception 'Document metadata is immutable' using errcode='42501';
    end if;
    return new;
  end if;
  select a.renter_id into renter from public.applications a
    where a.id=new.application_id and a.renter_id=auth.uid();
  object_path:=coalesce(nullif(new.path,''),new.file_url);
  if renter is null or coalesce(new.bucket,'application-documents') <> 'application-documents'
    or not private.application_document_path_matches(renter,object_path)
    or (new.uploaded_by is not null and new.uploaded_by is distinct from renter) then
    raise exception 'Invalid document storage reference' using errcode='42501';
  end if;
  perform 1 from storage.objects o where o.bucket_id='application-documents' and o.name=object_path
    and coalesce(nullif(o.owner_id,''),renter::text)=renter::text for key share of o;
  if not found then raise exception 'Document object unavailable' using errcode='42501'; end if;
  new.bucket:='application-documents';new.path:=object_path;new.file_url:=object_path;new.uploaded_by:=renter;
  return new;
end;
$$;
revoke all on function private.pinpoint_application_document_guard() from public,anon,authenticated,service_role;
create trigger documents_reference_guard before insert or update on public.documents
  for each row execute function private.pinpoint_application_document_guard();

-- A document's tenant binding cannot be changed through ordinary table writes.
create function private.pinpoint_application_identity_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user='authenticated' and (new.id,new.renter_id,new.listing_id)
    is distinct from (old.id,old.renter_id,old.listing_id) then
    raise exception 'Application identity is immutable' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.pinpoint_application_identity_guard() from public,anon,authenticated,service_role;
create trigger applications_identity_guard before update of id,renter_id,listing_id on public.applications
  for each row execute function private.pinpoint_application_identity_guard();

-- Keep the existing party-based grant, bound to the real renter namespace and
-- object owner. Historical rows are neither rewritten nor deleted.
drop policy "Landlords can read application documents for their listings" on storage.objects;
create policy "Landlords can read application documents for their listings"
on storage.objects for select to authenticated using (
  bucket_id='application-documents' and public.has_profile_role('landlord')
  and exists (
    select 1 from public.documents d join public.applications a on a.id=d.application_id
      join public.listings l on l.id=a.listing_id
    where l.landlord_id=auth.uid() and coalesce(d.bucket,'application-documents')=storage.objects.bucket_id
      and coalesce(nullif(d.path,''),d.file_url)=storage.objects.name
      and private.application_document_path_matches(a.renter_id,storage.objects.name)
      and coalesce(nullif(storage.objects.owner_id,''),a.renter_id::text)=a.renter_id::text
  )
);

commit;
