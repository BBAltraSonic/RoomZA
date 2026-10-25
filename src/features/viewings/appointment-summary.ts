import type { ViewingSlotRef } from "@/features/applications/application-types";

export function singleSlot(value: ViewingSlotRef | ViewingSlotRef[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function availableViewingSlots(
  offers: { slot: ViewingSlotRef | ViewingSlotRef[] | null }[],
  now: number,
) {
  return offers.map(offer => singleSlot(offer.slot)).filter((slot): slot is ViewingSlotRef =>
    Boolean(slot && !slot.is_booked && Date.parse(slot.start_time) > now),
  ).sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
}
