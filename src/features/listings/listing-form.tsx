"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
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
import { InstantConnectPublisher } from "./components/instant-connect-publisher";
import { ImageUploader } from "./image-uploader";
import { LocationPickerLoader } from "./location-picker-loader";

import { createListing, updateListing, publishListing, type ListingImage } from "./actions";
import type { LiveTour } from "@/features/live-tours/types";
import type { AvailabilityMode } from "@/features/presence/presence-status";
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
    listingTypeLabels,
    listingTypes,
    listingFieldLabels,
    type AmenitiesData,
    type ListingFormData,
} from "./schema";
import { cn } from "@/lib/utils";
import { useScrollAdaptation } from "@/lib/hooks/use-scroll-adaptation";
import { publishFieldMessage } from "./publish-validation";

type ListingFormDefaults = {
    [Key in keyof ListingFormData]?: ListingFormData[Key] | null;
} & { id?: string };

type ListingFormProps = {
    defaultValues?: ListingFormDefaults;
    defaultMetadata?: { amenities?: AmenitiesData };
    defaultImages?: ListingImage[];
    listingStatus?: string;
    mode?: "create" | "edit";
    googleMapsApiKey?: string;
    instantConnect?: {
        availabilityMode: AvailabilityMode;
        upcomingTour?: LiveTour | null;
        scheduledToursEnabled?: boolean;
    };
};

type PublishIssue = {
    field?: string;
    label: string;
    message: string;
    targetId?: string;
};

