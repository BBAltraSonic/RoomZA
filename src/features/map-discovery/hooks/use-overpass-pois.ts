import { useState, useEffect, useRef } from "react";
import { NEIGHBORHOOD_LAYERS, type LayerCategory } from "../neighborhood-layers";
import { SA_TRANSPORT_DATA } from "../sa-transport-data";

export type POIMarkerData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: LayerCategory;
};

type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type OverpassElement = {
  id: number | string;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

// Simple cache keyed by layerId + rounded bounds
const poiCache = new Map<string, POIMarkerData[]>();

function getCacheKey(categoryId: string, bounds: ViewportBounds) {
  // Round to ~1km precision to maximize cache hits while panning slightly
  const precision = 100;
  const n = Math.round(bounds.north * precision) / precision;
  const s = Math.round(bounds.south * precision) / precision;
  const e = Math.round(bounds.east * precision) / precision;
  const w = Math.round(bounds.west * precision) / precision;
  return `${categoryId}_${n}_${s}_${e}_${w}`;
}

export function useOverpassPois(activeCategoryIds: Set<string>, bounds: ViewportBounds | null) {
  const [pois, setPois] = useState<POIMarkerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (activeCategoryIds.size === 0 || !bounds) {
      return;
    }

    const categories = NEIGHBORHOOD_LAYERS.flatMap(g => g.categories).filter(c => activeCategoryIds.has(c.id));
    if (categories.length === 0) return;

    // Load static data immediately
    const staticPois: POIMarkerData[] = [];
    const overpassCategories: LayerCategory[] = [];

    categories.forEach(category => {
      if (category.comingSoon) return;

      const staticData = category.staticDataId ? SA_TRANSPORT_DATA[category.staticDataId] : undefined;
      if (staticData) {
        // It's static data (Gautrain, MyCiTi, etc.)
        staticData.forEach(item => {
          // Only add if within bounds
          if (item.lat >= bounds.south && item.lat <= bounds.north &&
              item.lng >= bounds.west && item.lng <= bounds.east) {
            staticPois.push({ ...item, category });
          }
        });
      } else if (category.overpassQuery) {
        overpassCategories.push(category);
      }
    });

    if (overpassCategories.length === 0) {
      queueMicrotask(() => setPois(staticPois));
      return;
    }

    const fetchOverpass = async () => {
      queueMicrotask(() => setIsLoading(true));

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const newPois: POIMarkerData[] = [...staticPois];
      const queriesToRun: LayerCategory[] = [];

      for (const cat of overpassCategories) {
        const cacheKey = getCacheKey(cat.id, bounds);
        const cached = poiCache.get(cacheKey);
        if (cached) {
          newPois.push(...cached);
        } else {
          queriesToRun.push(cat);
        }
      }

      if (queriesToRun.length > 0) {
        try {
          // Build single bulk query for Overpass
          // Example: node["shop"~"supermarket"](south,west,north,east);
          let queryBody = "";
          queriesToRun.forEach(cat => {
            queryBody += `${cat.overpassQuery}(${bounds.south},${bounds.west},${bounds.north},${bounds.east});\n`;
          });

          const overpassQL = `[out:json][timeout:15];\n(\n${queryBody});\nout center;`;
          
          const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: overpassQL,
            signal: abortControllerRef.current.signal
          });

          if (!response.ok) throw new Error("Overpass API failed");
          const data = await response.json() as OverpassResponse;

          // Process and group results by mapping tags back to our categories
          const fetchedResults = new Map<string, POIMarkerData[]>();
          queriesToRun.forEach(c => fetchedResults.set(c.id, []));

          // This is a simplified mapper. In a robust production app, we'd more carefully match tags to the specific query that found it.
          data.elements?.forEach((el) => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            if (!lat || !lon) return;
            
            const name = el.tags?.name || el.tags?.brand || "Unnamed location";
            
            // Find which category this belongs to by running a basic check
            for (const cat of queriesToRun) {
              // Extract the tag key and values from the query (e.g., nwr["shop"~"supermarket|convenience"])
              const match = cat.overpassQuery?.match(/\["(.*?)"[=~]"(.*?)"\]/);
              if (match) {
                const tagKey = match[1];
                const tagVal = match[2];
                if (tagKey && tagVal && el.tags) {
                  const tagValue = el.tags[tagKey];
                  if (tagValue && new RegExp(tagVal).test(tagValue)) {
                    const poi = {
                      id: `${el.type}-${el.id}`,
                      name,
                      lat,
                      lng: lon,
                      category: cat
                    };
                    fetchedResults.get(cat.id)?.push(poi);
                    newPois.push(poi);
                    break; // found its category
                  }
                }
              }
            }
          });

          // Save to cache
          queriesToRun.forEach(cat => {
            const results = fetchedResults.get(cat.id) || [];
            poiCache.set(getCacheKey(cat.id, bounds), results);
          });

        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
          // Fallback to what we have
        }
      }

      queueMicrotask(() => setPois(newPois));
      queueMicrotask(() => setIsLoading(false));
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchOverpass, 600);
    return () => clearTimeout(timeoutId);

  }, [activeCategoryIds, bounds]);

  return {
    pois: activeCategoryIds.size === 0 || !bounds ? [] : pois,
    isLoading: activeCategoryIds.size === 0 || !bounds ? false : isLoading,
  };
}
