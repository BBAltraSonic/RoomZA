import type { Metadata } from "next";
import { Toaster } from "sonner";

import { Navigation } from "@/components/navigation/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RoomZA | Find Your Next Rental in South Africa",
    template: "%s | RoomZA",
  },
  description:
    "Discover rental properties on an interactive map across South Africa. Apply online, upload documents, chat with landlords, and schedule viewings in one place.",
  keywords: [
    "rental",
    "property",
    "South Africa",
    "accommodation",
    "rent",
    "apartment",
    "house",
    "listing",
    "landlord",
    "tenant",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://roomza.co.za",
  ),
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "RoomZA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <Navigation />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
