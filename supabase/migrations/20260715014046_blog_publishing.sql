-- Pinpoints admin-authored blog publishing.
-- Content tables remain server-only; public pages read published rows through
-- the server service client. The media bucket is public for asset delivery,
-- while all writes are performed by MFA-gated server actions.

do $$ begin
  create type public.blog_post_status as enum ('draft', 'published');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.blog_media_kind as enum ('cover', 'inline');
exception when duplicate_object then null;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null default '' check (char_length(title) <= 120),
  topic text not null default '' check (char_length(topic) <= 40),
  excerpt text not null default '' check (char_length(excerpt) <= 240),
  body_markdown text not null default '' check (char_length(body_markdown) <= 100000),
  status public.blog_post_status not null default 'draft',
  author_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_format check (
    slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint blog_posts_published_at_state check (
    status = 'draft' or published_at is not null
  )
);

create unique index if not exists blog_posts_slug_unique_idx
  on public.blog_posts(lower(slug)) where slug is not null;
create index if not exists blog_posts_latest_published_idx
  on public.blog_posts(published_at desc, id)
  where status = 'published';

create table if not exists public.blog_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  kind public.blog_media_kind not null,
  bucket text not null default 'blog-media' check (bucket = 'blog-media'),
  path text not null unique,
  public_url text not null,
  alt_text text not null check (char_length(trim(alt_text)) between 5 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists blog_post_media_one_cover_idx
  on public.blog_post_media(post_id) where kind = 'cover';
create index if not exists blog_post_media_post_created_idx
  on public.blog_post_media(post_id, created_at desc);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row execute function public.handle_updated_at();

create or replace function public.protect_published_blog_slug()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.published_at is not null and new.slug is distinct from old.slug then
    raise exception 'published blog slugs are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists blog_posts_protect_published_slug on public.blog_posts;
create trigger blog_posts_protect_published_slug
before update of slug on public.blog_posts
for each row execute function public.protect_published_blog_slug();

create or replace function public.validate_published_blog_post()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'published' then
    if char_length(trim(new.title)) < 5
      or new.slug is null
      or char_length(new.slug) not between 3 and 80
      or char_length(trim(new.topic)) not between 2 and 40
      or char_length(trim(new.excerpt)) not between 30 and 240
      or char_length(trim(new.body_markdown)) < 200
      or new.published_at is null then
      raise exception 'blog post is incomplete' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.blog_post_media
      where post_id = new.id and kind = 'cover'
    ) then
      raise exception 'blog cover image is required' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists blog_posts_validate_published on public.blog_posts;
create trigger blog_posts_validate_published
before insert or update on public.blog_posts
for each row execute function public.validate_published_blog_post();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-media',
  'blog-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.blog_posts enable row level security;
alter table public.blog_posts force row level security;
alter table public.blog_post_media enable row level security;
alter table public.blog_post_media force row level security;

revoke all on table public.blog_posts from public, anon, authenticated;
revoke all on table public.blog_post_media from public, anon, authenticated;
grant select, insert, update, delete on table public.blog_posts to service_role;
grant select, insert, update, delete on table public.blog_post_media to service_role;

