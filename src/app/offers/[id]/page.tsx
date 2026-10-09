import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { readPublicOffer } from "@/features/offers/public-data";
import { PublicOfferDetailScreen } from "@/features/offers/public-detail-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shopping Offer",
  description: "Read the confirmed offer terms and get directions to the shop.",
  robots: { index: false, follow: false },
};

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return <main className="mx-auto max-w-3xl px-5 py-10"><h1 className="text-2xl font-semibold">Invalid offer link</h1><Link prefetch={false} href="/" className="mt-5 inline-flex min-h-11 items-center text-forest underline">Return to Pinpoint</Link></main>;
  }
  const initial = await readPublicOffer(id);
  return <PublicOfferDetailScreen key={id} offerId={id} initial={initial} />;
}

