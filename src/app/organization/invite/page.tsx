import { AcceptInvitation } from "@/features/organizations/accept-invitation";

export default async function OrganizationInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main className="min-h-dvh bg-background px-4 py-16">
      <section className="mx-auto max-w-lg rounded-xl border border-border bg-panel p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-forest">Pinpoint organization</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Join your team workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in with the invited email address. Organization access requires a landlord account, and a renter-only profile will never be changed silently.</p>
        <AcceptInvitation token={token} />
      </section>
    </main>
  );
}
