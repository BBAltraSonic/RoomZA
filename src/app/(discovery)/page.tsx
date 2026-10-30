import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Rentals on the Map",
  description:
    "Explore rental listings across South Africa on an interactive map. Filter by area, price, and amenities to find your next home.",
  openGraph: {
    title: "Browse Rentals on the Map — Pinpoints",
    description:
      "Explore rental listings across South Africa on an interactive map.",
  },
};

/** The discovery layout renders the screen; this route only owns its metadata. */
export default function Home() {
  return null;
}
