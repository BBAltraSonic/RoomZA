import type { Metadata } from "next";
import { BadgeCheck, Clock3, ShieldQuestion } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { getProfileVerificationData } from "@/features/profile/data";
import { isVerifiedStatus, isPendingStatus, isRejectedStatus } from "@/features/profile/types";

export const metadata: Metadata = {
  title: "Profile Verification",
  robots: { index: false, follow: false },
};

const kinds = [
  "phone",
  "identity",
  "employment",
  "income",
  "student",
  "nsfas",
  "business",
  "landlord",
  "address",
  "previous_landlord_reference",
  "listing_ownership",
] as const;

export default async function ProfileVerificationPage() {
  const data = await getProfileVerificationData();
  const checks = new Map(data.checks.map((check) => [check.check_key, check]));
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Explainable trust"
        title="Verification"
        description="Track each check independently. Pinpoint does not turn these signals into a hidden trust score."
      />
      <div className="grid border-l border-t border-border sm:grid-cols-2">
        {kinds.map((kind) => {
          const platformVerified =
            kind === "phone" ? data.phoneVerified : false;
          const check = checks.get(kind);
          const status = platformVerified
            ? "verified"
            : (check?.status ?? "not_started");
          const Icon =
            isVerifiedStatus(status)
              ? BadgeCheck
              : isPendingStatus(status)
                ? Clock3
                : ShieldQuestion;
          return (
            <article
              key={kind}
              className="min-h-36 border-b border-r border-border bg-panel p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <Icon
                  className={`size-5 ${isVerifiedStatus(status) ? "text-forest" : "text-muted-foreground"}`}
                />
                <StatusBadge
                  tone={
                    isVerifiedStatus(status)
                      ? "success"
                      : isRejectedStatus(status)
                        ? "error"
                        : isPendingStatus(status)
                          ? "info"
                          : "neutral"
                  }
                >
                  {status.replaceAll("_", " ")}
                </StatusBadge>
              </div>
              <h2 className="mt-4 text-sm font-semibold capitalize text-ink">
                {kind.replaceAll("_", " ")}
              </h2>
              {check?.rejected_reason ? (
                <p className="mt-2 text-xs leading-5 text-destructive">
                  {check.rejected_reason}
                </p>
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {status === "not_started"
                    ? "Not yet submitted to the audited verification queue."
                    : "Status changes are retained in append-only history."}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        This release manages verification statuses only. Identity, income, and
        other checks do not connect to external KYC or credit providers.
      </p>
    </div>
  );
}
