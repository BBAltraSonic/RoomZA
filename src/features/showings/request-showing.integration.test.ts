import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enqueueNotificationEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/notifications/outbox", () => ({
  enqueueNotificationEvent: (id: string) => mocks.enqueueNotificationEvent(id),
}));

import { acceptShowing, requestShowing } from "./actions";

const renterId = "550e8400-e29b-41d4-a716-446655440010";
const listingId = "550e8400-e29b-41d4-a716-446655440011";
const landlordId = "550e8400-e29b-41d4-a716-446655440012";
const requestId = "550e8400-e29b-41d4-a716-446655440013";

type RpcResult = { data: unknown; error: { message: string } | null };

function createSupabaseMock({
  userId = renterId,
  requestRpc,
  respondRpc,
  requestRow = {
    id: requestId,
    listing_id: listingId,
    renter_id: renterId,
    landlord_id: landlordId,
    status: "requested",
    window_choice: "now",
  },
}: {
  userId?: string | null;
  requestRpc?: RpcResult;
  respondRpc?: RpcResult;
  requestRow?: Record<string, unknown> | null;
} = {}) {
  const notificationInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "notification-1" }, error: null })),
    })),
  }));

  const showingSingle = vi.fn(async () => ({
    data: requestRow,
    error: requestRow ? null : { message: "not found" },
  }));

  const rpc = vi.fn(async (name: string) => {
    if (name === "request_showing") {
      return requestRpc ?? { data: [{ result: "requested", request_id: requestId }], error: null };
    }
    if (name === "respond_showing") {
      return respondRpc ?? { data: [{ result: "updated", new_status: "accepted" }], error: null };
    }
    throw new Error(`Unexpected rpc ${name}`);
  });

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: userId ? { id: userId } : null } })),
    },
    rpc,
    from: vi.fn((table: string) => {
      if (table === "showing_requests") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: showingSingle,
        };
        return query;
      }
      if (table === "notification_events") {
        return { insert: notificationInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    notificationInsert,
    showingSingle,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestShowing", () => {
  it("creates the request via the RPC and notifies the landlord", async () => {
    const supabase = createSupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const result = await requestShowing({ listingId, window: "now" });

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("request_showing", {
      target_listing_id: listingId,
      window_choice: "now",
      eta_minutes: undefined,
    });
    // Notification addressed to the landlord, keyed idempotently by request id.
    expect(supabase.notificationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_id: landlordId,
        type: "showing_request",
        idempotency_key: `showing_request:${requestId}`,
      }),
    );
    expect(mocks.enqueueNotificationEvent).toHaveBeenCalledWith("notification-1");
  });

  it("surfaces the single-live-request invariant from the RPC", async () => {
    const supabase = createSupabaseMock({
      requestRpc: { data: [{ result: "request_in_progress", request_id: null }], error: null },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await requestShowing({ listingId, window: "now" });

    expect(result).toEqual({
      success: false,
      error: "You already have a live showing request for this listing.",
    });
    // No fetch, no notification when the invariant blocks the insert.
    expect(supabase.notificationInsert).not.toHaveBeenCalled();
    expect(mocks.enqueueNotificationEvent).not.toHaveBeenCalled();
  });

  it("rejects the landlord requesting their own listing", async () => {
    const supabase = createSupabaseMock({
      requestRpc: { data: [{ result: "own_listing", request_id: null }], error: null },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await requestShowing({ listingId, window: "now" });
    expect(result).toEqual({
      success: false,
      error: "You can't request a showing on your own listing.",
    });
  });

  it("requires authentication", async () => {
    const supabase = createSupabaseMock({ userId: null });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await requestShowing({ listingId, window: "now" });
    expect(result).toEqual({
      success: false,
      error: "You must be signed in to request a showing.",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("acceptShowing", () => {
  it("accepts via respond_showing and notifies the renter", async () => {
    const supabase = createSupabaseMock({
      requestRow: { renter_id: renterId, listing_id: listingId },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await acceptShowing(requestId);

    expect(result).toEqual({ success: true, data: { status: "accepted" } });
    expect(supabase.rpc).toHaveBeenCalledWith("respond_showing", {
      target_request_id: requestId,
      action: "accept",
    });
    expect(supabase.notificationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient_id: renterId,
        type: "showing_accepted",
        idempotency_key: `showing_accepted:${requestId}`,
      }),
    );
  });

  it("treats an idempotent noop as success without notifying", async () => {
    const supabase = createSupabaseMock({
      respondRpc: { data: [{ result: "noop", new_status: "completed" }], error: null },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await acceptShowing(requestId);
    expect(result).toEqual({ success: true, data: { status: "completed" } });
    expect(supabase.notificationInsert).not.toHaveBeenCalled();
  });
});
