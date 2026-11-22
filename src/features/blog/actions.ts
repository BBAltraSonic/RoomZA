"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { appendAdminAudit } from "@/features/admin/audit";
import { requireAdmin } from "@/features/admin/auth";
import { actionFailure, actionSuccess, fieldErrorFailure } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

import {
  BLOG_MEDIA_LIMIT,
  blogEditorSchema,
  blogIdSchema,
  blogMediaInputSchema,
  blogStatusSchema,
  publishableBlogSchema,
  validateBlogImage,
} from "./schemas";
import type { BlogEditorInput, BlogPostMedia } from "./types";

async function requestId() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray") ?? randomUUID();
}

function revalidateBlog(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/admin/blog");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}

function mediaExtension(type: string) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  } as Record<string, string>)[type] ?? "jpg";
}

function mapMedia(row: Record<string, unknown>): BlogPostMedia {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    kind: row.kind === "cover" ? "cover" : "inline",
    bucket: "blog-media",
    path: String(row.path),
    publicUrl: String(row.public_url),
    altText: String(row.alt_text),
    createdAt: String(row.created_at),
  };
}

export async function createBlogDraft() {
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data, error } = await admin.rpc("admin_create_blog_draft", {
    actor: context.user.id,
    audit_request_id: id,
  });
  if (error || !data) {
    logger.error("Blog draft creation failed", { requestId: id, actorId: context.user.id, error });
    return actionFailure("The draft could not be created.");
  }
  revalidatePath("/admin/blog");
  return actionSuccess({ id: String(data) });
}

export async function saveBlogPost(input: BlogEditorInput) {
  const parsed = blogEditorSchema.safeParse(input);
  if (!parsed.success) return fieldErrorFailure(parsed.error.flatten().fieldErrors);

  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const value = parsed.data;
  const { error } = await admin.rpc("admin_save_blog_post", {
    actor: context.user.id,
    target_post: value.id,
    next_title: value.title,
    next_slug: value.slug,
    next_topic: value.topic,
    next_excerpt: value.excerpt,
    next_body_markdown: value.bodyMarkdown,
    audit_request_id: id,
  });
  if (error) {
    logger.error("Blog post save failed", { requestId: id, actorId: context.user.id, postId: value.id, error });
    if (error.code === "23505") return actionFailure("That slug is already used by another post.");
    if (error.message?.includes("immutable")) return actionFailure("The slug cannot change after publication.");
    return actionFailure("The post could not be saved.");
  }
  revalidatePath(`/admin/blog/${value.id}/edit`);
  revalidateBlog(value.slug);
  return actionSuccess(undefined);
}

export async function setBlogPostStatus(input: unknown) {
  const parsed = blogStatusSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Invalid blog status change.");

  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, slug, title, topic, excerpt, body_markdown")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!post) return actionFailure("The blog post could not be found.");

  if (parsed.data.status === "published") {
    const publishable = publishableBlogSchema.safeParse({
      id: post.id,
      slug: post.slug ?? "",
      title: post.title,
      topic: post.topic,
      excerpt: post.excerpt,
      bodyMarkdown: post.body_markdown,
    });
    if (!publishable.success) return fieldErrorFailure(publishable.error.flatten().fieldErrors, "Complete the required publishing details.");
  }

  const { error } = await admin.rpc("admin_set_blog_post_status", {
    actor: context.user.id,
    target_post: parsed.data.id,
    next_status: parsed.data.status,
    audit_request_id: id,
  });
  if (error) {
    logger.error("Blog status change failed", { requestId: id, actorId: context.user.id, postId: parsed.data.id, status: parsed.data.status, error });
    return actionFailure(error.message?.includes("cover") ? "Add a cover image before publishing." : "The publication status could not be changed.");
  }
  revalidatePath(`/admin/blog/${parsed.data.id}/edit`);
  revalidateBlog(post.slug);
  return actionSuccess(undefined);
}

export async function deleteBlogPost(postId: string) {
  const parsed = blogIdSchema.safeParse(postId);
  if (!parsed.success) return actionFailure("Invalid blog post.");

  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const [{ data: post }, { data: media }] = await Promise.all([
    admin.from("blog_posts").select("id, slug, status").eq("id", parsed.data).maybeSingle(),
    admin.from("blog_post_media").select("path").eq("post_id", parsed.data),
  ]);
  if (!post) return actionFailure("The blog post could not be found.");
  if (post.status !== "draft") return actionFailure("Unpublish this post before deleting it.");

  const { error } = await admin.rpc("admin_delete_blog_post", {
    actor: context.user.id,
    target_post: parsed.data,
    audit_request_id: id,
  });
  if (error) {
    logger.error("Blog post deletion failed", { requestId: id, actorId: context.user.id, postId: parsed.data, error });
    return actionFailure("The blog post could not be deleted.");
  }

  const paths = (media ?? []).map((item) => item.path);
  if (paths.length) {
    const { error: cleanupError } = await admin.storage.from("blog-media").remove(paths);
    if (cleanupError) logger.warn("Blog media cleanup incomplete", { requestId: id, postId: parsed.data, assetCount: paths.length, error: cleanupError });
  }
  revalidateBlog(post.slug);
  return actionSuccess(undefined);
}

