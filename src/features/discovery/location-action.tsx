"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

/** Open the existing header chooser so search and keyboard focus have one owner. */
export function DiscoveryLocationAction({ idPrefix, children = "Choose location" }: { idPrefix: string; children?: ReactNode }) {
  return <button type="button" onClick={() => document.getElementById(`${idPrefix}-location-trigger`)?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><MapPin size={16} aria-hidden="true" />{children}</button>;
}
