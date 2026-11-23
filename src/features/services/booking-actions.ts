"use server";

import { z } from "zod";

import { recordAndEnqueueNotifications } from "@/features/notifications/outbox";
import { formatSlotRequest, type ViewingHour } from "@/features/showings/viewing-availability";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

import { serviceClient } from "./data";
import { isLiveBooking, parseBookingRequest, validateServiceHours, type ProviderBooking, type ServiceBooking, type ServiceBookingState } from "./service-booking";

const idSchema = z.string().uuid();
const availabilitySchema = z.object({
  hasHours: z.boolean(),
  own: z.boolean(),
  slots: z.array(z.object({ start: z.string(), end: z.string() })),
});
const hoursSchema = z.array(z.object({ weekday: z.number().int(), startMinute: z.number().int(), endMinute: z.number().int() })).max(7);
const LIVE = ["requested", "accepted"];

async function currentUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") return { user: null, failed: true } as const;
  return { user: data?.user ?? null, failed: false } as const;
}

/** Non-fatal: a failed notice never fails the booking action that caused it. */
async function notify(input: { recipientId: string; actorId: string; booking: ServiceBooking; role: "provider" | "customer"; event: string; title: string; message: string }) {
  try {
    await recordAndEnqueueNotifications({
      recipient_id: input.recipientId,
      actor_id: input.actorId,
      category: "viewings",
      source_kind: "service_booking",
      source_id: input.booking.id,
      type: "service_booking_update",
      idempotency_key: `service_booking:${input.event}:${input.booking.id}`,
      payload: { title: input.title, message: input.message, serviceId: input.booking.service_id, bookingId: input.booking.id, bookingRole: input.role },
    });
  } catch (error) {
    logger.error("Failed to enqueue service booking notification", { bookingId: input.booking.id, event: input.event, error });
  }
}

/** Whether this service takes bookings, its open hours, and the viewer's own live booking. */
export async function getServiceBookingState(serviceId: string): Promise<ActionResult<ServiceBookingState>> {
  const parsed = idSchema.safeParse(serviceId);
  if (!parsed.success) return actionFailure("Invalid service.");
  const supabase = await createClient();
  const { user, failed } = await currentUser(supabase);
  if (failed) return actionFailure("Booking times could not be loaded. Try again.");

  const { data, error } = await supabase.rpc("service_booking_availability", { target_service_id: parsed.data });
  if (error) {
    logger.warn("Failed to load service booking availability", { serviceId: parsed.data, error: error.message });
    return actionFailure("Booking times could not be loaded. Try again.");
  }
  const empty: ServiceBookingState = { signedIn: Boolean(user), hasHours: false, own: false, slots: [], booking: null, phone: null };
  if (data === null) return actionSuccess(empty);
  const availability = availabilitySchema.safeParse(data);
  if (!availability.success) return actionFailure("Booking times could not be loaded. Try again.");
  if (!user || availability.data.own) return actionSuccess({ ...empty, ...availability.data });

  const [bookingRead, profileRead] = await Promise.all([
    supabase.from("service_bookings").select("*").eq("service_id", parsed.data).eq("customer_id", user.id)
      .in("status", LIVE).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle(),
  ]);
  if (bookingRead.error) return actionFailure("Your booking could not be loaded. Try again.");
  const booking = bookingRead.data && isLiveBooking(bookingRead.data) ? bookingRead.data : null;
  return actionSuccess({ ...empty, ...availability.data, booking, phone: profileRead.data?.phone ?? null });
}

/**
 * Requests one of the service's open hours. `request_service_booking` re-checks
 * the slot under a per-provider lock; the provider then accepts or declines.
 */
