import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enqueueNotificationEvent: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/notifications/outbox", () => ({
  enqueueNotificationEvent: (eventId: string) => mocks.enqueueNotificationEvent(eventId),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: (role: string) => mocks.requireRole(role),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mocks.revalidatePath(path),
}));

import { proposeViewingSlots } from "./actions/propose-viewing-slots";

const listingId = "550e8400-e29b-41d4-a716-446655440000";
const applicationId = "550e8400-e29b-41d4-a716-446655440001";
const futureSlot = {
  startTime: "2099-07-01T10:00:00.000Z",
  endTime: "2099-07-01T10:30:00.000Z",
};

function makeClient({
  listing = { id: listingId },
  applications = [{ id: applicationId, renter_id: "renter-1" }],
  slotInsertError = null,
}: {
  listing?: unknown;
  applications?: unknown[];
  slotInsertError?: { message: string } | null;
}) {
  const inserts: Record<string, unknown[]> = {};

  class Builder {
    constructor(private readonly table: string, private readonly insertedData?: unknown) {}

    select() {
      return this;
    }

    eq() {
      return this;
    }

    in() {
      return this;
    }

    insert(payload: unknown) {
      (inserts[this.table] ??= []).push(payload);
      return new Builder(this.table, payload);
    }

    single() {
      if (this.table === "listings") {
        return Promise.resolve({ data: listing, error: listing ? null : { message: "not found" } });
      }
      return Promise.resolve({ data: null, error: null });
    }

    then(
      resolve: (value: { data: unknown; error: { message: string } | null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      if (this.table === "applications") {
        return Promise.resolve({ data: applications, error: null }).then(resolve, reject);
      }
      if (this.table === "viewing_slots") {
        return Promise.resolve({
          data: slotInsertError ? null : [{ id: "slot-1" }],
          error: slotInsertError,
        }).then(resolve, reject);
      }
      if (this.table === "viewing_slot_offers") {
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      if (this.table === "notification_events") {
        return Promise.resolve({ data: [{ id: "notification-1" }], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: this.insertedData ?? null, error: null }).then(resolve, reject);
    }
  }

  return {
    inserts,
    from: (table: string) => new Builder(table),
  };
}

describe("landlord viewing proposal workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ user: { id: "landlord-1" } });
    mocks.enqueueNotificationEvent.mockResolvedValue(undefined);
  });

  it("creates slots, offers them to applicants, and queues notifications", async () => {
    const client = makeClient({});
    mocks.createClient.mockResolvedValue(client);

    const result = await proposeViewingSlots({
      listingId,
      applicationIds: [applicationId],
      mode: "video_call",
      slots: [futureSlot],
    });

    expect(result).toEqual({ success: true, data: undefined });
    const slotInserts = client.inserts.viewing_slots;
    const offerInserts = client.inserts.viewing_slot_offers;
    const notificationInserts = client.inserts.notification_events;
    expect(slotInserts).toBeDefined();
    expect(offerInserts).toBeDefined();
    expect(notificationInserts).toBeDefined();
    expect(slotInserts?.[0]).toEqual([
      expect.objectContaining({ listing_id: listingId, created_by: "landlord-1", mode: "video_call" }),
    ]);
    expect(offerInserts?.[0]).toEqual([{ slot_id: "slot-1", application_id: applicationId }]);
    expect(notificationInserts?.[0]).toEqual([
      expect.objectContaining({ recipient_id: "renter-1", type: "viewing_proposed" }),
    ]);
    expect(mocks.enqueueNotificationEvent).toHaveBeenCalledWith("notification-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/dashboard/listings/${listingId}/applicants`);
  });

  it("rejects invalid viewing slots before inserting rows", async () => {
    const client = makeClient({});
    mocks.createClient.mockResolvedValue(client);

    const result = await proposeViewingSlots({
      listingId,
      applicationIds: [applicationId],
      mode: "in_person",
      slots: [{ startTime: "2020-01-01T10:00:00.000Z", endTime: "2020-01-01T09:00:00.000Z" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid viewing slots");
    }
    expect(client.inserts.viewing_slots).toBeUndefined();
    expect(client.inserts.notification_events).toBeUndefined();
  });
});
