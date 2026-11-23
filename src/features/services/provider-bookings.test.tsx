// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), accept: vi.fn(), decline: vi.fn(), cancel: vi.fn() }));
vi.mock("./booking-actions", () => ({
  getProviderBookings: mocks.list, acceptServiceBooking: mocks.accept, declineServiceBooking: mocks.decline, cancelServiceBooking: mocks.cancel,
}));

import { ProviderBookings } from "./provider-bookings";
import type { ProviderBooking } from "./service-booking";

const booking: ProviderBooking = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", service_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", customer_id: "c", provider_id: "p",
  slot_start: "2030-01-08T12:00:00.000Z", status: "requested", note: "Leaking tap, 4 Oak Road", customer_phone: "+27825550101",
  customer_name: "Sipho", created_at: "2030-01-01T00:00:00.000Z", responded_at: null, serviceTitle: "Tap repairs",
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("ProviderBookings", () => {
  it("should_explain_how_to_get_bookings_when_there_are_none", async () => {
    mocks.list.mockResolvedValue({ success: true, data: { bookings: [] } });
    render(<ProviderBookings />);
    expect(await screen.findByText(/Set booking hours on a service/)).toBeVisible();
  });

  it("should_show_the_job_and_how_to_reach_the_customer_then_accept", async () => {
    mocks.list.mockResolvedValue({ success: true, data: { bookings: [booking] } });
    mocks.accept.mockResolvedValue({ success: true, data: { booking: { ...booking, status: "accepted" } } });
    render(<ProviderBookings />);
    const row = await screen.findByRole("listitem", { name: "Tap repairs, Tue 8 Jan at 14:00" });
    expect(within(row).getByText("Leaking tap, 4 Oak Road")).toBeVisible();
    expect(within(row).getByText(/Sipho/)).toBeVisible();
    expect(within(row).getByRole("link", { name: "Call +27825550101" })).toHaveAttribute("href", "tel:+27825550101");
    fireEvent.click(within(row).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith(booking.id));
    expect(await within(row).findByText("Confirmed")).toBeVisible();
    expect(within(row).queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Cancel booking" })).toBeVisible();
  });

  it("should_remove_a_declined_request_and_keep_errors_visible", async () => {
    mocks.list.mockResolvedValue({ success: true, data: { bookings: [booking] } });
    mocks.decline.mockResolvedValueOnce({ success: false, error: "This booking is no longer open." });
    render(<ProviderBookings />);
    const row = await screen.findByRole("listitem", { name: /Tap repairs/ });
    fireEvent.click(within(row).getByRole("button", { name: "Decline" }));
    expect(await within(row).findByRole("alert")).toHaveTextContent("This booking is no longer open.");
    mocks.decline.mockResolvedValueOnce({ success: true, data: { booking: { ...booking, status: "declined" } } });
    fireEvent.click(within(row).getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(screen.queryByRole("listitem")).not.toBeInTheDocument());
  });

  it("should_offer_a_retry_when_bookings_cannot_be_loaded", async () => {
    mocks.list.mockResolvedValueOnce({ success: false, error: "Bookings could not be loaded. Try again." });
    mocks.list.mockResolvedValueOnce({ success: true, data: { bookings: [] } });
    render(<ProviderBookings />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Set booking hours on a service/)).toBeVisible();
  });
});
