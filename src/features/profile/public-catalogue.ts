import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { z } from "zod";

import { enrichDiscoveryItems } from "@/features/discovery/presentation-data";
import { entryCategorySchema, entryContentSchema } from "@/features/entries/schema";
import { publicOfferDetailSchema } from "@/features/offers/public-contract";
import type {
  PublicProfileCatalogue,
  PublicProfileSpecialItem,
} from "@/features/profile/types";
import { getSupabaseEnv } from "@/lib/env";
import { createUntypedClient } from "@/lib/supabase/admin";

/** Newest items per category. Enough to show range without a heavy page. */
const SPECIAL_LIMIT = 12;
/** Offers are checked one by one through the public RPC, so stay tighter. */
const OFFER_CANDIDATES = 12;
const ID_CANDIDATES = 48;

/**
 * The anonymous client keeps row-level security on. Public eligibility (review,
 * suspension, policy acceptance, expiry) lives in those policies and RPCs, so a
 * profile can never show something discovery would hide.
 */
function anonymous() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) }),
    },
  });
}

const idRows = z.array(z.object({ id: z.string().uuid() }));
const entryRow = z.object({
  id: z.string().uuid(),
  category: entryCategorySchema,
  content: z.unknown(),
  approved_at: z.string(),
});

function firstImage(media?: { url: string }[]) {
  return media?.[0]?.url ?? null;
}

/** Photos are decoration here. A media failure must not hide the listings. */
async function withMedia<T extends { media?: { id: string; url: string }[] }>(
  items: T[],
  category?: string,
): Promise<T[]> {
  try {
    return await enrichDiscoveryItems(items, category);
  } catch {
    return items;
  }
}

async function posterIds(table: string, profileId: string, onlyActive: boolean) {
  const admin = createUntypedClient();
  let query = admin
    .from(table)
    .select("id")
    .eq("poster_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(ID_CANDIDATES);
  if (onlyActive) query = query.is("withdrawn_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return idRows.parse(data ?? []).map((row) => row.id);
}

async function readEntries(profileId: string): Promise<PublicProfileSpecialItem[]> {
  const ids = await posterIds("pinpoint_entries", profileId, true);
  if (!ids.length) return [];
  const { data, error } = await anonymous()
    .from("approved_entry_specials")
    .select("id,category,content,approved_at")
    .in("id", ids)
    .order("approved_at", { ascending: false })
    .limit(SPECIAL_LIMIT);
  if (error) throw error;
  const now = Date.now();
  const rows = z.array(entryRow).parse(data ?? []).flatMap((row) => {
    const content = entryContentSchema.safeParse(row.content);
    return content.success
      ? [{ entryId: row.id, category: row.category, content: content.data, media: undefined as { id: string; url: string }[] | undefined }]
      : [];
  });
  return (await withMedia(rows)).map(({ entryId, category, content, media }) => ({
    id: entryId,
    kind: category,
    title: content.title,
    venueName: content.venueName,
    address: content.address,
    priceCents: content.priceCents ?? null,
    originalPriceCents: content.originalPriceCents ?? null,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
    state: Date.parse(content.startsAt) > now ? "upcoming" : "live",
    imageUrl: firstImage(media),
  }));
}

async function readOffers(profileId: string): Promise<PublicProfileSpecialItem[]> {
  const ids = (await posterIds("shopping_offers", profileId, true)).slice(0, OFFER_CANDIDATES);
  if (!ids.length) return [];
  const client = anonymous();
  const details = await Promise.all(
    ids.map(async (target) => {
      const { data, error } = await client.rpc("pinpoint_offer_public_detail", { target });
      if (error) throw error;
      const parsed = publicOfferDetailSchema.safeParse(data);
      return parsed.success && parsed.data.status === "live" ? parsed.data : null;
    }),
  );
  const live = details.flatMap((offer) => (offer ? [offer] : []));
  return (await withMedia(live)).map((offer) => ({
    id: offer.offerId,
    kind: "shopping" as const,
    title: offer.content.title,
    venueName: offer.content.shopName,
    address: offer.content.address,
    priceCents: offer.content.priceCents ?? null,
    originalPriceCents: offer.content.originalPriceCents ?? null,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    state: "live" as const,
    imageUrl: firstImage(offer.media),
  }));
}

/**
 * Throws on failure so the cache never stores an outage as "no listings".
 * Media URLs are signed for an hour; five minutes of caching stays well inside that.
 */
const getCachedCatalogue = unstable_cache(
  async (profileId: string) => {
    const [entries, offers] = await Promise.all([
      readEntries(profileId),
      readOffers(profileId),
    ]);
    const specials = [...offers, ...entries]
      .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
      .slice(0, SPECIAL_LIMIT);
    return { specials };
  },
  ["public-profile-catalogue-v2"],
  { revalidate: 300, tags: ["public-profiles"] },
);

export async function getPublicProfileCatalogue(
  profileId: string,
): Promise<PublicProfileCatalogue> {
  try {
    return { status: "ready", ...(await getCachedCatalogue(profileId)) };
  } catch {
    return { status: "unavailable", specials: [] };
  }
}
