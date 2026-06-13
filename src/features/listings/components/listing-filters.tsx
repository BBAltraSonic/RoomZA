"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

export function ListingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const status = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";

  const baseParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(baseParams.toString());
    if (!value || value === "all" || (key === "sort" && value === "recent")) next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }, [baseParams, pathname, router]);

  useEffect(() => {
    const id = window.setTimeout(() => setParam("q", query.trim().slice(0, 100)), 250);
    return () => window.clearTimeout(id);
  }, [query, setParam]);

  return (
    <div className="mb-4 grid gap-2 rounded-lg border border-border bg-panel p-3 shadow-[var(--elevation-1)] md:grid-cols-[1fr_160px_170px]">
      <label className="relative">
        <span className="sr-only">Search listings</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search listings" className="h-10 pl-9" />
      </label>
      <select value={status} onChange={(event) => setParam("status", event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-medium">
        <option value="all">Active</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
      <select value={sort} onChange={(event) => setParam("sort", event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm font-medium">
        <option value="recent">Most recent</option>
        <option value="applicants">Most applicants</option>
      </select>
    </div>
  );
}
