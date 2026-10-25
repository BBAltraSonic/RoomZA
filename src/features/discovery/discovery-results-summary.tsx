import type { ReactNode } from "react";

/** Compact recovery stays available even when the results sheet is in Peek. */
export function DiscoveryResultsSummary({ label, count, totalCount, loading, error, onRetry, message, action }: {
  label: string; count?: number; totalCount?: number; loading?: boolean; error?: boolean;
  onRetry?: () => void; message?: string; action?: ReactNode;
}) {
  return <div className="space-y-1 text-xs">
    <p role={error ? "alert" : "status"} className={error ? "text-status-error-text" : "text-muted-foreground"}>
      {message ?? (error ? count ? "Refresh failed. Previous results kept." : "Could not load listings. Try again." : loading ? `Checking ${label.toLowerCase()}…` : count === 0 ? "No matching listings. Move the map or change your filters." : count === undefined ? "Loading listings…" : totalCount !== undefined && totalCount > count ? `${count.toLocaleString()} of ${totalCount.toLocaleString()} listings shown` : `${count.toLocaleString()} ${count === 1 ? "listing" : "listings"} nearby`)}
    </p>
    {action ?? (error && onRetry ? <button type="button" onClick={onRetry} className="min-h-11 text-sm font-semibold text-forest underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry {label.toLowerCase()}</button> : null)}
  </div>;
}
