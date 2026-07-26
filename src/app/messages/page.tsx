import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, MapPin, MessageSquare, User } from "lucide-react";

import { EmptyState } from "@/components/premium/primitives";
import { DiscoveryPage } from "@/features/map-discovery/discovery-page";
import { getConversations } from "@/features/chat/actions";
import { requireUser } from "@/lib/auth";
import { sanitizeUserText } from "@/lib/sanitize";

import { getProfileDisplayName } from "@/lib/utils";

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d`;
  return new Intl.DateTimeFormat("en-ZA", { month: "short", day: "numeric" }).format(date);
}

export default async function MessagesOverviewPage() {
  const { user, profile } = await requireUser({ redirectTo: "/messages" });
  const conversations = await getConversations();
  const isLandlord = profile?.role === "landlord";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      {/* Map background — mobile only. On desktop, Messages is its own screen. */}
      <div className="absolute inset-0 z-0 sm:hidden">
        <Suspense fallback={null}>
          <DiscoveryPage
            googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            googleMapsMapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
            hideSidebar
          />
        </Suspense>
      </div>

      <section className="absolute inset-x-0 top-0 bottom-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom))] z-40 flex w-full flex-col overflow-hidden border-border bg-panel shadow-[var(--elevation-3)] sm:inset-0 sm:bottom-0 sm:shadow-none">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden sm:px-6">
          <div
            className="flex items-end justify-between gap-4 border-b border-border px-5 pb-4 pt-4 sm:px-0 sm:pb-6 sm:pt-10"
            style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
          >
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-clay">Inbox</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Messages</h1>
              <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2">
                Listing conversations stay tied to the home and applicant context.
              </p>
            </div>
            <Link
              href="/"
              className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-panel px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-forest hover:text-forest sm:inline-flex"
            >
              <MapPin className="size-4" />
              Back to map
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-5 sm:px-0 sm:pb-10 sm:pt-5">
            {conversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No messages yet"
                description={isLandlord
                  ? "Messages begin when a renter contacts a published listing or you reply from an applicant record."
                  : "Open a home and contact the landlord when you have a specific question. Conversations stay tied to that listing."}
                action={
                  <Link
                    href={isLandlord ? "/dashboard/applicants" : "/"}
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 text-sm font-semibold text-primary-foreground hover:bg-forest/90"
                  >
                    {isLandlord ? "Open applicants" : "Explore homes"}
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {conversations.map((convo) => {
                  const isLandlord = convo.landlord_id === user.id;
                  const renter = Array.isArray(convo.renter) ? convo.renter[0] : convo.renter;
                  const landlord = Array.isArray(convo.landlord) ? convo.landlord[0] : convo.landlord;
                  const otherPerson = isLandlord ? renter : landlord;
                  const otherPersonName = getProfileDisplayName(otherPerson);
                  const listing = Array.isArray(convo.listing) ? convo.listing[0] : convo.listing;
                  const displayAddress = listing?.address || "Unknown property";
                  const listingImage = listing?.listing_images?.[0]?.public_url;
                  const latestTime = convo.latest_message ? convo.latest_message.created_at : convo.created_at;
                  const latestMessageText = convo.latest_message ? sanitizeUserText(convo.latest_message.content) : null;

                  return (
                    <li key={convo.id}>
                      <Link
                        href={`/messages/${convo.id}`}
                        className="group flex items-center gap-3 rounded-2xl border border-border bg-panel p-3.5 shadow-[var(--elevation-1)] transition-all hover:border-forest/30 hover:bg-warm-surface active:scale-[0.98] sm:rounded-xl sm:active:scale-100"
                      >
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          {listingImage ? (
                            <Image src={listingImage} alt={displayAddress} fill sizes="56px" className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <User className="size-6" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="truncate text-sm font-bold text-ink">{otherPersonName}</h2>
                            <span className="text-[0.7rem] font-medium text-muted-foreground">{formatRelativeTime(latestTime)}</span>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-[0.7rem] font-bold text-forest">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{displayAddress}</span>
                          </p>
                          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                            {convo.latest_message
                              ? convo.latest_message.sender_id === user.id
                                ? `You: ${latestMessageText}`
                                : latestMessageText
                              : "Start the conversation"}
                          </p>
                        </div>

                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-forest" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
