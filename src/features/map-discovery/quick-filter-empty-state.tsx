"use client";

import Link from "next/link";
import { Eye, Globe2, Heart, ShieldCheck, Sofa, Sparkles, type LucideIcon } from "lucide-react";

import type { PikoMood } from "@/features/piko/art";
import { Piko } from "@/features/piko/piko";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";

import type { QuickFilterKey } from "./lib/types";

type EmptyCopy = { icon: LucideIcon; title: string; description: string; mood?: PikoMood };

/** Piko shows for "nothing here"; a failure to load keeps the plain icon. */
const EMPTY_COPY: Record<QuickFilterKey, EmptyCopy> = {
  all: { icon: Globe2, mood: "noResults", title: "No homes in this area", description: "Try a nearby area or clear your refinements." },
  "nsfas-approved": { icon: ShieldCheck, mood: "noResults", title: "No NSFAS-approved homes here", description: "Try moving the map or view all available homes." },
  favourites: { icon: Heart, mood: "empty", title: "No saved homes yet", description: "Tap the heart on any listing to add it to your favourites." },
  "recently-listed": { icon: Sparkles, mood: "loading", title: "No new homes this week", description: "View all listings or try another area." },
  "recently-viewed": { icon: Eye, mood: "explore", title: "No recently viewed homes yet", description: "Open a listing and it will appear here for easy return." },
  furnished: { icon: Sofa, mood: "noResults", title: "No furnished homes here", description: "Try moving the map or view all available homes." },
};

export function QuickFilterEmptyState({
  filter,
  authenticated = true,
  favoritesError = false,
  onClear,
  overlay = false,
}: {
  filter: QuickFilterKey;
  authenticated?: boolean;
  favoritesError?: boolean;
  onClear: () => void;
  overlay?: boolean;
}) {
  const copy: EmptyCopy = filter === "favourites" && !authenticated
    ? { icon: Heart, mood: "hello", title: "Sign in to see favourites", description: "Saved homes stay connected to your Pinpoint account." }
    : filter === "favourites" && favoritesError
      ? { icon: Heart, title: "Saved homes could not be loaded", description: "Try again after checking your connection." }
      : EMPTY_COPY[filter];
  const Icon = copy.icon;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center rounded-2xl border border-border/70 bg-panel p-5 text-center shadow-[var(--elevation-2)]",
        overlay && "pointer-events-auto absolute left-1/2 top-[42%] z-[var(--z-controls)] w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2",
      )}
    >
      {copy.mood ? (
        <Piko mood={copy.mood} height={110} />
      ) : (
        <span className="flex size-11 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <h3 className="mt-3 text-base font-bold text-ink">{copy.title}</h3>
      <p className="mt-1 max-w-[34ch] text-sm leading-5 text-muted-foreground">{copy.description}</p>
      {filter === "favourites" && !authenticated ? (
        <Link href={authPathForRedirect("/")} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-forest px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Sign in
        </Link>
      ) : (
        <button type="button" onClick={onClear} className="mt-4 min-h-11 rounded-full bg-forest px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Show all listings
        </button>
      )}
    </div>
  );
}
