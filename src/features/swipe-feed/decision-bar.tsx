"use client";

import { Heart, Undo2, X } from "lucide-react";

import { cn } from "@/lib/utils";

const round = "flex shrink-0 items-center justify-center rounded-full border shadow-[var(--elevation-2)] transition-[transform,background-color,color] duration-[var(--motion-fast)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 motion-reduce:transform-none motion-reduce:transition-none";

/** ✕ / Undo / ♡. Every swipe has a button here (requirement 10.1). */
export function DecisionBar({ onPass, onSave, onUndo, saved, canUndo, disabled, className }: {
  onPass: () => void;
  onSave: () => void;
  onUndo: () => void;
  saved: boolean;
  canUndo: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Decide on this listing" className={cn("flex items-center justify-center gap-5", className)}>
      <button type="button" onClick={onPass} disabled={disabled} aria-label="Pass" aria-keyshortcuts="ArrowLeft"
        className={cn(round, "size-14 border-border/60 bg-panel text-ink hover:bg-warm-surface")}>
        <X className="size-6" aria-hidden="true" />
      </button>
      <button type="button" onClick={onUndo} disabled={disabled || !canUndo} aria-label="Undo" aria-keyshortcuts="z"
        className={cn(round, "size-11 border-border/60 bg-panel/90 text-muted-foreground hover:text-ink")}>
        <Undo2 className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onSave} disabled={disabled} aria-label="Save" aria-pressed={saved} aria-keyshortcuts="ArrowRight"
        className={cn(round, "size-14", saved ? "border-transparent bg-selection text-selection-foreground" : "border-border/60 bg-panel text-ink hover:bg-warm-surface")}>
        <Heart className={cn("size-6", saved && "fill-current")} aria-hidden="true" />
      </button>
    </div>
  );
}
