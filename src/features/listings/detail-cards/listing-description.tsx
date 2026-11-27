"use client";

import { useId, useState } from "react";

const EXCERPT_CHARS = 240;

/**
 * The opening of a description, cut at a word boundary, or null when the whole
 * text already fits. Structured blocks carry the facts, so prose stays short
 * until the visitor asks for more (requirement 4.3).
 */
export function descriptionExcerpt(text: string, limit = EXCERPT_CHARS): string | null {
  if (text.length <= limit) return null;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function ListingDescription({ description }: { description?: string | null }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const text = description?.trim();
  if (!text) return null;

  const excerpt = descriptionExcerpt(text);
  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border border-border bg-surface-panel p-4">
      <h2 id={`${id}-heading`} className="text-sm font-semibold text-ink">About this home</h2>
      <p id={`${id}-body`} className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
        {expanded || !excerpt ? text : excerpt}
      </p>
      {excerpt ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-body`}
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 min-h-11 rounded-md text-sm font-semibold text-forest hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </section>
  );
}