export async function requestServiceBooking(input: { serviceId: string; slotStart: string; note: string; phone: string }): Promise<ActionResult<{ booking: ServiceBooking }>> {
  const parsed = parseBookingRequest(input);
  if (!parsed.ok) return actionFailure(parsed.error);
  const supabase = await createClient();
  const { user } = await currentUser(supabase);
  if (!user) return actionFailure("Sign in to book this service.");

  const { serviceId, slotStart, note, phone } = parsed.value;
  const { data, error } = await supabase.rpc("request_service_booking", { target_service_id: serviceId, slot_start: slotStart, note, phone });
  if (error) {
    logger.warn("Failed to request service booking", { serviceId, error: error.message });
    return actionFailure("The booking could not be confirmed. Check your bookings and try again.");
  }
  const outcome = data?.[0];
  switch (outcome?.result) {
    case "requested":
    case "request_in_progress": {
      if (!outcome.booking_id) return actionFailure("The booking could not be confirmed. Try again.");
      const { data: booking, error: readError } = await supabase.from("service_bookings").select("*").eq("id", outcome.booking_id).single();
      if (readError || !booking) return actionFailure("The booking was sent but could not be loaded. Reopen the service to check it.");
      if (outcome.result === "requested") await notify({
        recipientId: booking.provider_id, actorId: user.id, booking, role: "provider", event: "requested",
        title: "Booking request",
        message: `${booking.customer_name ?? "A customer"} asked for ${formatSlotRequest(booking.slot_start)}: ${booking.note.slice(0, 120)}`,
      });
      return actionSuccess({ booking });
    }
    case "slot_unavailable":
      return actionFailure("That time was just taken or is no longer open. Choose another time.");
    case "own_service":
      return actionFailure("You can't book your own service.");
    case "service_unavailable":
      return actionFailure("This service is no longer taking bookings.");
    case "invalid_input":
      return actionFailure("Check the job description and phone number.");
    case "access_denied":
      return actionFailure("Sign in again before booking.");
    default:
      return actionFailure("The booking could not be sent. Try again.");
  }
}

const RESPONSE_COPY = {
  accepted: { title: "Booking confirmed", message: (at: string) => `Your booking for ${at} is confirmed.` },
  declined: { title: "Booking declined", message: (at: string) => `The provider can't make ${at}. Choose another time.` },
  cancelled: { title: "Booking cancelled", message: (at: string) => `The booking for ${at} was cancelled.` },
} as const;

async function respond(bookingId: string, action: "accept" | "decline" | "cancel"): Promise<ActionResult<{ booking: ServiceBooking }>> {
  const parsed = idSchema.safeParse(bookingId);
  if (!parsed.success) return actionFailure("Invalid booking.");
  const supabase = await createClient();
  const { user } = await currentUser(supabase);
  if (!user) return actionFailure("Sign in to manage this booking.");

  const { data, error } = await supabase.rpc("respond_service_booking", { target_booking_id: parsed.data, action });
  if (error) return actionFailure("The booking change could not be confirmed. Reload and check it.");
  const outcome = data?.[0];
  if (outcome?.result === "access_denied") return actionFailure("You are not part of this booking.");
  if (outcome?.result === "invalid_transition") return actionFailure("This booking is no longer open.");
  if (outcome?.result !== "updated" && outcome?.result !== "noop") return actionFailure("The booking could not be updated. Try again.");

  const { data: booking, error: readError } = await supabase.from("service_bookings").select("*").eq("id", parsed.data).single();
  if (readError || !booking) return actionFailure("The booking was updated but could not be loaded. Reload to check it.");
  if (outcome.result === "updated" && booking.status in RESPONSE_COPY) {
    const copy = RESPONSE_COPY[booking.status as keyof typeof RESPONSE_COPY];
    const toProvider = user.id === booking.customer_id;
    await notify({
      recipientId: toProvider ? booking.provider_id : booking.customer_id, actorId: user.id, booking,
      role: toProvider ? "provider" : "customer", event: booking.status,
      title: copy.title, message: copy.message(formatSlotRequest(booking.slot_start)),
    });
  }
  return actionSuccess({ booking });
}

