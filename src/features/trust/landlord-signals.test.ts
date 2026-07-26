import { describe, expect, it } from "vitest";

import {
  formatPredictedResponseTime,
  formatResponseTime,
  predictResponseTimeSeconds,
  selectLandlordTrustSignals,
} from "./landlord-signals";

describe("formatResponseTime", () => {
  it("formats minutes, hours, and days without displaying zero minutes", () => {
    expect(formatResponseTime(0)?.full).toBe("Responds in 1 min");
    expect(formatResponseTime(18 * 60)?.full).toBe("Responds in 18 mins");
    expect(formatResponseTime(2 * 3600)?.full).toBe("Responds in 2 hrs");
    expect(formatResponseTime(2 * 86400)?.full).toBe("Responds in 2 days");
  });

  it("rejects invalid durations", () => {
    expect(formatResponseTime(-1)).toBeNull();
    expect(formatResponseTime(Number.NaN)).toBeNull();
  });
});

describe("selectLandlordTrustSignals", () => {
  it("enforces response, phone, email priority", () => {
    expect(selectLandlordTrustSignals({
      medianFirstResponseSeconds: 18 * 60,
      phoneVerified: true,
      emailVerified: true,
    }).map((signal) => signal.kind)).toEqual(["response_time", "phone_verified", "email_verified"]);
  });

  it("hides unavailable signals and never returns more than three", () => {
    expect(selectLandlordTrustSignals(null)).toEqual([]);
    expect(selectLandlordTrustSignals({
      medianFirstResponseSeconds: null,
      phoneVerified: false,
      emailVerified: true,
    }).map((signal) => signal.kind)).toEqual(["email_verified"]);
    expect(selectLandlordTrustSignals({
      medianFirstResponseSeconds: 60,
      phoneVerified: true,
      emailVerified: true,
    })).toHaveLength(3);
  });
});

describe("response-time prediction", () => {
  it("caps an available landlord at five minutes", () => {
    expect(predictResponseTimeSeconds({
      medianFirstResponseSeconds: 1800,
      presence: "available",
    })).toBe(300);
  });

  it("keeps the persisted median while offline", () => {
    expect(predictResponseTimeSeconds({
      medianFirstResponseSeconds: 900,
      presence: "offline",
    })).toBe(900);
  });

  it("formats prediction copy distinctly from historical evidence", () => {
    expect(formatPredictedResponseTime(300)?.full).toBe(
      "Likely reply in about 5 mins",
    );
  });
});
