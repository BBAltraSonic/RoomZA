"use client";

import Image from "next/image";
import {
    ArrowLeft,
    Bath,
    BedDouble,
    Car,
    ChevronLeft,
    ChevronRight,
    MapPin,
    MessageSquare,
    Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApplicationModal } from "@/features/applications/application-modal";

import {
    amenityCategories,
    amenityLabels,
    electricityTypeLabels,
    leaseDurationLabels,
    parkingTypeLabels,
    waterTypeLabels,
    type AmenitiesData,
    type AmenityCategory,
} from "../listings/schema";

type ListingImage = {
    id: string;
    public_url: string;
    sort_order: number;
};

export type ListingDetail = {
    id: string;
    title: string;
    address: string;
    price: number;
    latitude: number;
    longitude: number;
    bedrooms: number;
    bathrooms: number;
    parking_type: string;
    parking_count: number;
    electricity_type: string;
    water_availability: string;
    lease_duration: string;
    availability_date: string;
    metadata: { amenities?: AmenitiesData } | null;
    images: ListingImage[];
};

type ListingDetailPanelProps = {
    listing: ListingDetail;
    onBack?: () => void;
};

function formatPrice(price: number) {
    return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}

function ImageCarousel({ images }: { images: ListingImage[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    const goNext = useCallback(() => {
        setCurrentIndex((i) => (i + 1) % images.length);
    }, [images.length]);

    const goPrev = useCallback(() => {
        setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    }, [images.length]);

    if (images.length === 0) {
        return (
            <div className="flex aspect-[16/10] items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">No images</p>
            </div>
        );
    }

    return (
        <div className="group relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
            <Image
                src={images[currentIndex].public_url}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 1024px) 440px, 100vw"
                className="object-cover transition-opacity duration-300"
            />

            {images.length > 1 ? (
                <>
                    <button
                        type="button"
                        onClick={goPrev}
                        className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition hover:bg-black/60 group-hover:opacity-100"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="size-5" />
                    </button>
                    <button
                        type="button"
                        onClick={goNext}
                        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition hover:bg-black/60 group-hover:opacity-100"
                        aria-label="Next image"
                    >
                        <ChevronRight className="size-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                        {images.map((img, i) => (
                            <button
                                key={img.id}
                                type="button"
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    "size-2 rounded-full transition",
                                    i === currentIndex ? "bg-white" : "bg-white/50",
                                )}
                                aria-label={`Go to image ${i + 1}`}
                            />
                        ))}
                    </div>
                </>
            ) : null}
        </div>
    );
}

export function ListingDetailPanel({ listing, onBack }: ListingDetailPanelProps) {
    const amenities = (listing.metadata as { amenities?: AmenitiesData } | null)?.amenities;
    const hasAmenities = amenities && Object.values(amenities).some((arr) => arr.length > 0);

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-border p-5">
                {onBack ? (
                    <button
                        type="button"
                        onClick={onBack}
                        className="mb-3 flex items-center gap-1.5 text-sm font-medium text-[#2b6357] transition hover:text-[#173b33]"
                    >
                        <ArrowLeft className="size-4" />
                        Back to listings
                    </button>
                ) : null}
                <h1 className="text-2xl font-semibold tracking-normal">{listing.title}</h1>
                <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    {listing.address}
                </div>
                <p className="mt-3 text-2xl font-bold text-[#173b33]">
                    {formatPrice(listing.price)}
                    <span className="text-sm font-normal text-muted-foreground"> /month</span>
                </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
                {/* Carousel */}
                <ImageCarousel images={listing.images} />

                {/* Property facts */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                        <BedDouble className="size-4 text-[#2b6357]" />
                        <span className="text-sm">
                            <span className="font-semibold">{listing.bedrooms}</span> Bedrooms
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                        <Bath className="size-4 text-[#2b6357]" />
                        <span className="text-sm">
                            <span className="font-semibold">{listing.bathrooms}</span> Bathrooms
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                        <Car className="size-4 text-[#2b6357]" />
                        <span className="text-sm">
                            {parkingTypeLabels[listing.parking_type as keyof typeof parkingTypeLabels] ?? listing.parking_type}
                            {listing.parking_count > 0 ? ` (${listing.parking_count})` : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                        <Zap className="size-4 text-[#2b6357]" />
                        <span className="text-sm">
                            {electricityTypeLabels[listing.electricity_type as keyof typeof electricityTypeLabels] ?? listing.electricity_type}
                        </span>
                    </div>
                </div>

                {/* Lease details */}
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Lease Details</h3>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Duration</span>
                            <span className="font-medium">
                                {leaseDurationLabels[listing.lease_duration as keyof typeof leaseDurationLabels] ?? listing.lease_duration}
                            </span>
                        </div>
                        <div className="mt-2 flex justify-between">
                            <span className="text-muted-foreground">Water</span>
                            <span className="font-medium">
                                {waterTypeLabels[listing.water_availability as keyof typeof waterTypeLabels] ?? listing.water_availability}
                            </span>
                        </div>
                        <div className="mt-2 flex justify-between">
                            <span className="text-muted-foreground">Available from</span>
                            <span className="font-medium">
                                {new Date(listing.availability_date).toLocaleDateString("en-ZA", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Amenities */}
                {hasAmenities ? (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Amenities</h3>
                        {(Object.entries(amenityCategories) as [AmenityCategory, (typeof amenityCategories)[AmenityCategory]][]).map(
                            ([categoryKey, category]) => {
                                const selected = amenities[categoryKey] ?? [];
                                if (selected.length === 0) return null;
                                return (
                                    <div key={categoryKey}>
                                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            {category.label}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selected.map((item) => (
                                                <span
                                                    key={item}
                                                    className="rounded-full bg-[#e7f2ee] px-2.5 py-1 text-xs font-medium text-[#2b6357]"
                                                >
                                                    {amenityLabels[item] ?? item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            },
                        )}
                    </div>
                ) : null}
            </div>

            {/* CTA Footer */}
            <div className="border-t border-border p-5">
                <div className="grid grid-cols-2 gap-2">
                    <Button className="h-10" variant="outline">
                        <MessageSquare className="size-4" />
                        Message
                    </Button>
                    <ApplicationModal listingId={listing.id} />
                </div>
            </div>
        </div>
    );
}
