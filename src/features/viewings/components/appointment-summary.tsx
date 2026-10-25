import Link from "next/link";
import type { ViewingSlotRef } from "@/features/applications/application-types";
import { singleSlot, availableViewingSlots } from "../appointment-summary";
import { SelectViewingSlot } from "./select-viewing-slot";

type Props = {
  now: number;
  applicationId?: string;
  buyerInterestId?: string;
  viewings: { id: string; status: string; slot: ViewingSlotRef | ViewingSlotRef[] | null }[];
  offers: { slot: ViewingSlotRef | ViewingSlotRef[] | null }[];
};

export function AppointmentSummary({ applicationId, buyerInterestId, viewings, offers, now }: Props) {
  const booked = viewings.find(viewing => viewing.status === "booked");
  const slot = booked ? singleSlot(booked.slot) : null;
  if (booked && slot) return <div className="space-y-2 rounded-lg border border-border bg-accent p-4">
    <p className="font-semibold">Viewing booked · {slot.mode === "video_call" ? "Video call" : "In-person"}</p>
    <time dateTime={slot.start_time}>{new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(slot.start_time))} SAST</time>
    {slot.mode === "video_call" ? <Link href={`/viewings/${booked.id}/live`} className="inline-flex min-h-11 items-center font-semibold text-forest underline">Open video viewing</Link> : <p className="text-sm text-muted-foreground">Meet at the property address above.</p>}
  </div>;
  const available = availableViewingSlots(offers, now);
  if (!available.length) return <p className="text-sm text-muted-foreground">No viewing times are currently available. Open the property to contact the owner.</p>;
  return buyerInterestId
    ? <SelectViewingSlot buyerInterestId={buyerInterestId} slots={available} />
    : applicationId ? <SelectViewingSlot applicationId={applicationId} slots={available} /> : null;
}
