import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireRole: vi.fn(),
  revalidatePath: vi.fn(),
  enqueueNotificationEvent: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mocks.createClient(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: (role: string) => mocks.requireRole(role),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mocks.revalidatePath(path),
}));

vi.mock("@/features/notifications/outbox", () => ({
  enqueueNotificationEvent: (id: string) => mocks.enqueueNotificationEvent(id),
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

import { submitApplication, withdrawApplication } from "./actions";

function validApplicationForm() {
  const formData = new FormData();
  formData.set("listingId", "550e8400-e29b-41d4-a716-446655440000");
  formData.set("fullName", "Test Renter");
  formData.set("income", "25000");
  formData.set("employmentStatus", "employed");
  formData.set("moveInDate", "2026-08-01");
  formData.set("householdSize", "2");
  return formData;
}

function createSupabaseMock() {
  const rpc = vi.fn(async () => ({
    data: [{ application_id: "660e8400-e29b-41d4-a716-446655440000", result: "created" }],
    error: null,
  }));
  const remove = vi.fn(async () => ({ error: null }));
  const upload = vi.fn(async () => ({ error: null }));
  const applicationCountQuery = {
    eq: vi.fn(function (this: typeof applicationCountQuery) {
      return this;
    }),
    in: vi.fn(async () => ({ count: 0, error: null })),
  };
  const applicationExistingQuery = {
    eq: vi.fn(function (this: typeof applicationExistingQuery) {
      return this;
    }),
    in: vi.fn(function (this: typeof applicationExistingQuery) {
      return this;
    }),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  const listingQuery = {
    eq: vi.fn(function (this: typeof listingQuery) {
      return this;
    }),
    single: vi.fn(async () => ({ data: { landlord_id: "landlord-1" }, error: null })),
  };
  const notificationInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: "notification-1" }, error: null })),
    })),
  }));
  let applicationSelectCount = 0;

  return {
    rpc,
    storage: {
      from: vi.fn(() => ({ upload, remove })),
    },
    from: vi.fn((table: string) => {
      if (table === "applications") {
        applicationSelectCount += 1;
        return {
          select: vi.fn(() => (applicationSelectCount === 1 ? applicationCountQuery : applicationExistingQuery)),
        };
      }
      if (table === "listings") {
        return {
          select: vi.fn(() => listingQuery),
        };
      }
      if (table === "notification_events") {
        return {
          insert: notificationInsert,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ user: { id: "renter-1" } });
});

describe("submitApplication", () => {
  it("submits through submit_application_atomic and enqueues a landlord notification", async () => {
    const supabase = createSupabaseMock();
    mocks.createClient.mockResolvedValue(supabase);

    const startedAt = performance.now();
    const result = await submitApplication(validApplicationForm());
    const elapsedMs = performance.now() - startedAt;

    const rpcCalls = supabase.rpc.mock.calls as unknown as Array<[string, { target_application_id: string }]>;
    const rpcPayload = rpcCalls[0]?.[1];
    expect(rpcPayload?.target_application_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result).toEqual({
      success: true,
      data: { applicationId: rpcPayload?.target_application_id },
    });
    expect(elapsedMs).toBeLessThan(5000);
    expect(supabase.rpc).toHaveBeenCalledWith("submit_application_atomic", expect.objectContaining({
      target_application_id: rpcPayload?.target_application_id,
      target_listing_id: "550e8400-e29b-41d4-a716-446655440000",
      full_name: "Test Renter",
      income: 25000,
      employment_status: "employed",
      move_in_date: "2026-08-01",
      household_size: 2,
      document_metadata: [],
    }));
    expect(mocks.enqueueNotificationEvent).toHaveBeenCalledWith("notification-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/applications");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/listing/550e8400-e29b-41d4-a716-446655440000");
  });
});

function createWithdrawSupabaseMock(updatedApplication: { id: string } | null) {
  const maybeSingle = vi.fn(async () => ({ data: updatedApplication, error: null }));
  const select = vi.fn(() => ({ maybeSingle }));
  const inFilter = vi.fn(() => ({ select }));
  const eqRenter = vi.fn(() => ({ in: inFilter }));
  const eqId = vi.fn(() => ({ eq: eqRenter }));
  const update = vi.fn(() => ({ eq: eqId }));

  return {
    from: vi.fn((table: string) => {
      if (table !== "applications") {
        throw new Error(`Unexpected table ${table}`);
      }
      return { update };
    }),
    update,
    eqId,
    eqRenter,
    inFilter,
    select,
    maybeSingle,
  };
}

describe("withdrawApplication", () => {
  it("transitions an owned active application to withdrawn", async () => {
    const supabase = createWithdrawSupabaseMock({ id: "application-1" });
    mocks.createClient.mockResolvedValue(supabase);

    const result = await withdrawApplication("application-1");

    expect(result).toEqual({ success: true, data: undefined });
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: "withdrawn" }));
    expect(supabase.inFilter).toHaveBeenCalledWith("status", ["submitted", "under_review", "shortlisted"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/applications");
  });

  it("fails when no owned active application is updated", async () => {
    const supabase = createWithdrawSupabaseMock(null);
    mocks.createClient.mockResolvedValue(supabase);

    await expect(withdrawApplication("missing-application")).resolves.toEqual({
      success: false,
      error: "Application not found or cannot be withdrawn.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/applications");
  });
});
