-- Blog removal acceptance plan for 20261122120000_remove_blog_publishing.sql.
-- Run after migrations; it only reads the catalog.

do $$
begin
  if to_regclass('public.blog_posts') is not null
    or to_regclass('public.blog_post_media') is not null then
    raise exception 'FAIL: blog tables still exist';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'admin_create_blog_draft', 'admin_save_blog_post', 'admin_set_blog_post_status',
      'admin_delete_blog_post', 'protect_published_blog_slug', 'validate_published_blog_post'
    )
  ) then
    raise exception 'FAIL: blog functions still exist';
  end if;

  if to_regtype('public.blog_post_status') is not null
    or to_regtype('public.blog_media_kind') is not null then
    raise exception 'FAIL: blog enum types still exist';
  end if;

  if exists (select 1 from storage.buckets where id = 'blog-media' and public) then
    raise exception 'FAIL: blog-media bucket is still public';
  end if;

  -- Existing notification preferences must keep working.
  if not 'blog_updates' = any (enum_range(null::public.notification_category)::text[]) then
    raise exception 'FAIL: blog_updates notification category was removed';
  end if;
end $$;

select 'PASS: blog publishing removed' as result;
