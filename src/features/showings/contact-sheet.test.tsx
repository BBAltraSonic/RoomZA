// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ current: vi.fn(), request: vi.fn(), scheduled: vi.fn(), availability: vi.fn(), voice: vi.fn(), video: vi.fn(), push: vi.fn(), client: vi.fn() }));
vi.mock("@/features/showings/actions", () => ({
  requestShowing: mocks.request, getCurrentShowing: mocks.current,
  requestScheduledShowing: mocks.scheduled, getViewingAvailability: mocks.availability,
  cancelShowing: vi.fn(), checkInShowing: vi.fn(), completeShowing: vi.fn(),
}));
vi.mock("@/features/chat/actions", () => ({ requestListingVoiceCall: mocks.voice, requestListingVideoCall: mocks.video }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: mocks.client }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ContactSheet } from "./contact-sheet";
import type { ShowingRequest } from "./actions";

const listingId = "550e8400-e29b-41d4-a716-446655440031";
const base = {
  listingId, title: "Garden cottage", latitude: -26, longitude: 28,
  presence: "available" as const, kind: "rent" as const, authenticated: true,
  contact: null, onMessage: vi.fn(async () => {}),
};
const accepted = {
  id: "550e8400-e29b-41d4-a716-446655440033", listing_id: listingId, renter_id: "r", landlord_id: "l", status: "accepted",
  window_choice: "now", eta_minutes: null, requested_at: new Date().toISOString(), expires_at: new Date(Date.now() + 900000).toISOString(),
  responded_at: null, checked_in_at: null, completed_at: null, created_at: new Date().toISOString(), conversation_id: null, scheduled_for: null,
} satisfies ShowingRequest;

// 2030-01-08 is a Tuesday; 12:30 UTC is 14:30 SAST.
const slots = [
  { start: "2030-01-08T12:30:00.000Z", end: "2030-01-08T13:00:00.000Z" },
  { start: "2030-01-08T13:00:00.000Z", end: "2030-01-08T13:30:00.000Z" },
  { start: "2030-01-09T07:00:00.000Z", end: "2030-01-09T07:30:00.000Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current.mockResolvedValue({ success: true, data: { request: null } });
  mocks.availability.mockResolvedValue({ success: true, data: { slots, hasHours: true, inHoursNow: true } });
  const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
  mocks.client.mockReturnValue({
    from: vi.fn(), channel: vi.fn(() => channel), removeChannel: vi.fn(async () => {}),
    auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  });
});
afterEach(cleanup);

async function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: /^Contact/ }));
  return screen.findByRole("dialog", { name: /^Contact/ });
}

