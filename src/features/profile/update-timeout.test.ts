import { describe, expect, it, vi } from "vitest";

import {
  PROFILE_UPDATE_TIMEOUT_MS,
  ProfileUpdateTimeoutError,
  withProfileUpdateTimeout,
} from "./update-timeout";

describe("withProfileUpdateTimeout", () => {
  it("resolves when the profile update completes within 2s", async () => {
    await expect(withProfileUpdateTimeout(Promise.resolve({ error: null }))).resolves.toEqual({ error: null });
  });

  it("rejects when the profile update exceeds 2s", async () => {
    vi.useFakeTimers();
    try {
      const promise = withProfileUpdateTimeout(new Promise(() => undefined));
      const assertion = expect(promise).rejects.toBeInstanceOf(ProfileUpdateTimeoutError);

      await vi.advanceTimersByTimeAsync(PROFILE_UPDATE_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
