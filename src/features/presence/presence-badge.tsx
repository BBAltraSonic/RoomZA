import { cn } from "@/lib/utils";
import {
  formatPredictedResponseTime,
  formatResponseTime,
} from "@/features/trust/landlord-signals";

import { presenceBadgeLabel, type PresenceBadge as PresenceBadgeValue } from "./presence-status";

const TONE: Record<PresenceBadgeValue, { dot: string; text: string }> = {
  available: { dot: "bg-forest", text: "text-forest" },
  busy: { dot: "bg-gold", text: "text-clay" },
  offline: { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

type PresenceBadgeProps = {
  badge: PresenceBadgeValue;
  /**
   * Optional median first-response seconds from the landlord trust signal. When
   * present it is blended into the label ("Available now · Responds in 5 mins"),
   * composing the is-online answer with the how-fast-usually answer (§3.2).
   */
  responseSeconds?: number | null;
  predicted?: boolean;
  /** Hide the label, showing only the coloured dot (e.g. on dense cards). */
  dotOnly?: boolean;
  className?: string;
};

/**
 * The 🟢/🟡/🔴 presence dot + label (design §3.5). Ambient and best-effort: it
 * reads a resolved `PresenceBadge` and never opens a connection itself. Offline
 * still renders (a grey dot) so the element has a defined non-live state rather
 * than vanishing — graceful absence is handled by callers choosing not to
 * render it, not by returning null here.
 */
export function PresenceBadge({
  badge,
  responseSeconds,
  predicted = false,
  dotOnly = false,
  className,
}: PresenceBadgeProps) {
  const tone = TONE[badge];
  const base = presenceBadgeLabel(badge);

  // Blend the response-time signal only when the person is reachable.
  const responseLabel =
    badge !== "offline" && typeof responseSeconds === "number"
      ? predicted
        ? formatPredictedResponseTime(responseSeconds)
        : formatResponseTime(responseSeconds)
      : null;
  const label = responseLabel ? `${base} · ${responseLabel.full}` : base;

  return (
    <span
      data-slot="presence-badge"
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", tone.text, className)}
      aria-label={label}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          tone.dot,
          badge === "available" && "animate-pulse",
        )}
        aria-hidden="true"
      />
      {dotOnly ? null : <span className="truncate">{label}</span>}
    </span>
  );
}
