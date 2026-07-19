import { describe, expect, it } from "vitest";

import { blogEditorSchema, publishableBlogSchema } from "./schemas";
import { calculateReadingMinutes, createBlogSlug, transformBlogMarkdownUrl } from "./utils";

describe("blog utilities", () => {
  it("creates stable lowercase slugs", () => {
    expect(createBlogSlug("  The Real Move-In Cost!  ")).toBe("the-real-move-in-cost");
    expect(createBlogSlug("Café living in Joburg")).toBe("cafe-living-in-joburg");
  });

  it("calculates a minimum one-minute reading time", () => {
    expect(calculateReadingMinutes("Short guidance.")).toBe(1);
    expect(calculateReadingMinutes(Array.from({ length: 401 }, () => "home").join(" "))).toBe(3);
  });

  it("allows safe links and tracked blog media only", () => {
    expect(transformBlogMarkdownUrl("https://example.com/guide", "href")).toBe("https://example.com/guide");
    expect(transformBlogMarkdownUrl("javascript:alert(1)", "href")).toBe("");
    expect(transformBlogMarkdownUrl("https://project.supabase.co/storage/v1/object/public/blog-media/post/image.webp", "src")).toContain("/blog-media/");
    expect(transformBlogMarkdownUrl("https://example.com/untracked.webp", "src")).toBe("");
  });
});
describe("blog validation", () => {
  const draft = { id: "550e8400-e29b-41d4-a716-446655440000", title: "", slug: "", topic: "", excerpt: "", bodyMarkdown: "" };

  it("allows incomplete drafts but rejects invalid slugs", () => {
    expect(blogEditorSchema.safeParse(draft).success).toBe(true);
    expect(blogEditorSchema.safeParse({ ...draft, slug: "Not Valid" }).success).toBe(false);
  });

  it("requires complete publication details", () => {
    expect(publishableBlogSchema.safeParse(draft).success).toBe(false);
    expect(publishableBlogSchema.safeParse({
      ...draft,
      title: "The real move-in cost",
      slug: "the-real-move-in-cost",
      topic: "Budgeting",
      excerpt: "Understand the deposit, fees, and first payment before you commit.",
      bodyMarkdown: "Useful rental guidance. ".repeat(12),
    }).success).toBe(true);
  });
});
