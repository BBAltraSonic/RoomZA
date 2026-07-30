import { SettingsShell } from "@/features/profile/components/settings-shell";
import { requireUser } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser({ redirectTo: "/settings" });
  return <SettingsShell>{children}</SettingsShell>;
}
