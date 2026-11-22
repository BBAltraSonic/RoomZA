import { getLatestPublishedBlogPosts } from "@/features/blog/data";
export async function GET() {
  const posts = await getLatestPublishedBlogPosts(3, AbortSignal.timeout(2500)).catch(() => []);
  return Response.json({ posts }, { headers: { "cache-control": "public, max-age=60" } });
}
