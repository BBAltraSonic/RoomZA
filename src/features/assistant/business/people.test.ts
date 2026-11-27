import { describe, expect, it } from "vitest";

import { buildPeople, filterPeople, groupPeople, type PeopleInput } from "./people";

const NOW = new Date("2026-11-24T10:00:00Z");
const days = (count: number) => new Date(NOW.getTime() - count * 86_400_000).toISOString();

function input(overrides: Partial<PeopleInput> = {}): PeopleInput {
  return {
    now: NOW,
    listings: [
      { id: "L1", title: "Room in Bellville", price: 3800, availabilityDate: "2026-12-01", kind: "rent" },
      { id: "L2", title: "Flat in Rondebosch", price: 7500, availabilityDate: null, kind: "rent" },
    ],
    conversations: [],
    showings: [],
    applications: [],
    buyerInterests: [],
    profiles: [
      { id: "thandi", name: "Thandi M", verified: true },
      { id: "sipho", name: "Sipho K", verified: false },
      { id: "lerato", name: "Lerato N", verified: false },
    ],
    actions: [],
    ...overrides,
  };
}

describe("buildPeople", () => {
  it("should_join_everything_one_person_did_on_one_listing_into_one_card", () => {
    const people = buildPeople(input({
      conversations: [{ id: "c1", listingId: "L1", customerId: "thandi", createdAt: days(5), lastMessageAt: days(1), lastSenderIsCustomer: true }],
      applications: [{ id: "a1", listingId: "L1", customerId: "thandi", status: "submitted", moveInDate: "2026-12-01", createdAt: days(2), updatedAt: days(2) }],
    }));
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ key: "thandi:L1", name: "Thandi M", stage: "applied", waitingOnYou: true, subjectTitle: "Room in Bellville" });
    expect(people[0]!.refs).toEqual({ conversationId: "c1", applicationId: "a1" });
  });

  it("should_give_visible_reasons_instead_of_a_score", () => {
    const [person] = buildPeople(input({
      applications: [{ id: "a1", listingId: "L1", customerId: "thandi", status: "submitted", moveInDate: "2026-12-05", createdAt: days(2), updatedAt: days(2) }],
      showings: [{ id: "s1", listingId: "L1", customerId: "thandi", status: "accepted", requestedAt: days(3), scheduledFor: new Date(NOW.getTime() + 86_400_000).toISOString(), expiresAt: days(-2), respondedAt: days(3), completedAt: null }],
    }));
    expect(person!.reasons).toEqual(["Applied", "Viewing booked", "Move-in date fits", "Verified"]);
  });

  it("should_mark_gone_quiet_after_a_week_without_activity", () => {
    const [person] = buildPeople(input({
      conversations: [{ id: "c1", listingId: "L2", customerId: "sipho", createdAt: days(20), lastMessageAt: days(9), lastSenderIsCustomer: false }],
    }));
    expect(person).toMatchObject({ stage: "gone-quiet", waitingOnYou: false });
    expect(person!.reasons).toContain("Quiet for 9 days");
  });

  it("should_mark_ready_to_apply_after_a_completed_viewing_without_an_application", () => {
    const [person] = buildPeople(input({
      showings: [{ id: "s1", listingId: "L1", customerId: "lerato", status: "completed", requestedAt: days(4), scheduledFor: null, expiresAt: days(3), respondedAt: days(4), completedAt: days(2) }],
    }));
    expect(person!.stage).toBe("ready-to-apply");
    expect(person!.reasons).toContain("Viewed");
  });

  it("should_treat_a_viewing_request_waiting_for_an_answer_as_waiting_on_you", () => {
    const [person] = buildPeople(input({
      showings: [{ id: "s1", listingId: "L1", customerId: "lerato", status: "requested", requestedAt: days(0), scheduledFor: null, expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(), respondedAt: null, completedAt: null }],
    }));
    expect(person).toMatchObject({ stage: "viewing-booked", waitingOnYou: true });
    expect(person!.next).toContain("viewing-request");
  });

  it("should_close_people_whose_application_was_rejected_or_withdrawn", () => {
    const [person] = buildPeople(input({
      applications: [{ id: "a1", listingId: "L1", customerId: "thandi", status: "withdrawn", moveInDate: "2026-12-01", createdAt: days(2), updatedAt: days(1) }],
    }));
    expect(person!.stage).toBe("closed");
  });

  it("should_hide_archived_people_and_show_who_last_acted", () => {
    const base = { conversations: [{ id: "c1", listingId: "L1", customerId: "thandi", createdAt: days(5), lastMessageAt: days(1), lastSenderIsCustomer: true }] };
    expect(buildPeople(input({ ...base, actions: [{ subjectKey: "thandi:L1", action: "archived", actorName: "Sipho", createdAt: days(0) }] }))).toEqual([]);
    const [person] = buildPeople(input({ ...base, actions: [{ subjectKey: "thandi:L1", action: "viewing_accepted", actorName: "Sipho", createdAt: "2026-11-24T12:02:00Z" }] }));
    expect(person!.lastAction).toEqual({ label: "Viewing accepted", actorName: "Sipho", at: "2026-11-24T12:02:00Z" });
  });

  it("should_rank_by_stage_then_waiting_then_reasons_then_recency", () => {
    const people = buildPeople(input({
      conversations: [
        { id: "c1", listingId: "L1", customerId: "lerato", createdAt: days(1), lastMessageAt: days(0), lastSenderIsCustomer: true },
        { id: "c2", listingId: "L2", customerId: "sipho", createdAt: days(30), lastMessageAt: days(10), lastSenderIsCustomer: false },
      ],
      applications: [{ id: "a1", listingId: "L1", customerId: "thandi", status: "submitted", moveInDate: "2026-12-01", createdAt: days(2), updatedAt: days(2) }],
    }));
    expect(people.map((person) => person.key)).toEqual(["thandi:L1", "lerato:L1", "sipho:L2"]);
  });
});

describe("filterPeople and groupPeople", () => {
  const people = buildPeople(input({
    conversations: [
      { id: "c1", listingId: "L1", customerId: "lerato", createdAt: days(1), lastMessageAt: days(0), lastSenderIsCustomer: true },
      { id: "c2", listingId: "L2", customerId: "sipho", createdAt: days(30), lastMessageAt: days(10), lastSenderIsCustomer: false },
    ],
    applications: [{ id: "a1", listingId: "L1", customerId: "thandi", status: "submitted", moveInDate: "2026-12-01", createdAt: days(2), updatedAt: days(2) }],
  }));

  it("should_filter_by_listing_price_waiting_and_this_week", () => {
    expect(filterPeople(people, { maxPrice: 4000 }, NOW).map((person) => person.key)).toEqual(["thandi:L1", "lerato:L1"]);
    expect(filterPeople(people, { waitingOnYou: true }, NOW).map((person) => person.key)).toEqual(["thandi:L1", "lerato:L1"]);
    expect(filterPeople(people, { since: "week" }, NOW).map((person) => person.key)).toEqual(["thandi:L1", "lerato:L1"]);
    expect(filterPeople(people, { stage: "gone-quiet" }, NOW).map((person) => person.key)).toEqual(["sipho:L2"]);
  });

  it("should_group_by_stage_in_priority_order", () => {
    expect(groupPeople(people).map((group) => [group.stage, group.people.length])).toEqual([
      ["applied", 1],
      ["just-enquired", 1],
      ["gone-quiet", 1],
    ]);
  });
});
