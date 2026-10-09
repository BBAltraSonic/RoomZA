"use client";

import { BusFront, GraduationCap, HeartPulse, ShoppingBasket, Utensils, X } from "lucide-react";
import type { NormalizedLocation } from "@/lib/maptiler";
import { cn } from "@/lib/utils";
import type { GeoPoint } from "./lib/types";

export const NEARBY_MIN_ZOOM = 12;

export type NearbyCategoryId = "transport" | "schools" | "groceries" | "clinics" | "restaurants";

export type NearbyPoi = {
  id: string;
  name: string;
  address?: string;
  coordinates: GeoPoint;
  categoryId: NearbyCategoryId;
};

export const NEARBY_CATEGORIES: Array<{
  id: NearbyCategoryId;
  label: string;
  query: string;
  icon: typeof BusFront;
  markerClassName: string;
}> = [
  { id: "transport", label: "Transport", query: "public transport", icon: BusFront, markerClassName: "bg-status-info-text" },
  { id: "schools", label: "Schools", query: "school", icon: GraduationCap, markerClassName: "bg-violet-600" },
  { id: "groceries", label: "Groceries", query: "supermarket", icon: ShoppingBasket, markerClassName: "bg-forest" },
  { id: "clinics", label: "Clinics", query: "clinic", icon: HeartPulse, markerClassName: "bg-status-error-text" },
  { id: "restaurants", label: "Restaurants", query: "restaurant", icon: Utensils, markerClassName: "bg-status-warning-text" },
];

export function locationToPoi(
  feature: NormalizedLocation,
  categoryId: NearbyCategoryId,
): NearbyPoi | null {
  const { lng, lat } = feature.center;
  return {
    id: `${categoryId}-${feature.id}`,
    name: feature.label,
    address: feature.secondaryLabel || undefined,
    coordinates: { lng, lat },
    categoryId,
  };
}

export function NearbyPanel({
  zoom,
  open,
  activeCategory,
  onActiveCategoryChange,
  results,
  loading,
  error,
  onClose,
}: {
  zoom: number;
  open: boolean;
  activeCategory: NearbyCategoryId;
  onActiveCategoryChange: (category: NearbyCategoryId) => void;
  results: Record<NearbyCategoryId, NearbyPoi[]>;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <section
      aria-label="Nearby essentials"
      className="absolute inset-x-3 top-4 z-[var(--z-controls)] max-h-[18rem] overflow-y-auto rounded-2xl border border-border/70 bg-panel p-3 shadow-[var(--elevation-3)] sm:inset-x-auto sm:left-4 sm:top-auto sm:bottom-5 sm:w-60 lg:left-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Nearby</h2>
          <p className="text-xs text-muted-foreground">
            {zoom < NEARBY_MIN_ZOOM ? "Zoom in to explore nearby." : "Essentials in this map area"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close nearby places"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-warm-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-2 divide-y divide-border/60">
        {NEARBY_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const count = zoom < NEARBY_MIN_ZOOM ? 0 : results[category.id].length;
          return (
            <li key={category.id}>
              <button
                type="button"
                disabled={zoom < NEARBY_MIN_ZOOM}
                aria-pressed={activeCategory === category.id}
                onClick={() => onActiveCategoryChange(category.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                  activeCategory === category.id ? "bg-warm-surface text-forest" : "text-ink hover:bg-warm-surface",
                )}
              >
                <span className={cn("size-2.5 rounded-full", category.markerClassName)} aria-hidden="true" />
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 font-medium">{category.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {zoom >= NEARBY_MIN_ZOOM && loading ? "…" : count >= 10 ? "10+" : count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {zoom >= NEARBY_MIN_ZOOM && error
        ? <p role="status" className="mt-2 text-xs text-status-error-text">{error}</p>
        : null}
    </section>
  );
}

