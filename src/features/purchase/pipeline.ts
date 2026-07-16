import type { Database } from "@/lib/supabase/types";

export type BuyerInterestStatus = Database["public"]["Enums"]["buyer_interest_status"];

export const BUYER_INTEREST_STATUSES: BuyerInterestStatus[] = [
  "interested",
  "negotiating",
  "accepted",
  "declined",
];

export const buyerInterestStatusLabels: Record<BuyerInterestStatus, string> = {
  interested: "Interested",
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
};

export function isBuyerInterestStatus(value: unknown): value is BuyerInterestStatus {
  return typeof value === "string" && BUYER_INTEREST_STATUSES.includes(value as BuyerInterestStatus);
}
