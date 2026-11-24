import { cn } from "@/lib/utils";

import { MOODS, displaySize, pikoSrc, type PikoArtName, type PikoMood } from "./art";

/*
 * Piko's art. Plain <img>: the files are already small, pre-sized WebP, so the image loader would
 * only add a round trip. Animations live in globals.css ("Piko") and stop under reduced motion.
 */

type Animation = "bob" | "pop";

/** Full-body Piko for a mood, for empty states and welcomes. Decorative unless given `alt`. */
export function Piko({
  mood,
  height,
  animate,
  alt = "",
  className,
}: {
  mood: PikoMood;
  /** Wanted height in CSS px. Capped so the art stays sharp. */
  height: number;
  animate?: Animation;
  alt?: string;
  className?: string;
}) {
  const art: PikoArtName = MOODS[mood].pose;
  const size = displaySize(art, height);
  return (
    <span data-piko-mood={mood} data-piko-animate={animate} className={cn("inline-flex shrink-0 select-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP (see above) */}
      <img src={pikoSrc(art)} alt={alt} width={size.width} height={size.height} loading="lazy" decoding="async" draggable={false} />
    </span>
  );
}

/** Piko's face for a mood in a round frame: the chat avatar and the assistant button. */
export function PikoFace({ mood, size, className }: { mood: PikoMood; size: number; className?: string }) {
  const art: PikoArtName = MOODS[mood].face;
  return (
    <span
      data-piko-mood={mood}
      className={cn("inline-flex shrink-0 select-none items-end justify-center overflow-hidden rounded-full bg-[var(--piko-face-bg)]", className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP (see above) */}
      <img
        src={pikoSrc(art)}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="size-[112%] max-w-none translate-y-[6%] object-cover object-top"
      />
    </span>
  );
}
