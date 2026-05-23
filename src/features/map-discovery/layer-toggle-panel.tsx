"use client";

import { useRef, useEffect } from "react";
import { X, Layers } from "lucide-react";
import { NEIGHBORHOOD_LAYERS, type LayerCategory } from "./neighborhood-layers";
import { cn } from "@/lib/utils";

type LayerTogglePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  activeLayers: Set<string>;
  onToggleLayer: (categoryId: string) => void;
  className?: string;
};

export function LayerTogglePanel({
  isOpen,
  onClose,
  activeLayers,
  onToggleLayer,
  className
}: LayerTogglePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "flex flex-col w-[320px] max-h-[80vh] overflow-hidden rounded-2xl border border-border bg-panel/95 shadow-[var(--elevation-3)] backdrop-blur-xl animate-in fade-in slide-in-from-right-4",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-ink" />
          <h2 className="text-sm font-semibold text-ink">Neighborhood Intelligence</h2>
        </div>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:text-ink hover:bg-warm-surface"
          aria-label="Close layers panel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide space-y-1">
        {NEIGHBORHOOD_LAYERS.map(group => (
          <div key={group.id} className="mb-4">
            <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.categories.map((category: LayerCategory) => {
                const isActive = activeLayers.has(category.id);
                const Icon = category.icon;

                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      if (!category.comingSoon) onToggleLayer(category.id);
                    }}
                    disabled={category.comingSoon}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-accent/50 text-ink"
                        : "text-muted-foreground hover:bg-muted hover:text-ink",
                      category.comingSoon && "opacity-60 cursor-not-allowed hover:bg-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex size-6 items-center justify-center rounded-md border",
                        isActive ? "border-transparent text-primary-foreground shadow-sm" : "border-border bg-panel",
                        category.comingSoon && "bg-transparent border-dashed"
                      )}
                      style={{ backgroundColor: isActive ? category.pinColor : undefined }}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <span>{category.label}</span>
                    </div>
                    
                    {category.comingSoon ? (
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-warm-surface border border-border">
                        Soon
                      </span>
                    ) : (
                      <div className={cn(
                        "relative flex h-4 w-8 items-center rounded-full border transition-colors",
                        isActive ? "border-transparent" : "border-input bg-warm-surface"
                      )}
                      style={{ backgroundColor: isActive ? category.pinColor : undefined }}
                      >
                        <div className={cn(
                          "absolute h-3 w-3 rounded-full bg-panel shadow-sm transition-transform",
                          isActive ? "translate-x-[18px]" : "translate-x-0.5"
                        )} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
