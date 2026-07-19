export type LandlordTrustSummary = {
  medianFirstResponseSeconds: number | null;
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

export function selectLandlordTrustSignals(summary?: LandlordTrustSummary | null): LandlordTrustSignal[] {
  if (!summary) return [];

  const signals: LandlordTrustSignal[] = [];
  if (summary.medianFirstResponseSeconds !== null) {
    const responseLabel = formatResponseTime(summary.medianFirstResponseSeconds);
    if (responseLabel) {
      signals.push({
        kind: "response_time",
        label: responseLabel.full,
        compactLabel: responseLabel.compact,
        description: "Median time to the landlord's first reply across recent Pinpoint conversations. Updated every six hours.",
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
