"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { LocationPickerLoader } from "./location-picker-loader";

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
    listingFieldLabels,
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
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4 sm:mb-6">
            <div>
                <h2 className="text-base font-bold tracking-tight text-ink sm:text-xl">{title}</h2>
                {description && <p className="mt-1 text-xs font-medium text-muted-foreground sm:mt-1.5 sm:text-sm">{description}</p>}
            </div>
            {badge && <div>{badge}</div>}
        </div>
    );
}

const formSections = [
    { id: "essentials", label: "Essentials" },
    { id: "location", label: "Location" },
    { id: "details", label: "Details" },
    { id: "utilities", label: "Utilities" },
    { id: "costs", label: "Costs" },
    { id: "amenities", label: "Amenities" },
    { id: "gallery", label: "Gallery" },
    { id: "publish", label: "Publish" },
];

const listingCreateConfirmationMs = 3000;

function SectionContainer({ children, className, id }: { children: React.ReactNode; className?: string; id: string }) {
    return (
        <section id={id} className={cn("scroll-mt-28 pb-8", className)}>
            {children}
        </section>
    );
}

function booleanSelectValue(value: boolean | null | undefined) {
    if (value === true) return "true";
    if (value === false) return "false";
    return undefined;
}

function BooleanCostSelect({
    id,
    name,
    label,
    defaultValue,
    fieldError,
    trueLabel = "Included",
    falseLabel = "Not included",
    emptyLabel = "Not sure",
}: {
    id: string;
    name: string;
    label: string;
    defaultValue?: boolean | null;
    fieldError: (name: string) => React.ReactNode;
    trueLabel?: string;
    falseLabel?: string;
    emptyLabel?: string;
}) {
    return (
        <div>
            <Label htmlFor={id} className="text-xs font-semibold uppercase text-muted-foreground">{label}</Label>
            <Select name={name} defaultValue={booleanSelectValue(defaultValue)}>
                <SelectTrigger id={id} className="mt-2 w-full bg-background shadow-none focus:ring-ring">
                    <SelectValue placeholder={emptyLabel} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="true" className="focus:bg-accent focus:text-forest">{trueLabel}</SelectItem>
                    <SelectItem value="false" className="focus:bg-accent focus:text-forest">{falseLabel}</SelectItem>
                </SelectContent>
            </Select>
            {fieldError(name)}
        </div>
    );
}

function MoneyInput({
    id,
    name,
    label,
    defaultValue,
    placeholder,
    fieldError,
}: {
    id: string;
    name: string;
    label: string;
    defaultValue?: number | null;
    placeholder: string;
    fieldError: (name: string) => React.ReactNode;
}) {
    return (
        <div>
            <Label htmlFor={id} className="text-xs font-semibold uppercase text-muted-foreground">{label}</Label>
            <div className="relative mt-2">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    R
                </span>
                <Input
                    id={id}
                    name={name}
                    type="number"
                    min={0}
                    placeholder={placeholder}
                    defaultValue={defaultValue ?? ""}
                    className="h-11 bg-background pl-9 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                />
            </div>
            {fieldError(name)}
        </div>
    );
}

