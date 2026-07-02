import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enqueueNotificationEvent: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
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

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { updateApplicationStatus } from "./actions";

type TableRows = Record<string, unknown>;

function makeClient({
  application,
  rpcRows,
  rpcError = null,
}: {
  application: unknown;
  rpcRows: unknown;
  rpcError?: { message: string } | null;
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

    insert(payload: unknown) {
      (inserts[this.table] ??= []).push(payload);
      return new Builder(this.table, payload);
    }

    single() {
      if (this.table === "applications") {
        return Promise.resolve({ data: application, error: null });
      }
      if (this.table === "notification_events") {
        return Promise.resolve({ data: { id: "notification-1" }, error: null });
      }
      return Promise.resolve({ data: this.insertedData ?? null, error: null });
    }

    then(resolve: (value: { data: null; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    }
  }

  return {
    inserts,
    from: (table: string) => new Builder(table),
    rpc: vi.fn(async () => ({ data: rpcRows, error: rpcError })),
  };
}

describe("landlord application decision workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ user: { id: "landlord-1" } });
    mocks.enqueueNotificationEvent.mockResolvedValue(undefined);
  });

  it("updates an owned application and queues a renter notification", async () => {
    const client = makeClient({
      application: {
        id: "application-1",
        listing_id: "listing-1",
        status: "shortlisted",
        renter_id: "renter-1",
        listing: { landlord_id: "landlord-1" },
      },
      rpcRows: [{ application_id: "application-1", result: "updated" }],
    });
    mocks.createClient.mockResolvedValue(client);

    const result = await updateApplicationStatus("application-1", "approved");

    expect(result).toEqual({ success: true, data: undefined });
    expect(client.rpc).toHaveBeenCalledWith("update_application_status_checked", {
      target_application_id: "application-1",
      target_status: "approved",
    });
    expect((client.inserts.notification_events as TableRows[])[0]).toMatchObject({
      recipient_id: "renter-1",
      type: "application_status_changed",
    });
    expect(mocks.enqueueNotificationEvent).toHaveBeenCalledWith("notification-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/listings/listing-1/applicants");
  });

  it("rejects an invalid terminal transition without changing status", async () => {
    const client = makeClient({
      application: {
        id: "application-1",
        listing_id: "listing-1",
        status: "approved",
        renter_id: "renter-1",
        listing: { landlord_id: "landlord-1" },
      },
      rpcRows: [],
    });
    mocks.createClient.mockResolvedValue(client);

    const result = await updateApplicationStatus("application-1", "rejected");

    expect(result).toEqual({ success: false, error: "That status transition is not allowed." });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.inserts.notification_events).toBeUndefined();
  });
});
