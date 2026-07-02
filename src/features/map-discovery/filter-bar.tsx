"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import { cn } from "@/lib/utils";

export type FilterState = {
    price?: { min?: number; max?: number };
    beds?: number;
    baths?: number;
    propertyTypes?: string[];
    layerPresets?: string[];
};

type FilterBarProps = {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    className?: string;
    resultCount?: number;
    isLoading?: boolean;
    /**
     * Where the desktop dropdowns open relative to their trigger pill.
     * "top" (default) suits bottom-anchored placements (hero overlay / bottom
     * sheet); "bottom" suits a pill row at the top of a panel.
     */
    dropdownPlacement?: "top" | "bottom";
    /**
     * Condensed pill set for the left listings panel: hides the Baths chip and
     * the inline Search button (the panel has its own SEARCH CTA).
     */
    condensed?: boolean;
};

function DropdownFooter({
    onClear,
    onDone,
    isLoading,
    resultCount,
}: {
    onClear: () => void;
    onDone: () => void;
    isLoading?: boolean;
    resultCount?: number;
}) {
    return (
        <div className="mt-4 flex justify-between border-t border-border pt-4">
            <button
                type="button"
                className="text-sm font-medium text-muted-foreground hover:text-ink"
                onClick={onClear}
            >
                Clear
            </button>
            <button
                type="button"
                className="relative flex h-9 min-w-[120px] items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-panel transition hover:bg-ink/90 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isLoading}
                onClick={onDone}
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <span className="size-3.5 animate-spin rounded-full border-2 border-panel border-r-transparent" />
                        Loading...
                    </span>
                ) : (
                    resultCount !== undefined ? `Show ${resultCount} homes` : "Done"
                )}
            </button>
        </div>
    );
}

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