describe("ContactSheet", () => {
  it("leads with Pinpoint messaging, then live calls while the landlord is available, then a showing", async () => {
    render(<ContactSheet {...base} listerName="Thandi" />);
    const sheet = await openSheet();
    expect(sheet).toHaveAccessibleName("Contact Thandi");
    const actions = within(sheet).getAllByRole("button").map(button => button.textContent?.trim()).filter(label => label && label !== "Close");
    expect(actions).toEqual(["Message the landlordRecommended", "Call now", "Video now", "Request a showing"]);
    fireEvent.click(within(sheet).getByRole("button", { name: /Message the landlord/ }));
    await waitFor(() => expect(base.onMessage).toHaveBeenCalledOnce());
  });

  it("hides live calls while the landlord is offline", async () => {
    render(<ContactSheet {...base} presence="offline" />);
    const sheet = await openSheet();
    expect(within(sheet).queryByRole("button", { name: "Call now" })).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Video now" })).not.toBeInTheDocument();
  });

  it("asks when only after the person chooses to request a showing", async () => {
    render(<ContactSheet {...base} presence="busy" />);
    const sheet = await openSheet();
    expect(within(sheet).queryByRole("button", { name: "Within 15 minutes" })).not.toBeInTheDocument();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Request a showing" }));
    // "Right now" needs a landlord who is available, so it is left out rather than greyed.
    for (const name of ["Within 15 minutes", "Within 30 minutes", "Later today", "Back"]) {
      expect(within(sheet).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(within(sheet).queryByRole("button", { name: "Right now" })).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Within 15 minutes" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith({ listingId, window: "within_15" }));
  });

  it("says an available landlord can meet within 15 minutes", async () => {
    render(<ContactSheet {...base} />);
    const sheet = await openSheet();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Request a showing" }));
    const status = await within(sheet).findByRole("status", { name: "Landlord availability" });
    expect(status).toHaveTextContent("Available now");
    expect(status).toHaveTextContent("Can meet you at the property within 15 minutes.");
    expect(within(sheet).getByRole("button", { name: "Right now" })).toBeInTheDocument();
  });

  it("warns that an offline landlord will not make it within 15 minutes", async () => {
    render(<ContactSheet {...base} presence="offline" />);
    const sheet = await openSheet();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Request a showing" }));
    const status = await within(sheet).findByRole("status", { name: "Landlord availability" });
    expect(status).toHaveTextContent("Offline");
    expect(status).toHaveTextContent("Book one of their viewing times below.");
  });

  it("books an open time from the landlord's calendar", async () => {
    mocks.scheduled.mockResolvedValue({ success: true, data: { request: { ...accepted, status: "requested", window_choice: "scheduled", scheduled_for: slots[0]!.start } } });
    render(<ContactSheet {...base} presence="offline" />);
    const sheet = await openSheet();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Request a showing" }));
    const calendar = await within(sheet).findByRole("group", { name: "Viewing calendar" });
    expect(mocks.availability).toHaveBeenCalledWith(listingId);

    // The first day with open times is selected; another day shows its own times.
    expect(within(calendar).getByRole("button", { name: "Tue 8 Jan, 2 open times" })).toHaveAttribute("aria-pressed", "true");
    expect(within(calendar).getAllByRole("radio").map(slot => slot.textContent)).toEqual(["14:30", "15:00"]);
    fireEvent.click(within(calendar).getByRole("button", { name: "Wed 9 Jan, 1 open time" }));
    expect(within(calendar).getAllByRole("radio").map(slot => slot.textContent)).toEqual(["09:00"]);
    fireEvent.click(within(calendar).getByRole("button", { name: "Tue 8 Jan, 2 open times" }));

    fireEvent.click(within(calendar).getByRole("radio", { name: "14:30" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Request Tue 8 Jan at 14:30" }));
    await waitFor(() => expect(mocks.scheduled).toHaveBeenCalledWith({ listingId, slotStart: slots[0]!.start }));
  });

  it("explains when the landlord has not set viewing hours", async () => {
    mocks.availability.mockResolvedValue({ success: true, data: { slots: [], hasHours: false, inHoursNow: false } });
    render(<ContactSheet {...base} presence="offline" />);
    const sheet = await openSheet();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Request a showing" }));
    expect(await within(sheet).findByText("This landlord hasn't set viewing hours yet.")).toBeVisible();
    expect(within(sheet).queryByRole("group", { name: "Viewing calendar" })).not.toBeInTheDocument();
  });

  it("keeps the quick times when the calendar cannot load", async () => {
    mocks.availability.mockResolvedValue({ success: false, error: "Viewing times could not be loaded. Try again." });
    render(<ContactSheet {...base} />);
    const sheet = await openSheet();
    fireEvent.click(await within(sheet).findByRole("button", { name: "Request a showing" }));
    expect(await within(sheet).findByText("Viewing times could not be loaded. Try again.")).toBeVisible();
    expect(within(sheet).getByRole("button", { name: "Within 15 minutes" })).toBeEnabled();
  });

  it("keeps WhatsApp, Call and Email as one quiet row at the end", async () => {
    render(<ContactSheet {...base} contact={{ whatsapp: "+27215550100", phone: "+27215550100", email: "a@example.com" }} />);
    const sheet = await openSheet();
    const direct = within(sheet).getByRole("group", { name: "Direct contact" });
    expect(within(direct).getAllByRole("link").map(link => link.textContent)).toEqual(["WhatsApp", "Call", "Email"]);
    const all = Array.from(sheet.querySelectorAll("button, a"));
    expect(all.indexOf(within(direct).getByRole("link", { name: "WhatsApp" }))).toBeGreaterThan(all.indexOf(within(sheet).getByRole("button", { name: "Request a showing" })));
  });

  it("shows an active showing on the trigger and at the top of the sheet", async () => {
    mocks.current.mockResolvedValue({ success: true, data: { request: accepted } });
    render(<ContactSheet {...base} />);
    const trigger = await screen.findByRole("button", { name: "Contact, showing accepted" });
    fireEvent.click(trigger);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("Accepted. Message the landlord or check in when you arrive.")).toBeVisible();
    expect(within(sheet).queryByRole("button", { name: "Request a showing" })).not.toBeInTheDocument();
  });

  it("opens straight away for a message deep link", async () => {
    render(<ContactSheet {...base} initialOpen />);
    expect(await screen.findByRole("dialog", { name: /^Contact/ })).toBeInTheDocument();
  });

  it("is a single sign-in button for guests with no direct contact", () => {
    render(<ContactSheet {...base} authenticated={false} />);
    const button = screen.getByRole("button", { name: "Sign in to contact" });
    fireEvent.click(button);
    expect(base.onMessage).toHaveBeenCalledOnce();
    expect(mocks.current).not.toHaveBeenCalled();
  });

  it("offers guests sign-in plus the lister's direct contact", async () => {
    render(<ContactSheet {...base} authenticated={false} contact={{ phone: "+27215550100" }} />);
    const sheet = await openSheet();
    expect(within(sheet).getByRole("button", { name: "Sign in to message" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+27215550100");
    expect(within(sheet).queryByRole("button", { name: "Request a showing" })).not.toBeInTheDocument();
  });

  it("messages a seller directly when there is nothing else to choose", () => {
    render(<ContactSheet {...base} kind="sale" presence={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Message the seller" }));
    expect(base.onMessage).toHaveBeenCalledOnce();
  });
});
