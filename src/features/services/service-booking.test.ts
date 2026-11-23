import { describe, expect, it } from "vitest";

import { bookingPhase, parseBookingRequest, SERVICE_SLOT_MINUTES, validateServiceHours, type ServiceBooking } from "./service-booking";

const serviceId = "550e8400-e29b-41d4-a716-446655440041";
const booking = (overrides: Partial<ServiceBooking> = {}): ServiceBooking => ({
  id: "550e8400-e29b-41d4-a716-446655440042", service_id: serviceId, customer_id: "c", provider_id: "p",
  slot_start: "2030-01-08T12:00:00.000Z", status: "requested", note: "Leaking tap", customer_phone: "+27825550101",
  customer_name: null, created_at: "2030-01-01T00:00:00.000Z", responded_at: null, ...overrides,
});

describe("validateServiceHours", () => {
  it("should_require_a_full_hour_per_day_when_slots_are_an_hour_long", () => {
    expect(SERVICE_SLOT_MINUTES).toBe(60);
    expect(validateServiceHours([{ weekday: 1, startMinute: 600, endMinute: 630 }]))
      .toEqual({ ok: false, error: "Each day needs at least an hour between start and end." });
  });

  it("should_accept_half_hour_aligned_windows_and_sort_them_sunday_first", () => {
    expect(validateServiceHours([{ weekday: 3, startMinute: 510, endMinute: 1020 }, { weekday: 0, startMinute: 600, endMinute: 720 }]))
      .toEqual({ ok: true, hours: [{ weekday: 0, startMinute: 600, endMinute: 720 }, { weekday: 3, startMinute: 510, endMinute: 1020 }] });
  });

  it("should_reject_two_windows_on_one_day", () => {
    expect(validateServiceHours([{ weekday: 2, startMinute: 600, endMinute: 720 }, { weekday: 2, startMinute: 780, endMinute: 900 }]))
      .toEqual({ ok: false, error: "Set one window per day." });
  });
});

describe("parseBookingRequest", () => {
  it("should_trim_the_note_and_phone_when_input_is_valid", () => {
    expect(parseBookingRequest({ serviceId, slotStart: "2030-01-08T12:00:00.000Z", note: "  Leaking tap at 4 Oak Road ", phone: " +27 82 555 0101 " }))
      .toEqual({ ok: true, value: { serviceId, slotStart: "2030-01-08T12:00:00.000Z", note: "Leaking tap at 4 Oak Road", phone: "+27 82 555 0101" } });
  });

  it("should_explain_what_is_missing_when_the_note_or_phone_is_unusable", () => {
    expect(parseBookingRequest({ serviceId, slotStart: "2030-01-08T12:00:00.000Z", note: "x", phone: "+27825550101" }))
      .toEqual({ ok: false, error: "Describe the job in a few words." });
    expect(parseBookingRequest({ serviceId, slotStart: "2030-01-08T12:00:00.000Z", note: "Leaking tap", phone: "call me" }))
      .toEqual({ ok: false, error: "Enter a phone number the provider can call." });
  });
});

describe("bookingPhase", () => {
  const before = Date.parse("2030-01-08T11:00:00.000Z");
  it("should_keep_a_request_live_until_its_slot_starts", () => {
    expect(bookingPhase(booking(), before)).toBe("requested");
    expect(bookingPhase(booking(), Date.parse("2030-01-08T12:00:00.000Z"))).toBe("expired");
  });

  it("should_treat_an_accepted_booking_as_under_way_during_its_hour_and_finished_after", () => {
    expect(bookingPhase(booking({ status: "accepted" }), before)).toBe("accepted");
    expect(bookingPhase(booking({ status: "accepted" }), Date.parse("2030-01-08T12:30:00.000Z"))).toBe("under_way");
    expect(bookingPhase(booking({ status: "accepted" }), Date.parse("2030-01-08T13:00:00.000Z"))).toBe("completed");
  });

  it("should_pass_through_closed_statuses", () => {
    expect(bookingPhase(booking({ status: "declined" }), before)).toBe("declined");
    expect(bookingPhase(booking({ status: "cancelled" }), before)).toBe("cancelled");
  });
});
