// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import type { BusinessView } from "./business-view";
import type { ChangeItem } from "./change-preview";
import type { Person } from "./people";

const mocks = vi.hoisted(() => ({
  getBusinessView: vi.fn(),
  approveChange: vi.fn(),
  createReminder: vi.fn(),
  completeReminder: vi.fn(),
  snoozeReminder: vi.fn(),
  applyImprovedDescription: vi.fn(),
}));

vi.mock("./business-actions", () => mocks);
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));

import { BusinessPanel } from "./business-panel";

const fetchMock = vi.fn();

const TODAY: BusinessView = {
  template: "today",
  items: [
    { key: "viewingRequests", count: 2, label: "2 viewing requests to answer", action: "Open" },
    { key: "listingsNeedingInfo", count: 1, label: "1 listing missing important info", action: "Fix" },
  ],
  notes: [{ key: "applicationsToReview", message: "Applications couldn't load, try again" }],
  badge: 3,
  reminders: [{ id: "r1", note: "Call the plumber", dueAt: "2026-11-24T15:00:00.000Z", due: true, personKey: null, personName: null, subjectTitle: null }],
};

const person = (overrides: Partial<Person> = {}): Person => ({
  key: "thandi:L1", customerId: "thandi", name: "Thandi M", subjectId: "L1", subjectTitle: "Room in Bellville", subjectKind: "rent",
  stage: "viewing-booked", waitingOnYou: true, reasons: ["Viewing booked", "Verified"], next: ["viewing-request"], lastActivityAt: "2026-11-24T07:00:00.000Z",
  firstSeenAt: "2026-11-20T07:00:00.000Z", price: 3800, refs: {}, timeline: [{ at: "2026-11-24T07:00:00.000Z", label: "Asked for a viewing" }],
  lastAction: { label: "Viewing accepted", actorName: "Sipho", at: "2026-11-24T12:02:00.000Z" }, ...overrides,
});

const item = (overrides: Partial<ChangeItem>): ChangeItem => ({
  id: "x", label: "x", detail: "Room in Bellville", subjectId: "L1", oneAtATime: false, preselected: true, canApprove: true,
  step: { type: "accept_showing", showingId: "s" }, ...overrides,
});

function previewView(items: ChangeItem[], approveNote: string | null = null): BusinessView {
  return { template: "change_preview", change: { kind: "review_applications" }, preview: { kind: "review_applications", title: "Move applications along", items, empty: null, approveNote } };
}

