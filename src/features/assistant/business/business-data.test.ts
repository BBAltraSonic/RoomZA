import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeAnswer } from "./fake-supabase";

const mocks = vi.hoisted(() => ({
  memberships: { data: [] as unknown[], error: null as { message: string } | null },
  names: new Map<string, { full_name: string; phone_verified: boolean }>(),
  session: null as unknown,
}));

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.session }));
vi.mock("@/features/services/data", () => ({ serviceClient: async () => mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({
  createUntypedClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ is: async () => mocks.memberships }) }) }) }),
}));
vi.mock("@/features/profile/interaction-data", () => ({ getInteractionProfileMap: async () => mocks.names }));

import { canManageListing, getListerContext, loadListerData, medianReplySeconds, previewInputFrom, type ListerContext } from "./business-data";
import { buildViewFromData } from "./business-view";

const NOW = new Date("2026-11-24T08:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const ahead = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();
const ME = "11111111-1111-4111-8111-000000000001";
const COLLEAGUE = "11111111-1111-4111-8111-000000000002";
const ORG = "11111111-1111-4111-8111-0000000000aa";

const listing = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, title: `Listing ${id}`, listing_type: "rent", price: 4000, sale_price: null, bedrooms: 1, bathrooms: 1, parking_type: "none", parking_count: 0,
  electricity_type: "prepaid", water_availability: "municipal", lease_duration: "12_months", availability_date: null, deposit_amount: null,
  metadata: {}, status: "published", updated_at: "2026-11-20T10:00:00.000Z", landlord_id: ME, organization_id: null, description: "Short",
  property_type: "room", latitude: -33.9, longitude: 18.6, listing_accreditations: [{ nsfas_approved: true }], ...overrides,
});

function tables(overrides: Record<string, FakeAnswer> = {}) {
  return {
    listings: { data: [listing("L1"), listing("L2", { landlord_id: COLLEAGUE, organization_id: ORG, title: "Colleague flat" })] },
    service_submissions: { data: [] },
    listing_images: { data: [{ listing_id: "L1" }, { listing_id: "L1" }] },
    conversations: { data: [{ id: "c1", listing_id: "L1", renter_id: "thandi", created_at: ago(48) }] },
    messages: { data: [
      { conversation_id: "c1", sender_id: "thandi", created_at: ago(40) },
      { conversation_id: "c1", sender_id: ME, created_at: ago(39) },
      { conversation_id: "c1", sender_id: "thandi", created_at: ago(2) },
    ] },
    showing_requests: { data: [{ id: "s1", listing_id: "L1", renter_id: "thandi", status: "requested", requested_at: ago(1), scheduled_for: ahead(26), expires_at: ahead(20), responded_at: null, completed_at: null }] },
    applications: { data: [] },
    service_bookings: { data: [] },
    buyer_interests: { data: [] },
    assistant_action_log: { data: [] },
    assistant_reminders: { data: [{ id: "r1", note: "Call the plumber", due_at: ago(1), subject_key: null }] },
    landlord_viewing_hours: { count: 0 },
    shopping_offers: { data: [] },
    shopping_offer_revisions: { data: [] },
    analytics_events: { data: [] },
    ...overrides,
  };
}

function lister(answers = tables(), role: ListerContext["role"] = "owner"): { context: ListerContext; calls: ReturnType<typeof fakeSupabase>["calls"] } {
  const fake = fakeSupabase(answers);
  mocks.session = fake.client;
  return {
    calls: fake.calls,
    context: { supabase: fake.client as never, userId: ME, organizationId: ORG, role, managedOrganizationId: role === "agent" ? null : ORG },
  };
}

beforeEach(() => {
  mocks.names = new Map([["thandi", { full_name: "Thandi M", phone_verified: true }]]);
  mocks.memberships = { data: [], error: null };
});