export function FilterBar({ filters, onFilterChange, className, resultCount, isLoading, dropdownPlacement = "top", condensed = false }: FilterBarProps) {
    const [activeDropdown, setActiveDropdown] = useState<"price" | "beds" | "baths" | "type" | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(containerRef, () => setActiveDropdown(null));

    // Desktop dropdown anchoring: open downward when the pill row sits at the
    // top of a panel, otherwise upward (hero overlay / bottom sheet default).
    const dropAnchor = dropdownPlacement === "bottom"
        ? "top-[calc(100%+0.5rem)] origin-top"
        : "bottom-[calc(100%+0.5rem)] origin-bottom";

    const hasActiveFilters =
        Boolean(filters.price?.min || filters.price?.max) ||
        filters.beds !== undefined ||
        filters.baths !== undefined ||
        (filters.propertyTypes && filters.propertyTypes.length > 0);

    const clearAll = useCallback(() => {
        onFilterChange({});
        setActiveDropdown(null);
    }, [onFilterChange]);

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
    }, [filters, onFilterChange]);

    const setBaths = useCallback((val: number | undefined) => {
        onFilterChange({ ...filters, baths: val });
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

    const mobileDropdown = activeDropdown ? (
        <div className="absolute inset-x-0 bottom-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] rounded-xl border border-border bg-panel p-3 shadow-[var(--elevation-3)] lg:hidden">
            {activeDropdown === "type" ? (
                <>
                    <h3 className="mb-3 text-sm font-semibold text-ink">Property types</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {PROPERTY_TYPES.map(type => (
                            <label key={type.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-warm-surface px-2.5 py-2">
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={filters.propertyTypes?.includes(type.value) ?? false}
                                    onChange={() => togglePropertyType(type.value)}
                                />
                                <div className={cn(
                                    "flex size-4 shrink-0 items-center justify-center rounded border",
                                    filters.propertyTypes?.includes(type.value)
                                        ? "border-forest bg-forest text-primary-foreground"
                                        : "border-input bg-background"
                                )}>
                                    {filters.propertyTypes?.includes(type.value) && <Check className="size-3" />}
                                </div>
                                <span className="truncate text-xs font-semibold text-ink">{type.label}</span>
                            </label>
                        ))}
                    </div>
                    <DropdownFooter
                        onClear={() => onFilterChange({ ...filters, propertyTypes: undefined })}
                        onDone={() => setActiveDropdown(null)}
                        isLoading={isLoading}
                        resultCount={resultCount}
                    />
                </>
            ) : null}

            {activeDropdown === "price" ? (
                <>
                    <h3 className="mb-3 text-sm font-semibold text-ink">Price range</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="mobile-min-price" className="mb-1 block text-xs font-medium text-muted-foreground">Minimum</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R</span>
                                <input
                                    id="mobile-min-price"
                                    type="number"
                                    min="0"
                                    placeholder="No min"
                                    className="w-full rounded-md border border-input bg-warm-surface py-2 pl-7 pr-3 text-sm text-ink outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                                    value={filters.price?.min || ""}
                                    onChange={setPriceMin}
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="mobile-max-price" className="mb-1 block text-xs font-medium text-muted-foreground">Maximum</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R</span>
                                <input
                                    id="mobile-max-price"
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
                    <DropdownFooter
                        onClear={() => onFilterChange({ ...filters, price: undefined })}
                        onDone={() => setActiveDropdown(null)}
                        isLoading={isLoading}
                        resultCount={resultCount}
                    />
                </>
            ) : null}

            {activeDropdown === "beds" || activeDropdown === "baths" ? (
                <>
                    <h3 className="mb-2 text-sm font-semibold text-ink">
                        {activeDropdown === "beds" ? "Bedrooms" : "Bathrooms"}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                        {(activeDropdown === "beds" ? BED_OPTIONS : BATH_OPTIONS).map(opt => (
                            <button
                                key={opt.label}
                                type="button"
                                className={cn(
                                    "flex h-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors",
                                    (activeDropdown === "beds" ? filters.beds : filters.baths) === opt.value
                                        ? "border-forest bg-accent text-forest"
                                        : "border-border bg-warm-surface text-ink hover:bg-muted"
                                )}
                                onClick={() => activeDropdown === "beds" ? setBeds(opt.value) : setBaths(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <DropdownFooter
                        onClear={() => activeDropdown === "beds" ? onFilterChange({ ...filters, beds: undefined }) : onFilterChange({ ...filters, baths: undefined })}
                        onDone={() => setActiveDropdown(null)}
                        isLoading={isLoading}
                        resultCount={resultCount}
                    />
                </>
            ) : null}
        </div>
    ) : null;

    return (
        <div className={cn("relative flex min-w-0 flex-col gap-3", className)} ref={containerRef}>
            {mobileDropdown}
            
            <div className={cn("relative z-10 mx-auto flex w-full flex-row flex-wrap items-center justify-start gap-2 overflow-visible", !condensed && "lg:justify-center")}>
                {/* Property Type Filter */}
                <div className="relative shrink-0">
                    <FilterChip
                        label="Type"
                        isActive={Boolean(filters.propertyTypes && filters.propertyTypes.length > 0)}
                        value={filters.propertyTypes?.length ? `${filters.propertyTypes.length}` : undefined}
                        isOpen={activeDropdown === "type"}
                        onClick={() => setActiveDropdown(activeDropdown === "type" ? null : "type")}
                        className="h-11 justify-between bg-panel shadow-sm border border-border hover:bg-muted px-3 py-1.5 text-sm lg:h-10 lg:py-2"
                    />
                    {activeDropdown === "type" && (
                        <div className={cn("absolute left-0 z-[var(--z-filter-dropdown,35)] hidden w-64 animate-in rounded-xl border border-border bg-panel p-4 shadow-[var(--elevation-2)] lg:block", dropAnchor)}>
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

                            <DropdownFooter 
                                onClear={() => onFilterChange({ ...filters, propertyTypes: undefined })}
                                onDone={() => setActiveDropdown(null)}
                                isLoading={isLoading}
                                resultCount={resultCount}
                            />
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
                                ? `R${filters.price.min}-R${filters.price.max}`
                                : filters.price?.min
                                    ? `>R${filters.price.min}`
                                    : filters.price?.max
                                        ? `<R${filters.price.max}`
                                        : undefined
                        }
                        isOpen={activeDropdown === "price"}
                        onClick={() => setActiveDropdown(activeDropdown === "price" ? null : "price")}
                        className="h-11 max-w-[9rem] justify-between bg-panel shadow-sm border border-border hover:bg-muted px-3 py-1.5 text-sm lg:h-10 lg:max-w-none lg:py-2"
                    />
                    {activeDropdown === "price" && (
                        <div className={cn("absolute left-0 z-[var(--z-filter-dropdown,35)] hidden w-[320px] animate-in fade-in zoom-in-95 rounded-xl border border-border bg-panel p-4 shadow-[var(--elevation-2)] lg:block", dropAnchor)}>
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

                            <DropdownFooter 
                                onClear={() => onFilterChange({ ...filters, price: undefined })}
                                onDone={() => setActiveDropdown(null)}
                                isLoading={isLoading}
                                resultCount={resultCount}
                            />
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
                        className="h-11 justify-between bg-panel shadow-sm border border-border hover:bg-muted px-3 py-1.5 text-sm lg:h-10 lg:py-2"
                    />
                    {activeDropdown === "beds" && (
                        <div className={cn("absolute left-0 z-[var(--z-filter-dropdown,35)] hidden w-48 animate-in fade-in zoom-in-95 rounded-xl border border-border bg-panel p-2 shadow-[var(--elevation-2)] lg:block", dropAnchor)}>
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
                            <DropdownFooter 
                                onClear={() => onFilterChange({ ...filters, beds: undefined })}
                                onDone={() => setActiveDropdown(null)}
                                isLoading={isLoading}
                                resultCount={resultCount}
                            />
                        </div>
                    )}
                </div>

                {/* Bathrooms Filter */}
                <div className={cn("relative shrink-0", condensed && "hidden")}>
                    <FilterChip
                        label="Baths"
                        isActive={filters.baths !== undefined}
                        value={filters.baths ? `${filters.baths}+` : undefined}
                        isOpen={activeDropdown === "baths"}
                        onClick={() => setActiveDropdown(activeDropdown === "baths" ? null : "baths")}
                        className="h-11 justify-between bg-panel shadow-sm border border-border hover:bg-muted px-3 py-1.5 text-sm lg:h-10 lg:py-2"
                    />
                    {activeDropdown === "baths" && (
                        <div className={cn("absolute left-0 z-[var(--z-filter-dropdown,35)] hidden w-48 animate-in fade-in zoom-in-95 rounded-xl border border-border bg-panel p-2 shadow-[var(--elevation-2)] lg:block", dropAnchor)}>
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
                            <DropdownFooter 
                                onClear={() => onFilterChange({ ...filters, baths: undefined })}
                                onDone={() => setActiveDropdown(null)}
                                isLoading={isLoading}
                                resultCount={resultCount}
                            />
                        </div>
                    )}
                </div>

                {/* Clear All */}
                {hasActiveFilters && (
                    <div className="relative shrink-0 flex items-center">
                        <button
                            type="button"
                            onClick={clearAll}
                            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-muted hover:text-ink lg:h-10"
                        >
                            <X className="size-3.5" />
                            <span className="hidden lg:inline">Clear</span>
                        </button>
                    </div>
                )}

                {/* Search Button */}
                {!condensed && (
                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveDropdown(null)}
                            className="flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-4 py-1.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-forest/90 lg:h-10"
                        >
                            Search
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
}

function FilterChip({
    label,
    value,
    isActive,
    isOpen,
    onClick,
    className
}: {
    label: string;
    value?: string;
    isActive: boolean;
    isOpen: boolean;
    onClick: () => void;
    className?: string;
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
                isOpen && (isActive ? "bg-accent/80" : "bg-muted border-muted-foreground/30"),
                className
            )}
        >
            <div className="flex items-center gap-1.5">
                <span>{label}</span>
                {value && <span className="font-semibold">{value}</span>}
            </div>
            <ChevronDown className={cn("size-3.5 opacity-60 transition-transform duration-200", isOpen && "rotate-180")} />
        </button>
    );
}
