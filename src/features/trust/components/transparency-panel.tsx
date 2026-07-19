import type { TransparencySnapshot } from "../types";

export function TransparencyPanel({ snapshot }: { snapshot: TransparencySnapshot | null }) {
  return (
    <section className="mt-10 border-t border-border pt-8" aria-labelledby="transparency-metrics-heading">
      <h2 id="transparency-metrics-heading" className="text-xl font-semibold text-ink">Published platform metrics</h2>
      {!snapshot ? (
        <div className="mt-4 rounded-2xl border border-border bg-panel p-5">
          <p className="font-semibold text-ink">Not enough data to publish</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Pinpoint publishes a metric only after its underlying group contains at least ten cases. No monthly snapshot has met the publication gate yet.</p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-panel">
          {snapshot.metrics.map((metric) => (
            <div key={metric.key} className="flex min-h-16 items-center justify-between gap-5 px-5 py-3">
              <div><p className="text-sm font-semibold text-ink">{metric.label}</p><p className="mt-0.5 text-xs text-muted-foreground">Sample size {metric.sampleSize}</p></div>
              <p className="text-sm font-semibold text-ink">{metric.suppressed ? "Not enough data" : `${metric.value?.toLocaleString("en-ZA")}${metric.unit ? ` ${metric.unit}` : ""}`}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
