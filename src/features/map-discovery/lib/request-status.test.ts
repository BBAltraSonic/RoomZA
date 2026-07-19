import { describe, expect, it } from "vitest";

import { discoveryRequestErrorMessage } from "./request-status";

describe("discoveryRequestErrorMessage", () => {
  it("keeps offline, rate-limit, validation, and server failures distinct", () => {
    expect(discoveryRequestErrorMessage("server_error", false)).toContain("offline");
    expect(discoveryRequestErrorMessage("rate_limited", true)).toContain("temporarily limited");
    expect(discoveryRequestErrorMessage("validation_failed", true)).toContain("Recenter");
    expect(discoveryRequestErrorMessage("server_error", true)).toContain("previous results");
  });
});
