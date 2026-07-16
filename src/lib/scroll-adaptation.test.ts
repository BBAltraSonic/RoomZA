import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { deriveScrollAdaptation, scrollProgress } from "./scroll-adaptation";

describe("scroll adaptation", () => {
  it("keeps progress monotonic as scrollTop increases", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (clientHeight, extraHeight, a, b) => {
          const scrollHeight = clientHeight + extraHeight;
          const first = Math.min(a, b);
          const second = Math.max(a, b);

          expect(scrollProgress(first, scrollHeight, clientHeight)).toBeLessThanOrEqual(
            scrollProgress(second, scrollHeight, clientHeight),
          );
        },
      ),
    );
  });

  it("resets chrome to expanded at the top", () => {
    const state = deriveScrollAdaptation({
      scrollTop: 0,
      previousScrollTop: 400,
      scrollHeight: 1200,
      clientHeight: 400,
    });

    expect(state.chrome).toBe("expanded");
    expect(state.atStart).toBe(true);
  });

  it("restores chrome on upward scroll", () => {
    const state = deriveScrollAdaptation({
      scrollTop: 220,
      previousScrollTop: 360,
      scrollHeight: 1200,
      clientHeight: 400,
    });

    expect(state.direction).toBe("up");
    expect(state.chrome).toBe("compact");
  });

  it("focus and open locks force expanded chrome", () => {
    const state = deriveScrollAdaptation({
      scrollTop: 600,
      previousScrollTop: 0,
      scrollHeight: 1400,
      clientHeight: 400,
      focusLocked: true,
      openLocked: true,
    });

    expect(state.chrome).toBe("expanded");
  });

  it("neverHidden prevents hidden chrome", () => {
    const state = deriveScrollAdaptation({
      scrollTop: 800,
      previousScrollTop: 100,
      scrollHeight: 1600,
      clientHeight: 400,
      deltaTimeMs: 100,
      neverHidden: true,
    });

    expect(state.chrome).toBe("minimal");
  });

  it("reduced motion avoids hidden chrome", () => {
    const state = deriveScrollAdaptation({
      scrollTop: 800,
      previousScrollTop: 100,
      scrollHeight: 1600,
      clientHeight: 400,
      deltaTimeMs: 100,
      reducedMotion: true,
    });

    expect(state.chrome).toBe("compact");
  });
});
