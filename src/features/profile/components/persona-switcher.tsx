"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setActivePersonaAction } from "@/features/profile/actions";
import {
  marketplacePersonaLabels,
  type MarketplacePersona,
} from "@/lib/personas";

export function PersonaSwitcher({
  personas,
}: {
  personas: Array<{ persona: MarketplacePersona; isActive: boolean }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active =
    personas.find((item) => item.isActive)?.persona ?? personas[0]?.persona;

  return (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      Active persona
      <select
        aria-label="Active marketplace persona"
        className="h-11 min-w-36 rounded-lg border border-input bg-background px-3 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={active}
        disabled={pending}
        onChange={(event) => {
          const persona = event.target.value as MarketplacePersona;
          startTransition(async () => {
            const result = await setActivePersonaAction(persona);
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success(`Switched to ${marketplacePersonaLabels[persona]}`);
            router.refresh();
          });
        }}
      >
        {personas.map(({ persona }) => (
          <option key={persona} value={persona}>
            {marketplacePersonaLabels[persona]}
          </option>
        ))}
      </select>
    </label>
  );
}
