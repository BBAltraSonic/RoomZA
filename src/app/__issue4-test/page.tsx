import { ListingDetailPanel, type ListingDetail } from "@/features/map-discovery/listing-detail-panel";

const listing: ListingDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Browser test studio",
  address: "10 Main Road, Cape Town",
  price: 12_500,
  listing_type: "rent",
  latitude: -33.92,
  longitude: 18.42,
  bedrooms: 1,
  bathrooms: 1,
  property_type: "apartment",
  parking_type: "none",
  parking_count: 0,
  electricity_type: "prepaid",
  water_availability: "municipal",
  lease_duration: "12_months",
  availability_date: "2026-08-01",
  created_at: "2026-07-16T10:00:00.000Z",
  metadata: null,
  images: [],
  landlordTrust: {
    medianFirstResponseSeconds: 18 * 60,
    phoneVerified: true,
    emailVerified: true,
  },
};

export default function Issue4TestPage() {
  return (
    <main className="h-screen bg-background sm:p-6">
      <div className="mx-auto h-full max-w-[34rem] overflow-hidden border-border bg-panel sm:rounded-2xl sm:border">
        <ListingDetailPanel listing={listing} />
      </div>
    </main>
  );
}
