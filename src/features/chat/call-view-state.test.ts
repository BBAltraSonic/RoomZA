import { describe, expect, it } from "vitest";

import {
    reconcileEndedSession,
    shouldShowActiveCall,
    shouldShowIncomingInvite,
} from "./call-view-state";
import type { CallStatus } from "./call-state";

const statuses: CallStatus[] = ["ringing", "active", "ended", "declined", "missed"];

describe("shouldShowActiveCall", () => {
    it("is true only for an active session", () => {
        for (const status of statuses) {
            expect(shouldShowActiveCall({ status })).toBe(status === "active");
        }
    });

    it("is false for a null session", () => {
        expect(shouldShowActiveCall(null)).toBe(false);
    });
});

describe("shouldShowIncomingInvite", () => {
    const callee = "callee-1";

    it("shows the invite only to the callee while ringing", () => {
        for (const status of statuses) {
            const session = { status, callee_id: callee };
            expect(shouldShowIncomingInvite(session, callee)).toBe(status === "ringing");
        }
    });

    it("never shows the invite to the caller (non-callee)", () => {
        expect(shouldShowIncomingInvite({ status: "ringing", callee_id: callee }, "caller-9")).toBe(false);
    });

    it("is false for a null session", () => {
        expect(shouldShowIncomingInvite(null, callee)).toBe(false);
    });
});

describe("reconcileEndedSession", () => {
    it("clears the session when the ended id matches", () => {
        expect(reconcileEndedSession({ id: "s1" }, "s1")).toBeNull();
    });

    it("keeps the session when a stale/other id ends", () => {
        const current = { id: "s2" };
        expect(reconcileEndedSession(current, "s1")).toBe(current);
    });

    it("is a no-op when there is no current session", () => {
        expect(reconcileEndedSession(null, "s1")).toBeNull();
    });
});
