import { redirect } from "next/navigation";
import { Ban } from "lucide-react";

import { getSuspendedAccountStatus } from "@/features/admin/account-status";

export default async function AccountSuspendedPage() {
  const status = await getSuspendedAccountStatus();
  if (status.kind === "unauthenticated") redirect("/auth");
  if (status.kind === "active") redirect("/");
  const { suspension } = status;

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-panel p-7 shadow-[var(--elevation-2)] sm:p-9">
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><Ban className="size-6" /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account status</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">Your account is suspended</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{suspension.reason}</p>
        <p className="mt-4 text-sm text-muted-foreground">{suspension.suspended_until ? `Access may resume after ${new Date(suspension.suspended_until).toLocaleString("en-ZA")}.` : "This suspension has no scheduled end date."}</p>
        <form action="/auth/sign-out" method="post" className="mt-6"><button className="h-11 rounded-lg bg-ink px-5 text-sm font-semibold text-background">Sign out</button></form>
      </section>
    </main>
  );
}
