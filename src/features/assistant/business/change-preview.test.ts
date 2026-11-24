import { describe, expect, it } from "vitest";

import { buildChangePreview, loggedAction, NEEDS_OWNER_OR_ADMIN, roundPrice, selectForApproval, type PreviewInput } from "./change-preview";
import { buildPeople, type PeopleInput } from "./people";

const NOW = new Date("2026-11-24T08:00:00Z");
const ahead = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function setup(overrides: Partial<PeopleInput> = {}, managed = { L1: true, L2: true, S1: true }): PreviewInput {
  const people: PeopleInput = {
    now: NOW,
    listings: [
      { id: "L1", title: "Room in Bellville", price: 3800, availabilityDate: null, kind: "rent" },
      { id: "L2", title: "House in Durbanville", price: 2_450_000, availabilityDate: null, kind: "sale" },
    ],
    services: [{ id: "S1", title: "Geyser repairs" }],
    conversations: [],
    showings: [],
    applications: [],
    bookings: [],
    buyerInterests: [],
    profiles: [
      { id: "thandi", name: "Thandi M", verified: true },
      { id: "sipho", name: "Sipho K", verified: false },
    ],
    actions: [],
    ...overrides,
  };
  return {
    now: NOW,
    people: buildPeople(people),
    showings: people.showings,
    applications: people.applications,
    bookings: people.bookings,
    listings: [
      { id: "L1", title: "Room in Bellville", kind: "rent", status: "published", price: 3800, salePrice: null, updatedAt: "2026-11-20T10:00:00.000Z", canManage: managed.L1 },
      { id: "L2", title: "House in Durbanville", kind: "sale", status: "published", price: 2_450_000, salePrice: 2_450_000, updatedAt: "2026-11-21T10:00:00.000Z", canManage: managed.L2 },
    ],
    services: [{ id: "S1", title: "Geyser repairs", canManage: managed.S1 }],
  };
}

const waitingShowing = (id: string, customerId: string, listingId = "L1") => ({
  id, listingId, customerId, status: "requested", requestedAt: ago(0.1), scheduledFor: ahead(26), expiresAt: ahead(20), respondedAt: null, completedAt: null,
});

describe("buildChangePreview", () => {
  it("should_list_every_viewing_request_still_waiting_for_an_answer", () => {
    const preview = buildChangePreview({ kind: "accept_viewings" }, setup({
      showings: [
        waitingShowing("s1", "thandi"),
        waitingShowing("s2", "sipho"),
        { ...waitingShowing("s3", "sipho"), status: "accepted" },
        { ...waitingShowing("s4", "thandi", "L2"), expiresAt: ago(1) },
      ],
    }));
    expect(preview.title).toBe("Accept 2 viewing requests");
    expect(preview.items.map((item) => item.id)).toEqual(["showing:s1", "showing:s2"]);
    expect(preview.items[0]).toMatchObject({ label: "Accept Thandi M's viewing", personKey: "thandi:L1", oneAtATime: false, canApprove: true, step: { type: "accept_showing", showingId: "s1" } });
    expect(preview.items[0]!.detail).toMatch(/^Room in Bellville · /);
  });

  it("should_cover_only_one_person_when_opened_from_their_card", () => {
    const preview = buildChangePreview({ kind: "accept_viewings", personKey: "thandi:L1" }, setup({ showings: [waitingShowing("s1", "thandi"), waitingShowing("s2", "sipho")] }));
    expect(preview.items.map((item) => item.id)).toEqual(["showing:s1"]);
  });

  it("should_keep_a_declined_viewing_to_one_person_and_one_at_a_time", () => {
    const preview = buildChangePreview({ kind: "decline_viewing", personKey: "sipho:L1" }, setup({ showings: [waitingShowing("s1", "thandi"), waitingShowing("s2", "sipho")] }));
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0]).toMatchObject({ id: "showing:s2", oneAtATime: true, step: { type: "decline_showing", showingId: "s2" } });
  });

  it("should_move_applications_one_permitted_step_and_treat_shortlisting_as_a_decision", () => {
    const preview = buildChangePreview({ kind: "review_applications" }, setup({
      applications: [
        { id: "a1", listingId: "L1", customerId: "thandi", status: "submitted", moveInDate: null, createdAt: ago(2), updatedAt: ago(2) },
        { id: "a2", listingId: "L1", customerId: "sipho", status: "under_review", moveInDate: null, createdAt: ago(3), updatedAt: ago(1) },
        { id: "a3", listingId: "L1", customerId: "sipho", status: "rejected", moveInDate: null, createdAt: ago(3), updatedAt: ago(1) },
      ],
    }));
    expect(preview.items.map((item) => [item.id, item.oneAtATime, item.preselected])).toEqual([
      ["application:a1:under_review", false, true],
      ["application:a2:shortlisted", true, false],
    ]);
  });

  it("should_only_confirm_requested_bookings_that_have_not_started", () => {
    const preview = buildChangePreview({ kind: "confirm_bookings" }, setup({
      bookings: [
        { id: "b1", serviceId: "S1", customerId: "thandi", customerName: null, status: "requested", slotStart: ahead(30), createdAt: ago(1) },
        { id: "b2", serviceId: "S1", customerId: "sipho", customerName: null, status: "requested", slotStart: ago(1), createdAt: ago(2) },
      ],
    }));
    expect(preview.items.map((item) => item.id)).toEqual(["booking:b1"]);
  });

  it("should_archive_only_people_who_have_gone_quiet", () => {
    const preview = buildChangePreview({ kind: "archive_quiet" }, setup({
      conversations: [
        { id: "c1", listingId: "L1", customerId: "sipho", createdAt: ago(20), lastMessageAt: ago(9), lastSenderIsCustomer: false },
        { id: "c2", listingId: "L1", customerId: "thandi", createdAt: ago(2), lastMessageAt: ago(1), lastSenderIsCustomer: true },
      ],
    }));
    expect(preview.items).toHaveLength(1);
    expect(preview.items[0]).toMatchObject({ label: "Archive Sipho K", step: { type: "archive_person", customerId: "sipho", listingId: "L1" } });
  });

  it("should_round_a_percentage_price_change_and_keep_the_loaded_version", () => {
    const preview = buildChangePreview({ kind: "change_price", percent: 5 }, setup());
    expect(preview.title).toBe("Raise prices by 5%");
    expect(preview.items.map((item) => item.step)).toEqual([
      { type: "change_price", listingId: "L1", expectedUpdatedAt: "2026-11-20T10:00:00.000Z", from: 3800, to: 4000, sale: false },
      { type: "change_price", listingId: "L2", expectedUpdatedAt: "2026-11-21T10:00:00.000Z", from: 2_450_000, to: 2_573_000, sale: true },
    ]);
    expect(preview.items[0]!.detail).toBe("R3,800 → R4,000 a month");
  });

  it("should_make_the_lister_choose_when_a_fixed_price_could_mean_several_listings", () => {
    const preview = buildChangePreview({ kind: "change_price", amount: 4200 }, setup());
    expect(preview.items.every((item) => !item.preselected)).toBe(true);
    const one = buildChangePreview({ kind: "change_price", amount: 4200, listingId: "L1" }, setup());
    expect(one.items).toHaveLength(1);
    expect(one.items[0]!.preselected).toBe(true);
  });

  it("should_only_mark_published_rentals_as_let", () => {
    const preview = buildChangePreview({ kind: "mark_let" }, setup());
    expect(preview.items.map((item) => item.id)).toEqual(["let:L1"]);
    expect(preview.items[0]!.preselected).toBe(true);
  });

  it("should_show_the_preview_with_approve_off_when_the_login_cannot_act", () => {
    const preview = buildChangePreview({ kind: "accept_viewings" }, setup({ showings: [waitingShowing("s1", "thandi")] }, { L1: false, L2: true, S1: true }));
    expect(preview.items[0]!.canApprove).toBe(false);
    expect(preview.approveNote).toBe(NEEDS_OWNER_OR_ADMIN);
  });

  it("should_explain_when_there_is_nothing_to_change", () => {
    const preview = buildChangePreview({ kind: "accept_viewings" }, setup());
    expect(preview).toMatchObject({ items: [], empty: "No viewing requests are waiting for an answer.", approveNote: null });
  });
});

