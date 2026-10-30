import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nearby Services", robots: { index: false, follow: false } };

/** The discovery layout renders the screen; this route only owns its metadata. */
export default function ServicesPage() {
  return null;
}
