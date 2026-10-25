import Link from "next/link";
import { SpecialDetailContent } from "@/features/discovery/special-detail-content";
import { offerDetailState } from "@/features/discovery/special-detail-data";
import { SavedSpecialsProvider } from "@/features/discovery/saved-specials-client";
import type { PublicOfferDetail } from "./public-contract";
export function PublicOfferDetailScreen({ offerId, initial }: { offerId: string; initial: PublicOfferDetail }) {
  return <SavedSpecialsProvider><main className="mx-auto max-w-3xl px-5 py-8"><Link prefetch={false} className="inline-flex min-h-11 items-center text-forest underline" href="/offers">Return to Pinpoint</Link><SpecialDetailContent target={{ category: "shopping", id: offerId }} initial={offerDetailState(initial)} /></main></SavedSpecialsProvider>;
}
