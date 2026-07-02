import { describe, expect, it, vi } from "vitest";

import {
  APPLICATION_SUBMIT_TIMEOUT_MS,
  ApplicationSubmitTimeoutError,
  withApplicationSubmitTimeout,
} from "./submission-timeout";

describe("withApplicationSubmitTimeout", () => {
  it("resolves when application submission completes within 5s", async () => {
    await expect(withApplicationSubmitTimeout(Promise.resolve({ data: [{ result: "created" }] }))).resolves.toEqual({
      data: [{ result: "created" }],
    });
  });

  it("rejects when application submission exceeds 5s", async () => {
    vi.useFakeTimers();
    try {
      const promise = withApplicationSubmitTimeout(new Promise(() => undefined));
      const assertion = expect(promise).rejects.toBeInstanceOf(ApplicationSubmitTimeoutError);

      await vi.advanceTimersByTimeAsync(APPLICATION_SUBMIT_TIMEOUT_MS);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
