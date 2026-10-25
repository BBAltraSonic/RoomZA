import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  recordAndEnqueueNotifications: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  propose: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/features/notifications/outbox", () => ({
  recordAndEnqueueNotifications: (events: unknown) =>
    mocks.recordAndEnqueueNotifications(events),
}));
vi.mock("@/lib/supabase/admin", () => ({ createUntypedClient: () => ({ rpc: mocks.propose }) }));

vi.mock("@/lib/auth", () => ({
  requireAnyPersona: () => mocks.requireRole("landlord"),
}));

vi.mock("@/features/listings/management-scope", () => ({
  getListingManagementScope: () =>
    Promise.resolve({ managedOrganizationId: null }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mocks.revalidatePath(path),
}));

import { proposeViewingSlots } from "./actions/propose-viewing-slots";

const listingId = "550e8400-e29b-41d4-a716-446655440000";
const applicationId = "550e8400-e29b-41d4-a716-446655440001";
const proposalId = "550e8400-e29b-41d4-a716-446655440002";
const slotId = "550e8400-e29b-41d4-a716-446655440003";
const sessionId = "550e8400-e29b-41d4-a716-446655440004";
const futureSlot = {
  startTime: "2099-07-01T10:00:00.000Z",
  endTime: "2099-07-01T10:30:00.000Z",
};

function makeClient({
  listing = {
    id: listingId,
    landlord_id: "landlord-1",
    organization_id: null,
  },
  applications = [{ id: applicationId, renter_id: "renter-1" }],
  slotInsertError = null,
}: {
  listing?: unknown;
  applications?: unknown[];
  slotInsertError?: { message: string } | null;
}) {
  const inserts: Record<string, unknown[]> = {};

  class Builder {
    constructor(
      private readonly table: string,
      private readonly insertedData?: unknown,
    ) {}

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
        return Promise.resolve({
          data: listing,
          error: listing ? null : { message: "not found" },
        });
      }
      return Promise.resolve({ data: null, error: null });
    }

    then(
      resolve: (value: {
        data: unknown;
        error: { message: string } | null;
      }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      if (this.table === "applications") {
        return Promise.resolve({ data: applications, error: null }).then(
          resolve,
          reject,
        );
      }
      if (this.table === "viewing_slots") {
        return Promise.resolve({
          data: slotInsertError ? null : [{ id: "slot-1" }],
          error: slotInsertError,
        }).then(resolve, reject);
      }
      if (this.table === "viewing_slot_offers") {
        return Promise.resolve({ data: null, error: null }).then(
          resolve,
          reject,
        );
      }
      if (this.table === "notification_events") {
        return Promise.resolve({
          data: [{ id: "notification-1" }],
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({
        data: this.insertedData ?? null,
        error: null,
      }).then(resolve, reject);
    }
  }

  return {
    inserts,
    auth: { getClaims: async () => ({ data: { claims: { sub: "landlord-1", session_id: sessionId } }, error: null }) },
    from: (table: string) => new Builder(table),
  };
}

describe("landlord viewing proposal workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ user: { id: "landlord-1" } });
    mocks.recordAndEnqueueNotifications.mockResolvedValue(undefined);
    mocks.propose.mockResolvedValue({ data: { slotIds: [slotId] }, error: null });
  });

  it("creates slots, offers them to applicants, and queues notifications", async () => {
    const client = makeClient({});
    mocks.createClient.mockResolvedValue(client);

    const result = await proposeViewingSlots({
      proposalId,
      listingId,
      applicationIds: [applicationId],
      mode: "video_call",
      slots: [futureSlot],
    });

    expect(result).toEqual({ success: true, data: undefined });
    const slotInserts = client.inserts.viewing_slots;
    const offerInserts = client.inserts.viewing_slot_offers;
    expect(slotInserts).toBeUndefined();
    expect(offerInserts).toBeUndefined();
    expect(mocks.propose).toHaveBeenCalledWith("pinpoint_rental_viewing_propose", {
      actor_id: "landlord-1", actor_session_id: sessionId, proposal_id: proposalId,
      target_listing_id: listingId, target_application_ids: [applicationId], proposed_mode: "video_call", proposed_slots: [futureSlot],
    });
    expect(mocks.recordAndEnqueueNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_id: "renter-1",
        type: "viewing_proposed",
      }),
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/dashboard/listings/${listingId}/applicants`,
    );
  });

  it("rejects invalid viewing slots before inserting rows", async () => {
    const client = makeClient({});
    mocks.createClient.mockResolvedValue(client);

    const result = await proposeViewingSlots({
      proposalId,
      listingId,
      applicationIds: [applicationId],
      mode: "in_person",
      slots: [
        {
          startTime: "2020-01-01T10:00:00.000Z",
          endTime: "2020-01-01T09:00:00.000Z",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid viewing slots");
    }
    expect(client.inserts.viewing_slots).toBeUndefined();
    expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });

  it("rejects a client whose claims identify another actor before privileged mutation", async () => {
    const client=makeClient({});client.auth.getClaims=async()=>({data:{claims:{sub:"different-actor",session_id:sessionId}},error:null});mocks.createClient.mockResolvedValue(client);
    expect((await proposeViewingSlots({proposalId,listingId,applicationIds:[applicationId],mode:"in_person",slots:[futureSlot]})).success).toBe(false);
    expect(mocks.propose).not.toHaveBeenCalled();expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });

  it("keeps uncertain transaction errors generic and never notifies before confirmation", async () => {
    mocks.createClient.mockResolvedValue(makeClient({}));mocks.propose.mockResolvedValue({data:null,error:{code:"503",message:"private database detail"}});
    const result=await proposeViewingSlots({proposalId,listingId,applicationIds:[applicationId],mode:"in_person",slots:[futureSlot]});
    expect(result).toMatchObject({success:false,error:expect.stringContaining("Retry the same proposal")});expect(JSON.stringify(result)).not.toContain("private database detail");
    expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });
});
