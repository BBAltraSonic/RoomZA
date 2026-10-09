import { describe, expect, it } from "vitest";
import { notificationForDisplay, notificationInboxQuerySchema, type NotificationInboxRow } from "./inbox-contract";

const id = "11111111-1111-4111-8111-111111111111";
const row: NotificationInboxRow = { id, type: "incoming_call", payload: { message: "A fixture call", conversationId: id, recipient_id: "private", url: "https://elsewhere.invalid" }, read_at: null, created_at: "2026-10-02T12:00:00Z" };
describe("notification display and cursor safety", () => {
  it("projects display data and constructs a known internal target without copying payload fields", () => {
    const item = notificationForDisplay(row);
    expect(item).toEqual({ id, title: "Call update", message: "A fixture call", createdAt: row.created_at, unread: true, href: `/messages/${id}` });
    expect(JSON.stringify(item)).not.toContain("private");
    expect(JSON.stringify(item)).not.toContain("elsewhere");
  });
  it.each([null, [], "raw", { message: 7, conversationId: "//elsewhere.invalid" }])("handles malformed payloads without an unsafe link", (payload) => {
    expect(notificationForDisplay({ ...row, payload })).toMatchObject({ href: null, message: "You have a new account update." });
  });
  it("uses only valid stored IDs for supported notification targets", () => {
    expect(notificationForDisplay({ ...row, type: "showing_request", payload: { listingId: id } }).href).toBe(`/listing/${id}`);
    expect(notificationForDisplay({ ...row, type: "admin_alert", payload: { caseId: id } }).href).toBe(`/admin/reports/${id}`);
    expect(notificationForDisplay({ ...row, read_at: row.created_at }).unread).toBe(false);
  });
  it("accepts a paired stable cursor and rejects partial, injected or extra cursor fields", () => {
    expect(notificationInboxQuerySchema.safeParse({}).success).toBe(true);
    expect(notificationInboxQuerySchema.safeParse({ before: row.created_at, beforeId: id }).success).toBe(true);
    for (const input of [{ before: row.created_at }, { beforeId: id }, { before: "now),recipient_id.neq.null", beforeId: id }, { recipientId: id }]) expect(notificationInboxQuerySchema.safeParse(input).success).toBe(false);
  });
});