export async function uploadBlogMedia(formData: FormData) {
  const input = blogMediaInputSchema.safeParse({
    postId: formData.get("postId"),
    kind: formData.get("kind"),
    altText: formData.get("altText"),
  });
  const file = formData.get("file");
  if (!input.success || !(file instanceof File)) return actionFailure("Choose an image and add descriptive alt text.");
  const fileError = validateBlogImage(file);
  if (fileError) return actionFailure(fileError);

  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: post } = await admin.from("blog_posts").select("id").eq("id", input.data.postId).maybeSingle();
  if (!post) return actionFailure("The blog post could not be found.");

  const [{ count }, { data: currentCover }] = await Promise.all([
    admin.from("blog_post_media").select("id", { count: "exact", head: true }).eq("post_id", input.data.postId),
    input.data.kind === "cover"
      ? admin.from("blog_post_media").select("id, path").eq("post_id", input.data.postId).eq("kind", "cover").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if ((count ?? 0) >= BLOG_MEDIA_LIMIT && !currentCover) return actionFailure(`Posts are limited to ${BLOG_MEDIA_LIMIT} images.`);

  const storagePath = `${input.data.postId}/${randomUUID()}.${mediaExtension(file.type)}`;
  const { error: uploadError } = await admin.storage.from("blog-media").upload(storagePath, file, { contentType: file.type });
  if (uploadError) {
    logger.error("Blog media upload failed", { requestId: id, actorId: context.user.id, postId: input.data.postId, kind: input.data.kind, error: uploadError });
    return actionFailure("The image could not be uploaded.");
  }
  const { data: publicUrl } = admin.storage.from("blog-media").getPublicUrl(storagePath);
  const mediaValue = {
    post_id: input.data.postId,
    kind: input.data.kind,
    bucket: "blog-media",
    path: storagePath,
    public_url: publicUrl.publicUrl,
    alt_text: input.data.altText,
    created_by: context.user.id,
  };

  const mediaQuery = currentCover
    ? admin.from("blog_post_media").update(mediaValue).eq("id", currentCover.id).select("id, post_id, kind, bucket, path, public_url, alt_text, created_at").single()
    : admin.from("blog_post_media").insert(mediaValue).select("id, post_id, kind, bucket, path, public_url, alt_text, created_at").single();
  const { data: mediaRow, error: recordError } = await mediaQuery;
  if (recordError || !mediaRow) {
    await admin.storage.from("blog-media").remove([storagePath]);
    logger.error("Blog media record save failed", { requestId: id, actorId: context.user.id, postId: input.data.postId, kind: input.data.kind, error: recordError });
    return actionFailure("The image record could not be saved.");
  }
  if (currentCover?.path) {
    const { error: cleanupError } = await admin.storage.from("blog-media").remove([currentCover.path]);
    if (cleanupError) logger.warn("Replaced blog cover cleanup incomplete", { requestId: id, postId: input.data.postId, error: cleanupError });
  }
  await appendAdminAudit({
    actorId: context.user.id,
    actionKey: currentCover ? "blog.cover_replaced" : "blog.media_uploaded",
    targetType: "blog_post",
    targetId: input.data.postId,
    requestId: id,
    metadata: { kind: input.data.kind, mediaId: mediaRow.id },
  });
  revalidatePath(`/admin/blog/${input.data.postId}/edit`);
  revalidateBlog();
  return actionSuccess({ media: mapMedia(mediaRow as Record<string, unknown>) });
}

export async function deleteBlogMedia(mediaId: string) {
  const parsed = blogIdSchema.safeParse(mediaId);
  if (!parsed.success) return actionFailure("Invalid blog image.");
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: media } = await admin
    .from("blog_post_media")
    .select("id, post_id, kind, path, public_url, post:blog_posts(body_markdown)")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!media) return actionFailure("The image could not be found.");
  if (media.kind === "cover") return actionFailure("Replace the cover image instead of deleting it.");
  const relatedPost = Array.isArray(media.post) ? media.post[0] : media.post;
  if (relatedPost?.body_markdown?.includes(media.public_url)) return actionFailure("Remove this image from the Markdown before deleting it.");

  const { error } = await admin.from("blog_post_media").delete().eq("id", media.id);
  if (error) {
    logger.error("Blog media record deletion failed", { requestId: id, actorId: context.user.id, postId: media.post_id, mediaId: media.id, error });
    return actionFailure("The image record could not be deleted.");
  }
  const { error: storageError } = await admin.storage.from("blog-media").remove([media.path]);
  if (storageError) logger.warn("Deleted blog media file cleanup incomplete", { requestId: id, postId: media.post_id, mediaId: media.id, error: storageError });
  await appendAdminAudit({ actorId: context.user.id, actionKey: "blog.media_deleted", targetType: "blog_post", targetId: media.post_id, requestId: id, metadata: { mediaId: media.id } });
  revalidatePath(`/admin/blog/${media.post_id}/edit`);
  return actionSuccess(undefined);
}
