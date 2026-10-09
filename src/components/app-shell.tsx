"use client";
import { usePathname } from "next/navigation";
import { useNavigationAccount } from "@/features/auth/use-navigation-account";
import { PresenceHeartbeat } from "@/features/presence/presence-heartbeat";
import { Navigation } from "@/components/navigation/navigation";
import { MotionProvider } from "@/lib/motion/provider";
import { Toaster } from "sonner";

/** Shared chrome for every screen; protected data remains server-authorized. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const account = useNavigationAccount(usePathname());
  return <Navigation {...account} userName={account.userEmail?.split("@")[0]}>
    <PresenceHeartbeat enabled={account.isAuthenticated} />
    <MotionProvider>{children}</MotionProvider>
    <Toaster richColors position="top-right" toastOptions={{ classNames: { toast: "motion-toast" } }} />
  </Navigation>;
}
