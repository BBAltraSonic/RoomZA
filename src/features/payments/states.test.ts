import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  DEPOSIT_STATES,
  autoReleaseAt,
  contestDeadline,
  isPermittedDepositTransition,
  isTerminalDepositState,
  moveInStart,
  permittedDepositTransitions,
  renterCancellationOutcome,
  type DepositState,
} from "./states";

describe("deposit transitions", () => {
  it("should allow exactly the transitions in the proposal's state table", () => {
    const expected: Record<DepositState, DepositState[]> = {
      awaiting_payment: ["held", "cancelled"],
      held: ["releasing", "refunding", "disputed"],
      disputed: ["releasing", "refunding"],
      releasing: ["released"],
      released: [],
      refunding: ["refunded"],
      refunded: [],
      cancelled: [],
    };
    for (const state of DEPOSIT_STATES) {
      expect(permittedDepositTransitions(state)).toEqual(expected[state]);
    }
  });

  it("should never leave a final state or stay in place", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DEPOSIT_STATES), fc.constantFrom(...DEPOSIT_STATES), (from, to) => {
        expect(isPermittedDepositTransition(from, to)).toBe(permittedDepositTransitions(from).includes(to));
        if (isTerminalDepositState(from) || from === to) {
          expect(isPermittedDepositTransition(from, to)).toBe(false);
        }
      }),
    );
  });

  it("should treat released, refunded and cancelled as final", () => {
    expect(DEPOSIT_STATES.filter(isTerminalDepositState)).toEqual(["released", "refunded", "cancelled"]);
  });

  it("should never pay out a deposit that was never held", () => {
    expect(isPermittedDepositTransition("awaiting_payment", "releasing")).toBe(false);
    expect(isPermittedDepositTransition("awaiting_payment", "refunding")).toBe(false);
    expect(isPermittedDepositTransition("cancelled", "held")).toBe(false);
  });
});

describe("move-in timing", () => {
  // South Africa is UTC+2 all year, so 15 December starts at 22:00 UTC on the 14th.
  it("should start the move-in date at midnight South African time", () => {
    expect(moveInStart("2026-12-15").toISOString()).toBe("2026-12-14T22:00:00.000Z");
  });

  it("should reject a move-in date that is not a calendar date", () => {
    expect(() => moveInStart("15/12/2026")).toThrow(RangeError);
    expect(() => moveInStart("2026-02-30")).toThrow(RangeError);
  });

  it("should release automatically 48 hours after the move-in date ends", () => {
    expect(autoReleaseAt("2026-12-15").toISOString()).toBe("2026-12-17T22:00:00.000Z");
  });

  it("should refund immediately when the renter cancels before the move-in date", () => {
    expect(renterCancellationOutcome("2026-12-15", new Date("2026-12-14T21:59:59.999Z"))).toBe("refund_now");
  });

  it("should open the owner's contest window when the renter cancels on or after the move-in date", () => {
    expect(renterCancellationOutcome("2026-12-15", new Date("2026-12-14T22:00:00.000Z"))).toBe(
      "owner_contest_window",
    );
    expect(renterCancellationOutcome("2026-12-15", new Date("2026-12-16T09:00:00.000Z"))).toBe(
      "owner_contest_window",
    );
  });

  it("should give the owner 24 hours to contest", () => {
    expect(contestDeadline(new Date("2026-12-16T09:00:00.000Z")).toISOString()).toBe("2026-12-17T09:00:00.000Z");
  });
});
