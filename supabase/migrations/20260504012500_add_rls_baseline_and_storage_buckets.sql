alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create or replace function public.has_profile_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = expected_role
  );
$$;

revoke execute on function public.has_profile_role(text) from public, anon;
grant execute on function public.has_profile_role(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'listing-images',
    'listing-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'application-documents',
    'application-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png']
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read listing images" on storage.objects;
drop policy if exists "Landlords can upload listing images" on storage.objects;
drop policy if exists "Landlords can update their listing images" on storage.objects;
drop policy if exists "Landlords can delete their listing images" on storage.objects;
drop policy if exists "Renters can upload application documents" on storage.objects;
drop policy if exists "Renters can read their application documents" on storage.objects;
drop policy if exists "Renters can update their application documents" on storage.objects;
drop policy if exists "Renters can delete their application documents" on storage.objects;

create policy "Anyone can read listing images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'listing-images');

create policy "Landlords can upload listing images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and public.has_profile_role('landlord')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Landlords can update their listing images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('landlord')
  )
  with check (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('landlord')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Landlords can delete their listing images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('landlord')
  );

create policy "Renters can upload application documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and public.has_profile_role('renter')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Renters can read their application documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('renter')
  );

create policy "Renters can update their application documents"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'application-documents'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('renter')
  )
  with check (
    bucket_id = 'application-documents'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('renter')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Renters can delete their application documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'application-documents'
    and owner_id = (select auth.uid())::text
    and public.has_profile_role('renter')
  );
