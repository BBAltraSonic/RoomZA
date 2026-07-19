"use client";

import { useMemo } from "react";

const COLORS = ["var(--forest)", "var(--clay)", "var(--gold)", "var(--mint)", "var(--moss)"];

/**
 * A tiny, dependency-free confetti burst. Renders a fixed set of CSS-animated
 * pieces that fall once and fade. Purely decorative and aria-hidden; it
 * collapses to nothing under prefers-reduced-motion via the global safeguard.
 */
export function Confetti({ pieces = 28 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2;
        const spread = 40 + (i % 5) * 22;
        return {
          key: i,
          left: 50 + Math.cos(angle) * 6,
          x: `${Math.round(Math.cos(angle) * spread)}px`,
          y: `${90 + (i % 7) * 14}px`,
          r: `${180 + (i % 6) * 60}deg`,
          dur: `${900 + (i % 5) * 160}ms`,
          delay: `${(i % 6) * 40}ms`,
          color: COLORS[i % COLORS.length],
          round: i % 3 === 0,
        };
      }),
    [pieces],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible" aria-hidden>
      {bits.map((b) => (
        <span
          key={b.key}
          className="journey-confetti-piece"
          style={
            {
              left: `${b.left}%`,
              background: b.color,
              borderRadius: b.round ? "9999px" : "2px",
              "--confetti-x": b.x,
              "--confetti-y": b.y,
              "--confetti-r": b.r,
              "--confetti-dur": b.dur,
              "--confetti-delay": b.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
