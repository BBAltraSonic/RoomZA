import { z } from "zod";
import { offerDraftSchema } from "./schema";
import { OFFER_PERMISSION_VERSION } from "./permission-contract";
import { ownedOfferStatusLabels, type OwnedOfferPublication } from "./owned-status-contract";

export const offerWriteRequestSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("create"), offerId: z.string().uuid(), expectedVersion: z.literal(0) }).strict(),
  z.object({ command: z.literal("save"), offerId: z.string().uuid(), expectedVersion: z.number().int().positive(), draft: offerDraftSchema }).strict(),
  z.object({ command: z.literal("submit"), offerId: z.string().uuid(), expectedVersion: z.number().int().positive(), revisionId: z.string().uuid(), permissionConfirmed: z.literal(true), permissionVersion: z.literal(OFFER_PERMISSION_VERSION) }).strict(),
  z.object({ command: z.literal("withdraw"), offerId: z.string().uuid(), expectedVersion: z.number().int().positive() }).strict(),
]);

export type OfferWriteRequest = z.infer<typeof offerWriteRequestSchema>;
export type OwnedOffer = {
  guestContactExempt?: boolean;
  id: string;
  draft: z.infer<typeof offerDraftSchema>;
  version: number;
  pendingRevisionId: string | null;
  withdrawnAt: string | null;
  updatedAt: string;
  publication?: OwnedOfferPublication;
};
export type OfferWorkspaceDetail = {
  offer: OwnedOffer;
  placeLabel: string | null;
  submission: { id: string; content: z.infer<typeof offerDraftSchema>; submittedAt: string } | null;
  history: { id: string; action: string; reason: string | null; occurredAt: string; version: number | null }[];
};

export function privateOfferStatus(offer: OwnedOffer) {
  if (offer.withdrawnAt) return "Withdrawn";
  if (offer.pendingRevisionId) return "Awaiting admin confirmation";
  if (offer.publication) return ownedOfferStatusLabels[offer.publication.status];
  return "Private draft";
}
