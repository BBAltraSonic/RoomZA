import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeroOverlayProps {
  className?: string;
  children?: ReactNode;
}

export function HeroOverlay({ className, children }: HeroOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto relative rounded-[32px] shadow-2xl",
        className
      )}
    >
      <div className="absolute inset-0 z-0 overflow-hidden rounded-[32px] bg-neutral-900">
        <img
          src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop"
          alt="Beautiful home with pool"
          className="h-full w-full object-cover object-center"
        />
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
        <div className="mb-8 flex gap-1.5 hidden sm:flex">
          <div className="h-1.5 w-6 rounded-full bg-white" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
          <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
        </div>

        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Explore beautiful homes near you
        </h1>
        <p className="mb-6 text-base font-medium text-white/80 sm:text-lg">
          Over 2,900 homes waiting for you
        </p>

        {children}
      </div>
    </div>
  );
}
