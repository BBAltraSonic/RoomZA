import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the conversation call server actions.
 *
 * Unlike the older re-implementation-style tests, these mock the Supabase
 * client and notification outbox so the ACTUAL code in `call-actions.ts` runs:
 * the auth guard, the RPC-result → ActionResult mapping, and the terminal
 * side effects (caller notification + system message).
 */

// --- Mocks ---------------------------------------------------------------

const createClientMock = vi.fn();
const enqueueNotificationEventMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => createClientMock(),
}));

vi.mock("@/features/notifications/outbox", () => ({
    enqueueNotificationEvent: (id: string) => enqueueNotificationEventMock(id),
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
    declineCall,
    endCall,
    getActiveCall,
    joinCall,
    startCall,
} from "./call-actions";

// --- Chainable Supabase mock --------------------------------------------

type Store = {
    user: { id: string } | null;
    rpc: Record<string, { data: unknown; error: { message: string } | null }>;
    rows: Record<string, unknown>;
    errors: Record<string, { message: string } | null>;
    inserts: Record<string, unknown[]>;
};

function makeClient(partial: Partial<Store>) {
    const store: Store = {
        user: "user" in partial ? (partial.user ?? null) : { id: "user-1" },
        rpc: partial.rpc ?? {},
        rows: partial.rows ?? {},
        errors: partial.errors ?? {},
        inserts: {},
    };

    class QB {
        constructor(private table: string) {}
        select() { return this; }
        eq() { return this; }
        in() { return this; }
        insert(payload: unknown) {
            (store.inserts[this.table] ??= []).push(payload);
            return this;
        }
        single() { return Promise.resolve(this.result()); }
        maybeSingle() { return Promise.resolve(this.result()); }
        private result() {
            return { data: store.rows[this.table] ?? null, error: store.errors[this.table] ?? null };
        }
        // Awaiting the builder directly (e.g. messages insert with no select).
        then(resolve: (v: { data: null; error: { message: string } | null }) => unknown, reject?: (e: unknown) => unknown) {
            return Promise.resolve({ data: null, error: store.errors[this.table] ?? null }).then(resolve, reject);
        }
    }

    const client = {
        store,
        auth: { getUser: () => Promise.resolve({ data: { user: store.user } }) },
        rpc: (name: string) => Promise.resolve(store.rpc[name] ?? { data: null, error: null }),
        from: (table: string) => new QB(table),
    };

    return client;
}

function use(partial: Partial<Store>) {
    createClientMock.mockResolvedValue(makeClient(partial));
}

beforeEach(() => {
    createClientMock.mockReset();
    enqueueNotificationEventMock.mockClear();
});

// --- startCall -----------------------------------------------------------

describe("startCall", () => {
    it("fails when unauthenticated", async () => {
        use({ user: null });
        const result = await startCall("conv-1");
        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("signed in") });
    });

    it("maps access_denied from the RPC", async () => {
        use({ rpc: { start_call_session: { data: [{ result: "access_denied" }], error: null } } });
        const result = await startCall("conv-1");
        expect(result).toEqual({ success: false, error: "You are not part of this conversation." });
    });

    it("maps the single-active-call invariant to call_in_progress", async () => {
        use({ rpc: { start_call_session: { data: [{ result: "call_in_progress" }], error: null } } });
        const result = await startCall("conv-1");
        expect(result).toEqual({ success: false, error: "A call is already active in this conversation." });
    });

    it("returns the started session and notifies the callee", async () => {
        const session = {
            id: "sess-1",
            callee_id: "callee-9",
            conversation_id: "conv-1",
            listing_id: "listing-1",
        };
        const client = makeClient({
            rpc: { start_call_session: { data: [{ result: "started", session_id: "sess-1" }], error: null } },
            rows: { call_sessions: session, notification_events: { id: "notif-1" } },
        });
        createClientMock.mockResolvedValue(client);

        const result = await startCall("conv-1");

        expect(result.success).toBe(true);
        expect(result.success && result.data.session.id).toBe("sess-1");

        // Callee was notified through the outbox (Req 6.1).
        const notif = client.store.inserts.notification_events?.[0] as { recipient_id: string; idempotency_key: string } | undefined;
        expect(notif?.recipient_id).toBe("callee-9");
        expect(notif?.idempotency_key).toBe("incoming_call:ringing:sess-1");
        expect(enqueueNotificationEventMock).toHaveBeenCalledWith("notif-1");
    });
});

// --- transition guards ---------------------------------------------------

describe("joinCall", () => {
    it("surfaces invalid_transition as a benign error", async () => {
        use({ rpc: { end_call_session: { data: [{ result: "invalid_transition" }], error: null } } });
        const result = await joinCall("sess-1");
        expect(result).toEqual({ success: false, error: "This call is no longer available." });
    });

    it("maps access_denied for a non-participant", async () => {
        use({ rpc: { end_call_session: { data: [{ result: "access_denied" }], error: null } } });
        const result = await joinCall("sess-1");
        expect(result).toEqual({ success: false, error: "You are not part of this conversation." });
    });

    it("returns the new status on a legal join", async () => {
        use({ rpc: { end_call_session: { data: [{ result: "updated", new_status: "active" }], error: null } } });
        const result = await joinCall("sess-1");
        expect(result).toEqual({ success: true, data: { status: "active" } });
    });
});

