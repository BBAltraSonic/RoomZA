"use client";

import { useEffect, useState } from "react";
import { Search, X, MapPin } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const NEIGHBORHOODS = [
  { name: "Cape Town CBD", slug: "cape-town-cbd" },
  { name: "Braamfontein", slug: "braamfontein" },
  { name: "Sandton Central", slug: "sandton-central" },
  { name: "Rondebosch", slug: "rondebosch" },
];

export function HeroModal({
  open,
  onClose,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // Avoid hydration mismatch for portals/modals
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      onClose();
    }
  };

  const handleChipClick = (name: string) => {
    setQuery(name);
    onSearch(name);
    onClose();
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center transition-all duration-700 ease-in-out",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none delay-200"
      )}
    >
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000"
          alt="Beautiful home interior"
          fill
          className="object-cover scale-105"
          priority
        />
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      </div>

      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
        aria-label="Skip to Map"
      >
        <X className="size-6" />
      </button>

      {/* Content */}
      <div
        className={cn(
          "relative z-10 w-full max-w-3xl px-6 text-center transition-all duration-700 delay-100",
          open ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"
        )}
      >
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
          Find your next home.
        </h1>
        <p className="mb-10 text-lg font-medium text-white/80 sm:text-xl">
          Discover beautiful rentals across South Africa.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="relative mx-auto max-w-2xl">
          <div className="relative flex items-center overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl transition-all focus-within:ring-4 focus-within:ring-forest/30 hover:shadow-forest/20">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center text-muted-foreground">
              <Search className="size-6" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Where do you want to live?"
              className="h-14 w-full bg-transparent px-2 text-lg font-medium text-ink placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              className="ml-2 flex h-14 shrink-0 items-center justify-center rounded-[1.5rem] bg-forest px-8 font-semibold text-white transition-colors hover:bg-forest/90 active:scale-95"
            >
              Search
            </button>
          </div>
        </form>

        {/* Neighborhood Chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-medium text-white/70">Popular:</span>
          {NEIGHBORHOODS.map((neighborhood) => (
            <button
              key={neighborhood.slug}
              type="button"
              onClick={() => handleChipClick(neighborhood.name)}
              className="flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
            >
              <MapPin className="mr-1.5 size-3.5 opacity-70" />
              {neighborhood.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
