import { answerListingFact, type FactListing, type FactTopic } from "../listing-facts";

/**
 * "What people ask about" (proposal, capability 1). Pinpoint's own code checks incoming
 * enquiries for a fixed list of words. Messages never leave Pinpoint, nothing is summarised,
 * and only counts come out: "Parking: mentioned in 3 enquiries, not on your listing".
 */

export const TOPICS = ["parking", "pets", "wifi", "deposit", "electricity", "nsfas", "furnished", "move-in"] as const;
export type Topic = (typeof TOPICS)[number];

const TOPIC_LABELS: Record<Topic, string> = {
  parking: "Parking",
  pets: "Pets",
  wifi: "Wi-Fi",
  deposit: "Deposit",
  electricity: "Electricity",
  nsfas: "NSFAS",
  furnished: "Furnished",
  "move-in": "Move-in date",
};

const PATTERNS: Record<Topic, RegExp> = {
  parking: /\b(?:parking|park my car|garage|carport)\b/i,
  pets: /\b(?:pets?|dogs?|cats?|animals?)\b/i,
  wifi: /\b(?:wi-?fi|internet|fibre|fiber)\b/i,
  deposit: /\bdeposit\b/i,
  electricity: /\b(?:electricity|prepaid|lights|load[- ]?shedding)\b/i,
  nsfas: /\bnsfas\b/i,
  furnished: /\b(?:furnished|furniture)\b/i,
  "move-in": /\b(?:move[- ]?in|moving in|available from|when can i)\b/i,
};

const FACT_FOR_TOPIC: Partial<Record<Topic, FactTopic>> = {
  parking: "parking",
  pets: "pets",
  wifi: "wifi",
  deposit: "deposit",
  electricity: "electricity",
  furnished: "furnished",
  "move-in": "move-in",
};

export type TopicMessage = { listingId: string; conversationId: string; content: string };

export type TopicInsight = {
  topic: Topic;
  label: string;
  listingId: string;
  /** Distinct enquiries that mentioned it. */
  enquiries: number;
  onListing: boolean;
  message: string;
  href: string;
};

export function findTopics(messages: readonly TopicMessage[], listings: readonly (FactListing & { nsfasApproved?: boolean })[]): TopicInsight[] {
  const seen = new Map<string, Set<string>>();
  for (const message of messages) {
    for (const topic of TOPICS) {
      if (!PATTERNS[topic].test(message.content)) continue;
      const key = `${message.listingId}|${topic}`;
      const conversations = seen.get(key) ?? new Set<string>();
      conversations.add(message.conversationId);
      seen.set(key, conversations);
    }
  }
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const insights: TopicInsight[] = [];
  for (const [key, conversations] of seen) {
    const [listingId, topic] = key.split("|") as [string, Topic];
    const listing = byId.get(listingId);
    if (!listing) continue;
    const fact = FACT_FOR_TOPIC[topic];
    const onListing = topic === "nsfas" ? Boolean(listing.nsfasApproved) : fact ? answerListingFact(listing, fact).known : false;
    const count = conversations.size;
    insights.push({
      topic,
      label: TOPIC_LABELS[topic],
      listingId,
      enquiries: count,
      onListing,
      message: `${TOPIC_LABELS[topic]}: mentioned in ${count} ${count === 1 ? "enquiry" : "enquiries"}${onListing ? "" : ", not on your listing"}`,
      href: `/dashboard/listings/${listingId}/edit`,
    });
  }
  return insights.sort((a, b) => Number(a.onListing) - Number(b.onListing) || b.enquiries - a.enquiries || a.label.localeCompare(b.label));
}
