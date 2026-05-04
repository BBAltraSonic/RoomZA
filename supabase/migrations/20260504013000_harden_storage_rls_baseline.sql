drop policy if exists "Anyone can read listing images" on storage.objects;

create or replace function public.has_profile_role(expected_role text)
returns boolean
language sql
stable
security invoker
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

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