describe("getListerContext", () => {
  it("should_return_null_when_signed_out", async () => {
    mocks.session = fakeSupabase().client;
    expect(await getListerContext()).toBeNull();
  });

  it("should_only_manage_the_organisation_as_an_owner_or_admin_of_the_active_one", async () => {
    const fake = fakeSupabase({ profiles: { data: [{ active_organization_id: ORG }] } });
    mocks.session = { ...fake.client, auth: { getUser: async () => ({ data: { user: { id: ME } }, error: null }) } };
    mocks.memberships = { data: [{ organization_id: ORG, role: "agent", organizations: { deleted_at: null } }], error: null };
    expect(await getListerContext()).toMatchObject({ userId: ME, organizationId: ORG, role: "agent", managedOrganizationId: null });
    mocks.memberships = { data: [{ organization_id: ORG, role: "admin", organizations: { deleted_at: null } }], error: null };
    expect(await getListerContext()).toMatchObject({ role: "admin", managedOrganizationId: ORG });
  });
});

describe("loadListerData", () => {
  it("should_build_people_from_activity_with_names_and_the_last_sender", async () => {
    const { context } = lister();
    const data = await loadListerData(context, NOW);
    expect(data.failed.size).toBe(0);
    expect(data.listings[0]).toMatchObject({ id: "L1", photoCount: 2, nsfasApproved: true });
    expect(data.people).toHaveLength(1);
    expect(data.people[0]).toMatchObject({ key: "thandi:L1", name: "Thandi M", waitingOnYou: true, next: ["reply", "viewing-request"] });
    expect(data.people[0]!.reasons).toContain("Verified");
  });

  it("should_never_select_message_text_for_the_people_list", async () => {
    const { context, calls } = lister();
    await loadListerData(context, NOW);
    const selects = calls.filter((call) => call.table === "messages" && call.method === "select").map((call) => String(call.args[0]));
    expect(selects).toEqual(["conversation_id,sender_id,created_at"]);
  });

  it("should_report_a_part_that_failed_instead_of_treating_it_as_empty", async () => {
    const { context } = lister(tables({ showing_requests: { error: { message: "boom" } } }));
    const data = await loadListerData(context, NOW);
    expect([...data.failed]).toEqual(["showings"]);
  });

  it("should_let_an_agent_see_but_not_manage_organisation_listings", async () => {
    const { context } = lister(tables(), "agent");
    const data = await loadListerData(context, NOW);
    const input = previewInputFrom(context, data);
    expect(input.listings.map((entry) => [entry.id, entry.canManage])).toEqual([["L1", true], ["L2", false]]);
    expect(canManageListing({ userId: ME, managedOrganizationId: ORG }, { landlord_id: COLLEAGUE, organization_id: ORG })).toBe(true);
  });
});

