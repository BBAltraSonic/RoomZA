import type { ReactNode } from "react";

import { WorkspaceNav } from "@/features/dashboard/workspace-nav";
import { requireRole } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireRole("landlord", { redirectTo: "/dashboard" });

  return (
    <>
      <WorkspaceNav />
      {children}
    </>
  );
}
