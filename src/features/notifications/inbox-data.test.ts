import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/profile/data", () => ({ getProfileNotificationsEventsApi: mocks.read }));
import { getNotificationInbox } from "./inbox-data";
const userId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { vi.resetAllMocks(); mocks.requireUser.mockResolvedValue({ user: { id: userId } }); });
describe("private notification inbox", () => {
  it("requires the cookie identity before reading and rejects caller-supplied recipient filters", async () => {
    expect((await getNotificationInbox({ recipientId: "someone-else" })).status).toBe("invalid");
    expect(mocks.requireUser).toHaveBeenCalledWith({ redirectTo: "/profile/notifications" });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("does not read when authentication rejects the request", async () => {
    mocks.requireUser.mockRejectedValue(new Error("redirect to auth"));
    await expect(getNotificationInbox({})).rejects.toThrow("redirect to auth");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns an unavailable state rather than an empty inbox or raw database error", async () => {
    mocks.read.mockResolvedValue({ data: null, error: { message: "private database diagnostic" } });
    expect(await getNotificationInbox({})).toEqual({ status: "unavailable", items: [], next: null });
    expect(mocks.read).toHaveBeenCalledWith(userId, undefined, 30, undefined);
  });
  it("paginates using the last visible timestamp and ID when timestamps tie", async () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({ id: `11111111-1111-4111-8111-${String(31-index).padStart(12,"0")}`, type: "incoming_call", payload: { message: "Fixture" }, read_at: null, created_at: "2026-10-02T12:00:00Z" }));
    mocks.read.mockResolvedValue({ data: rows, error: null });
    const page = await getNotificationInbox({});
    expect(page.items).toHaveLength(30);
    const last = rows[29]!;
    expect(page.next).toEqual({ before: last.created_at, beforeId: last.id });
    await getNotificationInbox(page.next);
    expect(mocks.read).toHaveBeenLastCalledWith(userId, last.created_at, 30, last.id);
  });
});
