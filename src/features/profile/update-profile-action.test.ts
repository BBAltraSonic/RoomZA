import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUser: () => mocks.requireUser(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mocks.revalidatePath(path),
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { updateProfileAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({
    user: { id: "user-1" },
    profile: { phone: "+27 82 000 0000", role: "renter" },
  });
});

describe("updateProfileAction", () => {
  it("updates the profile phone and revalidates within the confirmation path", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq }));
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== "profiles") throw new Error(`Unexpected table ${table}`);
        return { update };
      }),
    });
    const formData = new FormData();
    formData.set("phone", "+27 82 111 1111");

    const startedAt = performance.now();
    const result = await updateProfileAction({ success: false, message: "" }, formData);
    const elapsedMs = performance.now() - startedAt;

    expect(result).toEqual({ success: true, message: "Profile updated successfully." });
    expect(elapsedMs).toBeLessThan(2000);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ phone: "+27 82 111 1111" }));
    expect(eq).toHaveBeenCalledWith("id", "user-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });
});
