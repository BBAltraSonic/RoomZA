import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/lib/motion/primitives";

type ProgressRingProps = {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  tone?: "forest" | "clay" | "muted";
  label?: string;
};

const toneStroke: Record<NonNullable<ProgressRingProps["tone"]>, string> = {
  forest: "var(--forest)",
  clay: "var(--clay)",
  muted: "var(--muted-foreground)",
};

/**
 * Circular progress dial with a soft neumorphic track. The arc interpolates
 * smoothly from 0 to `value` on mount so progress feels alive rather than
 * snapping into place.
 */
export function ProgressRing({
  value,
  size = 132,
  strokeWidth = 12,
  className,
  tone = "forest",
  label = "Journey",
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped}% ${label.toLowerCase()} complete`}
    >
      {/* Neumorphic well behind the dial */}
      <div
        className="absolute inset-1 rounded-full"
        style={{ boxShadow: "var(--shadow-hairline)" }}
        aria-hidden
      />
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeOpacity={0.35}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneStroke[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset var(--motion-slow) var(--ease-out-expo)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-ink"><AnimatedNumber value={clamped} />%</span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