create or replace function public.admin_create_blog_draft(
  actor uuid,
  audit_request_id text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  post_id uuid;
begin
  perform public.assert_admin_actor(actor);
  insert into public.blog_posts(author_id)
  values (actor)
  returning id into post_id;

  insert into public.admin_audit_events(
    actor_id, action_key, target_type, target_id, request_id
  ) values (
    actor, 'blog.draft_created', 'blog_post', post_id, audit_request_id
  );
  return post_id;
end;
$$;

create or replace function public.admin_save_blog_post(
  actor uuid,
  target_post uuid,
  next_title text,
  next_slug text,
  next_topic text,
  next_excerpt text,
  next_body_markdown text,
  audit_request_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_post public.blog_posts%rowtype;
  normalized_slug text;
begin
  perform public.assert_admin_actor(actor);
  select * into current_post from public.blog_posts where id = target_post for update;
  if current_post.id is null then raise exception 'blog post not found'; end if;

  normalized_slug := nullif(lower(trim(next_slug)), '');
  if current_post.published_at is not null
    and normalized_slug is distinct from current_post.slug then
    raise exception 'published blog slugs are immutable' using errcode = '23514';
  end if;

  update public.blog_posts set
    title = trim(next_title),
    slug = normalized_slug,
    topic = trim(next_topic),
    excerpt = trim(next_excerpt),
    body_markdown = next_body_markdown
  where id = target_post;

  insert into public.admin_audit_events(
    actor_id, action_key, target_type, target_id, request_id,
    metadata
  ) values (
    actor, 'blog.content_saved', 'blog_post', target_post, audit_request_id,
    jsonb_build_object('status', current_post.status)
  );
end;
$$;

create or replace function public.admin_set_blog_post_status(
  actor uuid,
  target_post uuid,
  next_status public.blog_post_status,
  audit_request_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_post public.blog_posts%rowtype;
begin
  perform public.assert_admin_actor(actor);
  select * into current_post from public.blog_posts where id = target_post for update;
  if current_post.id is null then raise exception 'blog post not found'; end if;

  if next_status = 'published' then
    if char_length(trim(current_post.title)) < 5
      or current_post.slug is null
      or char_length(current_post.slug) not between 3 and 80
      or char_length(trim(current_post.topic)) not between 2 and 40
      or char_length(trim(current_post.excerpt)) not between 30 and 240
      or char_length(trim(current_post.body_markdown)) < 200 then
      raise exception 'blog post is incomplete' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.blog_post_media
      where post_id = target_post and kind = 'cover'
    ) then
      raise exception 'blog cover image is required' using errcode = '23514';
    end if;
  end if;

  update public.blog_posts set
    status = next_status,
    published_at = case
      when next_status = 'published' then coalesce(published_at, now())
      else published_at
    end
  where id = target_post;

  insert into public.admin_audit_events(
    actor_id, action_key, target_type, target_id, request_id,
    metadata
  ) values (
    actor,
    case when next_status = 'published' then 'blog.published' else 'blog.unpublished' end,
    'blog_post', target_post, audit_request_id,
    jsonb_build_object('previousStatus', current_post.status, 'status', next_status)
  );
end;
$$;

create or replace function public.admin_delete_blog_post(
  actor uuid,
  target_post uuid,
  audit_request_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_status public.blog_post_status;
begin
  perform public.assert_admin_actor(actor);
  select status into current_status
  from public.blog_posts where id = target_post for update;
  if current_status is null then raise exception 'blog post not found'; end if;
  if current_status <> 'draft' then
    raise exception 'unpublish the blog post before deleting it' using errcode = '23514';
  end if;

  insert into public.admin_audit_events(
    actor_id, action_key, target_type, target_id, request_id
  ) values (
    actor, 'blog.deleted', 'blog_post', target_post, audit_request_id
  );
  delete from public.blog_posts where id = target_post;
end;
$$;

revoke all on function public.admin_create_blog_draft(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_save_blog_post(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_set_blog_post_status(uuid, uuid, public.blog_post_status, text) from public, anon, authenticated;
revoke all on function public.admin_delete_blog_post(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.admin_create_blog_draft(uuid, text) to service_role;
grant execute on function public.admin_save_blog_post(uuid, uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.admin_set_blog_post_status(uuid, uuid, public.blog_post_status, text) to service_role;
grant execute on function public.admin_delete_blog_post(uuid, uuid, text) to service_role;

revoke all on function public.protect_published_blog_slug() from public, anon, authenticated;
revoke all on function public.validate_published_blog_post() from public, anon, authenticated;

comment on table public.blog_posts is 'Server-managed admin blog posts; only published rows are rendered publicly.';
comment on table public.blog_post_media is 'Tracked cover and inline blog assets stored in the public blog-media bucket.';
