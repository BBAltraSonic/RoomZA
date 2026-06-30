"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Home, Loader2, Plus, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { proposeViewingSlots } from "@/features/viewings/actions/propose-viewing-slots";
import { cn } from "@/lib/utils";

interface ProposeViewingModalProps {
  listingId: string;
  applicantIds: string[];
}

export function ProposeViewingModal({ listingId, applicantIds }: ProposeViewingModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"in_person" | "video_call">("in_person");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("12:00");
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSlot = () => {
    if (!date) return;
    const [hours = "0", minutes = "0"] = time.split(":");
    const start = new Date(date);
    start.setHours(Number.parseInt(hours), Number.parseInt(minutes), 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

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
    if (slots.length === 0) {
      toast.error("Please add at least one time slot");
      return;
    }

    setIsSubmitting(true);
    const result = await proposeViewingSlots({
      listingId,
      applicationIds: applicantIds,
      mode,
      slots,
    });

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Viewing slots proposed");
      setOpen(false);
      setSlots([]);
      router.refresh();
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-10 w-full border-forest/30 text-forest hover:bg-accent sm:h-9 sm:w-auto">
        <CalendarIcon className="size-4" />
        Propose viewings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden border-border bg-panel p-0 sm:max-w-[460px] sm:rounded-lg">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="text-xl font-semibold tracking-normal text-ink">Propose viewing times</DialogTitle>
            <p className="text-sm text-muted-foreground">Send one or more time slots for the renter to choose from.</p>
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
                    onClick={() => setMode(option.value)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected ? "bg-panel text-forest shadow-[var(--elevation-1)]" : "text-muted-foreground hover:text-ink",
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
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md" />
            </div>

            <div className="flex gap-2">
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="h-10 flex-1 rounded-md border border-input bg-warm-surface px-3 text-sm text-ink outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <Button onClick={handleAddSlot} disabled={!date} className="h-10 bg-forest text-primary-foreground hover:bg-forest/90" aria-label="Add slot">
                <Plus className="size-4" />
              </Button>
            </div>

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
                      <span>{format(new Date(slot.startTime), "MMM d, h:mm a")}</span>
                      <span className="ml-auto mr-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        {mode === "video_call" ? <Video className="size-3.5" /> : <Home className="size-3.5" />}
                        {mode === "video_call" ? "Video" : "In-person"}
                      </span>
                      <button
                        type="button"
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
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Send proposal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
