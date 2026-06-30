import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
    callOutcome,
    isTerminal,
    nextStatus,
    NON_TERMINAL,
    TERMINAL,
    type CallAction,
    type CallStatus,
} from "./call-state";

const statuses: CallStatus[] = ["ringing", "active", "ended", "declined", "missed"];
const actions: CallAction[] = ["join", "decline", "missed", "end"];

const arbStatus = fc.constantFrom(...statuses);
const arbAction = fc.constantFrom(...actions);

describe("call-state: isTerminal", () => {
    it("classifies every status as exactly one of terminal / non-terminal", () => {
        for (const status of statuses) {
            expect(isTerminal(status)).toBe(TERMINAL.includes(status));
            expect(NON_TERMINAL.includes(status)).toBe(!isTerminal(status));
        }
    });
});

describe("call-state: nextStatus", () => {
    // Property 1: Terminal states are absorbing.
    it("P1 terminal states absorb every action (always null)", () => {
        fc.assert(
            fc.property(fc.constantFrom(...TERMINAL), arbAction, (status, action) => {
                expect(nextStatus(status, action)).toBeNull();
            }),
        );
    });

    // Property 2: Legal transitions advance toward termination.
    it("P2 transitions only advance, never loop back to a non-terminal", () => {
        fc.assert(
            fc.property(arbStatus, arbAction, (status, action) => {
                const next = nextStatus(status, action);
                if (next === null) return;

                // Never returns the same non-terminal status.
                expect(next).not.toBe(status);
                // Never moves active back to ringing.
                expect(next === "ringing").toBe(false);

                if (status === "ringing") {
                    expect(["active", "declined", "missed", "ended"]).toContain(next);
                }
                if (status === "active") {
                    expect(next).toBe("ended");
                }
            }),
        );
    });

    // Property 3: `join` is the only path to `active`.
    it("P3 a status becomes active iff it was ringing and the action was join", () => {
        fc.assert(
            fc.property(arbStatus, arbAction, (status, action) => {
                const becameActive = nextStatus(status, action) === "active";
                expect(becameActive).toBe(status === "ringing" && action === "join");
            }),
        );
    });

    it("maps each legal move from ringing explicitly", () => {
        expect(nextStatus("ringing", "join")).toBe("active");
        expect(nextStatus("ringing", "decline")).toBe("declined");
        expect(nextStatus("ringing", "missed")).toBe("missed");
        expect(nextStatus("ringing", "end")).toBe("ended");
    });

    it("only allows end from active", () => {
        expect(nextStatus("active", "end")).toBe("ended");
        expect(nextStatus("active", "join")).toBeNull();
        expect(nextStatus("active", "decline")).toBeNull();
        expect(nextStatus("active", "missed")).toBeNull();
    });
});

describe("call-state: callOutcome", () => {
    // Property 4: Outcome classification matches answered history.
    it("P4 returns completed iff the call was ever answered", () => {
        fc.assert(
            fc.property(
                arbStatus,
                fc.option(fc.date({ noInvalidDate: true }).map((d) => d.toISOString()), { nil: null }),
                (status, answeredAt) => {
                    const outcome = callOutcome({ status, answeredAt });
                    expect(outcome === "completed").toBe(answeredAt !== null);
                },
            ),
        );
    });

    it("classifies unanswered terminal states", () => {
        expect(callOutcome({ status: "missed", answeredAt: null })).toBe("missed");
        expect(callOutcome({ status: "declined", answeredAt: null })).toBe("declined");
        expect(callOutcome({ status: "ended", answeredAt: null })).toBe("cancelled");
    });

    it("treats any answered session as completed regardless of terminal status", () => {
        const answeredAt = new Date().toISOString();
        expect(callOutcome({ status: "ended", answeredAt })).toBe("completed");
        expect(callOutcome({ status: "missed", answeredAt })).toBe("completed");
    });
});
