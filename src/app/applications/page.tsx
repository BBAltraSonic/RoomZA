import { FileText, MapPin } from "lucide-react";

import { requireRole } from "@/lib/auth";

export default async function ApplicationsPage() {
  const { profile } = await requireRole("renter");

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-[#2d5b52]">Renter workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Applications</h1>
        <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>

        <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
          <FileText className="mb-5 size-6 text-[#2d5b52]" />
          <h2 className="text-xl font-semibold">Application tracker ready</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            This renter-only surface is protected by the profile role. The application cap and document flows will attach here in CHE-30 through CHE-33.
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-lg bg-[#edf5f1] px-3 py-2 text-sm text-[#2d5b52]">
            <MapPin className="size-4" />
            Map discovery stays one click away from the renter loop.
          </div>
        </section>
      </div>
    </main>
  );
}