describe("buildViewFromData", () => {
  it("should_count_today_and_add_due_reminders_to_the_badge", async () => {
    const { context } = lister();
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "today" }, context, data);
    if (view.template !== "today") throw new Error("wrong template");
    expect(view.items.map((item) => item.label)).toEqual(["1 enquiry waiting on you", "1 viewing request to answer", "2 listings missing important info"]);
    expect(view.reminders.map((reminder) => reminder.note)).toEqual(["Call the plumber"]);
    expect(view.badge).toBe(3);
  });

  it("should_say_a_count_failed_rather_than_show_zero", async () => {
    const { context } = lister(tables({ showing_requests: { error: { message: "boom" } } }));
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "today" }, context, data);
    if (view.template !== "today") throw new Error("wrong template");
    expect(view.notes.map((note) => note.message)).toContain("Viewing requests couldn't load, try again");
    expect(view.items.some((item) => item.key === "viewingRequests")).toBe(false);
  });

  it("should_keep_a_colleague's_enquiries_out_of_the_performance_totals", async () => {
    const { context } = lister();
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "performance" }, context, data);
    if (view.template !== "performance") throw new Error("wrong template");
    expect(view.tiles.find((tile) => tile.label === "Enquiries")).toEqual({ label: "Enquiries", value: "1" });
    expect(view.funnels.find((funnel) => funnel.listingId === "L2")!.steps[1]).toEqual({ label: "Enquiries", value: null });
    expect(view.notes).toContain("Totals cover your own listings. Enquiries on a colleague's listing are private to them.");
  });

  it("should_offer_person_actions_that_open_previews_not_changes", async () => {
    const { context } = lister();
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "person_detail", personKey: "thandi:L1" }, context, data);
    if (view.template !== "person_detail") throw new Error("wrong template");
    expect(view.canApprove).toBe(true);
    expect(view.actions.map((action) => action.label)).toEqual(["Accept viewing", "Decline viewing", "Suggest times", "Reply"]);
    expect(view.actions[0]).toEqual({ label: "Accept viewing", request: { template: "change_preview", change: { kind: "accept_viewings", personKey: "thandi:L1" } } });
  });

  it("should_return_a_reminder_draft_without_saving_it", async () => {
    const { context, calls } = lister();
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "reminders", create: { text: "call Thandi", due: "tomorrow" } }, context, data);
    if (view.template !== "reminders") throw new Error("wrong template");
    expect(view.draft).toEqual({ note: "call Thandi", dueAt: "2026-11-25T07:00:00.000Z", personKey: null });
    expect(calls.some((call) => call.method === "insert")).toBe(false);
  });

  it("should_write_a_new_listing_by_rules_when_no_allowance_is_left", async () => {
    const { context } = lister();
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "new_listing", draft: { notes: "room near UWC, wifi", propertyType: "room", price: 3800 } }, context, data, { ai: async () => null });
    if (view.template !== "new_listing") throw new Error("wrong template");
    expect(view.source).toBe("rules");
    expect(view.missing).toEqual(["Area"]);
    expect(view.notes).toEqual(["The writing help is resting for today, so this is a plain version."]);
  });

  it("should_count_only_customer_messages_for_topics", async () => {
    const { context } = lister(tables({ messages: { data: [
      { conversation_id: "c1", sender_id: "thandi", created_at: ago(40), content: "Is there parking?" },
      { conversation_id: "c1", sender_id: ME, created_at: ago(39), content: "Yes, and pets are fine" },
    ] } }));
    const data = await loadListerData(context, NOW);
    const view = await buildViewFromData({ template: "question_insights" }, context, data);
    if (view.template !== "question_insights") throw new Error("wrong template");
    expect(view.insights.map((insight) => insight.topic)).toEqual(["parking"]);
  });
});

describe("improve_listing view", () => {
  it("should_suggest_a_fuller_description_from_public_details_for_a_manager", async () => {
    const { context } = lister();
    const data = await loadListerData(context, NOW);
    const ai = vi.fn(async () => null);
    const view = await buildViewFromData({ template: "improve_listing", listingId: "L1" }, context, data, { ai });
    if (view.template !== "improve_listing") throw new Error("wrong template");
    expect(ai).toHaveBeenCalled();
    expect(view).toMatchObject({ listingTitle: "Listing L1", current: "Short", source: "rules", canApprove: true, approveNote: null, expectedUpdatedAt: "2026-11-20T10:00:00.000Z" });
    expect(view.proposed!.length).toBeGreaterThan("Short".length);
  });

  it("should_not_spend_the_allowance_for_a_login_that_cannot_approve", async () => {
    const { context } = lister(tables(), "agent");
    const data = await loadListerData(context, NOW);
    const ai = vi.fn(async () => null);
    const view = await buildViewFromData({ template: "improve_listing", listingId: "L2" }, context, data, { ai });
    if (view.template !== "improve_listing") throw new Error("wrong template");
    expect(ai).not.toHaveBeenCalled();
    expect(view).toMatchObject({ canApprove: false, approveNote: "Needs an owner or admin" });
  });
});

describe("medianReplySeconds", () => {
  it("should_need_three_replies_and_measure_from_the_first_unanswered_message", () => {
    const customerOf = new Map([["c1", "thandi"]]);
    const messages = [0, 1, 2].flatMap((index) => [
      { conversationId: "c1", senderId: "thandi", createdAt: ago(30 - index * 5) },
      { conversationId: "c1", senderId: "thandi", createdAt: ago(29.5 - index * 5) },
      { conversationId: "c1", senderId: ME, createdAt: ago(29 - index * 5 - index) },
    ]);
    expect(medianReplySeconds(messages.slice(0, 6), customerOf)).toBeNull();
    expect(medianReplySeconds(messages, customerOf)).toBe(7200);
  });
});
