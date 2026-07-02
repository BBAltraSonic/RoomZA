import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enqueueNotificationEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/notifications/outbox", () => ({
  enqueueNotificationEvent: (id: string) => mocks.enqueueNotificationEvent(id),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mocks.revalidatePath(path),
}));

import { bookViewingSlot } from "./actions/book-viewing-slot";
import { buildViewingBookedNotification } from "./notifications";

const userId = "550e8400-e29b-41d4-a716-446655440010";
const applicationId = "550e8400-e29b-41d4-a716-446655440011";
const slotId = "550e8400-e29b-41d4-a716-446655440012";
const listingId = "550e8400-e29b-41d4-a716-446655440013";
const landlordId = "550e8400-e29b-41d4-a716-446655440014";
const viewingId = "550e8400-e29b-41d4-a716-446655440015";

function createSupabaseMock({
  application = { id: applicationId, listing_id: listingId, renter_id: userId },
}: {
  application?: { id: string; listing_id: string; renter_id: string } | null;
} = {}) {
  const applicationSingle = vi.fn(async () => ({ data: application, error: application ? null : { message: "not found" } }));
  const listingSingle = vi.fn(async () => ({ data: { landlord_id: landlordId }, error: null }));
  const notificationInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "notification-1" }, error: null })),
    })),
  }));
  const rpc = vi.fn(async () => ({ data: viewingId, error: null }));

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: userId } } })),
    },
    rpc,
    from: vi.fn((table: string) => {
      if (table === "applications") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: applicationSingle,
        };
        return query;
      }
      if (table === "listings") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: listingSingle,
        };
        return query;
      }
      if (table === "notification_events") {
        return { insert: notificationInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    applicationSingle,
    listingSingle,
    notificationInsert,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildViewingBookedNotification", () => {
  it("builds a stable notification payload", () => {
    expect(buildViewingBookedNotification({ applicationId, viewingId })).toEqual({
      type: "viewing_booked",
      idempotency_key: `viewing_booked:${viewingId}`,
      payload: {
        applicationId,
        viewingId,
        message: "A viewing has been booked.",
      },
    });
  });
});

describe("bookViewingSlot", () => {
  it("books the slot through the atomic RPC and notifies the landlord", async () => {
    const supabase = createSupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const result = await bookViewingSlot({ applicationId, slotId });

    expect(result).toEqual({ success: true, data: viewingId });
    expect(supabase.rpc).toHaveBeenCalledWith("book_viewing_slot_atomic", {
      target_slot_id: slotId,
      target_application_id: applicationId,
    });
    expect(supabase.notificationInsert).toHaveBeenCalledWith({
      recipient_id: landlordId,
      ...buildViewingBookedNotification({ applicationId, viewingId }),
    });
    expect(mocks.enqueueNotificationEvent).toHaveBeenCalledWith("notification-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/applications");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/viewings/${viewingId}/live`);
  });

  it("rejects when the application is not owned by the renter", async () => {
    const supabase = createSupabaseMock({ application: null });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(bookViewingSlot({ applicationId, slotId })).resolves.toEqual({
      success: false,
      error: "Application not found or unauthorized",
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
