import type { PresenceBadge } from "@/features/presence/presence-status";

export type LandlordTrustSummary = {
  medianFirstResponseSeconds: number | null;
  predictedResponseSeconds?: number | null;
  phoneVerified: boolean;
  emailVerified: boolean;
};

export type LandlordTrustSignal = {
  kind: "response_time" | "phone_verified" | "email_verified";
  label: string;
  compactLabel: string;
  description: string;
  tone: "response" | "verified";
};

export function formatResponseTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return null;

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return {
      full: `Responds in ${minutes} ${minutes === 1 ? "min" : "mins"}`,
      compact: `${minutes} min response`,
    };
  }

  const hours = Math.max(1, Math.round(seconds / 3600));
  if (hours < 24) {
    return {
      full: `Responds in ${hours} ${hours === 1 ? "hr" : "hrs"}`,
      compact: `${hours} hr response`,
    };
  }

  const days = Math.max(1, Math.round(seconds / 86400));
  return {
    full: `Responds in ${days} ${days === 1 ? "day" : "days"}`,
    compact: `${days} day response`,
  };
}

export function predictResponseTimeSeconds(input: {
  medianFirstResponseSeconds: number | null;
  presence: PresenceBadge;
}) {
  const median = input.medianFirstResponseSeconds;

  if (input.presence === "available") {
    return Math.max(60, Math.min(median ?? 300, 300));
  }

  if (input.presence === "busy") {
    return Math.max(60, Math.min(median ?? 1200, 1200));
  }

  return median !== null && Number.isFinite(median) && median >= 0
    ? median
    : null;
}

export function formatPredictedResponseTime(seconds: number) {
  const formatted = formatResponseTime(seconds);
  if (!formatted) return null;

  return {
    full: formatted.full.replace("Responds in", "Likely reply in about"),
    compact: `Likely ${formatted.compact.replace(" response", "")}`,
  };
}

export function selectLandlordTrustSignals(summary?: LandlordTrustSummary | null): LandlordTrustSignal[] {
  if (!summary) return [];

  const signals: LandlordTrustSignal[] = [];
  const responseSeconds =
    summary.predictedResponseSeconds ?? summary.medianFirstResponseSeconds;
  if (responseSeconds !== null) {
    const isPrediction = summary.predictedResponseSeconds !== undefined;
    const responseLabel = isPrediction
      ? formatPredictedResponseTime(responseSeconds)
      : formatResponseTime(responseSeconds);
    if (responseLabel) {
      signals.push({
        kind: "response_time",
        label: responseLabel.full,
        compactLabel: responseLabel.compact,
        description: isPrediction
          ? "Estimate based on current availability and the landlord's recent median first-reply time."
          : "Median time to the landlord's first reply across recent Pinpoint conversations. Updated every six hours.",
        tone: "response",
      });
    }
  }

  if (summary.phoneVerified) {
    signals.push({
      kind: "phone_verified",
      label: "Verified Phone",
      compactLabel: "Phone",
      description: "Phone number confirmed with a one-time code. This does not verify identity or property ownership.",
      tone: "verified",
    });
  }

  if (summary.emailVerified) {
    signals.push({
      kind: "email_verified",
      label: "Verified Email",
      compactLabel: "Email",
      description: "Email address confirmed. This does not verify identity or property ownership.",
      tone: "verified",
    });
  }

  return signals.slice(0, 3);
}
