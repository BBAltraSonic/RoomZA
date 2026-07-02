import { describe, expect, it, vi } from "vitest";

import {
  FAVORITE_STATE_TIMEOUT_MS,
  FavoriteMutationTimeoutError,
  withFavoriteMutationTimeout,
} from "./favorites";

describe("withFavoriteMutationTimeout", () => {
  it("resolves when the favorite mutation completes within 2s", async () => {
    await expect(withFavoriteMutationTimeout(Promise.resolve({ error: null }))).resolves.toEqual({ error: null });
  });

  it("rejects when the favorite mutation exceeds the 2s reflection window", async () => {
    vi.useFakeTimers();
    try {
      const promise = withFavoriteMutationTimeout(new Promise(() => undefined));
      const assertion = expect(promise).rejects.toBeInstanceOf(FavoriteMutationTimeoutError);

      await vi.advanceTimersByTimeAsync(FAVORITE_STATE_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
