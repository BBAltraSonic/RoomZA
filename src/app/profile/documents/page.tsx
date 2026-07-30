import type { Metadata } from "next";

import { PageHeader } from "@/components/premium/primitives";
import { DocumentVault } from "@/features/profile/components/document-vault";
import { getProfileDocuments } from "@/features/profile/data";

export const metadata: Metadata = {
  title: "Document Vault",
  robots: { index: false, follow: false },
};

export default async function ProfileDocumentsPage() {
  const documents = await getProfileDocuments();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Private vault"
        title="Documents"
        description="Versioned documents for applications and verified sharing. Files are never public profile data."
      />
      <DocumentVault documents={documents} />
    </div>
  );
}
