import { describe, expect, it } from "vitest";
import { privateOfferStatus, type OwnedOffer } from "./workspace-contract";
import { ownedOfferStatusBatchSchema, ownedOfferStatusLabels } from "./owned-status-contract";
const id = "00000000-0000-4000-8000-000000000001";
const clock = "2026-10-02T10:00:00Z";
const summary = { offerId: id, version: 4, checkedAt: clock, status: "live", revisionId: id, confirmedAt: clock, startsAt: clock, endsAt: "2026-10-03T10:00:00Z" };
const offer: OwnedOffer = { id, version: 4, draft: {}, pendingRevisionId: null, withdrawnAt: null, updatedAt: clock };
describe("owned publication status", () => {
  it("distinguishes approval and removal from a private draft", () => {
    for (const [status, label] of Object.entries(ownedOfferStatusLabels)) {
      const [parsed] = ownedOfferStatusBatchSchema.parse([{ ...summary, status }]);
      expect(privateOfferStatus({ ...offer, publication: parsed })).toBe(label);
    }
    expect(privateOfferStatus(offer)).toBe("Private draft");
  });
  it("gives local submission and withdrawal precedence over earlier approval", () => {
    const [publication] = ownedOfferStatusBatchSchema.parse([summary]);
    expect(privateOfferStatus({ ...offer, publication, pendingRevisionId: id })).toBe("Awaiting admin confirmation");
    expect(privateOfferStatus({ ...offer, publication, withdrawnAt: clock })).toBe("Withdrawn");
  });
  it("rejects private admin metadata and overlong batches", () => {
    expect(ownedOfferStatusBatchSchema.safeParse([{ ...summary, verificationNote: "private note" }]).success).toBe(false);
    expect(ownedOfferStatusBatchSchema.safeParse(Array(21).fill(summary)).success).toBe(false);
  });
});