// --- declineCall side effects -------------------------------------------

describe("declineCall", () => {
    it("notifies the CALLER and records a declined system message", async () => {
        const client = makeClient({
            rpc: { end_call_session: { data: [{ result: "updated", new_status: "declined" }], error: null } },
            rows: {
                call_sessions: {
                    caller_id: "caller-7",
                    conversation_id: "conv-1",
                    listing_id: "listing-1",
                    status: "declined",
                    answered_at: null,
                },
                notification_events: { id: "notif-2" },
            },
        });
        createClientMock.mockResolvedValue(client);

        const result = await declineCall("sess-1");
        expect(result).toEqual({ success: true, data: { status: "declined" } });

        const notif = client.store.inserts.notification_events?.[0] as { recipient_id: string; idempotency_key: string } | undefined;
        expect(notif?.recipient_id).toBe("caller-7");
        expect(notif?.idempotency_key).toBe("incoming_call:declined:sess-1");

        const message = client.store.inserts.messages?.[0] as { content: string } | undefined;
        expect(message?.content).toBe("Video call declined.");
    });

    it("treats a noop (already terminal) as success and is idempotent", async () => {
        const client = makeClient({
            rpc: { end_call_session: { data: [{ result: "noop", new_status: "declined" }], error: null } },
            rows: { call_sessions: { caller_id: "caller-7", conversation_id: "conv-1", listing_id: "listing-1", status: "declined", answered_at: null }, notification_events: { id: "n" } },
        });
        createClientMock.mockResolvedValue(client);

        const result = await declineCall("sess-1");

        expect(result.success).toBe(true);
        expect(client.store.inserts.messages).toBeUndefined();
        expect(client.store.inserts.notification_events).toBeUndefined();
        expect(enqueueNotificationEventMock).not.toHaveBeenCalled();
    });
});

// --- endCall side effects ------------------------------------------------

describe("endCall", () => {
    it("missed timeout notifies the caller with a missed message", async () => {
        const client = makeClient({
            rpc: { end_call_session: { data: [{ result: "updated", new_status: "missed" }], error: null } },
            rows: {
                call_sessions: { caller_id: "caller-7", conversation_id: "conv-1", listing_id: "listing-1", status: "missed", answered_at: null },
                notification_events: { id: "notif-3" },
            },
        });
        createClientMock.mockResolvedValue(client);

        const result = await endCall("sess-1", "missed");
        expect(result).toEqual({ success: true, data: { status: "missed" } });

        const notif = client.store.inserts.notification_events?.[0] as { recipient_id: string } | undefined;
        expect(notif?.recipient_id).toBe("caller-7");
        expect((client.store.inserts.messages?.[0] as { content: string }).content).toBe("Missed video call.");
    });

    it("a normal end of an answered call records completed and does NOT notify", async () => {
        const client = makeClient({
            rpc: { end_call_session: { data: [{ result: "updated", new_status: "ended" }], error: null } },
            rows: {
                call_sessions: { caller_id: "caller-7", conversation_id: "conv-1", listing_id: "listing-1", status: "ended", answered_at: new Date().toISOString() },
            },
        });
        createClientMock.mockResolvedValue(client);

        const result = await endCall("sess-1");
        expect(result).toEqual({ success: true, data: { status: "ended" } });

        // ended (not missed/declined) → no caller notification.
        expect(client.store.inserts.notification_events).toBeUndefined();
        expect((client.store.inserts.messages?.[0] as { content: string }).content).toBe("Video call ended.");
    });

    it("does not duplicate the transcript message for an already-ended call", async () => {
        const client = makeClient({
            rpc: { end_call_session: { data: [{ result: "noop", new_status: "ended" }], error: null } },
            rows: {
                call_sessions: { caller_id: "caller-7", conversation_id: "conv-1", listing_id: "listing-1", status: "ended", answered_at: new Date().toISOString() },
            },
        });
        createClientMock.mockResolvedValue(client);

        const result = await endCall("sess-1");

        expect(result).toEqual({ success: true, data: { status: "ended" } });
        expect(client.store.inserts.messages).toBeUndefined();
        expect(client.store.inserts.notification_events).toBeUndefined();
    });
});

// --- getActiveCall -------------------------------------------------------

describe("getActiveCall", () => {
    it("returns the active session when one exists", async () => {
        const session = { id: "sess-1", status: "active" };
        use({ rows: { call_sessions: session } });
        const result = await getActiveCall("conv-1");
        expect(result).toEqual({ success: true, data: { session } });
    });

    it("returns null when there is no active call", async () => {
        use({ rows: {} });
        const result = await getActiveCall("conv-1");
        expect(result).toEqual({ success: true, data: { session: null } });
    });

    it("fails when unauthenticated", async () => {
        use({ user: null });
        const result = await getActiveCall("conv-1");
        expect(result.success).toBe(false);
    });
});
