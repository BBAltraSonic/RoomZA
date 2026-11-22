-- Remove admin blog publishing (added in 20260715014046_blog_publishing.sql).
-- The app no longer reads or writes any of these objects.
--
-- Kept on purpose:
--   * admin_audit_events rows with target_type 'blog_post' stay as audit history.
--   * The 'blog_updates' value of public.notification_category stays, because
--     Postgres cannot drop an enum value without rebuilding the type and every
--     column that uses it.
--
-- Storage: Supabase blocks deleting from storage.objects and storage.buckets
-- in SQL, so the 'blog-media' bucket and its files must be removed through the
-- Storage API (dashboard, or `supabase storage rm -r ss:///blog-media
-- --experimental` followed by deleting the bucket). This migration makes the
-- bucket private so nothing in it is served publicly from now on.

drop function if exists public.admin_create_blog_draft(uuid, text);
drop function if exists public.admin_save_blog_post(uuid, uuid, text, text, text, text, text, text);
drop function if exists public.admin_set_blog_post_status(uuid, uuid, public.blog_post_status, text);
drop function if exists public.admin_delete_blog_post(uuid, uuid, text);

-- Dropping the tables also drops their triggers and indexes.
drop table if exists public.blog_post_media;
drop table if exists public.blog_posts;

drop function if exists public.protect_published_blog_slug();
drop function if exists public.validate_published_blog_post();

drop type if exists public.blog_media_kind;
drop type if exists public.blog_post_status;

update storage.buckets set public = false where id = 'blog-media';
