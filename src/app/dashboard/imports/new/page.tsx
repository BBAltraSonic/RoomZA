import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

import { AppShell, BackLink, EmptyState, PageHeader } from "@/components/premium/primitives";
import { getImportAccess } from "@/features/listing-imports/access";
import { NewImportForm } from "@/features/listing-imports/new-import-form";

export const metadata: Metadata = {
  title: "New listing import",
  robots: { index: false, follow: false },
};

export default async function NewImportPage() {
  const access = await getImportAccess();
  return (
    <AppShell width="xl" className="pt-2 md:pt-12">
      <BackLink href="/dashboard/imports">Listing imports</BackLink>
      <PageHeader
        eyebrow="Step 1 of 8"
        title="Choose a listing source"
        description="Pinpoint preserves your listing copy. Mapping and validation make the source compatible without rewriting it."
      />
      {!access.allowed ? (
        <EmptyState icon={AlertCircle} title="Unable to start an import" description={access.reason ?? "Import access is unavailable."} />
      ) : (
        <NewImportForm />
      )}
    </AppShell>
  );
}
