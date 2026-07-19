import Image from "next/image";
import Link from "next/link";
import { Bath, Bed, Building2, ChevronLeft } from "lucide-react";

import { CallButton } from "./call-button";
import { ReportPanel } from "@/features/admin/components/report-panel";

type ChatHeaderConversation = {
  id: string;
  listing: {
    title: string;
    price: number;
    bedrooms?: number | null;
    bathrooms?: number | null;
    listing_images?: { public_url: string; sort_order?: number | null }[] | null;
  };
};

import { formatCurrency } from "@/lib/utils";

export function ChatHeader({
  conversation,
  backUrl = "/messages",
  reportedUserId,
}: {
  conversation: ChatHeaderConversation;
  backUrl?: string;
  reportedUserId: string;
}) {
  const listing = conversation.listing;
  const thumbnailUrl = [...(listing.listing_images ?? [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.public_url ?? "";

  return (
    <header
      className="relative z-10 flex min-h-16 shrink-0 items-center border-b border-border bg-panel/90 px-4 pb-3 shadow-none backdrop-blur-md sm:h-20 sm:border-border sm:px-6 sm:pb-0 sm:pt-0 sm:shadow-[var(--elevation-1)] sm:backdrop-blur-none"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
    >
      <Link
        href={backUrl}
        className="mr-3 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-warm-surface text-ink transition-all active:scale-90 sm:mr-4 sm:size-10 sm:rounded-md sm:active:scale-100"
        aria-label="Back"
      >
        <ChevronLeft className="size-5" />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={listing.title}
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-border sm:size-12 sm:rounded-md"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-warm-surface sm:size-12 sm:rounded-md">
            <Building2 className="size-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold tracking-tight text-ink sm:text-base">{listing.title}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-[0.7rem] font-bold text-muted-foreground sm:mt-1">
            <span className="text-forest">{formatCurrency(listing.price)}/mo</span>
            <span className="h-0.5 w-0.5 rounded-full bg-border" />
            <span className="flex items-center gap-1">
              <Bed className="size-3" />
              {listing.bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <Bath className="size-3" />
              {listing.bathrooms}
            </span>
          </div>
        </div>
      </div>

      <CallButton conversationId={conversation.id} className="ml-2 sm:ml-4" />
      <ReportPanel reportedUserId={reportedUserId} label="Report" popover className="ml-2" />
    </header>
  );
}
