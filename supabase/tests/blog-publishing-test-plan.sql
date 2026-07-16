-- Blog publishing security and integrity acceptance plan.
-- Run against a disposable local database after all migrations.

do $$
declare
  owner_id constant uuid := '30000000-0000-4000-8000-000000000001';
  admin_id constant uuid := '30000000-0000-4000-8000-000000000002';
  renter_id constant uuid := '30000000-0000-4000-8000-000000000003';
  post_id uuid;
begin
  if has_table_privilege('anon', 'public.blog_posts', 'select')
    or has_table_privilege('authenticated', 'public.blog_posts', 'select')
    or has_table_privilege('authenticated', 'public.blog_post_media', 'insert') then
    raise exception 'FAIL: browser roles have direct blog table privileges';
  end if;

  insert into auth.users(id, email, created_at, updated_at)
  values
    (owner_id, 'blog-owner@example.com', now(), now()),
    (admin_id, 'blog-admin@example.com', now(), now()),
    (renter_id, 'blog-renter@example.com', now(), now())
  on conflict (id) do nothing;
  insert into public.admin_memberships(user_id, level)
  values (owner_id, 'owner'), (admin_id, 'admin')
  on conflict (user_id) do update set revoked_at = null;

  post_id := public.admin_create_blog_draft(admin_id, 'blog-test-create');
  perform public.admin_save_blog_post(
    admin_id, post_id, 'The real move-in cost', 'the-real-move-in-cost',
    'Budgeting', 'Understand deposits, fees, and the first payment before signing.',
    repeat('Useful rental guidance. ', 12), 'blog-test-save'
  );

  begin
    perform public.admin_create_blog_draft(renter_id, 'blog-test-denied');
    raise exception 'FAIL: non-admin created a blog draft';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.admin_set_blog_post_status(admin_id, post_id, 'published', 'blog-test-no-cover');
    raise exception 'FAIL: post published without a cover';
  exception when check_violation then null;
  end;

  if not exists (
    select 1 from public.admin_audit_events
    where target_id = post_id and action_key in ('blog.draft_created', 'blog.content_saved')
  ) then
    raise exception 'FAIL: blog actions were not audited';
  end if;

  perform public.admin_delete_blog_post(admin_id, post_id, 'blog-test-delete');
  delete from public.admin_memberships where user_id in (owner_id, admin_id);
  delete from auth.users where id in (owner_id, admin_id, renter_id);
end $$;

select 'PASS: blog publishing security and integrity checks' as result;
