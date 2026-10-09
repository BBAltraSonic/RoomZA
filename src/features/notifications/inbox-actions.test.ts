import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), createClient: vi.fn(), revalidatePath: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), is: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { markNotificationRead } from "./inbox-actions";

const id = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle, update: mocks.update, is: mocks.is };
  mocks.from.mockReturnValue(query);
  for (const method of [mocks.select, mocks.eq, mocks.update]) method.mockReturnValue(query);
  mocks.requireUser.mockResolvedValue({ user: { id: userId } });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  mocks.maybeSingle.mockResolvedValue({ data: { id, read_at: null }, error: null });
  mocks.is.mockResolvedValue({ error: null });
});

describe("mark own notification read", () => {
  it("rejects malformed identifiers before accessing storage", async () => {
    expect((await markNotificationRead({ id, recipientId: userId })).success).toBe(false);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("requires authentication before reading or writing", async () => {
    mocks.requireUser.mockRejectedValue(new Error("auth redirect"));
    await expect(markNotificationRead(id)).rejects.toThrow("auth redirect");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("does not update an absent or other-recipient row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await markNotificationRead(id)).success).toBe(false);
    expect(mocks.eq).toHaveBeenCalledWith("recipient_id", userId);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("changes only read state for the session recipient and refreshes both screens", async () => {
    expect((await markNotificationRead(id)).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(mocks.eq.mock.calls).toEqual([["id", id], ["recipient_id", userId], ["id", id], ["recipient_id", userId]]);
    expect(mocks.is).toHaveBeenCalledWith("read_at", null);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/profile/notifications"], ["/profile"]]);
  });
  it("preserves the original timestamp when an already-read request is retried", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id, read_at: "2026-10-02T12:00:00Z" }, error: null });
    expect((await markNotificationRead(id)).success).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["read", "update"])("returns a safe failure on a %s database error", async (stage) => {
    const error = { message: "private database diagnostic" };
    if (stage === "read") mocks.maybeSingle.mockResolvedValue({ data: null, error });
    else mocks.is.mockResolvedValue({ error });
    expect(await markNotificationRead(id)).toEqual({ success: false, error: "That notification could not be updated." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
