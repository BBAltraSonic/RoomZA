"use client";

import { useRef, useState } from "react";
import { CalendarClock, Home, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { bookViewingSlot } from "@/features/viewings/actions/book-viewing-slot";
import { bookBuyerViewingSlot } from "@/features/purchase/actions";
import { cn } from "@/lib/utils";
import { formatViewingDay, formatViewingTime } from "@/features/viewings/sast-time";
import { PendingGlyph, SuccessFeedback } from "@/lib/motion/primitives";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  mode?: "in_person" | "video_call";
}

type SelectViewingSlotProps = { slots: Slot[] } & (
  { applicationId: string; buyerInterestId?: never } |
  { buyerInterestId: string; applicationId?: never }
);

export function SelectViewingSlot({ applicationId, buyerInterestId, slots }: SelectViewingSlotProps) {
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [bookedViewingId, setBookedViewingId] = useState<string | null>(null);
  const [bookedMode, setBookedMode] = useState<Slot["mode"]>();
  const pendingRef = useRef(false);

  const handleBook = async () => {
    if (!selectedSlotId || pendingRef.current) return;

    pendingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = buyerInterestId !== undefined
        ? await bookBuyerViewingSlot({ buyerInterestId, slotId: selectedSlotId })
        : await bookViewingSlot({ applicationId, slotId: selectedSlotId });
      if (!result.success) {
        toast.error(result.error);
        setSelectedSlotId(null);
      } else if (typeof result.data === "string") {
        toast.success("Viewing booked");
        setBookedViewingId(result.data);
        setBookedMode(slots.find(slot => slot.id === selectedSlotId)?.mode);
        setIsBooked(true);
        router.refresh();
      } else {
        toast.error("Viewing could not be booked. Please try again.");
      }
    } catch {
      toast.error("The booking response could not be received. Refresh to check your booking before trying again.");
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (isBooked) {
    return (
      <div className="rounded-lg border border-status-success-border bg-status-success-surface p-5 text-center text-status-success-text">
        <SuccessFeedback eventKey={`viewing-booked-${bookedViewingId ?? applicationId ?? buyerInterestId}`} title="Viewing confirmed" description={bookedMode === "video_call" ? "Your video appointment is booked." : "Meet at the property at your booked time."} />
        {bookedViewingId && bookedMode === "video_call" ? (
          <Button
            render={<Link href={`/viewings/${bookedViewingId}/live`} />}
            className="mt-4 h-10 bg-forest text-primary-foreground hover:bg-forest/90"
          >
            <Video className="size-4" />
            Open viewing
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <CalendarClock className="size-5 text-forest" />
        <div>
          <h3 className="text-base font-semibold text-ink">Select a viewing time</h3>
          <p className="text-sm text-muted-foreground">The property owner proposed these slots.</p>
        </div>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-warm-surface py-6 text-center text-sm text-muted-foreground">
          No available slots.
        </p>
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => {
            const isSelected = selectedSlotId === slot.id;

            return (
              <button
                key={slot.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => setSelectedSlotId(slot.id)}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected ? "border-selection bg-selection text-selection-foreground" : "border-border bg-warm-surface hover:border-forest/35",
                )}
              >
                <span className="block text-sm font-semibold">{formatViewingDay(slot.start_time)}</span>
                <span className={cn("mt-1 block text-sm", isSelected ? "text-selection-foreground" : "text-muted-foreground")}>{formatViewingTime(slot.start_time)}</span>
                <span className={cn("mt-3 inline-flex items-center gap-1 text-xs font-semibold", isSelected ? "text-selection-foreground" : "text-brand-ink")}>
                  {slot.mode === "video_call" ? <Video className="size-3.5" /> : <Home className="size-3.5" />}
                  {slot.mode === "video_call" ? "Video call" : "In-person"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Button
        className="h-10 w-full bg-forest text-primary-foreground hover:bg-forest/90 sm:w-auto"
        disabled={!selectedSlotId || isSubmitting}
        onClick={handleBook}
      >
        {isSubmitting ? <PendingGlyph label="Confirming booking" /> : "Confirm booking"}
      </Button>
    </div>
  );
}
