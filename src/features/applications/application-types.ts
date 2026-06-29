export type ViewingSlotRef = {
  id: string;
  start_time: string;
  end_time: string;
  is_booked?: boolean;
  mode?: "in_person" | "video_call";
};

type ListingRef = { title: string; address: string; price: number };

/** Shape returned by `getMyApplications` (renter-facing application list). */
export type RenterApplicationListItem = {
  id: string;
  status: string;
  created_at: string;
  listing_id: string;
  listing: ListingRef | ListingRef[] | null;
  conversations: { id: string }[] | null;
  viewings:
    | {
        id: string;
        status: string;
        meeting_join_url: string | null;
        meeting_room_id: string | null;
        meeting_starts_at: string | null;
        meeting_ends_at: string | null;
        slot: ViewingSlotRef | ViewingSlotRef[] | null;
      }[]
    | null;
  viewing_slot_offers: { id: string; slot: ViewingSlotRef | ViewingSlotRef[] | null }[] | null;
};
