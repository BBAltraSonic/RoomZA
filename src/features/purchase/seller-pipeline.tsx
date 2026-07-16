"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, MessageSquare, Phone, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getOrCreateBuyerInterestConversation, updateBuyerInterest } from "@/features/purchase/actions";
import { SuccessFeedback } from "@/lib/motion/primitives";
import { BUYER_INTEREST_STATUSES, buyerInterestStatusLabels, type BuyerInterestStatus } from "@/features/purchase/pipeline";
import { formatPrice } from "@/lib/utils";

type BuyerInterestRow = {
  id: string;
  status: BuyerInterestStatus;
  notes: string | null;
  viewing_date: string | null;
  created_at: string;
  updated_at: string;
  buyer?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  listing?: {
    id: string;
    title: string;
    address: string;
    sale_price: number | null;
    price: number;
  } | null;
  viewings?: { id: string; status: string; slot?: { start_time: string | null } | null }[] | null;
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function viewingLabel(row: BuyerInterestRow) {
  const confirmed = row.viewings?.find((viewing) => viewing.status !== "cancelled");
  if (confirmed?.slot?.start_time) {
    return `Booked ${new Date(confirmed.slot.start_time).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}`;
  }
  if (row.viewing_date) {
    return `Requested ${new Date(row.viewing_date).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}`;
  }
  return "No viewing yet";
}

function BuyerInterestCard({ row }: { row: BuyerInterestRow }) {
  const router = useRouter();
  const [status, setStatus] = useState<BuyerInterestStatus>(row.status);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [viewingDate, setViewingDate] = useState(toDateTimeLocal(row.viewing_date));
  const [isPending, startTransition] = useTransition();
  const [successSequence, setSuccessSequence] = useState(0);
  const buyerName = row.buyer?.full_name || row.buyer?.email || "Buyer";
  const listingPrice = row.listing?.sale_price ?? row.listing?.price ?? 0;

  function handleSave() {
    startTransition(async () => {
      const result = await updateBuyerInterest({
        buyerInterestId: row.id,
        status,
        notes,
        viewingDate: viewingDate ? new Date(viewingDate).toISOString() : null,
      });
      if (result.success) {
        setSuccessSequence((sequence) => sequence + 1);
        toast.success("Buyer interest updated");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleConversation() {
    startTransition(async () => {
      const result = await getOrCreateBuyerInterestConversation(row.id);
      if (result.success) {
        router.push(`/messages/${result.data.conversationId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <article className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{buyerName}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.buyer?.email ?? "No email on profile"}</p>
        </div>
        <span className="rounded-md bg-warm-surface px-2 py-1 text-xs font-semibold text-muted-foreground">
          {new Date(row.updated_at).toLocaleDateString("en-ZA")}
        </span>
      </div>

      <div className="mt-4 rounded-md bg-warm-surface p-3">
        <p className="line-clamp-1 text-sm font-semibold text-ink">{row.listing?.title ?? "Property"}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.listing?.address ?? "No address"}</p>
        <p className="mt-2 text-sm font-bold text-forest">{formatPrice(listingPrice)}</p>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Pipeline status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as BuyerInterestStatus)}>
            <SelectTrigger className="mt-2 bg-background shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUYER_INTEREST_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {buyerInterestStatusLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`viewing-${row.id}`} className="text-xs font-semibold uppercase text-muted-foreground">
            Viewing
          </Label>
          <div className="mt-2 flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <Input
              id={`viewing-${row.id}`}
              type="datetime-local"
              value={viewingDate}
              onChange={(event) => setViewingDate(event.target.value)}
              className="bg-background shadow-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{viewingLabel(row)}</p>
        </div>

        <div>
          <Label htmlFor={`notes-${row.id}`} className="text-xs font-semibold uppercase text-muted-foreground">
            Private notes
          </Label>
          <Textarea
            id={`notes-${row.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Add seller-only context for follow-up."
            className="mt-2 bg-background shadow-none"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={isPending} className="h-9 bg-forest text-primary-foreground hover:bg-forest/90">
          <Save className="size-4" />
          Save
        </Button>
        <Button type="button" variant="outline" onClick={handleConversation} disabled={isPending} className="h-9">
          <MessageSquare className="size-4" />
          Contact
        </Button>
        {row.buyer?.phone ? (
          <Button type="button" variant="ghost" render={<a href={`tel:${row.buyer.phone}`} />} className="h-9">
            <Phone className="size-4" />
            Call
          </Button>
        ) : null}
      </div>
      {successSequence > 0 ? (
        <SuccessFeedback
          compact
          eventKey={`buyer-progress-${row.id}-${successSequence}`}
          title="Buyer progress updated"
          className="mt-3"
        />
      ) : null}
    </article>
  );
}

export function SellerPipeline({ interests }: { interests: BuyerInterestRow[] }) {
  const grouped = BUYER_INTEREST_STATUSES.map((status) => ({
    status,
    rows: interests.filter((interest) => interest.status === status),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {grouped.map((group) => (
        <section key={group.status} className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-ink">{buyerInterestStatusLabels[group.status]}</h2>
            <span className="rounded-md bg-panel px-2 py-1 text-xs font-semibold text-muted-foreground shadow-[var(--neu-inset-sm)]">
              {group.rows.length}
            </span>
          </div>
          <div className="space-y-3">
            {group.rows.length > 0 ? (
              group.rows.map((row) => <BuyerInterestCard key={row.id} row={row} />)
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
                No buyers in this stage.
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
