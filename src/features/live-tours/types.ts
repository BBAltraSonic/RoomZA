import type { Database } from "@/lib/supabase/types";

export type LiveTour = Database["public"]["Tables"]["live_tours"]["Row"];

export type LiveTourWithListing = LiveTour & {
  listing: {
    id: string;
    title: string;
    address: string;
    landlord_id: string;
    status: Database["public"]["Enums"]["listing_status"];
  };
};

export type TourPresencePayload = {
  role: "host" | "viewer";
  joinedAt: string;
  userId?: string;
  displayName?: string;
  conferenceParticipantId?: string;
};

export type TourPresenceEntry = TourPresencePayload & {
  key: string;
};

export type UpcomingLiveTour = {
  tourId: string;
  listingId: string;
  scheduledAt: string;
  durationMinutes: number;
};
