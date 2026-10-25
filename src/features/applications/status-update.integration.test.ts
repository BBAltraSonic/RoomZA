import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  adminClient: vi.fn(),
  recordAndEnqueueNotifications: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  adminRpc: vi.fn(),
  redirect: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createUntypedClient: () => mocks.adminClient(),
  createClient: () => mocks.adminClient(),
}));

vi.mock("@/features/notifications/outbox", () => ({
  recordAndEnqueueNotifications: (event: unknown) => mocks.recordAndEnqueueNotifications(event),
}));

vi.mock("@/lib/auth", () => ({
  requirePersona: (role: string) => mocks.requireRole(role),
  requireAnyPersona: (personas: readonly string[]) => mocks.requireRole(personas[0]),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mocks.revalidatePath(path),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { updateApplicationStatus } from "./actions";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims: { sub: ownerId, session_id: sessionId } }, error: null,
      })),
    },
    from: (table: string) => new Builder(table),
    rpc: vi.fn(async () => ({ data: rpcRows, error: rpcError })),
  };
}

describe("landlord application decision workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ user: { id: ownerId } });
    mocks.adminRpc.mockResolvedValue({ data: true, error: null });
    mocks.redirect.mockImplementation(() => { throw new Error("AUTH_REDIRECT"); });
    mocks.recordAndEnqueueNotifications.mockResolvedValue(undefined);
    // Mock admin client used by getOrganizationContext
    const adminQuery = {
      select: vi.fn(() => adminQuery),
      eq: vi.fn(() => adminQuery),
      is: vi.fn(() => adminQuery),
      in: vi.fn(() => adminQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    // The ordinary owner has no organization, and a current verified session.
    mocks.adminClient.mockReturnValue({
      from: vi.fn(() => adminQuery),
      rpc: mocks.adminRpc,
    });
  });

  it("updates an owned application and queues a renter notification", async () => {
    const client = makeClient({
      application: {
        id: "application-1",
        listing_id: "listing-1",
        status: "shortlisted",
        renter_id: "renter-1",
        listing: { landlord_id: ownerId, organization_id: null },
      },
      rpcRows: [{ application_id: "application-1", result: "updated" }],
    });
    mocks.createClient.mockResolvedValue(client);

    const result = await updateApplicationStatus("application-1", "approved");

    expect(result).toEqual({ success: true, data: undefined });
    expect(mocks.adminRpc).toHaveBeenCalledWith("pinpoint_active_session", {
      actor_id: ownerId, actor_session_id: sessionId,
    });
    expect(client.rpc).toHaveBeenCalledWith("update_application_status_checked", {
      target_application_id: "application-1",
      target_status: "approved",
    });
    expect(mocks.recordAndEnqueueNotifications).toHaveBeenCalledWith(expect.objectContaining({
      recipient_id: "renter-1",
      type: "application_status_changed",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/listings/listing-1/applicants");
  });

  it("rejects an invalid terminal transition without changing status", async () => {
    const client = makeClient({
      application: {
        id: "application-1",
        listing_id: "listing-1",
        status: "approved",
        renter_id: "renter-1",
        listing: { landlord_id: ownerId, organization_id: null },
      },
      rpcRows: [],
    });
    mocks.createClient.mockResolvedValue(client);

    const result = await updateApplicationStatus("application-1", "rejected");

    expect(result).toEqual({ success: false, error: "That status transition is not allowed." });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });

  it.each(["revoked session", "different claims owner"])("denies a decision for a %s before writing or delivery", async (kind) => {
    const client = makeClient({
      application: { id: "application-1", listing_id: "listing-1", status: "shortlisted", renter_id: "renter-1", listing: { landlord_id: ownerId, organization_id: null } },
      rpcRows: [{ application_id: "application-1", result: "updated" }],
    });
    if (kind === "revoked session") mocks.adminRpc.mockResolvedValue({ data: false, error: null });
    else client.auth.getClaims.mockResolvedValue({ data: { claims: { sub: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", session_id: sessionId } }, error: null });
    mocks.createClient.mockResolvedValue(client);
    await expect(updateApplicationStatus("application-1", "approved")).rejects.toThrow("AUTH_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/auth?redirect=%2Fdashboard%2Forganization");
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.inserts).toEqual({});
    expect(mocks.recordAndEnqueueNotifications).not.toHaveBeenCalled();
  });
});
