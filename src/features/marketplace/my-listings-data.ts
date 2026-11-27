import { unstable_rethrow } from "next/navigation";
import { getHostUpcomingLiveTours } from "@/features/live-tours/actions";
import { getInstantConnectPhase3Flags } from "@/features/live-tours/feature-flags";
import { getMyListings } from "@/features/listings/actions";
import { readEntryWorkspace } from "@/features/entries/workspace-data";
import { privateEntryStatus } from "@/features/entries/workspace-contract";
import { readOfferWorkspace } from "@/features/offers/workspace-data";
import { privateOfferStatus } from "@/features/offers/workspace-contract";
import { logger } from "@/lib/logger";

import type { CategoryLoad, ListingCategory } from "./my-listings";
import type { ManagedItem } from "./my-listings-view";

/** Rows shown per non-property category; the rest are one "See all" away. */
const PREVIEW_LIMIT = 20;

type ListLoad = CategoryLoad & { items: ManagedItem[] };
type PropertyData = Extract<Awaited<ReturnType<typeof getMyListings>>, { success: true }>["data"];
type PropertyLoad = CategoryLoad & {
  rows: PropertyData;
  upcomingTours: Awaited<ReturnType<typeof getHostUpcomingLiveTours>>;
  scheduledToursEnabled: boolean;
};

function failed(category: string, error: unknown): CategoryLoad {
  // Redirects and request-time signals are Next.js control flow, not load failures.
  unstable_rethrow(error);
  logger.error("My listings category failed to load", { category, error });
  return { count: 0, hasMore: false, error: `${category} could not load. Refresh the page to try again.` };
}

async function loadProperty(): Promise<PropertyLoad> {
  try {
    const [result, upcomingTours, flags] = await Promise.all([getMyListings(), getHostUpcomingLiveTours(), getInstantConnectPhase3Flags()]);
    if (!result.success) return { ...failed("Your homes", result.error), rows: [], upcomingTours: [], scheduledToursEnabled: false };
    const rows = result.data ?? [];
    return { count: rows.length, hasMore: false, error: null, rows, upcomingTours, scheduledToursEnabled: flags.scheduledTours };
  } catch (error) {
    return { ...failed("Your homes", error), rows: [], upcomingTours: [], scheduledToursEnabled: false };
  }
}

function preview(items: ManagedItem[], moreOnServer = false): ListLoad {
  return { count: items.length, hasMore: moreOnServer || items.length > PREVIEW_LIMIT, error: null, items: items.slice(0, PREVIEW_LIMIT) };
}

async function loadOffers(): Promise<ListLoad> {
  try {
    const workspace = await readOfferWorkspace(1);
    return preview(workspace.offers.map(offer => ({
      id: offer.id, title: offer.draft.title || "Untitled offer", status: privateOfferStatus(offer), href: `/post/offers/${offer.id}`,
    })), workspace.hasNext);
  } catch (error) {
    return { ...failed("Shopping Specials", error), items: [] };
  }
}

async function loadEntries(category: "tourism" | "event"): Promise<ListLoad> {
  try {
    const workspace = await readEntryWorkspace(category, 1);
    return preview(workspace.entries.map(entry => ({
      id: entry.id, title: entry.draft.title || "Untitled entry", status: privateEntryStatus(entry), href: `/post/entries/${category}/${entry.id}`,
    })), workspace.hasNext);
  } catch (error) {
    return { ...failed(category === "event" ? "Events" : "Places", error), items: [] };
  }
}

/** Reads every category in parallel; one category failing never hides the others. */
export async function loadMyListings(): Promise<{ property: PropertyLoad } & Record<Exclude<ListingCategory, "property">, ListLoad>> {
  const [property, offers, places, events] = await Promise.all([
    loadProperty(), loadOffers(), loadEntries("tourism"), loadEntries("event"),
  ]);
  return { property, offers, places, events };
}
