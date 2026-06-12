import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireRole("landlord", { redirectTo: "/dashboard" });

  return (
    <main className="flex-1 md:pl-64">
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </main>
  );
}
