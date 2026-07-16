import Link from "next/link";

import { StatusBadge } from "@/components/premium/primitives";
import { AdminHeader, AdminTable } from "@/features/admin/components/admin-ui";

import { listAdminBlogPosts } from "../data";
import { formatBlogDate } from "../utils";
import { CreateBlogPostButton } from "./admin-blog-controls";

export async function AdminBlogPageContent({ params }: { params: Record<string, string | undefined> }) {
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const data = await listAdminBlogPosts({ page, status: params.status });
  return (
    <>
      <AdminHeader title="Blog publishing" description="Write clear rental guidance, preview it in context, then publish it to Pinpoints." action={<CreateBlogPostButton />} />
      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter blog posts">
        {[{ value: "", label: "All" }, { value: "draft", label: "Drafts" }, { value: "published", label: "Published" }].map((filter) => {
          const active = (params.status ?? "") === filter.value;
          return <Link key={filter.label} href={filter.value ? `/admin/blog?status=${filter.value}` : "/admin/blog"} aria-current={active ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-accent text-forest" : "text-muted-foreground hover:bg-muted hover:text-ink"}`}>{filter.label}</Link>;
        })}
      </div>
      <AdminTable headers={["Post", "Topic", "Status", "Updated", "Published"]} empty={!data.posts.length}>
        {data.posts.map((post) => (
          <tr key={post.id} className="hover:bg-muted/40">
            <td className="px-4 py-3"><Link href={`/admin/blog/${post.id}/edit`} className="font-semibold text-forest hover:underline">{post.title || "Untitled draft"}</Link><p className="mt-1 text-xs text-muted-foreground">{post.slug ? `/blog/${post.slug}` : "Slug not set"}</p></td>
            <td className="px-4 py-3 text-muted-foreground">{post.topic || "Not set"}</td>
            <td className="px-4 py-3"><StatusBadge tone={post.status === "published" ? "success" : "warning"}>{post.status}</StatusBadge></td>
            <td className="px-4 py-3 text-muted-foreground">{formatBlogDate(post.updatedAt)}</td>
            <td className="px-4 py-3 text-muted-foreground">{formatBlogDate(post.publishedAt)}</td>
          </tr>
        ))}
      </AdminTable>
      {data.pageCount > 1 ? <nav className="mt-5 flex items-center justify-between" aria-label="Blog pages"><Link className={`text-sm font-semibold text-forest ${data.page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={`/admin/blog?page=${data.page - 1}${params.status ? `&status=${params.status}` : ""}`}>Previous</Link><span className="text-sm text-muted-foreground">Page {data.page} of {data.pageCount}</span><Link className={`text-sm font-semibold text-forest ${data.page >= data.pageCount ? "pointer-events-none opacity-40" : ""}`} href={`/admin/blog?page=${data.page + 1}${params.status ? `&status=${params.status}` : ""}`}>Next</Link></nav> : null}
    </>
  );
}
