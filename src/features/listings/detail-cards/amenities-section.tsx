import { StatusBadge } from "@/components/premium/primitives";
import { amenityCategories, amenityLabels, type AmenitiesData, type AmenityCategory } from "@/features/listings/schema";

/** Selected amenities grouped by category. Renders nothing when none are selected. */
export function AmenitiesSection({ amenities }: { amenities: AmenitiesData | undefined }) {
  if (!amenities || !Object.values(amenities).some((items) => items.length > 0)) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">Amenities</h2>
      <div className="mt-3 space-y-4">
        {(Object.entries(amenityCategories) as [AmenityCategory, (typeof amenityCategories)[AmenityCategory]][]).map(
          ([categoryKey, category]) => {
            const selected = amenities[categoryKey] ?? [];
            if (selected.length === 0) return null;

            return (
              <div key={categoryKey}>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{category.label}</p>
                <div className="flex flex-wrap gap-2">
                  {selected.map((item) => (
                    <StatusBadge key={item} tone="neutral">
                      {amenityLabels[item] ?? item}
                    </StatusBadge>
                  ))}
                </div>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}
