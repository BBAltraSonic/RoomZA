// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ state: vi.fn(), request: vi.fn(), cancel: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("./booking-actions", () => ({ getServiceBookingState: mocks.state, requestServiceBooking: mocks.request, cancelServiceBooking: mocks.cancel }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { ServiceActionBar } from "./service-action-bar";
import type { PublicService } from "./schema";
import type { ServiceBooking, ServiceBookingState } from "./service-booking";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item: PublicService = {
  id, area_id: id, approved_at: "2026-10-11T08:00:00Z",
  content: { title: "Tap repairs", providerName: "Local plumber", serviceType: "Plumbing", description: "Fixes taps.", areaId: id, address: "10 Fixture Road", latitude: -33, longitude: 18, phone: "021 555 0100", publicContact: { whatsapp: "+27215550100" }, contactConsent: true },
};
// 2030-01-08 is a Tuesday; 12:00 UTC is 14:00 SAST.
const slots = [
  { start: "2030-01-08T12:00:00.000Z", end: "2030-01-08T13:00:00.000Z" },
  { start: "2030-01-08T13:00:00.000Z", end: "2030-01-08T14:00:00.000Z" },
  { start: "2030-01-09T07:00:00.000Z", end: "2030-01-09T08:00:00.000Z" },
];
const ready = (overrides: Partial<ServiceBookingState> = {}) => ({ success: true, data: { signedIn: true, hasHours: true, own: false, slots, booking: null, phone: "+27825550101", ...overrides } });
const requested: ServiceBooking = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", service_id: id, customer_id: "c", provider_id: "p", slot_start: slots[0]!.start,
  status: "requested", note: "Leaking tap", customer_phone: "+27825550101", customer_name: null, created_at: "2030-01-01T00:00:00.000Z", responded_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/services?detailId=" + id);
});
afterEach(cleanup);

const actions = () => screen.getByRole("group", { name: "Service actions" });

describe("ServiceActionBar", () => {
  it("should_offer_contact_and_a_quote_when_the_provider_has_no_booking_hours", async () => {
    mocks.state.mockResolvedValue(ready({ hasHours: false, slots: [] }));
    render(<ServiceActionBar item={item} />);
    expect(await within(actions()).findByRole("link", { name: "Request a quote" })).toHaveAttribute("data-emphasis", "primary");
    expect(within(actions()).queryByRole("button", { name: /Book a time/ })).not.toBeInTheDocument();
  });

  it("should_fall_back_to_a_quote_when_booking_times_cannot_be_loaded", async () => {
    mocks.state.mockResolvedValue({ success: false, error: "Booking times could not be loaded." });
    render(<ServiceActionBar item={item} />);
    expect(await within(actions()).findByRole("link", { name: "Request a quote" })).toBeVisible();
  });

  it("should_send_a_signed_out_visitor_to_sign_in_and_back_to_this_service", async () => {
    mocks.state.mockResolvedValue(ready({ signedIn: false, slots: [], phone: null }));
    render(<ServiceActionBar item={item} />);
    const link = await within(actions()).findByRole("link", { name: "Sign in to book" });
    expect(link).toHaveAttribute("href", "/auth?redirect=" + encodeURIComponent("/services?detailId=" + id));
    expect(within(actions()).getByRole("button", { name: "Contact" })).toBeVisible();
  });

  it("should_book_an_hour_with_a_job_note_and_phone_then_show_it_on_the_trigger", async () => {
    mocks.state.mockResolvedValue(ready());
    mocks.request.mockResolvedValue({ success: true, data: { booking: requested } });
    render(<ServiceActionBar item={item} />);
    fireEvent.click(await within(actions()).findByRole("button", { name: "Book a time" }));
    const sheet = await screen.findByRole("dialog", { name: "Book Local plumber" });
    expect(within(sheet).getByText(/Times are South African time/)).toBeVisible();

    fireEvent.click(within(sheet).getByRole("radio", { name: "14:00" }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Continue with Tue 8 Jan at 14:00" }));
    const phone = within(sheet).getByRole("textbox", { name: "Your phone number" });
    expect(phone).toHaveValue("+27825550101");
    fireEvent.click(within(sheet).getByRole("button", { name: "Send booking request" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Describe the job in a few words.");
    expect(mocks.request).not.toHaveBeenCalled();

    fireEvent.change(within(sheet).getByRole("textbox", { name: "What do you need done, and where?" }), { target: { value: "Leaking tap, 4 Oak Road" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Send booking request" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith({ serviceId: id, slotStart: slots[0]!.start, note: "Leaking tap, 4 Oak Road", phone: "+27825550101" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.success).toHaveBeenCalledWith("Booking requested for Tue 8 Jan at 14:00");
    expect(within(actions()).getByRole("button", { name: "Booking requested" })).toBeVisible();
  });

  it("should_show_a_live_booking_and_let_the_customer_cancel_it", async () => {
    mocks.state.mockResolvedValue(ready({ booking: { ...requested, status: "accepted" } }));
    mocks.cancel.mockResolvedValue({ success: true, data: { booking: { ...requested, status: "cancelled" } } });
    render(<ServiceActionBar item={item} />);
    fireEvent.click(await within(actions()).findByRole("button", { name: "Booked" }));
    const sheet = await screen.findByRole("dialog", { name: "Book Local plumber" });
    expect(within(sheet).getByRole("status")).toHaveTextContent("Local plumber confirmed Tue 8 Jan at 14:00.");
    fireEvent.click(within(sheet).getByRole("button", { name: "Cancel booking" }));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith(requested.id));
    expect(await within(sheet).findByRole("radiogroup", { name: /Open times on/ })).toBeVisible();
  });

  it("should_not_offer_booking_on_the_providers_own_service", async () => {
    mocks.state.mockResolvedValue(ready({ own: true, slots: [] }));
    render(<ServiceActionBar item={item} />);
    expect(await within(actions()).findByRole("link", { name: "Manage bookings" })).toHaveAttribute("href", "/post/services#bookings");
  });
});
