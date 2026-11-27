import type { PublicContact } from "@/features/guest-contact/schema";
import type { ListingImage } from "@/features/listings/actions";
import type { PublicLandlordPresence } from "@/features/listings/api";
import type { AmenitiesData } from "@/features/listings/schema";
import type { UpcomingLiveTour } from "@/features/live-tours/types";
import type { ListingLiveActivity } from "@/features/map-discovery/live-activity";
import type { LandlordTrustSummary } from "@/features/trust/landlord-signals";

export type { ListingImage };

/** Everything a listing's detail view shows. Shared by the detail panel and the swipe feed. */
export type ListingDetail = {
  publicContact?: PublicContact | null;
  id: string;
  title: string;
  address: string;
  price: number;
  sale_price?: number | null;
  display_price?: number | null;
  listing_type?: "rent" | "sale";
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  property_type?: string | null;
  parking_type: string;
  parking_count: number;
  electricity_type: string;
  water_availability: string;
  electricity_included?: boolean | null;
  electricity_estimate?: number | null;
  water_included?: boolean | null;
  water_estimate?: number | null;
  wifi_available?: boolean | null;
  wifi_included?: boolean | null;
  wifi_estimate?: number | null;
  parking_included?: boolean | null;
  parking_estimate?: number | null;
  security_fee_estimate?: number | null;
  deposit_amount?: number | null;
  admin_fee?: number | null;
  /** Approved renters pay the deposit through RoomZA, which holds it until move-in. */
  deposit_online?: boolean;
  lease_duration: string;
  availability_date: string;
  created_at: string;
  metadata: { amenities?: AmenitiesData } | null;
  images: ListingImage[];
  listing_reviewed_at?: string | null;
  landlordTrust?: LandlordTrustSummary | null;
  landlordPresence?: PublicLandlordPresence | null;
  liveTourId?: string | null;
  upcomingLiveTour?: UpcomingLiveTour | null;
  liveActivity?: ListingLiveActivity | null;
};