export function ListingForm({ defaultValues, defaultMetadata, defaultImages, listingStatus, mode = "create", googleMapsApiKey }: ListingFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [publishErrors, setPublishErrors] = useState<string[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "confirmed" | "failed">("idle");

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        setErrors({});
        setSubmitStatus("idle");

        startTransition(async () => {
            const startedAt = performance.now();
            const result =
                mode === "edit" && defaultValues?.id
                    ? await updateListing(defaultValues.id, formData)
                    : await createListing(formData);
            const elapsedMs = performance.now() - startedAt;

            if (result.success) {
                if (mode === "create") {
                    setSubmitStatus("confirmed");
                    toast.success("Draft created");
                    router.push(`/dashboard/listings/${result.data.listingId}/edit#gallery`);
                } else {
                    toast.success("Listing saved");
                    router.push("/dashboard");
                }
            } else {
                if (mode === "create" && elapsedMs > listingCreateConfirmationMs) {
                    setSubmitStatus("failed");
                }
                setErrors(result.details?.fieldErrors ?? { _form: [result.error] });
            }
        });
    }

    function fieldError(name: string) {
        const msgs = errors[name];
        if (!msgs || msgs.length === 0) return null;
        return <p className="mt-1.5 text-sm font-medium text-destructive">{msgs[0]}</p>;
    }

    const validationItems = Object.entries(errors)
        .filter(([name]) => name !== "_form")
        .flatMap(([name, messages]) =>
            (messages ?? []).slice(0, 1).map((message) => ({
                name,
                label: listingFieldLabels[name] ?? name,
                message,
            })),
        );

    return (
        <form onSubmit={handleSubmit} className="space-y-5 selection:bg-accent selection:text-forest sm:space-y-8">
            <nav
                aria-label="Listing form progress"
                className="sticky top-0 z-20 -mx-4 mb-8 overflow-x-auto border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-0 sm:px-0"
            >
                <div className="flex min-w-max gap-1">
                    {formSections.map((section) => (
                        <a
                            key={section.id}
                            href={`#${section.id}`}
                            className="rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-ink"
                        >
                            {section.label}
                        </a>
                    ))}
                </div>
            </nav>

            {errors._form ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm font-medium text-destructive">
                    {errors._form[0]}
                </div>
            ) : null}

            <div className="sr-only" role="status" aria-live="polite">
                {submitStatus === "confirmed" ? "Listing creation confirmed." : null}
                {submitStatus === "failed" ? "Listing creation was not confirmed within 3 seconds." : null}
            </div>

            {validationItems.length > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                    <p className="font-semibold">Fix these fields before saving</p>
                    <ul className="mt-2 space-y-1">
                        {validationItems.map((item) => (
                            <li key={item.name}>
                                <a className="font-medium underline-offset-4 hover:underline" href={`#${item.name}`}>
                                    {item.label}
                                </a>
                                : {item.message}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {/* ─── Basic Info ─── */}
            <SectionContainer id="essentials">
                <SectionHeading title="Essentials" description="Define the core identity of the property." />
                <div className="space-y-8">
                    <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
                        <div className="sm:col-span-2">
                            <Label htmlFor="title" className="text-xs font-semibold uppercase text-muted-foreground">Listing headline</Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="Sunny 2 bedroom home in Rosebank"
                                defaultValue={defaultValues?.title}
                                className="mt-2 h-11 bg-background text-base font-medium shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                                autoComplete="off"
                            />
                            {fieldError("title")}
                        </div>

                        <div className="sm:col-span-2">
                            <Label htmlFor="description" className="text-xs font-semibold uppercase text-muted-foreground">Description</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Add practical notes about layout, access, and nearby transport."
                                defaultValue={defaultValues?.description ?? ""}
                                rows={4}
                                className="mt-2 resize-y bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                            />
                            {fieldError("description")}
                        </div>

                        <div>
                            <Label htmlFor="property_type" className="text-xs font-semibold uppercase text-muted-foreground">Property type</Label>
                            <Select name="property_type" defaultValue={defaultValues?.property_type ?? undefined}>
                                <SelectTrigger id="property_type" className="mt-2 bg-background shadow-none focus:ring-ring">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {propertyTypes.map((value) => (
                                        <SelectItem key={value} value={value} className="focus:bg-accent focus:text-forest">
                                            {propertyTypeLabels[value]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {fieldError("property_type")}
                        </div>

                        <div>
                            <Label htmlFor="price" className="text-xs font-semibold uppercase text-muted-foreground">Monthly rent (ZAR)</Label>
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
                                    className="h-11 bg-background pl-9 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                                />
                            </div>
                            {fieldError("price")}
                        </div>
                    </div>
                </div>
            </SectionContainer>

            {/* ─── Location ─── */}
            <SectionContainer id="location">
                <SectionHeading title="Location" description="Search for an address or drop a pin accurately on the map." />
                <div className="h-full">
                    {googleMapsApiKey ? (
                        <LocationPickerLoader
                            apiKey={googleMapsApiKey}
                            defaultAddress={defaultValues?.address}
                            defaultLat={defaultValues?.latitude}
                            defaultLng={defaultValues?.longitude}
                        />
                    ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                            Google Maps API key not configured. Add <code className="font-mono text-clay">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the location picker.
                        </div>
                    )}
                    {fieldError("address")}
                    {fieldError("latitude")}
                    {fieldError("longitude")}
                </div>
            </SectionContainer>

            {/* ─── Property Details ─── */}
            <SectionContainer id="details">
                <SectionHeading title="Details" description="Rooms, parking, and property features." />
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-8">
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="bedrooms" className="text-xs font-semibold uppercase text-muted-foreground">Bedrooms</Label>
                        <Input
                            id="bedrooms"
                            name="bedrooms"
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder="2"
                            defaultValue={defaultValues?.bedrooms}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("bedrooms")}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="bathrooms" className="text-xs font-semibold uppercase text-muted-foreground">Bathrooms</Label>
                        <Input
                            id="bathrooms"
                            name="bathrooms"
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder="1.5"
                            defaultValue={defaultValues?.bathrooms}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("bathrooms")}
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="parking_type" className="text-xs font-semibold uppercase text-muted-foreground">Parking type</Label>
                        <Select name="parking_type" defaultValue={defaultValues?.parking_type}>
                            <SelectTrigger id="parking_type" className="mt-2 bg-background shadow-none focus:ring-ring">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {parkingTypes.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-accent focus:text-forest">
                                        {parkingTypeLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("parking_type")}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="parking_count" className="text-xs font-semibold uppercase text-muted-foreground">Parking bays</Label>
                        <Input
                            id="parking_count"
                            name="parking_count"
                            type="number"
                            min={0}
                            placeholder="1"
                            defaultValue={defaultValues?.parking_count ?? 0}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("parking_count")}
                    </div>
                </div>
            </SectionContainer>

            {/* ─── Utilities & Lease ─── */}
            <SectionContainer id="utilities">
                <SectionHeading title="Utilities & Leasing" description="Water, electricity, and rental terms." />
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
                    <div>
                        <Label htmlFor="electricity_type" className="text-xs font-semibold uppercase text-muted-foreground">Electricity</Label>
                        <Select name="electricity_type" defaultValue={defaultValues?.electricity_type}>
                            <SelectTrigger id="electricity_type" className="mt-2 bg-background shadow-none focus:ring-ring">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {electricityTypes.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-accent focus:text-forest">
                                        {electricityTypeLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("electricity_type")}
                    </div>
                    <div>
                        <Label htmlFor="water_availability" className="text-xs font-semibold uppercase text-muted-foreground">Water</Label>
                        <Select name="water_availability" defaultValue={defaultValues?.water_availability}>
                            <SelectTrigger id="water_availability" className="mt-2 bg-background shadow-none focus:ring-ring">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {waterTypes.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-accent focus:text-forest">
                                        {waterTypeLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("water_availability")}
                    </div>
                    <div>
                        <Label htmlFor="lease_duration" className="text-xs font-semibold uppercase text-muted-foreground">Lease term</Label>
                        <Select name="lease_duration" defaultValue={defaultValues?.lease_duration}>
                            <SelectTrigger id="lease_duration" className="mt-2 bg-background shadow-none focus:ring-ring">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                {leaseDurations.map((value) => (
                                    <SelectItem key={value} value={value} className="focus:bg-accent focus:text-forest">
                                        {leaseDurationLabels[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldError("lease_duration")}
                    </div>
                    <div>
                        <Label htmlFor="availability_date" className="text-xs font-semibold uppercase text-muted-foreground">Available from</Label>
                        <Input
                            id="availability_date"
                            name="availability_date"
                            type="date"
                            min={todayDate()}
                            defaultValue={defaultValues?.availability_date ?? todayDate()}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("availability_date")}
                    </div>
                </div>
            </SectionContainer>

            <SectionContainer id="costs">
                <SectionHeading title="Monthly costs" description="Help renters understand the real monthly commitment." />
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
                    <BooleanCostSelect
                        id="electricity_included"
                        name="electricity_included"
                        label="Electricity included?"
                        defaultValue={defaultValues?.electricity_included}
                        fieldError={fieldError}
                    />
                    <MoneyInput
                        id="electricity_estimate"
                        name="electricity_estimate"
                        label="Electricity estimate"
                        placeholder="850"
                        defaultValue={defaultValues?.electricity_estimate}
                        fieldError={fieldError}
                    />
                    <BooleanCostSelect
                        id="water_included"
                        name="water_included"
                        label="Water included?"
                        defaultValue={defaultValues?.water_included}
                        fieldError={fieldError}
                    />
                    <MoneyInput
                        id="water_estimate"
                        name="water_estimate"
                        label="Water estimate"
                        placeholder="300"
                        defaultValue={defaultValues?.water_estimate}
                        fieldError={fieldError}
                    />
                    <BooleanCostSelect
                        id="wifi_available"
                        name="wifi_available"
                        label="WiFi available?"
                        defaultValue={defaultValues?.wifi_available}
                        fieldError={fieldError}
                        trueLabel="Available"
                        falseLabel="Not available"
                    />
                    <BooleanCostSelect
                        id="wifi_included"
                        name="wifi_included"
                        label="WiFi included?"
                        defaultValue={defaultValues?.wifi_included}
                        fieldError={fieldError}
                    />
                    <MoneyInput
                        id="wifi_estimate"
                        name="wifi_estimate"
                        label="WiFi estimate"
                        placeholder="699"
                        defaultValue={defaultValues?.wifi_estimate}
                        fieldError={fieldError}
                    />
                    <BooleanCostSelect
                        id="parking_included"
                        name="parking_included"
                        label="Parking included?"
                        defaultValue={defaultValues?.parking_included}
                        fieldError={fieldError}
                    />
                    <MoneyInput
                        id="parking_estimate"
                        name="parking_estimate"
                        label="Parking estimate"
                        placeholder="500"
                        defaultValue={defaultValues?.parking_estimate}
                        fieldError={fieldError}
                    />
                    <MoneyInput
                        id="security_fee_estimate"
                        name="security_fee_estimate"
                        label="Security/complex fees"
                        placeholder="450"
                        defaultValue={defaultValues?.security_fee_estimate}
                        fieldError={fieldError}
                    />
                </div>
            </SectionContainer>

            {/* ─── Amenities ─── */}
            <SectionContainer id="amenities">
                <SectionHeading title="Amenities" description="Select the amenities available at this property." />
                <AmenitiesPicker defaultValue={defaultMetadata?.amenities} />
            </SectionContainer>

            {/* ─── Images (edit mode only) ─── */}
            <SectionContainer id="gallery">
                <SectionHeading
                    title="Gallery"
                    description={mode === "create" ? "Save your draft first to upload images." : "Curate the presentation of your property."}
                />
                {mode === "edit" && defaultValues?.id ? (
                    <ImageUploader listingId={defaultValues.id} defaultImages={defaultImages} />
                ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background">
                        <p className="text-sm font-medium text-muted-foreground">Image upload active after saving draft</p>
                    </div>
                )}
            </SectionContainer>


            {/* ─── Publish Errors ─── */}
            {publishErrors.length > 0 ? (
                <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-6 py-5 text-sm">
                    <p className="text-base font-medium text-status-warning-text">Unable to publish</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-status-warning-text">
                        {publishErrors.map((err) => (
                            <li key={err}>{err}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {/* ─── Submit ─── */}
            <div id="publish" className="sticky bottom-0 z-10 -mx-4 mt-8 flex scroll-mt-24 flex-col gap-3 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-md sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                <div className="hidden items-center gap-3 sm:flex">
                    <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} disabled={isPending || isPublishing} className="h-10 px-5 hover:bg-muted/50">
                        Cancel
                    </Button>
                </div>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                    {mode === "edit" && defaultValues?.id && listingStatus === "draft" ? (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending || isPublishing}
                            className="h-12 border-forest/30 px-6 text-base font-bold text-forest active:scale-95 sm:h-10 sm:text-sm sm:active:scale-100"
                            onClick={() => {
                                setIsPublishing(true);
                                setPublishErrors([]);
                                startTransition(async () => {
                                    const result = await publishListing(defaultValues.id!);
                                    if (result.success) {
                                        toast.success("Listing published");
                                        router.push("/dashboard");
                                    } else {
                                        setPublishErrors(result.details?.errors ?? [result.error]);
                                    }
                                    setIsPublishing(false);
                                });
                            }}
                        >
                            <span className="sm:hidden">{isPublishing ? "Publishing..." : "Publish Listing"}</span>
                            <span className="hidden sm:inline">{isPublishing ? "Publishing..." : "Publish listing"}</span>
                        </Button>
                    ) : null}
                    <Button
                        type="submit"
                        disabled={isPending || isPublishing}
                        className="h-12 bg-forest px-8 text-base font-bold text-primary-foreground active:scale-95 sm:h-10 sm:text-sm sm:active:scale-100"
                    >
                        {isPending ? "Saving..." : mode === "edit" ? "Save changes" : "Create draft & add photos"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} disabled={isPending || isPublishing} className="h-10 px-5 text-muted-foreground hover:bg-muted/50 sm:hidden">
                        Cancel
                    </Button>
                </div>
            </div>
        </form>
    );
}
