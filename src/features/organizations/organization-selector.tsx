"use client";

import { Building2, ChevronDown, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { selectActiveOrganization } from "./actions";
import type { OrganizationMembershipView } from "./types";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";

export function OrganizationSelector({
  memberships,
  activeOrganizationId,
}: {
  memberships: OrganizationMembershipView[];
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const ready = useWorkspaceReady();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  if (memberships.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel px-3 py-2">
      <Building2 className="size-4 text-forest" aria-hidden="true" />
      <label htmlFor="active-organization" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Workspace
      </label>
      <div className="relative min-w-52">
        <select
          id="active-organization"
          value={activeOrganizationId ?? ""}
          disabled={!ready || pending}
          onChange={(event) => {
            const organizationId = event.target.value;
            setMessage("");
            startTransition(async () => {
              const result = await selectActiveOrganization(organizationId);
              if (!result.success) {
                setMessage(result.error);
                return;
              }
              router.refresh();
            });
          }}
          className="h-10 w-full appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {memberships.map((membership) => (
            <option key={membership.organizationId} value={membership.organizationId}>
              {membership.organizationName} · {membership.role}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <Link href="/dashboard/organization" className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-forest hover:bg-accent">
        <Settings2 className="size-4" /> Manage
      </Link>
      {message ? <p role="alert" className="text-sm font-medium text-destructive">{message}</p> : null}
    </div>
  );
}
