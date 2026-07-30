"use client";

import { ArrowRight, Braces, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ImportSourceKind } from "./types";

const sourceOptions: Array<{
  kind: ImportSourceKind;
  title: string;
  description: string;
  icon: typeof FileText;
}> = [
  { kind: "csv", title: "CSV", description: "Comma, semicolon, tab, or pipe-delimited.", icon: Table2 },
  { kind: "xlsx", title: "Excel workbook", description: "Choose a worksheet after inspection.", icon: FileSpreadsheet },
  { kind: "xml", title: "XML", description: "Choose a repeating record path.", icon: Braces },
  { kind: "json", title: "JSON", description: "Choose the array containing listings.", icon: Braces },
  { kind: "pasted_table", title: "Paste a table", description: "Paste rows copied from a spreadsheet.", icon: Table2 },
  { kind: "pinpoint_v1", title: "Pinpoint export", description: "Restore a version 1 Pinpoint export.", icon: FileText },
];

type FormValues = { sourceKind: "csv" | "xlsx" | "xml" | "json" | "pasted_table" | "pinpoint_v1" };

export function NewImportForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const form = useForm<FormValues>({ defaultValues: { sourceKind: "csv" } });
  // React Hook Form subscriptions are the source of truth for this small choice grid.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selected = form.watch("sourceKind");

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setMessage("");
        const response = await fetch("/api/imports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        const payload = await response.json() as { ok: boolean; data?: { job: { id: string } }; error?: { message: string } };
        if (!payload.ok || !payload.data) {
          setMessage(payload.error?.message ?? "Unable to create the import.");
          return;
        }
        router.push(`/dashboard/imports/${payload.data.job.id}`);
      })}
      className="space-y-5"
    >
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Choose a structured listing source</legend>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Images can be added from ZIP files, folders, mapped filenames, or safe image URLs after the listing source is staged.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sourceOptions.map((option) => {
            const Icon = option.icon;
            const checked = selected === option.kind;
            return (
              <label
                key={option.kind}
                className={cn(
                  "flex min-h-28 cursor-pointer gap-3 rounded-lg border bg-panel p-4 shadow-[var(--shadow-control)] outline-none transition-colors focus-within:ring-2 focus-within:ring-ring",
                  checked ? "border-forest bg-accent/60" : "border-border hover:border-forest/30",
                )}
              >
                <input type="radio" value={option.kind} className="sr-only" {...form.register("sourceKind")} />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-warm-surface text-forest">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{option.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {message ? <p role="alert" className="text-sm font-medium text-destructive">{message}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating workspace…" : "Continue to upload"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}
