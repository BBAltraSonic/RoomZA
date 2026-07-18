import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { Navigation } from "@/components/navigation/navigation";
import { getAdminMembership } from "@/features/admin/auth";
import { getSessionProfile } from "@/lib/auth";
import { MotionProvider } from "@/lib/motion/provider";
import { isRole } from "@/lib/roles";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Pinpoints | Find Your Next Rental in South Africa",
    template: "%s | Pinpoints",
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
    siteName: "Pinpoints",
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
    { media: "(prefers-color-scheme: light)", color: "#f4f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#202824" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await getSessionProfile();
  const currentRole = isRole(profile?.role) ? profile.role : null;
  const userEmail = profile?.email ?? user?.email ?? null;
  const userName = userEmail ? userEmail.split("@")[0] : null;
  const adminMembership = user ? await getAdminMembership(user.id) : null;

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Navigation
          currentRole={currentRole}
          isAuthenticated={Boolean(user)}
          userName={userName}
          userEmail={userEmail}
          hasAdminAccess={Boolean(adminMembership)}
        >
          <MotionProvider>{children}</MotionProvider>
        </Navigation>
        <Toaster
          richColors
          position="top-right"
          toastOptions={{ classNames: { toast: "motion-toast" } }}
        />
      </body>
    </html>
  );
}
