import { cn } from "@/lib/utils";

/*
 * Piko's round face frame, without the art lookup (art.ts). The dock is on every page, so it
 * shows one fixed face through this and leaves the rest of Piko's art to the pages that use it.
 */

/** The face the dock's assistant circle shows: the `welcome` mood's face in art.ts. */
export const DOCK_FACE_SRC = "/piko/face/piko-happy.webp";

export function PikoFaceFrame({ src, size, className, mood }: { src: string; size: number; className?: string; mood?: string }) {
  return (
    <span
      data-piko-mood={mood}
      className={cn("inline-flex shrink-0 select-none items-end justify-center overflow-hidden rounded-full bg-[var(--piko-face-bg)]", className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP (see piko.tsx) */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="size-[112%] max-w-none translate-y-[6%] object-cover object-top"
      />
    </span>
  );
}
