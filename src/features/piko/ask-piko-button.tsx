"use client";

import { useDockAssistant } from "@/components/navigation/dock-assistant";
import { cn } from "@/lib/utils";

import { PikoFace } from "./piko";
import { PikoTipNote, usePikoTip } from "./tips-context";

/**
 * "Ask Piko" on a listing, special or service. It opens the page's Piko, which already knows
 * which item is open and offers that item's questions. Hidden where the page has no Piko. When
 * the page gives a tip for the item (PikoTipProvider), it shows above the button.
 */
export function AskPikoButton({ className, align = "start" }: { className?: string; align?: "start" | "end" }) {
  const assistant = useDockAssistant();
  const tip = usePikoTip();
  if (!assistant) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", align === "end" ? "items-end" : "items-start", className)}>
      {tip ? <PikoTipNote tip={tip} /> : null}
      <button
        type="button"
        onClick={() => {
          if (!assistant.open) assistant.toggle();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-panel py-1 pl-1 pr-4 text-sm font-semibold text-ink shadow-[var(--elevation-2)] transition-colors hover:border-[var(--brand-amber)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PikoFace mood="idea" size={34} />
        Ask Piko
      </button>
    </div>
  );
}
