// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { replaceDiscoveryUrl } from "./discovery-url";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("replaceDiscoveryUrl", () => {
  it("should_replace_the_current_history_entry_without_adding_one", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const pushState = vi.spyOn(window.history, "pushState");
    const lengthBefore = window.history.length;

    replaceDiscoveryUrl("/?mode=buy&beds=2");

    expect(replaceState).toHaveBeenCalledWith(null, "", "/?mode=buy&beds=2");
    expect(pushState).not.toHaveBeenCalled();
    expect(window.history.length).toBe(lengthBefore);
    expect(window.location.search).toBe("?mode=buy&beds=2");
  });
});
