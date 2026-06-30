import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionFailure, actionSuccess } from "@/lib/action-result";

/**
 * Funnel test for the listing-card video-call CTA (Requirements 5.1, 5.2, 5.4;
 * spec tasks 5.5 / 8.3).
 *
 * Runs the real `requestListingVideoCall`, which resolves (or creates) the
 * inquiry conversation via `getOrCreateInquiryConversation` and then starts a
 * call through the shared `startCall` path. The Supabase client and `startCall`
 * are mocked so the actual funnel/branching logic executes.
 */

const createClientMock = vi.fn();
const startCallMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: () => createClientMock(),
}));

vi.mock("@/features/notifications/outbox", () => ({
    enqueueNotificationEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
    requireRole: vi.fn(),
    requireUser: vi.fn(),
}));

vi.mock("./call-actions", () => ({
    startCall: (conversationId: string) => startCallMock(conversationId),
}));

import { requestListingVideoCall } from "./actions";

type Store = {
    user: { id: string } | null;
    rows: Record<string, unknown>;
};

function makeClient(store: Store) {
    class QB {
        constructor(private table: string) {}
        select() { return this; }
        eq() { return this; }
        insert() { return this; }
        single() { return Promise.resolve({ data: store.rows[this.table] ?? null, error: null }); }
        maybeSingle() { return Promise.resolve({ data: store.rows[this.table] ?? null, error: null }); }
    }
    return {
        auth: { getUser: () => Promise.resolve({ data: { user: store.user } }) },
        from: (table: string) => new QB(table),
    };
}

function use(store: Store) {
    createClientMock.mockResolvedValue(makeClient(store));
}

beforeEach(() => {
    createClientMock.mockReset();
    startCallMock.mockReset();
});

describe("requestListingVideoCall", () => {
    it("rejects calling about your own listing and never starts a call (Req 5.4)", async () => {
        use({
            user: { id: "owner-1" },
            rows: { listings: { landlord_id: "owner-1" } },
        });

        const result = await requestListingVideoCall("listing-1");

        expect(result.success).toBe(false);
        expect(result).toMatchObject({ error: expect.stringContaining("your own listing") });
        expect(startCallMock).not.toHaveBeenCalled();
    });

    it("resolves the inquiry conversation and starts a call through the shared path (Req 5.1, 5.2)", async () => {
        use({
            user: { id: "renter-1" },
            rows: {
                listings: { landlord_id: "landlord-9" },
                conversations: { id: "conv-77" },
            },
        });
        const session = { id: "sess-1", conversation_id: "conv-77" };
        startCallMock.mockResolvedValue(actionSuccess({ session }));

        const result = await requestListingVideoCall("listing-1");

        expect(startCallMock).toHaveBeenCalledWith("conv-77");
        expect(result).toEqual({ success: true, data: { conversationId: "conv-77", session } });
    });

    it("propagates a startCall failure (e.g. call already in progress)", async () => {
        use({
            user: { id: "renter-1" },
            rows: {
                listings: { landlord_id: "landlord-9" },
                conversations: { id: "conv-77" },
            },
        });
        startCallMock.mockResolvedValue(actionFailure("A call is already active in this conversation."));

        const result = await requestListingVideoCall("listing-1");

        expect(result).toEqual({ success: false, error: "A call is already active in this conversation." });
    });

    it("fails when the conversation cannot be resolved (unauthenticated)", async () => {
        use({ user: null, rows: {} });

        const result = await requestListingVideoCall("listing-1");

        expect(result.success).toBe(false);
        expect(startCallMock).not.toHaveBeenCalled();
    });
});
