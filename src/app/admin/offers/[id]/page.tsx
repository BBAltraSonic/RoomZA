import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { readOfferSubmissionForReview } from "@/features/offers/intake";
import { OfferReviewEditor } from "@/features/offers/offer-review-editor";
import { readOfferPermissionReview } from "@/features/offers/permission-review-data";
import { OfferPermissionEvidenceEditor } from "@/features/offers/offer-permission-evidence-editor";
import { readOfferLocationReview } from "@/features/offers/location-review-data";
import { OfferLocationEvidenceEditor } from "@/features/offers/offer-location-evidence-editor";
import { readOfferDecision } from "@/features/offers/decision-data";
import { OfferApprovalEditor, OfferDecisionEditor } from "@/features/offers/offer-decision-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review Shopping Offer", robots: { index: false, follow: false } };
export default async function OfferReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const submission = await readOfferSubmissionForReview(id);
  if (!submission) {
    const decision = await readOfferDecision(id);
    if (!decision) notFound();
    return <OfferDecisionEditor key={`${decision.decision.id}:${decision.version}`} snapshot={decision} />;
  }
  const [permissionReview, locationReview] = await Promise.all([readOfferPermissionReview(id), readOfferLocationReview(id)]);
  if (!permissionReview || !locationReview || permissionReview.revisionId !== submission.revisionId || permissionReview.version !== submission.version
    || locationReview.revisionId !== submission.revisionId || locationReview.version !== submission.version) {
    return <div className="space-y-4 text-sm"><p>This submission changed while loading. Open the pending queue to review the current version.</p><Link href="/admin/offers" className="underline">Open pending offers</Link></div>;
  }
  return <div className="space-y-8"><OfferReviewEditor key={submission.revisionId} submission={submission} /><OfferPermissionEvidenceEditor key={`${submission.revisionId}:${submission.version}`} snapshot={permissionReview} /><OfferLocationEvidenceEditor key={`location:${submission.revisionId}:${submission.version}`} snapshot={locationReview} /><OfferApprovalEditor key={`approval:${submission.revisionId}:${submission.version}`} review={locationReview} /></div>;
}
