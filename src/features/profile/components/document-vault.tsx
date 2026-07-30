"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProfileDocumentAction,
  uploadProfileDocumentAction,
} from "@/features/profile/actions";
import type { ProfileDocument } from "@/features/profile/types";

export function DocumentVault({ documents }: { documents: ProfileDocument[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  async function openVersion(versionId: string) {
    const response = await fetch(
      `/api/profile/documents/${versionId}/signed-url`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok)
      return toast.error(result.error?.message ?? "Secure link unavailable.");
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-8">
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          startTransition(async () => {
            const result = await uploadProfileDocumentAction(
              new FormData(form),
            );
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success("Document added to your private vault");
            formRef.current?.reset();
            router.refresh();
          });
        }}
        className="grid gap-4 border-y border-border py-5 sm:grid-cols-2"
      >
        <div className="grid gap-2">
          <Label htmlFor="document-name">Display name</Label>
          <Input
            id="document-name"
            name="displayName"
            required
            maxLength={180}
            className="h-11"
            placeholder="March payslip"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="document-type">Document type</Label>
          <select
            id="document-type"
            name="documentType"
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {[
              "id",
              "passport",
              "drivers_license",
              "payslip",
              "employment_letter",
              "bank_statement",
              "lease_agreement",
              "proof_of_residence",
              "student_proof",
              "business_registration",
              "tax_document",
              "other",
            ].map((type) => (
              <option key={type} value={type}>
                {type.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="document-expiry">Expiry date</Label>
          <Input
            id="document-expiry"
            name="expiresAt"
            type="date"
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="document-file">File</Label>
          <Input
            id="document-file"
            name="file"
            type="file"
            required
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="h-11 file:mr-3 file:border-0 file:bg-transparent"
          />
        </div>
        <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
          PDF, JPEG, PNG, or WebP up to 20 MB. Files are private and links
          expire after 60 seconds.
        </p>
        <Button type="submit" disabled={pending} className="sm:w-fit">
          <Upload className="size-4" />
          {pending ? "Uploading…" : "Upload document"}
        </Button>
      </form>

      {documents.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-forest" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {document.displayName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {document.documentType.replaceAll("_", " ")}
                    {document.currentVersion
                      ? ` · version ${document.currentVersion.version} · ${(document.currentVersion.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                      : ""}
                    {document.expiresAt
                      ? ` · expires ${new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(document.expiresAt))}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {document.currentVersion ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void openVersion(document.currentVersion!.id)
                    }
                  >
                    <Download className="size-4" />
                    Open
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteProfileDocumentAction(
                        document.id,
                      );
                      if (!result.success) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Document removed");
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="border-y border-border py-12 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-ink">
            Your document vault is empty
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload a reusable document when you are ready.
          </p>
        </div>
      )}
    </div>
  );
}
