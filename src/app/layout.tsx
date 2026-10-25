import type { Metadata, Viewport } from "next";


import { AppShell } from "@/components/app-shell";

import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const themeBootstrapScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem("roomza-theme");
      const isDark =
        storedTheme === "dark" ||
        (storedTheme !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    } catch {}
  })();
`;

export const metadata: Metadata = {
  title: {
    default: "Pinpoint | Discover What’s Nearby",
    template: "%s | Pinpoint",
  },
  description:
    "Explore homes, shopping specials, places, events, and local services on an interactive map across South Africa.",
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
  icons: {
    icon: [
      { url: "/favicon.ico?v=amber-20261017", sizes: "16x16 32x32 48x48" },
      { url: "/icon.png?v=amber-20261017", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=amber-20261017", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "Pinpoint",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to resolve to real values on notched
  // devices — the app's mobile chrome (chat composer, bottom sheet, page
  // paddings) depends on these insets.
  viewportFit: "cover",
  // Resize the layout viewport when the on-screen keyboard appears so fixed
  // bottom UI (e.g. the chat composer) stays above the keyboard on mobile.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#151A24" },
    { media: "(prefers-color-scheme: dark)", color: "#151A24" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
