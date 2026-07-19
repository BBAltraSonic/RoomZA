export const BLOG_POST_STATUSES = ["draft", "published"] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const BLOG_MEDIA_KINDS = ["cover", "inline"] as const;
export type BlogMediaKind = (typeof BLOG_MEDIA_KINDS)[number];

export type BlogPostMedia = {
  id: string;
  postId: string;
  kind: BlogMediaKind;
  bucket: "blog-media";
  path: string;
  publicUrl: string;
  altText: string;
  createdAt: string;
};
export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  excerpt: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  updatedAt: string;
  cover: BlogPostMedia | null;
  readingMinutes: number;
};

export type BlogPostDetail = BlogPostSummary & {
  bodyMarkdown: string;
  media: BlogPostMedia[];
};

export type BlogEditorInput = {
  id: string;
  title: string;
  slug: string;
  topic: string;
  excerpt: string;
  bodyMarkdown: string;
};

export type PaginatedBlogPosts = {
  posts: BlogPostSummary[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};
