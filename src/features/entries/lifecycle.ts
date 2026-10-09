import "server-only";

import { z } from "zod";
import {
  requireEntryPoster, requireEntryReviewer, requireEntryPublicationEvidence,
  entryPublicationEvidenceSchema, type EntryPublicationEvidence,
} from "./access";
import {
  entryCategorySchema, entryContentSchema, entryDraftSchema, entryWindowState, parseEntrySubmission,
  type EntryCategory, type EntryContent, type EntryDraft,
} from "./schema";

export type EntryRevision = Readonly<{ id: string; content: EntryContent; submittedAt: string }>;
export type EntryReview = Readonly<{
  revisionId: string; decision: "approve" | "reject"; reviewerId: string; reviewedAt: string;
  reason: string | null; evidence: EntryPublicationEvidence | null;
}>;
export type EntryRecord = Readonly<{
  id: string; category: EntryCategory; posterId: string; version: number; draft: EntryDraft;
  revisions: readonly EntryRevision[]; reviews: readonly EntryReview[];
  pendingRevisionId: string | null; approvedRevisionId: string | null; withdrawnAt: string | null;
}>;
const uuid = z.string().uuid();
const version = z.number().int().min(1).max(2_147_483_646);

export class EntryConflictError extends Error {
  readonly code = "PT409";
  constructor() { super("Entry changed. Reload before saving."); this.name = "EntryConflictError"; }
}

function checkVersion(entry: EntryRecord, expected: number) {
  version.parse(entry.version); version.parse(expected);
  if (expected !== entry.version) throw new EntryConflictError();
}
async function requireOwner(entry: EntryRecord) {
  if (await requireEntryPoster(entry.category) !== entry.posterId) throw new Error("Entry owner access required");
}
function immutable(entry: EntryRecord): EntryRecord {
  return Object.freeze({ ...entry, revisions: Object.freeze([...entry.revisions]), reviews: Object.freeze([...entry.reviews]) });
}

// Internal domain records must come from a trusted persistence loader, never
// request JSON. These are not Server Actions or exposed mutation endpoints.
// The persistence step must recheck identity/capabilities and expected version
// atomically under database locks; this module alone is not concurrency/RLS proof.
export async function createEntry(id: string, category: EntryCategory): Promise<EntryRecord> {
  const posterId = await requireEntryPoster(entryCategorySchema.parse(category));
  uuid.parse(id);
  return immutable({ id, category, posterId, version: 1, draft: Object.freeze({}),
    revisions: [], reviews: [], pendingRevisionId: null, approvedRevisionId: null, withdrawnAt: null });
}

export async function saveEntryDraft(entry: EntryRecord, expectedVersion: number, draft: unknown) {
  await requireOwner(entry); checkVersion(entry, expectedVersion);
  return immutable({ ...entry, version: entry.version + 1, draft: Object.freeze(entryDraftSchema.parse(draft)) });
}

export async function submitEntry(entry: EntryRecord, expectedVersion: number, revisionId: string) {
  await requireOwner(entry); checkVersion(entry, expectedVersion); uuid.parse(revisionId);
  if (entry.pendingRevisionId) throw new Error("Entry already awaiting review");
  if (entry.revisions.some(revision => revision.id === revisionId)) throw new Error("Entry revision ID already used");
  const now = Date.now(), content = parseEntrySubmission(entry.draft, now);
  const revision = Object.freeze({ id: revisionId, content, submittedAt: new Date(now).toISOString() });
  return immutable({ ...entry, version: entry.version + 1, revisions: [...entry.revisions, revision],
    pendingRevisionId: revisionId, approvedRevisionId: null, withdrawnAt: null });
}

export async function reviewEntry(entry: EntryRecord, expectedVersion: number, revisionId: string,
  decision: "approve" | "reject", reason?: string) {
  const reviewerId = await requireEntryReviewer(); checkVersion(entry, expectedVersion);
  uuid.parse(revisionId); z.enum(["approve", "reject"]).parse(decision);
  const revision = entry.revisions.find(item => item.id === revisionId);
  if (entry.withdrawnAt || !revision || entry.pendingRevisionId !== revisionId) throw new Error("Entry revision is not awaiting review");
  const now = Date.now();
  if (now < Date.parse(revision.submittedAt)) throw new Error("Review predates submission");
  const correction = decision === "reject" ? z.string().trim().min(1).max(2000).parse(reason) : null;
  let evidence: EntryPublicationEvidence | null = null;
  if (decision === "approve") {
    parseEntrySubmission(revision.content, now);
    evidence = await requireEntryPublicationEvidence(entry.category, entry.id, revisionId);
    if (evidence.areaId !== revision.content.areaId) throw new Error("Revision place evidence mismatch");
  }
  const review = Object.freeze({ revisionId, decision, reviewerId, reviewedAt: new Date(now).toISOString(), reason: correction, evidence });
  return immutable({ ...entry, version: entry.version + 1, reviews: [...entry.reviews, review],
    pendingRevisionId: null, approvedRevisionId: decision === "approve" ? revisionId : null });
}

export async function withdrawEntry(entry: EntryRecord, expectedVersion: number) {
  await requireOwner(entry); checkVersion(entry, expectedVersion);
  if (entry.withdrawnAt) return entry;
  return immutable({ ...entry, version: entry.version + 1, pendingRevisionId: null,
    approvedRevisionId: null, withdrawnAt: new Date().toISOString() });
}

// Internal snapshot classification only. Fresh public eligibility lives in
// the database projection: Events display from approval until end; Tourism
// displays during its availability window. This helper is not a public read.
export function readConfirmedEntry(entry: EntryRecord, now = Date.now()) {
  if (!Number.isFinite(now)) return { state: "unavailable" as const };
  if (entry.withdrawnAt) return { state: "withdrawn" as const };
  if (entry.pendingRevisionId) return { state: "awaiting_review" as const };
  const revision = entry.revisions.find(item => item.id === entry.approvedRevisionId);
  const review = entry.reviews.find(item => item.revisionId === entry.approvedRevisionId && item.decision === "approve");
  const content = entryContentSchema.safeParse(revision?.content), proof = entryPublicationEvidenceSchema.safeParse(review?.evidence);
  if (!revision || !review || !content.success || !proof.success || proof.data.entryId !== entry.id
    || proof.data.revisionId !== revision.id || proof.data.category !== entry.category || proof.data.areaId !== content.data.areaId
    || !Number.isFinite(Date.parse(review.reviewedAt)) || Date.parse(review.reviewedAt) > now
    || !Number.isFinite(Date.parse(revision.submittedAt)) || Date.parse(review.reviewedAt) < Date.parse(revision.submittedAt)) {
    return { state: "unavailable" as const };
  }
  const state = entryWindowState(content.data, now);
  if (state === "unavailable" || state === "ended") return { state };
  return { state, entry: Object.freeze({ id: entry.id, category: entry.category, revisionId: revision.id,
    confirmedAt: review.reviewedAt, content: Object.freeze(content.data) }) };
}
