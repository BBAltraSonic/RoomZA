import { describe, expect, it, vi } from "vitest";

const permanentRedirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  permanentRedirect: permanentRedirectMock,
}));

import JourneyPage from "./page";

describe("legacy journey route", () => {
  it("redirects existing links to the Applications progress view", async () => {
    await JourneyPage();
    expect(permanentRedirectMock).toHaveBeenCalledWith("/applications?view=progress");
  });
});
