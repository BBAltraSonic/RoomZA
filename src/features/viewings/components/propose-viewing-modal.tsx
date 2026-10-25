"use client";

import { useRef, useState } from "react";
import { Calendar as CalendarIcon, Home, Plus, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proposeViewingSlots } from "@/features/viewings/actions/propose-viewing-slots";
import { proposeBuyerViewingSlots, type BuyerViewingProposalResult } from "@/features/purchase/actions";
import { validateViewingSlots } from "@/features/viewings/slot-validation";
import { formatViewingDay, formatViewingTime, viewingCalendarInstant } from "@/features/viewings/sast-time";
import { cn } from "@/lib/utils";
import { PendingGlyph } from "@/lib/motion/primitives";

const Calendar = dynamic(() => import("@/components/ui/calendar").then(module => module.Calendar), {
  loading: () => <p role="status" className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">Loading calendar…</p>,
});

type ProposeViewingModalProps = { listingId: string; disabled?: boolean } & (
  { applicantIds: string[]; buyerInterestId?: never; expectedUpdatedAt?: never } |
  { buyerInterestId: string; expectedUpdatedAt: string; applicantIds?: never; onBuyerProposed?: (result: BuyerViewingProposalResult) => void }
);

export function ProposeViewingModal(props: ProposeViewingModalProps) {
  const { listingId, applicantIds, buyerInterestId, expectedUpdatedAt, disabled } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in_person" | "video_call">("in_person");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("12:00");
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pendingRef = useRef(false);
  const rentalAttempt = useRef<{ id: string; fingerprint: string } | null>(null);

  const handleAddSlot = () => {
    if (!date || pendingRef.current) return;
    const instant = viewingCalendarInstant(date, time);
    if (!instant) { toast.error("Choose a valid viewing time."); return; }
    const start = new Date(instant);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const validation = validateViewingSlots([{ startTime: start.toISOString(), endTime: end.toISOString() }], new Date());
    if (!validation.valid) { toast.error(validation.errors.join(" ")); return; }
    if (slots.some(slot => slot.startTime === start.toISOString())) { toast.error("This time is already added."); return; }

    setSlots((prev) => [
      ...prev,
      {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    ]);
    setDate(undefined);
  };

  const handlePropose = async () => {
    if (pendingRef.current) return;
    if (slots.length === 0) {
      toast.error("Please add at least one time slot");
      return;
    }

    pendingRef.current = true;
    setIsSubmitting(true);
    try {
      const fingerprint = JSON.stringify({ listingId, applicantIds, mode, slots });
      if (buyerInterestId === undefined && rentalAttempt.current?.fingerprint !== fingerprint) {
        rentalAttempt.current = { id: crypto.randomUUID(), fingerprint };
      }
      const result = buyerInterestId !== undefined
        ? await proposeBuyerViewingSlots({ buyerInterestId, expectedUpdatedAt, mode, slots })
        : await proposeViewingSlots({ proposalId: rentalAttempt.current!.id, listingId, applicationIds: applicantIds, mode, slots });
      if (!result.success) toast.error(result.error);
      else {
        if (buyerInterestId !== undefined && result.data && "updatedAt" in result.data) {
          props.onBuyerProposed?.(result.data);
        }
        toast.success("Viewing slots proposed");
        setOpen(false);
        setSlots([]);
        rentalAttempt.current = null;
        router.refresh();
      }
    } catch {
      toast.error("The proposal response could not be received. Check your viewings before retrying.");
    } finally {
      pendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" disabled={disabled || isSubmitting} onClick={() => setOpen(true)} className="h-10 w-full border-forest/30 text-forest hover:bg-accent sm:h-9 sm:w-auto">
        <CalendarIcon className="size-4" />
        Propose viewings
      </Button>
      <Dialog open={open} onOpenChange={next => { if (!pendingRef.current) setOpen(next); }}>
        <DialogContent className="overflow-hidden border-border bg-panel p-0 sm:max-w-[460px] sm:rounded-lg">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-normal text-ink">Propose viewing times</DialogTitle>
            <p className="text-sm text-muted-foreground">Send one or more time slots for the {buyerInterestId ? "buyer" : "renter"} to choose from.</p>
          </DialogHeader>

          <div className="max-h-[65dvh] space-y-5 overflow-y-auto p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-warm-surface p-1">
              {[
                { value: "in_person" as const, label: "In-person", icon: Home },
                { value: "video_call" as const, label: "Video call", icon: Video },
              ].map((option) => {
                const Icon = option.icon;
                const isSelected = mode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setMode(option.value)}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected ? "bg-selection text-selection-foreground shadow-[var(--elevation-1)]" : "text-muted-foreground hover:text-ink",
                    )}
                    aria-pressed={isSelected}
                  >
                    <Icon className="size-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-border bg-warm-surface p-2">
              <Calendar mode="single" selected={date} onSelect={setDate} disabled={isSubmitting} className="rounded-md" />
            </div>

            <div className="flex gap-2">
              <input
                type="time"
                disabled={isSubmitting}
                aria-label="Viewing start time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-10 flex-1 rounded-md border border-input bg-warm-surface px-3 text-sm text-ink outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <Button onClick={handleAddSlot} disabled={!date || isSubmitting} className="h-10 bg-forest text-primary-foreground hover:bg-forest/90" aria-label="Add slot">
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Times are in South African time (SAST).</p>

            <div>
              <h4 className="text-sm font-semibold text-ink">Selected slots</h4>
              {slots.length === 0 ? (
                <p className="mt-2 rounded-md border border-dashed border-border bg-warm-surface p-4 text-center text-sm text-muted-foreground">
                  No slots added yet.
                </p>
              ) : (
                <ul className="mt-2 max-h-[150px] space-y-2 overflow-y-auto pr-1">
                  {slots.map((slot, index) => (
                    <li key={slot.startTime} className="flex items-center justify-between rounded-md border border-border bg-warm-surface px-3 py-2 text-sm">
                      <span>{formatViewingDay(slot.startTime)}, {formatViewingTime(slot.startTime)}</span>
                      <span className="ml-auto mr-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        {mode === "video_call" ? <Video className="size-3.5" /> : <Home className="size-3.5" />}
                        {mode === "video_call" ? "Video" : "In-person"}
                      </span>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setSlots((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove slot"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-warm-surface p-4">
            <Button
              className="h-11 w-full bg-forest text-primary-foreground hover:bg-forest/90"
              onClick={handlePropose}
              disabled={isSubmitting || slots.length === 0}
            >
              {isSubmitting ? <PendingGlyph label="Sending viewing proposal" /> : "Send proposal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
