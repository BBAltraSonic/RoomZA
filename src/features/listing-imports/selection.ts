import type { ImportSelection } from "./types";

export const LEGACY_IMPORT_REVIEW_MESSAGE =
  "These older results need a fresh selection review before applying changes. Existing drafts and history are saved. Review any linked listings or start a new import for the remaining changes.";

function ordered(values: readonly string[] | undefined) {
  return [...new Set(values ?? [])].sort();
}

function selectionKey(selection: ImportSelection) {
  if (selection.mode === "explicit") {
    return JSON.stringify({ mode: selection.mode, included: ordered(selection.included) });
  }
  return JSON.stringify({
    mode: selection.mode,
    excluded: ordered(selection.excluded),
    query: selection.filter.query?.toLowerCase() ?? "",
    states: ordered(selection.filter.states),
    severities: ordered(selection.filter.severities),
    duplicateOnly: Boolean(selection.filter.duplicateOnly),
  });
}

/** Membership is unchanged by object key order or the order of filter/ID sets. */
export function sameImportSelection(left: ImportSelection, right: ImportSelection) {
  return selectionKey(left) === selectionKey(right);
}
