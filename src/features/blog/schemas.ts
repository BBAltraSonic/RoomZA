import { z } from "zod";

import { BLOG_MEDIA_KINDS, BLOG_POST_STATUSES } from "./types";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogEditorSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(120),
  slug: z.string().trim().toLowerCase().max(80).refine((value) => !value || slugPattern.test(value), "Use lowercase letters, numbers, and hyphens only."),
  topic: z.string().trim().max(40),
  excerpt: z.string().trim().max(240),
  bodyMarkdown: z.string().max(100_000),
});

export const publishableBlogSchema = blogEditorSchema.extend({
  title: z.string().trim().min(5).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(80).regex(slugPattern),
  topic: z.string().trim().min(2).max(40),
  excerpt: z.string().trim().min(30).max(240),
  bodyMarkdown: z.string().trim().min(200).max(100_000),
});

export const blogStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(BLOG_POST_STATUSES),
});

export const blogIdSchema = z.string().uuid();

export const blogMediaInputSchema = z.object({
  postId: z.string().uuid(),
  kind: z.enum(BLOG_MEDIA_KINDS),
  altText: z.string().trim().min(5).max(160),
});

export const BLOG_MEDIA_LIMIT = 20;
export const BLOG_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const BLOG_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export function validateBlogImage(file: File) {
  if (!BLOG_MEDIA_TYPES.includes(file.type as (typeof BLOG_MEDIA_TYPES)[number])) {
    return "Use a JPEG, PNG, WebP, or AVIF image.";
  }
  if (file.size <= 0 || file.size > BLOG_MEDIA_MAX_BYTES) {
    return "Images must be larger than 0 bytes and no more than 5 MB.";
  }
  return null;
}
