import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogEditor } from "@/features/blog/components/blog-editor";
import { getAdminBlogPost } from "@/features/blog/data";

export const metadata: Metadata = { title: "Edit blog post | Pinpoints admin", robots: { index: false, follow: false } };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getAdminBlogPost(id);
  if (!post) notFound();
  return <BlogEditor initialPost={post} />;
}
