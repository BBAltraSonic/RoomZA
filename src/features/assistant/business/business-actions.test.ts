import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeAnswer } from "./fake-supabase";
import { buildPeople, type PeopleInput } from "./people";

const mocks = vi.hoisted(() => ({
  context: null as unknown,
  data: null as unknown,
  acceptShowing: vi.fn(),
  declineShowing: vi.fn(),
  updateApplicationStatus: vi.fn(),
  acceptServiceBooking: vi.fn(),
  unpublishListing: vi.fn(),
  changeListingPrice: vi.fn(),
  consumeListerAi: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/showings/actions", () => ({ acceptShowing: mocks.acceptShowing, declineShowing: mocks.declineShowing }));
vi.mock("@/features/applications/actions", () => ({ updateApplicationStatus: mocks.updateApplicationStatus }));
vi.mock("@/features/services/booking-actions", () => ({ acceptServiceBooking: mocks.acceptServiceBooking }));
vi.mock("@/features/listings/actions", () => ({ unpublishListing: mocks.unpublishListing, changeListingPrice: mocks.changeListingPrice }));
vi.mock("./business-allowance", () => ({ consumeListerAi: mocks.consumeListerAi }));
vi.mock("./business-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./business-data")>()),
  getListerContext: async () => mocks.context,
  loadListerData: async () => mocks.data,
}));

import { approveChange, completeReminder, createReminder, getBusinessView, snoozeReminder } from "./business-actions";

const NOW = new Date();
const ahead = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const ME = "11111111-1111-4111-8111-000000000001";
const THANDI = "22222222-2222-4222-8222-000000000001";
const SIPHO = "22222222-2222-4222-8222-000000000002";
const L1 = "33333333-3333-4333-8333-000000000001";

function setup(options: { manage?: boolean; answers?: Record<string, FakeAnswer> } = {}) {
  const fake = fakeSupabase({ assistant_action_log: { data: [{}] }, ...options.answers });
  const peopleInput: PeopleInput = {
    now: NOW,
    listings: [{ id: L1, title: "Room in Bellville", price: 3800, availabilityDate: null, kind: "rent" }],
    services: [],
    conversations: [{ id: "c1", listingId: L1, customerId: SIPHO, createdAt: ago(20), lastMessageAt: ago(9), lastSenderIsCustomer: false }],
    showings: [
      { id: "s1", listingId: L1, customerId: THANDI, status: "requested", requestedAt: ago(0.1), scheduledFor: ahead(26), expiresAt: ahead(20), respondedAt: null, completedAt: null },
    ],
    applications: [{ id: "a1", listingId: L1, customerId: THANDI, status: "under_review", moveInDate: null, createdAt: ago(2), updatedAt: ago(2) }],
    bookings: [],
    buyerInterests: [],
    profiles: [{ id: THANDI, name: "Thandi M", verified: false }, { id: SIPHO, name: "Sipho K", verified: false }],
    actions: [],
  };
  mocks.context = { supabase: fake.client, userId: ME, organizationId: null, role: null, managedOrganizationId: null };
  mocks.data = {
    now: NOW,
    listings: [{ id: L1, title: "Room in Bellville", listing_type: "rent", status: "published", price: 3800, sale_price: null, updated_at: "2026-11-20T10:00:00.000Z", landlord_id: options.manage === false ? SIPHO : ME, organization_id: null }],
    services: [],
    peopleInput,
    people: buildPeople(peopleInput),
    messages: [],
    conversationListing: new Map(),
    failed: new Set(),
  };
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acceptShowing.mockResolvedValue({ success: true, data: {} });
  mocks.updateApplicationStatus.mockResolvedValue({ success: true, data: undefined });
});

