import type { Database, Json } from "@/lib/supabase/types";

type ViewingMode = Database["public"]["Enums"]["viewing_mode"];

export function buildViewingProposedNotifications({
  listingId,
  mode,
  slotIds,
  applications,
}: {
  listingId: string;
  mode: ViewingMode;
  slotIds: string[];
  applications: { id: string; renter_id: string }[];
}) {
  return applications.map((application) => ({
    recipient_id: application.renter_id,
    type: "viewing_proposed" as const,
    idempotency_key: `viewing_proposed:${listingId}:${application.id}:${slotIds.join(",")}`,
    payload: {
      listingId,
      mode,
      slotIds,
      message: mode === "video_call"
        ? "New video viewing slots have been proposed."
        : "New viewing slots have been proposed.",
    } satisfies Json,
  }));
}

export function buildViewingBookedNotification({
  applicationId,
  viewingId,
}: {
  applicationId: string;
  viewingId: string;
}) {
  return {
    type: "viewing_booked" as const,
    idempotency_key: `viewing_booked:${viewingId}`,
    payload: {
      applicationId,
      viewingId,
      message: "A viewing has been booked.",
    } satisfies Json,
  };
}
