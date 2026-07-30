export type ImageCandidate = {
  id: string;
  filename?: string;
  sourceReferenceFolder?: string;
  url?: string;
};

export type ListingImageHints = {
  explicit: string[];
  sourceReference?: string;
};

const normalize = (value: string) => value
  .normalize("NFKD")
  .replaceAll(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/\.[a-z0-9]+$/i, "")
  .replaceAll(/[^a-z0-9]/g, "");

export function matchImages(hints: ListingImageHints, candidates: ImageCandidate[]) {
  const unmatched = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const matched: Array<ImageCandidate & { method: "explicit" | "source_reference" | "prefix" }> = [];
  const ambiguous: ImageCandidate[] = [];

  const takeUnique = (matches: ImageCandidate[], method: "explicit" | "source_reference" | "prefix") => {
    if (matches.length === 1) {
      const candidate = matches[0]!;
      unmatched.delete(candidate.id);
      matched.push({ ...candidate, method });
    } else if (matches.length > 1) {
      matches.forEach((candidate) => {
        unmatched.delete(candidate.id);
        ambiguous.push(candidate);
      });
    }
  };

  for (const reference of hints.explicit) {
    const target = normalize(reference);
    takeUnique([...unmatched.values()].filter((candidate) =>
      normalize(candidate.filename ?? candidate.url ?? "") === target
    ), "explicit");
  }

  if (hints.sourceReference) {
    const sourceReference = normalize(hints.sourceReference);
    const folderMatches = [...unmatched.values()].filter((candidate) =>
      normalize(candidate.sourceReferenceFolder ?? "") === sourceReference
    );
    folderMatches.forEach((candidate) => {
      unmatched.delete(candidate.id);
      matched.push({ ...candidate, method: "source_reference" });
    });

    const prefixMatches = [...unmatched.values()].filter((candidate) =>
      normalize(candidate.filename ?? "").startsWith(sourceReference)
    );
    prefixMatches.forEach((candidate) => {
      unmatched.delete(candidate.id);
      matched.push({ ...candidate, method: "prefix" });
    });
  }

  return { matched, ambiguous, unmatched: [...unmatched.values()] };
}