describe("selectForApproval", () => {
  const input = setup({
    showings: [waitingShowing("s1", "thandi"), waitingShowing("s2", "sipho")],
    applications: [
      { id: "a1", listingId: "L1", customerId: "thandi", status: "under_review", moveInDate: null, createdAt: ago(2), updatedAt: ago(2) },
      { id: "a2", listingId: "L1", customerId: "sipho", status: "submitted", moveInDate: null, createdAt: ago(2), updatedAt: ago(2) },
    ],
  });

  it("should_approve_low_stakes_items_together", () => {
    const preview = buildChangePreview({ kind: "accept_viewings" }, input);
    expect(selectForApproval(preview, ["showing:s1", "showing:s2"])).toMatchObject({ ok: true });
  });

  it("should_refuse_a_decision_about_a_person_in_a_bulk_list", () => {
    const preview = buildChangePreview({ kind: "review_applications" }, input);
    expect(selectForApproval(preview, ["application:a1:shortlisted", "application:a2:under_review"])).toEqual({ ok: false, reason: "Decisions about a person are approved one at a time." });
    expect(selectForApproval(preview, ["application:a1:shortlisted"])).toMatchObject({ ok: true });
  });

  it("should_refuse_items_that_are_not_in_the_fresh_preview", () => {
    const preview = buildChangePreview({ kind: "accept_viewings" }, input);
    expect(selectForApproval(preview, ["showing:forged"])).toMatchObject({ ok: false });
    expect(selectForApproval(preview, [])).toMatchObject({ ok: false });
  });

  it("should_refuse_items_the_login_may_not_approve", () => {
    const preview = buildChangePreview({ kind: "accept_viewings" }, { ...input, listings: input.listings.map((listing) => ({ ...listing, canManage: false })) });
    expect(selectForApproval(preview, ["showing:s1"])).toEqual({ ok: false, reason: NEEDS_OWNER_OR_ADMIN });
  });
});

describe("roundPrice and loggedAction", () => {
  it("should_round_rentals_to_r50_and_sales_to_r1000", () => {
    expect(roundPrice(3989, false)).toBe(4000);
    expect(roundPrice(2_572_500, true)).toBe(2_573_000);
  });

  it("should_log_only_decisions_about_a_person", () => {
    expect(loggedAction({ type: "accept_showing", showingId: "s" })).toBe("viewing_accepted");
    expect(loggedAction({ type: "application_status", applicationId: "a", to: "shortlisted" })).toBe("application_shortlisted");
    expect(loggedAction({ type: "mark_let", listingId: "l", expectedUpdatedAt: "x" })).toBeNull();
  });
});
