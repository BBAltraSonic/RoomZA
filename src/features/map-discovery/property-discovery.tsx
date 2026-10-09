"use client";
import { useEffect, useState } from "react";
import { DiscoveryPage } from "./discovery-page";
import type { BlogPostSummary } from "@/features/blog/types";
export function PropertyDiscovery({ mapApiKey }: { mapApiKey?: string }) {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/blog/latest", { signal: controller.signal }).then(async response => {
      if (response.ok) { const body = await response.json(); if (!controller.signal.aborted) setPosts(body.posts); }
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <DiscoveryPage mapApiKey={mapApiKey} initialBlogPosts={posts} />;
}