const publishFieldTargets: Record<string, string> = {
    address: "location",
    latitude: "location",
    longitude: "location",
    gallery: "gallery",
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

function FieldLabel({
    htmlFor,
    children,
    required = false,
}: {
    htmlFor?: string;
    children: React.ReactNode;
    required?: boolean;
}) {
    return (
        <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase text-muted-foreground">
            {children}
            {required ? <span className="ml-1.5 text-[0.65rem] normal-case tracking-normal text-clay">Required</span> : null}
        </Label>
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
    { id: "instant-connect", label: "Instant Connect" },
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

export function ListingForm({ defaultValues, defaultMetadata, defaultImages, listingStatus, mode = "create", googleMapsApiKey, instantConnect }: ListingFormProps) {
    const router = useRouter();
    const initialListingType = defaultValues?.listing_type === "sale" ? "sale" : "rent";
    const [listingType, setListingType] = useState<(typeof listingTypes)[number]>(initialListingType);
    const [salePrice, setSalePrice] = useState(defaultValues?.sale_price?.toString() ?? "");
    const [isPending, startTransition] = useTransition();
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [publishIssues, setPublishIssues] = useState<PublishIssue[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<"idle" | "confirmed" | "failed">("idle");
    const progressChrome = useScrollAdaptation({ neverHidden: true });
    const { measure: measureProgressScroll } = progressChrome;
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        const handleWindowScroll = () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
            }
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null;
                measureProgressScroll(document.documentElement);
            });
        };

        window.addEventListener("scroll", handleWindowScroll, { passive: true });
        handleWindowScroll();
        return () => {
            window.removeEventListener("scroll", handleWindowScroll);
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [measureProgressScroll]);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        if (listingType === "sale") {
            formData.set("price", salePrice);
            formData.set("sale_price", salePrice);
        }

        setErrors({});
        setPublishIssues([]);
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
        return <p id={`${name}-error`} className="mt-1.5 text-sm font-medium text-destructive">{msgs[0]}</p>;
    }

    function formDataForListing(form: HTMLFormElement) {
        const formData = new FormData(form);
        if (listingType === "sale") {
            formData.set("price", salePrice);
            formData.set("sale_price", salePrice);
        }
        return formData;
    }

    function focusPublishIssue(issue: PublishIssue) {
        if (!issue.targetId) return;

        const target = document.getElementById(issue.targetId);
        target?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "center",
        });

        window.setTimeout(() => {
            const focusTarget =
                document.getElementById(issue.field ?? "") ??
                (issue.targetId === "location" ? document.getElementById("location-search") : null);
            focusTarget?.focus({ preventScroll: true });
        }, 350);
    }

    function showPublishBlockers(
        fieldErrors: Record<string, string[]> = {},
        imageError?: string | null,
        fallbackMessage?: string,
    ) {
        const normalizedErrors = Object.fromEntries(
            Object.entries(fieldErrors).map(([field, messages]) => [
                field,
                (messages ?? []).map((message) => publishFieldMessage(field, message)),
            ]),
        );

        if (normalizedErrors.address || normalizedErrors.latitude || normalizedErrors.longitude) {
            normalizedErrors.address = ["Search for the address and place the pin on the map"];
            delete normalizedErrors.latitude;
            delete normalizedErrors.longitude;
        }

        const formError = normalizedErrors._form?.[0] ?? fallbackMessage;
        delete normalizedErrors._form;

        if (imageError) normalizedErrors.gallery = [imageError];

        const seenTargets = new Set<string>();
        const issues: PublishIssue[] = [];
        for (const [field, messages] of Object.entries(normalizedErrors)) {
            const targetId = publishFieldTargets[field] ?? field;
            if (!messages?.[0] || seenTargets.has(targetId)) continue;
            seenTargets.add(targetId);
            issues.push({
                field,
                label: field === "gallery" ? "Photos" : listingFieldLabels[field] ?? field,
                message: messages[0],
                targetId,
            });
        }

        if (issues.length === 0 && formError) {
            issues.push({ label: "Publishing", message: formError });
        }

        setErrors(normalizedErrors);
        setPublishIssues(issues);
        const firstIssue = issues[0];
        if (firstIssue) requestAnimationFrame(() => focusPublishIssue(firstIssue));
    }

    function handlePublish(form: HTMLFormElement) {
        if (!defaultValues?.id) return;

        setIsPublishing(true);
        setErrors({});
        setPublishIssues([]);
        startTransition(async () => {
            const saveResult = await updateListing(defaultValues.id!, formDataForListing(form));
            if (!saveResult.success) {
                showPublishBlockers(
                    saveResult.details?.fieldErrors ?? {},
                    null,
                    saveResult.error,
                );
                setIsPublishing(false);
                return;
            }

            const publishResult = await publishListing(defaultValues.id!);
            if (publishResult.success) {
                toast.success("Listing published");
                router.push("/dashboard");
            } else {
                showPublishBlockers(
                    publishResult.details?.fieldErrors ?? {},
                    publishResult.details?.imageError,
                    publishResult.error,
                );
            }
            setIsPublishing(false);
        });
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
                data-chrome={progressChrome.chrome}
                className={cn(
                    "adaptive-chrome sticky top-0 z-20 -mx-4 mb-8 overflow-x-auto border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:-mx-0 sm:px-0",
                    progressChrome.chrome !== "expanded" && "py-2",
                )}
            >
                <div className="scroll-progress-track -mx-4 mb-2 sm:mx-0">
                    <div className="scroll-progress-bar" style={{ transform: `scaleX(${progressChrome.progress})` }} />
                </div>
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

            {validationItems.length > 0 && publishIssues.length === 0 ? (
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
                            <FieldLabel required>Listing type</FieldLabel>
                            <div className="mt-2 grid grid-cols-2 rounded-lg border border-border bg-muted/20 p-1" role="group" aria-label="Listing type">
                                {listingTypes.map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={listingType === value}
                                        onClick={() => setListingType(value)}
                                        className={cn(
                                            "h-10 rounded-md px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            listingType === value ? "bg-panel text-forest shadow-[var(--shadow-control)]" : "text-muted-foreground hover:bg-panel/70 hover:text-ink",
                                        )}
                                    >
                                        {listingTypeLabels[value]}
                                    </button>
                                ))}
                            </div>
                            <input type="hidden" name="listing_type" value={listingType} />
                            {fieldError("listing_type")}
                        </div>

                        <div className="sm:col-span-2">
                            <FieldLabel htmlFor="title" required>Listing headline</FieldLabel>
                            <Input
                                id="title"
                                name="title"
                                placeholder="Sunny 2 bedroom home in Rosebank"
                                defaultValue={defaultValues?.title ?? ""}
                                aria-invalid={Boolean(errors.title)}
                                aria-describedby={errors.title ? "title-error" : undefined}
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
                            <FieldLabel htmlFor="property_type" required>Property type</FieldLabel>
                            <Select name="property_type" defaultValue={defaultValues?.property_type ?? undefined}>
                                <SelectTrigger
                                    id="property_type"
                                    aria-invalid={Boolean(errors.property_type)}
                                    aria-describedby={errors.property_type ? "property_type-error" : undefined}
                                    className="mt-2 bg-background shadow-none focus:ring-ring"
                                >
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
                            <FieldLabel htmlFor={listingType === "sale" ? "sale_price" : "price"} required>
                                {listingType === "sale" ? "Purchase price (ZAR)" : "Monthly rent (ZAR)"}
                            </FieldLabel>
                            <div className="relative mt-2">
                                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                                    R
                                </span>
                                {listingType === "sale" ? (
                                    <>
                                        <Input
                                            id="sale_price"
                                            name="sale_price"
                                            type="number"
                                            min={1}
                                            placeholder="1850000"
                                            value={salePrice}
                                            onChange={(event) => setSalePrice(event.target.value)}
                                            aria-invalid={Boolean(errors.sale_price)}
                                            aria-describedby={errors.sale_price ? "sale_price-error" : undefined}
                                            className="h-11 bg-background pl-9 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                                        />
                                        <input type="hidden" name="price" value={salePrice} />
                                    </>
                                ) : (
                                    <>
                                        <Input
                                            id="price"
                                            name="price"
                                            type="number"
                                            min={1}
                                            placeholder="12000"
                                            defaultValue={defaultValues?.price ?? ""}
                                            aria-invalid={Boolean(errors.price)}
                                            aria-describedby={errors.price ? "price-error" : undefined}
                                            className="h-11 bg-background pl-9 shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                                        />
                                        <input type="hidden" name="sale_price" value="" />
                                    </>
                                )}
                            </div>
                            {fieldError("price")}
                            {fieldError("sale_price")}
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
                            defaultAddress={defaultValues?.address ?? undefined}
                            defaultLat={defaultValues?.latitude ?? undefined}
                            defaultLng={defaultValues?.longitude ?? undefined}
                            invalid={Boolean(errors.address || errors.latitude || errors.longitude)}
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
                        <FieldLabel htmlFor="bedrooms" required>Bedrooms</FieldLabel>
                        <Input
                            id="bedrooms"
                            name="bedrooms"
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder="2"
                            defaultValue={defaultValues?.bedrooms ?? ""}
                            aria-invalid={Boolean(errors.bedrooms)}
                            aria-describedby={errors.bedrooms ? "bedrooms-error" : undefined}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("bedrooms")}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <FieldLabel htmlFor="bathrooms" required>Bathrooms</FieldLabel>
                        <Input
                            id="bathrooms"
                            name="bathrooms"
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder="1.5"
                            defaultValue={defaultValues?.bathrooms ?? ""}
                            aria-invalid={Boolean(errors.bathrooms)}
                            aria-describedby={errors.bathrooms ? "bathrooms-error" : undefined}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("bathrooms")}
                    </div>
                    <div className="col-span-2">
                        <FieldLabel htmlFor="parking_type" required>Parking type</FieldLabel>
                        <Select name="parking_type" defaultValue={defaultValues?.parking_type ?? undefined}>
                            <SelectTrigger
                                id="parking_type"
                                aria-invalid={Boolean(errors.parking_type)}
                                aria-describedby={errors.parking_type ? "parking_type-error" : undefined}
                                className="mt-2 bg-background shadow-none focus:ring-ring"
                            >
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
                        <FieldLabel htmlFor="parking_count" required>Parking bays</FieldLabel>
                        <Input
                            id="parking_count"
                            name="parking_count"
                            type="number"
                            min={0}
                            placeholder="1"
                            defaultValue={defaultValues?.parking_count ?? ""}
                            aria-invalid={Boolean(errors.parking_count)}
                            aria-describedby={errors.parking_count ? "parking_count-error" : undefined}
                            className="mt-2 bg-background shadow-none focus-visible:border-ring focus-visible:ring-ring/30"
                        />
                        {fieldError("parking_count")}
                    </div>
                </div>
            </SectionContainer>

            {/* ─── Utilities & Lease ─── */}
            <SectionContainer id="utilities">
                <SectionHeading
                    title={listingType === "sale" ? "Utilities & Availability" : "Utilities & Leasing"}
                    description={listingType === "sale" ? "Water, electricity, and when the property can be viewed or occupied." : "Water, electricity, and rental terms."}
                />
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
                    <div>
                        <FieldLabel htmlFor="electricity_type" required>Electricity</FieldLabel>
                        <Select name="electricity_type" defaultValue={defaultValues?.electricity_type ?? undefined}>
                            <SelectTrigger
                                id="electricity_type"
                                aria-invalid={Boolean(errors.electricity_type)}
                                aria-describedby={errors.electricity_type ? "electricity_type-error" : undefined}
                                className="mt-2 bg-background shadow-none focus:ring-ring"
                            >
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
                        <FieldLabel htmlFor="water_availability" required>Water</FieldLabel>
                        <Select name="water_availability" defaultValue={defaultValues?.water_availability ?? undefined}>
                            <SelectTrigger
                                id="water_availability"
                                aria-invalid={Boolean(errors.water_availability)}
                                aria-describedby={errors.water_availability ? "water_availability-error" : undefined}
                                className="mt-2 bg-background shadow-none focus:ring-ring"
                            >
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
                        <FieldLabel htmlFor="lease_duration" required>Lease term</FieldLabel>
                        <Select name="lease_duration" defaultValue={defaultValues?.lease_duration ?? undefined}>
                            <SelectTrigger
                                id="lease_duration"
                                aria-invalid={Boolean(errors.lease_duration)}
                                aria-describedby={errors.lease_duration ? "lease_duration-error" : undefined}
                                className="mt-2 bg-background shadow-none focus:ring-ring"
                            >
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
                        <FieldLabel htmlFor="availability_date" required>Available from</FieldLabel>
                        <Input
                            id="availability_date"
                            name="availability_date"
                            type="date"
                            min={todayDate()}
                            defaultValue={defaultValues?.availability_date ?? ""}
                            aria-invalid={Boolean(errors.availability_date)}
                            aria-describedby={errors.availability_date ? "availability_date-error" : undefined}
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
            <SectionContainer
                id="gallery"
                className={cn(
                    errors.gallery && "-mx-3 rounded-xl px-3 ring-2 ring-destructive/40 ring-offset-4 ring-offset-background",
                )}
            >
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
                {fieldError("gallery")}
            </SectionContainer>

            <SectionContainer id="instant-connect">
                <SectionHeading
                    title="Instant Connect"
                    description="Show renters when they can reach you and turn interest into a live viewing."
                />
                <InstantConnectPublisher
                    availabilityMode={instantConnect?.availabilityMode ?? "auto"}
                    listingId={defaultValues?.id}
                    listingStatus={listingStatus}
                    upcomingTour={instantConnect?.upcomingTour}
                    scheduledToursEnabled={instantConnect?.scheduledToursEnabled}
                />
            </SectionContainer>

            {/* ─── Publish Errors ─── */}
            {publishIssues.length > 0 ? (
                <div
                    className="rounded-xl border border-status-warning-border bg-status-warning-surface px-5 py-5 text-sm"
                    role="alert"
                    aria-labelledby="publish-guidance-title"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 size-5 shrink-0 text-status-warning-text" aria-hidden="true" />
                        <div>
                            <p id="publish-guidance-title" className="text-base font-semibold text-status-warning-text">
                                Finish these details to publish
                            </p>
                            <p className="mt-1 text-status-warning-text/80">
                                Your listing stays private until every required detail is complete.
                            </p>
                        </div>
                    </div>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                        {publishIssues.map((issue) => (
                            <li key={`${issue.label}-${issue.targetId ?? issue.message}`}>
                                {issue.targetId ? (
                                    <button
                                        type="button"
                                        onClick={() => focusPublishIssue(issue)}
                                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-status-warning-border bg-background/60 px-3 py-2.5 text-left text-status-warning-text transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span>
                                            <span className="block font-semibold">{issue.label}</span>
                                            <span className="mt-0.5 block text-xs text-status-warning-text/80">{issue.message}</span>
                                        </span>
                                        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                                    </button>
                                ) : (
                                    <p className="rounded-lg border border-status-warning-border px-3 py-2.5 text-status-warning-text">
                                        {issue.message}
                                    </p>
                                )}
                            </li>
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
                            disabled={isPending || isPublishing}
                            className="h-12 bg-forest px-6 text-base font-bold text-primary-foreground hover:bg-forest/90 active:scale-95 sm:h-10 sm:text-sm sm:active:scale-100"
                            onClick={(event) => handlePublish(event.currentTarget.form!)}
                        >
                            {isPublishing ? "Saving and publishing..." : "Save and publish"}
                        </Button>
                    ) : null}
                    <Button
                        type="submit"
                        variant={mode === "edit" && listingStatus === "draft" ? "outline" : "default"}
                        disabled={isPending || isPublishing}
                        className={cn(
                            "h-12 px-8 text-base font-bold active:scale-95 sm:h-10 sm:text-sm sm:active:scale-100",
                            !(mode === "edit" && listingStatus === "draft") && "bg-forest text-primary-foreground hover:bg-forest/90",
                        )}
                    >
                        {isPending && !isPublishing ? "Saving..." : mode === "edit" && listingStatus === "draft" ? "Save draft" : mode === "edit" ? "Save changes" : "Create draft & add photos"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")} disabled={isPending || isPublishing} className="h-10 px-5 text-muted-foreground hover:bg-muted/50 sm:hidden">
                        Cancel
                    </Button>
                </div>
            </div>
        </form>
    );
}
