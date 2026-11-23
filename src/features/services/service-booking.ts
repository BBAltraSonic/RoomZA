/**
 * Pure helpers for booking a service provider's time. No I/O. Calendar days and
 * clock times are South African, matching `private.service_open_slots()`.
 */
import { z } from "zod";

import { validateViewingHours, type ViewingHour, type ViewingSlot } from "@/features/showings/viewing-availability";
import type { Database } from "@/lib/supabase/types";

/** Length of one bookable service slot; mirrors the database slot generator. */
export const SERVICE_SLOT_MINUTES = 60;

export type ServiceBooking = Database["public"]["Tables"]["service_bookings"]["Row"];
/** A booking as the provider's inbox shows it, with the service it is for. */
export type ProviderBooking = ServiceBooking & { serviceTitle: string };

/** Everything the service detail needs to offer, or resume, a booking. */
export type ServiceBookingState = {
  signedIn: boolean;
  hasHours: boolean;
  /** The viewer posted this service, so they manage bookings instead of making one. */
  own: boolean;
  slots: ViewingSlot[];
  booking: ServiceBooking | null;
  /** The customer's profile phone, to prefill the form. */
  phone: string | null;
};

export function validateServiceHours(hours: ViewingHour[]) {
  return validateViewingHours(hours, SERVICE_SLOT_MINUTES);
}

/** Same pattern as the `service_bookings_phone` constraint. */
export const bookingPhonePattern = /^\+?[0-9 ()-]{7,24}$/;

const requestSchema = z.object({
  serviceId: z.string().uuid("Invalid service."),
  slotStart: z.string().datetime({ offset: true, message: "Choose a time." }),
  note: z.string().trim().min(3, "Describe the job in a few words.").max(500, "Keep the job description under 500 characters."),
  phone: z.string().trim().regex(bookingPhonePattern, "Enter a phone number the provider can call."),
});
export type BookingRequest = z.infer<typeof requestSchema>;

export function parseBookingRequest(input: unknown): { ok: true; value: BookingRequest } | { ok: false; error: string } {
  const parsed = requestSchema.safeParse(input);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: parsed.error.issues[0]?.message ?? "Check the booking details." };
}

export type BookingPhase = "requested" | "accepted" | "under_way" | "completed" | "declined" | "cancelled" | "expired";

/**
 * Where a booking stands at `now`. The database sweeps stale rows lazily, so a
 * row can still say `requested` after its slot started; the clock decides here.
 */
export function bookingPhase(booking: Pick<ServiceBooking, "status" | "slot_start">, now = Date.now()): BookingPhase {
  const start = Date.parse(booking.slot_start);
  if (booking.status === "requested") return now < start ? "requested" : "expired";
  if (booking.status === "accepted") {
    if (now < start) return "accepted";
    return now < start + SERVICE_SLOT_MINUTES * 60_000 ? "under_way" : "completed";
  }
  return booking.status as BookingPhase;
}

/** True while the booking still holds the customer's place. */
export function isLiveBooking(booking: Pick<ServiceBooking, "status" | "slot_start">, now = Date.now()) {
  const phase = bookingPhase(booking, now);
  return phase === "requested" || phase === "accepted" || phase === "under_way";
}
