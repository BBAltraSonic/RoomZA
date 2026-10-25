import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./access", () => ({ getImportAccess: vi.fn() }));
vi.mock("./review", () => ({ applyImportReview: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: vi.fn() }));

import { toJobSummary } from "./repository";
import { LEGACY_IMPORT_REVIEW_MESSAGE } from "./selection";

const job = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  stage: "confirming", version: 3, total_rows: 2, committed_rows: 1, failed_rows: 0,
  message_code: "drafts_committed", message_detail: "Drafts saved.", prepared_selection: null,
} as Parameters<typeof toJobSummary>[0];

it("explains a missing protected preparation receipt before legacy final confirmation", () => {
  const summary = toJobSummary(job);
  expect(summary.messageCode).toBe("selection_review_required");
  expect(summary.messageDetail).toBe(LEGACY_IMPORT_REVIEW_MESSAGE);
  expect(summary.committedRows).toBe(1);
  expect(summary).not.toHaveProperty("prepared_selection");
  expect(job.message_code).toBe("drafts_committed");
});

it("keeps current prepared confirmation results intact", () => {
  const summary = toJobSummary({ ...job, prepared_selection: { mode: "explicit", included: [] } });
  expect(summary.messageCode).toBe("drafts_committed");
  expect(summary.messageDetail).toBe("Drafts saved.");
});

it("preserves completed legacy rollback outcomes", () => {
  const summary = toJobSummary({ ...job, stage: "complete", message_code: "rollback_incomplete", message_detail: "Retry cleanup." });
  expect(summary.messageCode).toBe("rollback_incomplete");
  expect(summary.messageDetail).toBe("Retry cleanup.");
});
