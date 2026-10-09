import { describe, expect, it } from "vitest";
import { confirmedOfferQueueSchema } from "./confirmed-contract";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", now = "2026-10-02T10:00:00Z";
const row = { offerId: id, version: 5, revisionId: id, title: "Reviewed title", shopName: "Reviewed shop", confirmedAt: now, publicStatus: "live" };
describe("confirmed reviewer list boundary", () => {
  it("accepts current versions and only bounded current public states", () => {
    for (const publicStatus of ["live", "scheduled", "expired", "unavailable"]) expect(confirmedOfferQueueSchema.safeParse({ checkedAt: now, items: [{ ...row, publicStatus }], nextCursor: null }).success).toBe(true);
    expect(confirmedOfferQueueSchema.safeParse({ checkedAt: now, items: [{ ...row, publicStatus: "pending" }], nextCursor: null }).success).toBe(false);
  });
  it("rejects private drafts, contact and permission evidence instead of forwarding them", () => {
    for (const extra of [{ draft: { title: "Private" } }, { posterEmail: "private@example.com" }, { permissionReference: "Private proof" }]) expect(confirmedOfferQueueSchema.safeParse({ checkedAt: now, items: [{ ...row, ...extra }], nextCursor: null }).success).toBe(false);
  });
  it("caps list pages and requires complete cursor identity/time", () => {
    expect(confirmedOfferQueueSchema.safeParse({ checkedAt: now, items: Array(21).fill(row), nextCursor: null }).success).toBe(false);
    expect(confirmedOfferQueueSchema.safeParse({ checkedAt: now, items: [row], nextCursor: { confirmedAt: now } }).success).toBe(false);
  });
});
