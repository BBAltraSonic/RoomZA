"use client";

import { Check, ChevronDown, Filter, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import { cn } from "@/lib/utils";

export type FilterState = {
    price?: { min?: number; max?: number };
    beds?: number;
    baths?: number;
    propertyTypes?: string[];
    petFriendly?: boolean;
    layerPresets?: string[];
};

type FilterBarProps = {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    className?: string;
};

const BED_OPTIONS = [
    { label: "Any", value: undefined },
    { label: "1+", value: 1 },
    { label: "2+", value: 2 },
    { label: "3+", value: 3 },
    { label: "4+", value: 4 },
];

const BATH_OPTIONS = [
    { label: "Any", value: undefined },
    { label: "1+", value: 1 },
    { label: "2+", value: 2 },
];

const PROPERTY_TYPES = [
    { label: "Apartment", value: "apartment" },
    { label: "House", value: "house" },
    { label: "Room", value: "room" },
    { label: "Studio", value: "studio" },
    { label: "Cottage", value: "cottage" },
    { label: "Townhouse", value: "townhouse" },
];

export function FilterBar({ filters, onFilterChange, className }: FilterBarProps) {
    const [activeDropdown, setActiveDropdown] = useState<"price" | "beds" | "baths" | "type" | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(containerRef, () => setActiveDropdown(null));

    const hasActiveFilters =
        Boolean(filters.price?.min || filters.price?.max) ||
        filters.beds !== undefined ||
        filters.baths !== undefined ||
        (filters.propertyTypes && filters.propertyTypes.length > 0) ||
        filters.petFriendly;

    const clearAll = useCallback(() => {
        onFilterChange({});
        setActiveDropdown(null);
    }, [onFilterChange]);

    const togglePetFriendly = useCallback(() => {
        onFilterChange({ ...filters, petFriendly: !filters.petFriendly });
    }, [filters, onFilterChange]);

    const togglePropertyType = useCallback((typeToToggle: string) => {
        const currentTypes = filters.propertyTypes || [];
        const newTypes = currentTypes.includes(typeToToggle)
            ? currentTypes.filter(t => t !== typeToToggle)
            : [...currentTypes, typeToToggle];

        onFilterChange({
            ...filters,
            propertyTypes: newTypes.length > 0 ? newTypes : undefined
        });
    }, [filters, onFilterChange]);

    const setBeds = useCallback((val: number | undefined) => {
        onFilterChange({ ...filters, beds: val });
        setActiveDropdown(null);
    }, [filters, onFilterChange]);

    const setBaths = useCallback((val: number | undefined) => {
        onFilterChange({ ...filters, baths: val });
        setActiveDropdown(null);
    }, [filters, onFilterChange]);

    const setPriceMin = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value ? Number(e.target.value) : undefined;
        onFilterChange({
            ...filters,
            price: { ...filters.price, min: val }
        });
    }, [filters, onFilterChange]);

    const setPriceMax = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value ? Number(e.target.value) : undefined;
        onFilterChange({
            ...filters,
            price: { ...filters.price, max: val }
        });
    }, [filters, onFilterChange]);

    return (
        <div className={cn("relative flex flex-wrap items-center gap-2 py-1", className)} ref={containerRef}>
            
            {/* Smart Search Presets */}
            <button
                type="button"
                onClick={() => onFilterChange({ ...filters, layerPresets: ["groceries"] })}
                className="shrink-0 rounded-full border border-border bg-warm-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-muted hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
                Walkable groceries
            </button>
            <button
                type="button"
                onClick={() => onFilterChange({ ...filters, layerPresets: ["myciti", "taxi_ranks"] })}
                className="shrink-0 rounded-full border border-border bg-warm-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-muted hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
                Near transport
            </button>
            <button
                type="button"
                onClick={() => onFilterChange({ ...filters, layerPresets: ["schools"] })}
                className="shrink-0 rounded-full border border-border bg-warm-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-muted hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
                Student-friendly
            </button>

            <div className="h-6 w-px bg-border mx-1" />

            {/* Property Type Filter */}
            <div className="relative shrink-0">
                <FilterChip
                    label="Property type"
                    isActive={Boolean(filters.propertyTypes && filters.propertyTypes.length > 0)}
                    value={filters.propertyTypes?.length ? `${filters.propertyTypes.length} selected` : undefined}
                    isOpen={activeDropdown === "type"}
                    onClick={() => setActiveDropdown(activeDropdown === "type" ? null : "type")}
                />
                {activeDropdown === "type" && (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] w-64 rounded-xl border border-border bg-panel p-4 shadow-[var(--elevation-2)] origin-top-left animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
                        <h3 className="mb-3 text-sm font-semibold text-ink">Property types</h3>
                        <div className="space-y-2">
                            {PROPERTY_TYPES.map(type => (
                                <label key={type.value} className="flex cursor-pointer items-center gap-3 rounded-md p-1 hover:bg-muted">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={filters.propertyTypes?.includes(type.value) ?? false}
                                        onChange={() => togglePropertyType(type.value)}
                                    />
                                    <div className={cn(
                                        "flex size-5 items-center justify-center rounded border",
                                        filters.propertyTypes?.includes(type.value)
                                            ? "border-forest bg-forest text-primary-foreground"
                                            : "border-input bg-background"
                                    )}>
                                        {filters.propertyTypes?.includes(type.value) && <Check className="size-3.5" />}
                                    </div>
                                    <span className="text-sm font-medium text-ink">{type.label}</span>
                                </label>
                            ))}
                        </div>

                        <div className="mt-4 flex justify-between border-t border-border pt-4">
                            <button
                                type="button"
                                className="text-sm font-medium text-muted-foreground hover:text-ink"
                                onClick={() => onFilterChange({ ...filters, propertyTypes: undefined })}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-panel transition hover:bg-ink/90"
                                onClick={() => setActiveDropdown(null)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Price Filter */}
            <div className="relative shrink-0">
                <FilterChip
                    label="Price"
                    isActive={Boolean(filters.price?.min || filters.price?.max)}
                    value={
                        filters.price?.min && filters.price?.max
                            ? `R${filters.price.min} - R${filters.price.max}`
                            : filters.price?.min
                                ? `From R${filters.price.min}`
                                : filters.price?.max
                                    ? `Up to R${filters.price.max}`
                                    : undefined
                    }
                    isOpen={activeDropdown === "price"}
                    onClick={() => setActiveDropdown(activeDropdown === "price" ? null : "price")}
                />
                {activeDropdown === "price" && (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] w-[320px] rounded-xl border border-border bg-panel p-4 shadow-[var(--elevation-2)] origin-top-left animate-in fade-in zoom-in-95">
                        <h3 className="mb-4 text-sm font-semibold text-ink">Price range</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label htmlFor="min-price" className="mb-1 block text-xs font-medium text-muted-foreground">Minimum</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R</span>
                                    <input
                                        id="min-price"
                                        type="number"
                                        min="0"
                                        placeholder="No min"
                                        className="w-full rounded-md border border-input bg-warm-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                                        value={filters.price?.min || ""}
                                        onChange={setPriceMin}
                                    />
                                </div>
                            </div>
                            <div className="mt-5 h-[1px] w-4 bg-border" />
                            <div className="flex-1">
                                <label htmlFor="max-price" className="mb-1 block text-xs font-medium text-muted-foreground">Maximum</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R</span>
                                    <input
                                        id="max-price"
                                        type="number"
                                        min="0"
                                        placeholder="No max"
                                        className="w-full rounded-md border border-input bg-warm-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                                        value={filters.price?.max || ""}
                                        onChange={setPriceMax}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-between border-t border-border pt-4">
                            <button
                                type="button"
                                className="text-sm font-medium text-muted-foreground hover:text-ink"
                                onClick={() => onFilterChange({ ...filters, price: undefined })}
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-panel transition hover:bg-ink/90"
                                onClick={() => setActiveDropdown(null)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bedrooms Filter */}
            <div className="relative shrink-0">
                <FilterChip
                    label="Beds"
                    isActive={filters.beds !== undefined}
                    value={filters.beds ? `${filters.beds}+` : undefined}
                    isOpen={activeDropdown === "beds"}
                    onClick={() => setActiveDropdown(activeDropdown === "beds" ? null : "beds")}
                />
                {activeDropdown === "beds" && (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] w-48 rounded-xl border border-border bg-panel p-2 shadow-[var(--elevation-2)] origin-top-left animate-in fade-in zoom-in-95">
                        <div className="flex flex-col">
                            {BED_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    className={cn(
                                        "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                                        filters.beds === opt.value ? "text-forest" : "text-ink"
                                    )}
                                    onClick={() => setBeds(opt.value)}
                                >
                                    {opt.label}
                                    {filters.beds === opt.value && <Check className="size-4" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bathrooms Filter */}
            <div className="relative shrink-0">
                <FilterChip
                    label="Baths"
                    isActive={filters.baths !== undefined}
                    value={filters.baths ? `${filters.baths}+` : undefined}
                    isOpen={activeDropdown === "baths"}
                    onClick={() => setActiveDropdown(activeDropdown === "baths" ? null : "baths")}
                />
                {activeDropdown === "baths" && (
                    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] w-48 rounded-xl border border-border bg-panel p-2 shadow-[var(--elevation-2)] origin-top-left animate-in fade-in zoom-in-95">
                        <div className="flex flex-col">
                            {BATH_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    className={cn(
                                        "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                                        filters.baths === opt.value ? "text-forest" : "text-ink"
                                    )}
                                    onClick={() => setBaths(opt.value)}
                                >
                                    {opt.label}
                                    {filters.baths === opt.value && <Check className="size-4" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Pet Friendly Toggle */}
            <button
                type="button"
                onClick={togglePetFriendly}
                className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    filters.petFriendly
                        ? "border-forest/40 bg-accent text-forest"
                        : "border-border bg-warm-surface text-ink hover:bg-muted hover:border-muted-foreground/30"
                )}
            >
                Pet friendly
            </button>

            {/* Clear all */}
            {hasActiveFilters && (
                <button
                    type="button"
                    onClick={clearAll}
                    className="ml-2 flex shrink-0 items-center gap-1.5 p-1.5 text-sm font-medium text-muted-foreground transition hover:text-ink"
                >
                    <X className="size-4" />
                    Clear
                </button>
            )}

        </div>
    );
}

function FilterChip({
    label,
    value,
    isActive,
    isOpen,
    onClick
}: {
    label: string;
    value?: string;
    isActive: boolean;
    isOpen: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isActive
                    ? "border-forest/40 bg-accent text-forest hover:bg-accent/80"
                    : "border-border bg-warm-surface text-ink hover:bg-muted hover:border-muted-foreground/30",
                isOpen && (isActive ? "bg-accent/80" : "bg-muted border-muted-foreground/30")
            )}
        >
            <span>{label}</span>
            {value && <span className="font-semibold">{value}</span>}
            <ChevronDown className={cn("size-3.5 opacity-60 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
    );
}
