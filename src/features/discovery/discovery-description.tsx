"use client";

import { useId, useState } from "react";

export function DiscoveryDescription({ text, className = "text-sm" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > 280;
  const summary = long ? text.slice(0, 280).replace(/\s+\S*$/, "") + "…" : text;
  return <div><p id={id} className={`whitespace-pre-wrap break-words ${className}`}>{expanded ? text : summary}</p>{long ? <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{expanded ? "Show less" : "Read full description"}</button> : null}</div>;
}
