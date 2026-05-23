"use client";

import { useState } from "react";
import { Search, BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export function EmptyStateCapture({
  bbox,
  filters,
  compact = false,
}: {
  bbox: ViewportBounds | null;
  filters: any;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !bbox) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, bbox, filters }),
      });

      if (!res.ok) throw new Error("Failed to subscribe");
      
      setStatus("success");
      setEmail("");
      toast.success("Alert created", { description: "We'll notify you when homes are listed here." });
    } catch (error) {
      setStatus("idle");
      toast.error("Failed to create alert", { description: "Please try again later." });
    }
  };

  if (status === "success") {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "rounded-xl border border-border bg-warm-surface p-5" : "rounded-2xl border border-border bg-warm-surface p-8"
      )}>
        <div className="flex size-12 items-center justify-center rounded-full bg-forest/10 text-forest">
          <CheckCircle2 className="size-6" />
        </div>
        <h3 className="mt-4 font-semibold text-ink">You're on the list!</h3>
        <p className="mt-2 text-sm text-muted-foreground">We'll email you as soon as properties become available in this area.</p>
        <button 
          onClick={() => setStatus("idle")} 
          className="mt-6 text-sm font-medium text-forest hover:underline"
        >
          Create another alert
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col items-center text-center",
      compact ? "rounded-xl border border-dashed border-border bg-warm-surface p-5" : "rounded-2xl border border-dashed border-border bg-warm-surface p-8"
    )}>
      <Search className={cn("text-muted-foreground", compact ? "size-6" : "size-8")} />
      <h3 className={cn("font-semibold text-ink", compact ? "mt-3 text-sm" : "mt-4 text-base")}>
        No homes in view
      </h3>
      <p className={cn("text-muted-foreground", compact ? "mt-1 text-xs" : "mt-2 text-sm")}>
        Move the map or search another area.
      </p>

      <div className={cn("w-full border-t border-border", compact ? "my-4" : "my-6")} />

      <div className="w-full">
        <div className="flex items-center justify-center gap-2 text-ink">
          <BellRing className="size-4 text-forest" />
          <h4 className={cn("font-medium", compact ? "text-sm" : "text-base")}>Get notified</h4>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          We'll email you when listings appear in this area.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            className="h-10 w-full flex-1 rounded-md border border-input bg-background px-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === "loading" || !email}
            className="inline-flex h-10 items-center justify-center rounded-md bg-forest px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Notify me"}
          </button>
        </form>
      </div>
    </div>
  );
}
