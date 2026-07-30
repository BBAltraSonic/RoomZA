import type { Metadata } from "next";
import { Star } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { ReviewEditor } from "@/features/profile/components/review-editor";
import { getProfileReviewsData } from "@/features/profile/data";
import { isPublishedReviewStatus } from "@/features/profile/types";

export const metadata: Metadata = {
  title: "Profile Reviews",
  robots: { index: false, follow: false },
};

export default async function ProfileReviewsPage() {
  const { received, written, entitlements } = await getProfileReviewsData();
  const reviewedEntitlements = new Set(
    written.map((review) => review.entitlement_id),
  );
  const available = entitlements.filter(
    (entitlement) => !reviewedEntitlements.has(entitlement.id),
  );
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Verified interactions"
        title="Reviews"
        description="Reviews unlock only after a completed viewing, approved application, or completed purchase."
      />
      <section>
        <h2 className="text-xl font-semibold text-ink">
          Reviews you can write
        </h2>
        {available.length ? (
          available.map((entitlement) => (
            <div
              key={entitlement.id}
              className="mt-4 border-y border-border py-5"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold capitalize text-ink">
                    {entitlement.interaction_type} interaction
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Blind for up to 14 days after submission
                  </p>
                </div>
                <StatusBadge tone="forest">Verified</StatusBadge>
              </div>
              <ReviewEditor entitlementId={entitlement.id} />
            </div>
          ))
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No completed interactions are waiting for a review.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Received</h2>
        {received.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {received.map((review) => (
              <li key={review.id} className="py-4">
                <div className="flex items-center gap-2">
                  <Star className="size-4 fill-current text-forest" />
                  <span className="text-sm font-semibold text-ink">
                    {review.overall}/5
                  </span>
                  <StatusBadge
                    tone={isPublishedReviewStatus(review.status) ? "success" : "neutral"}
                  >
                    {review.status}
                  </StatusBadge>
                </div>
                {review.body ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {review.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No reviews received yet.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Written</h2>
        {written.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {written.map((review) => (
              <li
                key={review.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <span className="text-sm font-semibold text-ink">
                  {review.overall}/5
                </span>
                <StatusBadge
                  tone={isPublishedReviewStatus(review.status) ? "success" : "neutral"}
                >
                  {review.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            You have not written a review.
          </p>
        )}
      </section>
    </div>
  );
}
