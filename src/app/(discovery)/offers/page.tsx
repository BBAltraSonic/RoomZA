import type { Metadata } from "next";

export const metadata: Metadata = { title: "Specials", description: "Find approved shopping, Places and Event Specials near your selected location.", robots: { index: false, follow: false } };

/** The discovery layout renders the screen; this route only owns its metadata. */
export default function OffersPage() {
  return null;
}
