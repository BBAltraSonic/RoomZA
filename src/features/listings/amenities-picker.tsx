"use client";

import { Shield, Sofa, Sparkles, UtensilsCrossed } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

import {
    amenityCategories,
    amenityLabels,
    type AmenitiesData,
    type AmenityCategory,
} from "./schema";

const categoryIcons: Record<AmenityCategory, React.ElementType> = {
    essentials: Sparkles,
    security: Shield,
    lifestyle: Sofa,
    appliances: UtensilsCrossed,
};

type AmenitiesPickerProps = {
    defaultValue?: AmenitiesData;
    onChange?: (value: AmenitiesData) => void;
};

export function AmenitiesPicker({ defaultValue, onChange }: AmenitiesPickerProps) {
    const [selected, setSelected] = useState<AmenitiesData>(() => ({
        essentials: defaultValue?.essentials ?? [],
        security: defaultValue?.security ?? [],
        lifestyle: defaultValue?.lifestyle ?? [],
        appliances: defaultValue?.appliances ?? [],
    }));

    const toggle = useCallback(
        (category: AmenityCategory, item: string) => {
            setSelected((prev) => {
                const current = prev[category] as string[];
                const next = current.includes(item)
                    ? current.filter((i) => i !== item)
                    : [...current, item];

                const updated = { ...prev, [category]: next } as AmenitiesData;
                onChange?.(updated);
                return updated;
            });
        },
        [onChange],
    );

    return (
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {(Object.entries(amenityCategories) as [AmenityCategory, (typeof amenityCategories)[AmenityCategory]][]).map(
                ([categoryKey, category]) => {
                    const Icon = categoryIcons[categoryKey];
                    const categorySelected = (selected[categoryKey] as string[]) ?? [];

                    return (
                        <div key={categoryKey} className="group rounded-2xl border border-transparent p-5 transition hover:border-[#e7f2ee] hover:bg-muted/10">
                            <div className="mb-4 flex items-center gap-3">
                                <span className="flex size-8 items-center justify-center rounded-full bg-[#e7f2ee] text-[#2b6357]">
                                    <Icon className="size-4" />
                                </span>
                                <span className="text-base font-semibold tracking-wide text-foreground">{category.label}</span>
                                {categorySelected.length > 0 ? (
                                    <span className="ml-auto rounded-full bg-[#173b33] px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                                        {categorySelected.length}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                                {category.items.map((item) => {
                                    const isSelected = categorySelected.includes(item);
                                    return (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => toggle(categoryKey, item)}
                                            className={cn(
                                                "inline-flex items-center rounded-xl border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out",
                                                isSelected
                                                    ? "border-[#2b6357] bg-[#e7f2ee] text-[#173b33] shadow-sm"
                                                    : "border-border/60 bg-white text-muted-foreground hover:border-[#2b6357]/60 hover:bg-[#e7f2ee]/30 hover:text-foreground",
                                            )}
                                        >
                                            {amenityLabels[item] ?? item}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                },
            )}

            {/* Hidden input to carry JSON value in form submission */}
            <input
                type="hidden"
                name="metadata"
                value={JSON.stringify({ amenities: selected })}
            />
        </div>
    );
}
