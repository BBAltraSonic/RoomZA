import Image from "next/image";
import Link from "next/link";

import type { PublicLandlordPresence } from "@/features/listings/api";

/** The person behind the listing: photo and name, linked to their public profile when it is public. */
export function ListerIdentity({ presence }: { presence: PublicLandlordPresence }) {
  const initial = presence.name.trim().charAt(0).toUpperCase() || "L";
  const content = (
    <>
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent text-xs font-semibold text-forest">
        {presence.avatarUrl ? <Image src={presence.avatarUrl} alt="" fill sizes="28px" className="object-cover" /> : initial}
      </span>
      <span className="truncate">{presence.name}</span>
    </>
  );

  if (!presence.username) {
    return <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">{content}</span>;
  }

  return (
    <Link
      href={`/u/${encodeURIComponent(presence.username)}`}
      className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md text-sm font-semibold text-ink underline-offset-4 hover:text-forest hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View ${presence.name}'s profile`}
    >
      {content}
    </Link>
  );
}