describe("approveChange", () => {
  it("should_run_the_existing_action_and_record_who_approved_it", async () => {
    const fake = setup();
    const result = await approveChange({ kind: "accept_viewings" }, ["showing:s1"]);
    expect(result).toEqual({ success: true, data: { results: [{ id: "showing:s1", label: "Accept Thandi M's viewing", ok: true, message: "Done" }] } });
    expect(mocks.acceptShowing).toHaveBeenCalledWith("s1");
    const insert = fake.calls.find((call) => call.table === "assistant_action_log" && call.method === "insert");
    expect(insert?.args[0]).toEqual({ customer_id: THANDI, action: "viewing_accepted", listing_id: L1 });
  });

  it("should_refuse_an_item_that_is_not_in_a_fresh_preview", async () => {
    setup();
    const result = await approveChange({ kind: "accept_viewings" }, ["showing:someone-else"]);
    expect(result).toEqual({ success: false, error: "Something changed since the preview. Check it again." });
    expect(mocks.acceptShowing).not.toHaveBeenCalled();
  });

  it("should_turn_approve_off_for_a_login_that_cannot_act", async () => {
    setup({ manage: false });
    const result = await approveChange({ kind: "accept_viewings" }, ["showing:s1"]);
    expect(result).toEqual({ success: false, error: "Needs an owner or admin" });
    expect(mocks.acceptShowing).not.toHaveBeenCalled();
  });

  it("should_refuse_a_decision_about_a_person_bundled_with_other_items", async () => {
    setup();
    const result = await approveChange({ kind: "review_applications" }, ["application:a1:shortlisted", "application:other:under_review"]);
    expect(result.success).toBe(false);
    expect(mocks.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it("should_report_each_item's_own_failure", async () => {
    setup();
    mocks.updateApplicationStatus.mockResolvedValue({ success: false, error: "That status transition is not allowed." });
    const result = await approveChange({ kind: "review_applications" }, ["application:a1:shortlisted"]);
    expect(result).toEqual({ success: true, data: { results: [{ id: "application:a1:shortlisted", label: "Shortlist: Thandi M", ok: false, message: "That status transition is not allowed." }] } });
  });

  it("should_treat_a_failed_log_write_as_a_failed_archive", async () => {
    setup({ answers: { assistant_action_log: { error: { message: "denied" } } } });
    const result = await approveChange({ kind: "archive_quiet" }, [`archive:${SIPHO}:${L1}`]);
    expect(result).toEqual({ success: true, data: { results: [{ id: `archive:${SIPHO}:${L1}`, label: "Archive Sipho K", ok: false, message: "Couldn't archive. Try again." }] } });
  });

  it("should_reject_unreadable_input_and_signed_out_callers", async () => {
    setup();
    expect(await approveChange({ kind: "launch_rockets" }, ["x"])).toMatchObject({ success: false });
    mocks.context = null;
    expect(await approveChange({ kind: "accept_viewings" }, ["showing:s1"])).toEqual({ success: false, error: "Sign in to use the assistant." });
  });
});

describe("reminders", () => {
  it("should_save_a_reminder_about_a_person_with_its_listing", async () => {
    const fake = setup({ answers: {
      listings: { data: [{ id: L1 }] },
      assistant_reminders: { data: [{ id: "r1", note: "Call Thandi", due_at: "2026-11-25T07:00:00.000Z" }] },
    } });
    const result = await createReminder({ note: "Call Thandi", due: "tomorrow", personKey: `${THANDI}:${L1}` });
    expect(result).toEqual({ success: true, data: { id: "r1", note: "Call Thandi", dueAt: "2026-11-25T07:00:00.000Z" } });
    const insert = fake.calls.find((call) => call.table === "assistant_reminders" && call.method === "insert");
    expect(insert?.args[0]).toMatchObject({ note: "Call Thandi", customer_id: THANDI, listing_id: L1 });
    expect(insert?.args[0]).not.toHaveProperty("user_id");
  });

  it("should_need_a_note_and_exactly_one_way_of_saying_when", async () => {
    setup();
    expect(await createReminder({ note: " ", due: "tomorrow" })).toMatchObject({ success: false });
    expect(await createReminder({ note: "x" })).toMatchObject({ success: false });
    expect(await createReminder({ note: "x", due: "tomorrow", dueAt: ahead(3) })).toMatchObject({ success: false });
  });

  it("should_say_not_found_when_the_reminder_is_someone_else's", async () => {
    setup({ answers: { assistant_reminders: { data: [] } } });
    expect(await completeReminder("44444444-4444-4444-8444-000000000001")).toEqual({ success: false, error: "That reminder could not be found." });
  });

  it("should_snooze_only_to_tomorrow_or_next_week", async () => {
    setup({ answers: { assistant_reminders: { data: [{ id: "r1", note: "x", due_at: ahead(24) }] } } });
    expect(await snoozeReminder("44444444-4444-4444-8444-000000000001", "next-year")).toMatchObject({ success: false });
    expect(await snoozeReminder("44444444-4444-4444-8444-000000000001", "tomorrow")).toMatchObject({ success: true });
  });
});

describe("getBusinessView", () => {
  it("should_check_the_request_before_loading_anything", async () => {
    setup();
    expect(await getBusinessView({ template: "today", extra: true })).toEqual({ success: false, error: "That request could not be read." });
  });

  it("should_return_a_preview_without_running_anything", async () => {
    setup();
    const result = await getBusinessView({ template: "change_preview", change: { kind: "accept_viewings" } });
    expect(result.success && result.data.template === "change_preview" && result.data.preview.items.map((item) => item.id)).toEqual(["showing:s1"]);
    expect(mocks.acceptShowing).not.toHaveBeenCalled();
    expect(mocks.consumeListerAi).not.toHaveBeenCalled();
  });
});
