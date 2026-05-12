import Link from "next/link";
import Image from "next/image";
import { Building2, ChevronLeft, Bed, Bath } from "lucide-react";

type ChatHeaderConversation = {
    listing: {
        title: string;
        price: number;
        bedrooms?: number | null;
        bathrooms?: number | null;
        listing_images?: { public_url: string; sort_order?: number | null }[] | null;
    };
};

function formatCurrency(amount: number) {
    return `R ${new Intl.NumberFormat("en-ZA").format(amount)}`;
}

export function ChatHeader({
    conversation,
    backUrl = "/dashboard/conversations"
}: {
    conversation: ChatHeaderConversation;
    backUrl?: string;
}) {
    const listing = conversation.listing;
    let thumbnailUrl = "";
    if (Array.isArray(listing.listing_images) && listing.listing_images.length > 0) {
        const sortedImages = [...listing.listing_images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        thumbnailUrl = sortedImages[0]?.public_url || "";
    }

    return (
        <div className="flex h-20 shrink-0 items-center border-b border-border/40 bg-white px-4 sm:px-6 shadow-sm z-10 w-full relative">
            <Link
                href={backUrl}
                className="mr-5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-zinc-50 transition-colors hover:bg-zinc-100"
            >
                <ChevronLeft className="size-5 text-zinc-600" />
            </Link>

            <div className="flex flex-1 items-center gap-4 overflow-hidden">
                {thumbnailUrl ? (
                    <Image
                        src={thumbnailUrl}
                        alt={listing.title}
                        width={48}
                        height={48}
                        unoptimized
                        className="size-12 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-border/20"
                    />
                ) : (
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted/30 ring-1 ring-border/20">
                        <Building2 className="size-5 text-muted-foreground/40" />
                    </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="truncate text-base font-semibold tracking-tight text-zinc-900">{listing.title}</h2>
                    <div className="mt-0.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="font-semibold text-zinc-700">{formatCurrency(listing.price)}/mo</span>
                        <span className="size-1 rounded-full bg-border"></span>
                        <span className="flex items-center gap-1"><Bed className="size-3" /> {listing.bedrooms}</span>
                        <span className="flex items-center gap-1"><Bath className="size-3" /> {listing.bathrooms}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
