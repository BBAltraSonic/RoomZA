import { chipId, chipsFromParams, type SearchChip } from "../search-intent";

/** Chips from `kind:value` IDs, through the same address parsing the app uses. */
export function chipsFromIds(ids: readonly string[]): SearchChip[] {
  const params = new URLSearchParams();
  const types: string[] = [];
  const quick: string[] = [];
  for (const id of ids) {
    const separator = id.indexOf(":");
    const kind = id.slice(0, separator);
    const value = id.slice(separator + 1);
    if (kind === "type") types.push(value);
    else if (kind === "quick") quick.push(value);
    else if (kind === "flag") params.set(value, "1");
    else if (kind === "near") params.set("q", value);
    else if (kind === "area") params.set("area", value);
    else params.set(kind, value);
  }
  if (types.length) params.set("type", types.join(","));
  if (quick.length) params.set("quick", quick.join(","));
  return chipsFromParams(params);
}

export type CaseScore = { exact: boolean; missing: string[]; extra: string[] };

function normalize(id: string) {
  // Places compare loosely: "near:uwc" matches "near:UWC".
  return id.startsWith("near:") ? id.toLocaleLowerCase("en-ZA") : id;
}

/** Exact match on chips and gaps; the lists show what differed. */
export function scoreCase(expected: { chips: string[]; gaps?: string[] }, actual: { chips: SearchChip[]; gaps: string[] }): CaseScore {
  const want = new Set([...expected.chips.map(normalize), ...(expected.gaps ?? []).map((gap) => `gap:${gap}`)]);
  const got = new Set([...actual.chips.map((chip) => normalize(chipId(chip))), ...actual.gaps.map((gap) => `gap:${gap}`)]);
  const missing = [...want].filter((id) => !got.has(id));
  const extra = [...got].filter((id) => !want.has(id));
  return { exact: !missing.length && !extra.length, missing, extra };
}
