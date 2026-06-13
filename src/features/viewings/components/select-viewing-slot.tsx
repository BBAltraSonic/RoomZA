"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarClock, CheckCircle, Home, Loader2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { bookViewingSlot } from "@/features/viewings/actions/book-viewing-slot";
import { cn } from "@/lib/utils";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  mode?: "in_person" | "video_call";
}

interface SelectViewingSlotProps {
  applicationId: string;
  slots: Slot[];
}

export function SelectViewingSlot({ applicationId, slots }: SelectViewingSlotProps) {
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [bookedViewingId, setBookedViewingId] = useState<string | null>(null);

  const handleBook = async () => {
    if (!selectedSlotId) return;

    setIsSubmitting(true);
    const result = await bookViewingSlot({
      applicationId,
      slotId: selectedSlotId,
    });

    if (result?.error) {
      toast.error(result.error);
      setSelectedSlotId(null);
    } else if (typeof result?.success === "string") {
      toast.success("Viewing booked");
      setBookedViewingId(result.success);
      setIsBooked(true);
      router.refresh();
    } else {
      toast.error("Viewing could not be booked. Please try again.");
    }
    setIsSubmitting(false);
  };

  if (isBooked) {
    return (
      <div className="rounded-lg border border-forest/20 bg-accent p-5 text-center text-forest">
        <CheckCircle className="mx-auto mb-3 size-8" />
        <h3 className="text-lg font-semibold">Viewing confirmed</h3>
        <p className="mt-1 text-sm">You are all set.</p>
        {bookedViewingId ? (
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
          <p className="text-sm text-muted-foreground">The landlord proposed these slots.</p>
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
                onClick={() => setSelectedSlotId(slot.id)}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected ? "border-forest bg-accent text-forest" : "border-border bg-warm-surface hover:border-forest/35",
                )}
              >
                <span className="block text-sm font-semibold">{format(new Date(slot.start_time), "MMM d")}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{format(new Date(slot.start_time), "h:mm a")}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest">
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
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Confirm booking"}
      </Button>
    </div>
  );
}
