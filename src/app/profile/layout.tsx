import { ProfileShell } from "@/features/profile/components/profile-shell";
import { requireUser } from "@/lib/auth";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser({ redirectTo: "/profile" });
  return <ProfileShell>{children}</ProfileShell>;
}
