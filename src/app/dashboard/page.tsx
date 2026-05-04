import { Building2, Users } from "lucide-react";

import { requireRole } from "@/lib/auth";

export default async function DashboardPage() {
  const { profile } = await requireRole("landlord");

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-[#b86f42]">Landlord workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <Building2 className="mb-5 size-6 text-[#b86f42]" />
            <h2 className="text-xl font-semibold">Listings area ready</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Listing creation and Mapbox pin placement will build from this landlord-only route.
            </p>
          </article>
          <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <Users className="mb-5 size-6 text-[#2d5b52]" />
            <h2 className="text-xl font-semibold">Applicant queue ready</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Applicant review, shortlist, reject, approve, and viewing proposals will attach here.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