async function renderPanel() {
  const onBadge = vi.fn();
  const onClose = vi.fn();
  render(<BusinessPanel onClose={onClose} onBadge={onBadge} />);
  await screen.findByRole("heading", { name: "Today" });
  return { onBadge, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBusinessView.mockImplementation(async (request: { template: string }) => (request.template === "today" ? { success: true, data: TODAY } : { success: false, error: "not set up" }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("BusinessPanel", () => {
  it("should_open_on_today_with_counts_notes_reminders_and_starters", async () => {
    const { onBadge } = await renderPanel();
    expect(screen.getByText("2 viewing requests to answer")).toBeInTheDocument();
    expect(screen.getByText("Applications couldn't load, try again")).toBeInTheDocument();
    expect(screen.getByText("Call the plumber")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Try asking" })).getAllByRole("button")).toHaveLength(6);
    expect(onBadge).toHaveBeenCalledWith(3);
  });

  it("should_open_the_matching_preview_from_a_today_row_and_go_back", async () => {
    await renderPanel();
    mocks.getBusinessView.mockResolvedValueOnce({ success: true, data: previewView([item({ id: "showing:s1", label: "Accept Thandi M's viewing" })]) });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open: 2 viewing requests to answer" }));
    });
    expect(mocks.getBusinessView).toHaveBeenLastCalledWith({ template: "change_preview", change: { kind: "accept_viewings" } });
    expect(await screen.findByRole("heading", { name: "Check before approving" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
  });

  it("should_send_typed_text_without_contact_details_and_show_the_notice", async () => {
    await renderPanel();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {
      request: { template: "people_list", filters: {} }, source: "rules", notice: "allowance_used",
      view: { template: "people_list", filters: {}, total: 1, notes: [], groups: [{ stage: "viewing-booked", label: "Viewing booked", people: [person()] }] },
    } }), { status: 200 }));
    fireEvent.change(screen.getByRole("textbox", { name: "What do you need?" }), { target: { value: "who called from 082 555 1234" } });
    await act(async () => {
      fireEvent.submit(screen.getByRole("textbox", { name: "What do you need?" }).closest("form")!);
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1].body)) as { text: string };
    expect(body.text).not.toContain("082");
    expect(await screen.findByText("Thandi M")).toBeInTheDocument();
    // Shown in South African time, so two members don't act on the same person twice.
    expect(screen.getByText(/^Viewing accepted by Sipho, .*14:02$/)).toBeInTheDocument();
    expect(screen.getByText("You've used today's typed requests. The buttons still work.")).toBeInTheDocument();
  });

  it("should_keep_a_decision_about_a_person_on_its_own_and_report_results", async () => {
    await renderPanel();
    mocks.getBusinessView.mockResolvedValueOnce({ success: true, data: previewView([
      item({ id: "application:a1:under_review", label: "Move to review: Sipho K" }),
      item({ id: "application:a2:shortlisted", label: "Shortlist: Thandi M", oneAtATime: true, preselected: false }),
    ]) });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Who's waiting on me?" }));
    });
    const review = await screen.findByRole("checkbox", { name: /Move to review/ });
    const shortlist = screen.getByRole("radio", { name: /Shortlist/ });
    expect(review).toBeChecked();
    fireEvent.click(shortlist);
    expect(shortlist).toBeChecked();
    expect(review).not.toBeChecked();
    mocks.approveChange.mockResolvedValue({ success: true, data: { results: [{ id: "application:a2:shortlisted", label: "Shortlist: Thandi M", ok: true, message: "Done" }] } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    });
    expect(mocks.approveChange).toHaveBeenCalledWith({ kind: "review_applications" }, ["application:a2:shortlisted"]);
    expect(await screen.findByText("Done")).toBeInTheDocument();
  });

  it("should_show_the_preview_with_approve_off_when_the_login_cannot_act", async () => {
    await renderPanel();
    mocks.getBusinessView.mockResolvedValueOnce({ success: true, data: previewView([item({ id: "showing:s1", label: "Accept Thandi M's viewing", canApprove: false })], "Needs an owner or admin") });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Who's waiting on me?" }));
    });
    expect(await screen.findByText("Needs an owner or admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Accept Thandi/ })).toBeDisabled();
  });

  it("should_save_a_drafted_reminder_only_when_the_lister_taps_save", async () => {
    await renderPanel();
    mocks.getBusinessView.mockResolvedValueOnce({ success: true, data: { template: "reminders", reminders: [], notes: [], draft: { note: "call Thandi", dueAt: "2026-11-25T07:00:00.000Z", personKey: null } } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "My reminders" }));
    });
    await screen.findByRole("form", { name: "New reminder" });
    expect(mocks.createReminder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    mocks.createReminder.mockResolvedValue({ success: true, data: { id: "r2", note: "call Thandi", dueAt: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
    });
    expect(mocks.createReminder).toHaveBeenCalledWith({ note: "call Thandi", due: "next-week" });
    expect(await screen.findByText("Reminder saved. Only you can see it.")).toBeInTheDocument();
  });

  it("should_mark_a_due_reminder_done", async () => {
    await renderPanel();
    mocks.completeReminder.mockResolvedValue({ success: true, data: { id: "r1", note: "Call the plumber", dueAt: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Done: Call the plumber" }));
    });
    expect(mocks.completeReminder).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(screen.queryByText("Call the plumber")).not.toBeInTheDocument());
  });

  it("should_say_when_a_screen_could_not_load", async () => {
    await renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "How are my listings doing?" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("not set up");
  });

  it("should_write_a_better_description_from_the_quality_check_and_apply_it_on_approve", async () => {
    await renderPanel();
    mocks.getBusinessView
      .mockResolvedValueOnce({ success: true, data: { template: "quality_check", notes: [], listings: [{ id: "11111111-1111-4111-8111-111111111111", title: "Room in Bellville", issues: [{ key: "short-description", severity: "important", message: "The description is short", fix: "Improve description", href: "/edit" }] }] } })
      .mockResolvedValueOnce({ success: true, data: { template: "improve_listing", listingId: "11111111-1111-4111-8111-111111111111", listingTitle: "Room in Bellville", current: "Short", proposed: "A furnished room in Bellville with WiFi, R3,800 a month.", source: "ai", canApprove: true, approveNote: null, expectedUpdatedAt: "2026-11-20T10:00:00.000Z", editHref: "/edit", notes: [] } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "What's missing on my listings?" }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Write it for me" }));
    });
    expect(mocks.getBusinessView).toHaveBeenLastCalledWith({ template: "improve_listing", listingId: "11111111-1111-4111-8111-111111111111" });
    await screen.findByText("A furnished room in Bellville with WiFi, R3,800 a month.");
    expect(mocks.applyImprovedDescription).not.toHaveBeenCalled();
    mocks.applyImprovedDescription.mockResolvedValue({ success: true, data: { updatedAt: "x" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    });
    expect(mocks.applyImprovedDescription).toHaveBeenCalledWith({ listingId: "11111111-1111-4111-8111-111111111111", expectedUpdatedAt: "2026-11-20T10:00:00.000Z", description: "A furnished room in Bellville with WiFi, R3,800 a month." });
    expect(await screen.findByText("Description updated.")).toBeInTheDocument();
  });

  it("should_cycle_through_three_sheet_heights_on_phones", async () => {
    await renderPanel();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-height", "half");
    fireEvent.click(screen.getByRole("button", { name: "Show more of Piko" }));
    expect(dialog).toHaveAttribute("data-height", "full");
    fireEvent.click(screen.getByRole("button", { name: "Show less of Piko" }));
    expect(dialog).toHaveAttribute("data-height", "peek");
  });

  it("should_close_on_escape", async () => {
    const { onClose } = await renderPanel();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
