"use client";

import { Building2, Home } from "lucide-react";
import { useFormStatus } from "react-dom";

import { chooseRoleAction } from "@/app/onboarding/actions";

const roles = [
  {
    value: "renter",
    icon: Home,
    title: "Find a home",
    description: "Explore the map, save a shortlist, and apply when a place feels right.",
    outcome: "Start on the map",
  },
  {
    value: "landlord",
    icon: Building2,
    title: "List a property",
    description: "Create a private draft, finish the details, and publish when it is ready.",
    outcome: "Start a quick draft",
  },
] as const;

function RoleSubmit({ role }: { role: (typeof roles)[number] }) {
  const { pending, data } = useFormStatus();
  const Icon = role.icon;
  const isSubmitting = pending && data?.get("role") === role.value;

  return (
    <button
      className="group min-h-44 rounded-2xl border border-border bg-panel p-5 text-left shadow-[var(--elevation-1)] transition-[border-color,background-color,transform] hover:border-forest/40 hover:bg-warm-surface active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70 sm:min-h-48 sm:p-6"
      disabled={pending}
      name="role"
      type="submit"
      value={role.value}
      aria-busy={isSubmitting}
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-forest">
        <Icon className="size-5" />
      </span>
      <span className="mt-5 block text-xl font-semibold text-ink">{role.title}</span>
      <span className="mt-2 block max-w-sm text-sm leading-6 text-muted-foreground">{role.description}</span>
      <span className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-forest">
        {isSubmitting ? "Opening workspace..." : role.outcome}
      </span>
    </button>
  );
}

export function RoleChoiceForm({ redirectPath }: { redirectPath?: string }) {
  return (
    <form action={chooseRoleAction} className="grid gap-4 md:grid-cols-2">
      {redirectPath ? <input name="redirect" type="hidden" value={redirectPath} /> : null}
      {roles.map((role) => <RoleSubmit key={role.value} role={role} />)}
    </form>
  );
}
