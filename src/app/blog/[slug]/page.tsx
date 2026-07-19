import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";

import { CopyBlogLinkButton } from "@/features/blog/components/copy-link-button";
import { getPublishedBlogPostBySlug } from "@/features/blog/data";
import { BlogMarkdown } from "@/features/blog/markdown";
import { formatBlogDate } from "@/features/blog/utils";

type BlogArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) return { title: "Article not found | Pinpoints", robots: { index: false, follow: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.publishedAt ?? undefined, modifiedTime: post.updatedAt, authors: ["Pinpoints"], images: post.cover ? [{ url: post.cover.publicUrl, alt: post.cover.altText }] : undefined },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt, images: post.cover ? [post.cover.publicUrl] : undefined },
  };
}
export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roomza.co.za";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${baseUrl}/blog/${post.slug}`,
    author: { "@type": "Organization", name: "Pinpoints" },
    publisher: { "@type": "Organization", name: "Pinpoints", url: baseUrl },
    image: post.cover?.publicUrl,
  };
  return (
    <main className="min-h-dvh bg-background pb-24 text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="border-b border-border bg-panel"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 pr-20 sm:px-6 sm:pr-24 lg:px-8"><Link href="/blog" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-forest outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" />All articles</Link><span className="text-sm font-black tracking-tight text-ink">Pinpoints blog</span></div></header>
      <article>
        <div className="mx-auto max-w-4xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground"><span className="rounded-full bg-accent px-2.5 py-1 text-forest">{post.topic}</span><span>{formatBlogDate(post.publishedAt)}</span><span>{post.readingMinutes} min read</span><span>By Pinpoints</span></div>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.035em] text-ink sm:text-5xl lg:text-6xl">{post.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
          <div className="mt-7"><CopyBlogLinkButton title={post.title} /></div>
        </div>
        {post.cover ? <figure className="mx-auto mt-10 max-w-6xl px-4 sm:px-6 lg:px-8"><div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted sm:rounded-3xl"><Image src={post.cover.publicUrl} alt={post.cover.altText} fill priority sizes="(min-width: 1280px) 1152px, 100vw" className="object-cover" /></div><figcaption className="mt-2 px-1 text-xs text-muted-foreground">{post.cover.altText}</figcaption></figure> : null}
        <div className="mx-auto max-w-[72ch] px-4 pt-10 sm:px-6 sm:pt-14"><BlogMarkdown markdown={post.bodyMarkdown} /></div>
      </article>
      <section className="mx-auto mt-16 max-w-4xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col items-start gap-6 border-y border-border py-10 sm:flex-row sm:items-center sm:justify-between"><div><MapPin className="size-6 text-forest" /><h2 className="mt-3 text-2xl font-bold text-ink">Ready to find your next place?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Put the advice into practice with map-first rental discovery.</p></div><Link href="/" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-semibold text-primary-foreground">Explore homes<ArrowRight className="size-4" /></Link></div></section>
    </main>
  );
}