/** Provider confirms a pending request. */
export async function acceptServiceBooking(bookingId: string) {
  return respond(bookingId, "accept");
}

/** Provider turns down a pending request. */
export async function declineServiceBooking(bookingId: string) {
  return respond(bookingId, "decline");
}

/** Either party cancels a live booking before it starts. */
export async function cancelServiceBooking(bookingId: string) {
  return respond(bookingId, "cancel");
}

/** The signed-in provider's live and upcoming bookings across all their services, soonest first. */
export async function getProviderBookings(): Promise<ActionResult<{ bookings: ProviderBooking[] }>> {
  const supabase = await createClient();
  const { user } = await currentUser(supabase);
  if (!user) return actionFailure("Sign in to see your bookings.");
  const { data, error } = await supabase.from("service_bookings").select("*").eq("provider_id", user.id).in("status", LIVE)
    .gte("slot_start", new Date(Date.now() - 60 * 60_000).toISOString()).order("slot_start").limit(100);
  if (error) {
    logger.warn("Failed to load provider bookings", { providerId: user.id, error: error.message });
    return actionFailure("Bookings could not be loaded. Try again.");
  }
  const live = data.filter(booking => isLiveBooking(booking));
  const ids = [...new Set(live.map(booking => booking.service_id))];
  const titles = new Map<string, string>();
  if (ids.length) {
    const { data: services } = await (await serviceClient()).from("service_submissions").select("id,draft,submitted").in("id", ids);
    for (const service of services ?? []) {
      const title = [service.submitted, service.draft]
        .map(content => (content && typeof content === "object" && !Array.isArray(content) ? content.title : undefined))
        .find((value): value is string => typeof value === "string" && value.trim().length > 0);
      if (title) titles.set(service.id, title);
    }
  }
  return actionSuccess({ bookings: live.map(booking => ({ ...booking, serviceTitle: titles.get(booking.service_id) ?? "Your service" })) });
}

/** The weekly booking hours of one of the signed-in provider's services, Sunday first. */
export async function getServiceHours(serviceId: string): Promise<ActionResult<{ hours: ViewingHour[] }>> {
  const parsed = idSchema.safeParse(serviceId);
  if (!parsed.success) return actionFailure("Invalid service.");
  const supabase = await createClient();
  const { user } = await currentUser(supabase);
  if (!user) return actionFailure("Sign in to manage booking hours.");
  const { data, error } = await supabase.from("service_hours").select("weekday, start_minute, end_minute").eq("service_id", parsed.data).order("weekday");
  if (error) {
    logger.warn("Failed to load service hours", { serviceId: parsed.data, error: error.message });
    return actionFailure("Booking hours could not be loaded. Try again.");
  }
  return actionSuccess({ hours: data.map(row => ({ weekday: row.weekday, startMinute: row.start_minute, endMinute: row.end_minute })) });
}

/** Replaces the service's whole weekly schedule. An empty list turns booking off. */
export async function saveServiceHours(serviceId: string, input: ViewingHour[]): Promise<ActionResult<{ hours: ViewingHour[] }>> {
  const parsedId = idSchema.safeParse(serviceId);
  const parsed = hoursSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return actionFailure("Booking hours are out of range.");
  const valid = validateServiceHours(parsed.data);
  if (!valid.ok) return actionFailure(valid.error);
  const supabase = await createClient();
  const { user } = await currentUser(supabase);
  if (!user) return actionFailure("Sign in to manage booking hours.");
  const { error } = await supabase.rpc("set_service_hours", { target_service_id: parsedId.data, hours: valid.hours });
  if (error) {
    logger.warn("Failed to save service hours", { serviceId: parsedId.data, error: error.message });
    return actionFailure(error.code === "42501" ? "Sign in again before changing booking hours." : "Booking hours could not be saved. Try again.");
  }
  return actionSuccess({ hours: valid.hours });
}
