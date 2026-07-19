import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenText } from "lucide-react";

import { listPublishedBlogPosts } from "@/features/blog/data";
import { formatBlogDate } from "@/features/blog/utils";

export const metadata: Metadata = {
  title: "Rental advice",
  description: "Clear, practical guidance for viewing, applying for, and moving into a home in South Africa.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Rental advice | Pinpoints", description: "Practical guidance for finding and renting a home with confidence.", type: "website" },
};

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const data = await listPublishedBlogPosts(page, 10);
  if (data.total > 0 && page > data.pageCount) redirect(`/blog?page=${data.pageCount}`);
  const [lead, ...posts] = data.posts;
  return (
    <main className="min-h-dvh bg-background pb-24 text-foreground">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 pr-20 sm:px-6 sm:pr-24 lg:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-forest outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />Explore homes</Link>
          <Link href="/blog" className="inline-flex items-center gap-2 text-lg font-black tracking-tight text-ink"><BookOpenText className="size-5 text-forest" />Pinpoints blog</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-forest">Rental advice</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.035em] text-ink sm:text-5xl">Make the next move with fewer surprises.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Practical answers for comparing homes, preparing applications, and understanding the real cost of moving.</p>
        </div>

        {!lead ? (
          <section className="mt-14 border-y border-border py-16 text-center">
            <BookOpenText className="mx-auto size-9 text-forest" />
            <h2 className="mt-4 text-2xl font-bold text-ink">Fresh guidance is on the way</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">The Pinpoints team is preparing practical rental advice. Explore available homes while the first article is being written.</p>
            <Link href="/" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-semibold text-primary-foreground">Explore homes<ArrowRight className="size-4" /></Link>
          </section>
        ) : (
          <>
            <article className="mt-12 overflow-hidden rounded-3xl bg-panel shadow-[var(--elevation-1)] lg:grid lg:grid-cols-[1.18fr_0.82fr]">
              <Link href={`/blog/${lead.slug}`} className="group relative block min-h-72 overflow-hidden bg-muted lg:min-h-[30rem]">
                {lead.cover ? <Image src={lead.cover.publicUrl} alt={lead.cover.altText} fill priority sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-[1.025]" /> : null}
              </Link>
              <div className="flex flex-col justify-end p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="rounded-full bg-accent px-2.5 py-1 text-forest">{lead.topic}</span><span>{formatBlogDate(lead.publishedAt)}</span><span>{lead.readingMinutes} min read</span></div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-ink"><Link href={`/blog/${lead.slug}`} className="outline-none hover:text-forest focus-visible:ring-2 focus-visible:ring-ring">{lead.title}</Link></h2>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{lead.excerpt}</p>
                <Link href={`/blog/${lead.slug}`} className="mt-7 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-bold text-forest outline-none focus-visible:ring-2 focus-visible:ring-ring">Read article<ArrowRight className="size-4" /></Link>
              </div>
            </article>

            {posts.length ? <section className="mt-16" aria-labelledby="more-reading"><div className="flex items-end justify-between gap-4 border-b border-border pb-4"><h2 id="more-reading" className="text-2xl font-bold text-ink">More useful reads</h2><span className="text-sm text-muted-foreground">{data.total} article{data.total === 1 ? "" : "s"}</span></div><div className="grid gap-x-8 gap-y-12 pt-8 md:grid-cols-2">{posts.map((post, index) => <article key={post.id} className={cnBlogCard(index)}><Link href={`/blog/${post.slug}`} className="group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-muted">{post.cover ? <Image src={post.cover.publicUrl} alt={post.cover.altText} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:scale-[1.03]" /> : null}</Link><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="text-forest">{post.topic}</span><span>{formatBlogDate(post.publishedAt)}</span><span>{post.readingMinutes} min</span></div><h3 className="mt-2 text-xl font-bold leading-tight text-ink"><Link href={`/blog/${post.slug}`} className="hover:text-forest">{post.title}</Link></h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p></article>)}</div></section> : null}
          </>
        )}

        {data.pageCount > 1 ? <nav className="mt-16 flex items-center justify-between border-t border-border pt-5" aria-label="Blog pages"><Link href={`/blog?page=${data.page - 1}`} aria-disabled={data.page <= 1} className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest ${data.page <= 1 ? "pointer-events-none opacity-40" : ""}`}><ArrowLeft className="size-4" />Newer</Link><span className="text-sm text-muted-foreground">Page {data.page} of {data.pageCount}</span><Link href={`/blog?page=${data.page + 1}`} aria-disabled={data.page >= data.pageCount} className={`inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest ${data.page >= data.pageCount ? "pointer-events-none opacity-40" : ""}`}>Older<ArrowRight className="size-4" /></Link></nav> : null}
      </div>
    </main>
  );
}

function cnBlogCard(index: number) {
  return index % 3 === 2 ? "md:col-span-2 md:grid md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-8 [&>a]:md:aspect-[16/9]" : "";
}
