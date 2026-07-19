import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";

import { requireAdmin } from "@/features/admin/auth";

import type {
  BlogPostDetail,
  BlogPostMedia,
  BlogPostStatus,
  BlogPostSummary,
  PaginatedBlogPosts,
} from "./types";
import { calculateReadingMinutes } from "./utils";

type RawPost = {
  id: string;
  slug: string | null;
  title: string;
  topic: string;
  excerpt: string;
  body_markdown: string;
  status: BlogPostStatus;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawMedia = {
  id: string;
  post_id: string;
  kind: "cover" | "inline";
  bucket: "blog-media";
  path: string;
  public_url: string;
  alt_text: string;
  created_at: string;
};

function mapMedia(media: RawMedia): BlogPostMedia {
  return {
    id: media.id,
    postId: media.post_id,
    kind: media.kind,
    bucket: media.bucket,
    path: media.path,
    publicUrl: media.public_url,
    altText: media.alt_text,
    createdAt: media.created_at,
  };
}
function mapSummary(post: RawPost, media: RawMedia[]): BlogPostSummary {
  const cover = media.find((item) => item.post_id === post.id && item.kind === "cover");
  return {
    id: post.id,
    slug: post.slug ?? "",
    title: post.title,
    topic: post.topic,
    excerpt: post.excerpt,
    status: post.status,
    publishedAt: post.published_at,
    updatedAt: post.updated_at,
    cover: cover ? mapMedia(cover) : null,
    readingMinutes: calculateReadingMinutes(post.body_markdown),
  };
}

async function mediaForPosts(postIds: string[]) {
  if (!postIds.length) return [] as RawMedia[];
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("blog_post_media")
    .select("id, post_id, kind, bucket, path, public_url, alt_text, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load blog media.");
  return (data ?? []) as RawMedia[];
}

export async function listPublishedBlogPosts(page = 1, pageSize = 10): Promise<PaginatedBlogPosts> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(24, Math.max(1, Math.floor(pageSize)));
  const from = (safePage - 1) * safePageSize;
  const admin = createUntypedClient();
  const { data, error, count } = await admin
    .from("blog_posts")
    .select("id, slug, title, topic, excerpt, body_markdown, status, author_id, published_at, created_at, updated_at", { count: "exact" })
    .eq("status", "published")
    .not("slug", "is", null)
    .order("published_at", { ascending: false })
    .range(from, from + safePageSize - 1);

  if (error) throw new Error("Unable to load published blog posts.");
  const posts = (data ?? []) as RawPost[];
  const media = await mediaForPosts(posts.map((post) => post.id));
  const total = count ?? 0;
  return {
    posts: posts.map((post) => mapSummary(post, media)),
    page: safePage,
    pageSize: safePageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

export async function getLatestPublishedBlogPosts(limit = 3) {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, title, topic, excerpt, body_markdown, status, author_id, published_at, created_at, updated_at")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("published_at", { ascending: false })
    .limit(Math.min(12, Math.max(1, Math.floor(limit))));
  if (error) throw new Error("Unable to load latest blog posts.");
  const posts = (data ?? []) as RawPost[];
  const media = await mediaForPosts(posts.map((post) => post.id));
  return posts.map((post) => mapSummary(post, media));
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostDetail | null> {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, title, topic, excerpt, body_markdown, status, author_id, published_at, created_at, updated_at")
    .eq("status", "published")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) throw new Error("Unable to load the blog post.");
  if (!data) return null;
  const post = data as RawPost;
  const rawMedia = await mediaForPosts([post.id]);
  return {
    ...mapSummary(post, rawMedia),
    bodyMarkdown: post.body_markdown,
    media: rawMedia.map(mapMedia),
  };
}

export async function getPublishedBlogSitemapRows() {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("published_at", { ascending: false });
  if (error) throw new Error("Unable to load blog sitemap rows.");
  return (data ?? []) as Array<{ slug: string; updated_at: string }>;
}

export async function listAdminBlogPosts(params: { page?: number; status?: string } = {}) {
  await requireAdmin();
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const admin = createUntypedClient();
  let query = admin
    .from("blog_posts")
    .select("id, slug, title, topic, excerpt, body_markdown, status, author_id, published_at, created_at, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (params.status === "draft" || params.status === "published") query = query.eq("status", params.status);
  const { data, error, count } = await query;
  if (error) throw new Error("Unable to load admin blog posts.");
  const posts = (data ?? []) as RawPost[];
  const media = await mediaForPosts(posts.map((post) => post.id));
  return {
    posts: posts.map((post) => mapSummary(post, media)),
    page,
    pageSize,
    total: count ?? 0,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getAdminBlogPost(id: string): Promise<BlogPostDetail | null> {
  await requireAdmin();
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, title, topic, excerpt, body_markdown, status, author_id, published_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to load the blog post.");
  if (!data) return null;
  const post = data as RawPost;
  const rawMedia = await mediaForPosts([id]);
  return {
    ...mapSummary(post, rawMedia),
    bodyMarkdown: post.body_markdown,
    media: rawMedia.map(mapMedia),
  };
}
