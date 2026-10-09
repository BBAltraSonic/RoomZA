import { notFound } from "next/navigation";
import { z } from "zod";
import { readOwnedOffer } from "@/features/offers/workspace-data";
import { OfferDraftEditor } from "@/features/offers/offer-draft-editor";

export default async function OfferDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const detail = await readOwnedOffer(id);
  if (!detail) notFound();
  return <><h1 className="text-2xl font-semibold tracking-tight">Edit Shopping Offer</h1><OfferDraftEditor key={id} detail={detail} /></>;
}
