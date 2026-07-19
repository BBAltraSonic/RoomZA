import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Your Journey",
  robots: { index: false, follow: false },
};

export default async function JourneyPage() {
  permanentRedirect("/applications?view=progress");
}
