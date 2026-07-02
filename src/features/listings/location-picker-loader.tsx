"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

import type { LocationPickerProps } from "./location-picker";

const DynamicLocationPicker = dynamic<LocationPickerProps>(
  () => import("./location-picker").then((module) => module.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-border bg-warm-surface p-6 text-center">
        <MapPin className="size-6 text-forest" />
        <p className="mt-3 text-sm font-semibold text-ink">Loading location map</p>
      </div>
    ),
  },
);

export function LocationPickerLoader(props: LocationPickerProps) {
  return <DynamicLocationPicker {...props} />;
}
