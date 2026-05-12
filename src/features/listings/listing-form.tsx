"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { AmenitiesPicker } from "./amenities-picker";
import { ImageUploader } from "./image-uploader";
import { LocationPicker } from "./location-picker";

import { createListing, updateListing, publishListing, type ListingImage } from "./actions";
import {
    electricityTypeLabels,
    electricityTypes,
    leaseDurationLabels,
    leaseDurations,
    parkingTypeLabels,
    parkingTypes,
    waterTypeLabels,
    waterTypes,
    propertyTypeLabels,
    propertyTypes,
    type AmenitiesData,
    type ListingFormData,
} from "./schema";
import { cn } from "@/lib/utils";

type ListingFormProps = {
    defaultValues?: Partial<ListingFormData> & { id?: string; description?: string | null; property_type?: string | null };
    defaultMetadata?: { amenities?: AmenitiesData };
    defaultImages?: ListingImage[];
    listingStatus?: string;
    mode?: "create" | "edit";
    googleMapsApiKey?: string;
};

function todayDate() {
    return new Date().toISOString().slice(0, 10);
}

function SectionHeading({ title, description, badge }: { title: string; description?: string; badge?: React.ReactNode }) {
    return (
        <div className="mb-8 flex items-start justify-between border-b border-[#e7f2ee] pb-4">
            <div>
                <h2 className="text-xl font-medium tracking-tight text-foreground">{title}</h2>
                {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {badge && <div>{badge}</div>}
        </div>
    );
}

function SectionContainer({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <section className={cn("rounded-3xl border border-[#e7f2ee] bg-white p-8 shadow-sm transition-shadow hover:shadow-md", className)}>
            {children}
        </section>
    );
}

export function ListingForm({ defaultValues, defaultMetadata, defaultImages, listingStatus, mode = "create", googleMapsApiKey }: ListingFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [publishErrors, setPublishErrors] = useState<string[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        setErrors({});

        startTransition(async () => {
            const result =
                mode === "edit" && defaultValues?.id
                    ? await updateListing(defaultValues.id, formData)
                    : await createListing(formData);

            if (result.success) {
                if (mode === "create" && "listingId" in result) {
                    router.push(`/dashboard/listings/${result.listingId}/edit`);
                } else {
                    router.push("/dashboard");
                }
            } else {
                setErrors(result.errors);
            }
        });
    }

    function fieldError(name: string) {
        const msgs = errors[name];
        if (!msgs || msgs.length === 0) return null;
        return <p className="mt-1.5 text-sm font-medium text-destructive">{msgs[0]}</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-10 selection:bg-[#e7f2ee] selection:text-[#173b33]">
            {errors._form ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm font-medium text-destructive">
                    {errors._form[0]}
                </div>
            ) : null}

            {/* ─── Basic Info ─── */}
            <SectionContainer>
                <SectionHeading title="The Essentials" description="Define the core identity of the property." />
                <div className="space-y-8">
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Label htmlFor="title" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Listing Headline</Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="E.g., Architect-designed studio in Upper East Side"
                                defaultValue={defaultValues?.title}
                                className="mt-2 text-lg font-medium shadow-none focus-visible:ring-[#2b6357]"
                                autoComplete="off"
                            />
                            {fieldError("title")}
                        </div>

                        <div className="sm:col-span-2">
                            <Label htmlFor="description" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Description</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Describe what makes this property special..."
                                defaultValue={defaultValues?.description ?? ""}
                                rows={4}
                                className="mt-2 resize-y shadow-none focus-visible:ring-[#2b6357]"
                            />
                            {fieldError("description")}
                        </div>

                        <div>
                            <Label htmlFor="property_type" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Property Type</Label>
                            <Select name="property_type" defaultValue={defaultValues?.property_type ?? undefined}>
                                <SelectTrigger id="property_type" className="mt-2 shadow-none focus:ring-[#2b6357]">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {propertyTypes.map((value) => (
                                        <SelectItem key={value} value={value} className="focus:bg-[#e7f2ee] focus:text-[#173b33]">
                                            {propertyTypeLabels[value]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError("property_type")}
                        </div>

                        <div>
                            <Label htmlFor="price" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Monthly Rent (ZAR)</Label>
                            <div className="relative mt-2">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                                    R
                                </span>
                                <Input
                                    id="price"
                                    name="price"
                                    type="number"
                                    min={1}
                                    placeholder="12000"
                                    defaultValue={defaultValues?.price}
                                    className="pl-9 shadow-none focus-visible:ring-[#2b6357]"
                                />
                            </div>
                            {fieldError("price")}
                        </div>
                    </div>
                </div>
            </SectionContainer>

            {/* ─── Location ─── */}
            <SectionContainer>
                <SectionHeading title="Location" description="Search for an address or drop a pin accurately on the map." />
                <div className="h-full">
                    {googleMapsApiKey ? (
                        <LocationPicker
                            apiKey={googleMapsApiKey}
                            defaultAddress={defaultValues?.address}
                            defaultLat={defaultValues?.latitude}
                            defaultLng={defaultValues?.longitude}
                        />
                    ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                            Google Maps API key not configured. Add <code className="font-mono text-[#b86f42]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the location picker.
                        </div>
                    )}
                    {fieldError("address")}
                    {fieldError("latitude")}
                    {fieldError("longitude")}
                </div>
            </SectionContainer>

            {/* ─── Property Details ─── */}
            <SectionContainer>
                <SectionHeading title="Details & Configuration" description="Rooms, parking, and specific property features." />
                <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="bedrooms" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Bedrooms</Label>
                        <Input
                            id="bedrooms"
                            name="bedrooms"
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder="2"
                            defaultValue={defaultValues?.bedrooms}
                            className="mt-2 bg-muted/20 shadow-none focus-visible:bg-transparent focus-visible:ring-[#2b6357]"
                        />
                        {fieldError("bedrooms")}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="bathrooms" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Bathrooms</Label>
                        <Input
                            id="bathrooms"
                            name="bathrooms"
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder="1.5"
                            defaultValue={defaultValues?.bathrooms}
                            className="mt-2 bg-muted/20 shadow-none focus-visible:bg-transparent focus-visible:ring-[#2b6357]"
                        />
                        {fieldError("bathrooms")}
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="parking_type" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Parking Type</Label>
                        <Select name="parking_type" defaultValue={defaultValues?.parking_type}>
                            <SelectTrigger id="parking_type" className="mt-2 bg-muted/20 shadow-none focus:bg-transparent focus:ring-[#2b6357]">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {parkingTypes.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-[#e7f2ee] focus:text-[#173b33]">
                                        {parkingTypeLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("parking_type")}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="parking_count" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Parking Bays</Label>
                        <Input
                            id="parking_count"
                            name="parking_count"
                            type="number"
                            min={0}
                            placeholder="1"
                            defaultValue={defaultValues?.parking_count ?? 0}
                            className="mt-2 bg-muted/20 shadow-none focus-visible:bg-transparent focus-visible:ring-[#2b6357]"
                        />
                        {fieldError("parking_count")}
                    </div>
                </div>
            </SectionContainer>

            {/* ─── Utilities & Lease ─── */}
            <SectionContainer>
                <SectionHeading title="Utilities & Leasing" description="Water, electricity, and rental terms." />
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <Label htmlFor="electricity_type" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Electricity</Label>
                        <Select name="electricity_type" defaultValue={defaultValues?.electricity_type}>
                            <SelectTrigger id="electricity_type" className="mt-2 shadow-none focus:ring-[#2b6357]">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {electricityTypes.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-[#e7f2ee] focus:text-[#173b33]">
                                        {electricityTypeLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("electricity_type")}
                    </div>
                    <div>
                        <Label htmlFor="water_availability" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Water</Label>
                        <Select name="water_availability" defaultValue={defaultValues?.water_availability}>
                            <SelectTrigger id="water_availability" className="mt-2 shadow-none focus:ring-[#2b6357]">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {waterTypes.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-[#e7f2ee] focus:text-[#173b33]">
                                        {waterTypeLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("water_availability")}
                    </div>
                    <div>
                        <Label htmlFor="lease_duration" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Lease term</Label>
                        <Select name="lease_duration" defaultValue={defaultValues?.lease_duration}>
                            <SelectTrigger id="lease_duration" className="mt-2 shadow-none focus:ring-[#2b6357]">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {leaseDurations.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-[#e7f2ee] focus:text-[#173b33]">
                                        {leaseDurationLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("lease_duration")}
                    </div>
                    <div>
                        <Label htmlFor="availability_date" className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground/80">Available From</Label>
                        <Input
                            id="availability_date"
                            name="availability_date"
                            type="date"
                            min={todayDate()}
                            defaultValue={defaultValues?.availability_date ?? todayDate()}
                            className="mt-2 shadow-none focus-visible:ring-[#2b6357]"
                        />
                        {fieldError("availability_date")}
                    </div>
                </div>
            </SectionContainer>

            {/* ─── Amenities ─── */}
            <SectionContainer>
                <SectionHeading title="Amenities" description="Select the amenities available at this property." />
                <AmenitiesPicker defaultValue={defaultMetadata?.amenities} />
            </SectionContainer>

            {/* ─── Images (edit mode only) ─── */}
            <SectionContainer>
                <SectionHeading
                    title="Gallery"
                    description={mode === "create" ? "Save your draft first to upload images." : "Curate the presentation of your property."}
                />
                {mode === "edit" && defaultValues?.id ? (
                    <ImageUploader listingId={defaultValues.id} defaultImages={defaultImages} />
                ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/20">
                        <p className="text-sm font-medium text-muted-foreground">Image upload active after saving draft</p>
                    </div>
                )}
            </SectionContainer>

            {/* ─── Publish Errors ─── */}
            {publishErrors.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm">
                    <p className="text-base font-medium text-amber-900">Unable to publish</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800">
                        {publishErrors.map((err) => (
                            <li key={err}>{err}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {/* ─── Submit ─── */}
            <div className="sticky bottom-6 z-10 mx-auto flex max-w-2xl items-center justify-between rounded-full border border-border/60 bg-white/80 px-6 py-4 shadow-lg backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} disabled={isPending || isPublishing} className="rounded-xl px-5 hover:bg-muted/50">
                        Cancel
                    </Button>
                </div>
                <div className="flex items-center gap-3">
                    {mode === "edit" && defaultValues?.id && listingStatus === "draft" ? (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending || isPublishing}
                            className="rounded-xl border-[#2b6357] px-6 text-[#173b33] hover:bg-[#e7f2ee]"
                            onClick={() => {
                                setIsPublishing(true);
                                setPublishErrors([]);
                                startTransition(async () => {
                                    const result = await publishListing(defaultValues.id!);
                                    if (result.success) {
                                        router.push("/dashboard");
                                    } else {
                                        setPublishErrors(result.errors);
                                    }
                                    setIsPublishing(false);
                                });
                            }}
                        >
                            {isPublishing ? "Publishing…" : "Publish listing"}
                        </Button>
                    ) : null}
                    <Button type="submit" disabled={isPending || isPublishing} className="rounded-xl bg-[#173b33] px-8 text-white shadow-md hover:bg-[#102a24] hover:shadow-lg">
                        {isPending ? "Saving…" : mode === "edit" ? "Save changes" : "Create draft & add photos"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
