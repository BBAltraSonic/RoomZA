"use client";
import Link from "next/link";
import { SpecialDetailContent } from "@/features/discovery/special-detail-content";
import { SavedSpecialsProvider } from "@/features/discovery/saved-specials-client";
export function PublicEntryDetailScreen({ entryId }: { entryId: string }) {
  return <SavedSpecialsProvider><main className="mx-auto max-w-3xl px-5 py-8"><Link className="inline-flex min-h-11 items-center text-forest underline" href="/offers">Browse Specials</Link><SpecialDetailContent target={{ category: "entry", id: entryId }} /></main></SavedSpecialsProvider>;
}
