import type { OwnedEntryDraft } from "./intake-contract";

export function privateEntryStatus(entry: Pick<OwnedEntryDraft, "withdrawnAt" | "pendingRevisionId">) {
  if (entry.withdrawnAt) return "Withdrawn";
  if (entry.pendingRevisionId) return "Awaiting admin review";
  return "Private draft";
}
