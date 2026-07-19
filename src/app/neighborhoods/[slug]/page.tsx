import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/premium/property-card";
import { getNeighborhoodMetadata, getNeighborhoodPageData } from "@/features/map-discovery/neighborhoods";
import { MapPin, Home } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const neighborhood = await getNeighborhoodMetadata(slug);

  if (!neighborhood) return { title: "Neighborhood Not Found" };

  return {
    title: `Apartments for rent in ${neighborhood.name} | Pinpoints`,
    description: neighborhood.description || `Find your next home in ${neighborhood.name} with Pinpoints.`,
  };
}

export default async function NeighborhoodPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getNeighborhoodPageData(slug);

  if (!data) {
    notFound();
  }
  const { neighborhood, listings } = data;

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-16">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-forest/5 px-6 py-20 sm:px-12 md:py-32">
        <div className="mx-auto max-w-5xl relative z-10">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-forest hover:underline mb-6">
            <MapPin className="mr-1 size-4" />
            Back to Map
          </Link>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            {neighborhood.name}
          </h1>
          {neighborhood.description && (
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              {neighborhood.description}
            </p>
          )}
        </div>
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 -mr-20 -mt-20 opacity-10 pointer-events-none">
          <Home className="size-96 text-forest" />
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:px-12">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Available Homes in {neighborhood.name}
          </h2>
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-forest">
            {listings.length} listings
          </span>
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <PropertyCard
                key={listing.id}
                property={{
                  id: listing.id,
                  title: listing.title,
                  address: listing.address,
                  price: listing.price,
                  bedrooms: listing.bedrooms,
                  bathrooms: listing.bathrooms,
                  imageUrl: listing.thumbnail_url,
                }}
                href={`/listing/${listing.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-warm-surface px-6 py-12 text-center">
            <Home className="mx-auto mb-4 size-12 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-ink">No homes currently available</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn&apos;t find any active listings in {neighborhood.name} right now. Check back later or adjust your search.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-forest/90"
            >
              Explore Map
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
