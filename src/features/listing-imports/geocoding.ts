import "server-only";

import { geocoding, type GeocodingSearchResult } from "@maptiler/client";

import { IMPORT_LIMITS } from "./limits";

export type BatchGeocodeResult = {
  address: string;
  latitude?: number;
  longitude?: number;
  confidence?: number;
  ambiguous: boolean;
};

export async function batchGeocodeSouthAfricanAddresses(addresses: string[]): Promise<BatchGeocodeResult[]> {
  if (addresses.length > IMPORT_LIMITS.geocodeBatchSize) {
    throw new Error(`MapTiler batches are limited to ${IMPORT_LIMITS.geocodeBatchSize} addresses.`);
  }
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
  if (!apiKey || addresses.length === 0) return addresses.map((address) => ({ address, ambiguous: true }));

  const payloads = await geocoding.batch(addresses, {
    apiKey,
    country: ["za"],
    language: "en",
    autocomplete: false,
    limit: 2,
  });

  return addresses.map((address, index): BatchGeocodeResult => {
    const payload = payloads[index] as GeocodingSearchResult | undefined;
    const first = payload?.features[0];
    const second = payload?.features[1];
    if (!first) return { address, ambiguous: true };
    const longitude = first.center[0];
    const latitude = first.center[1];
    const confidence = first.relevance;
    const ambiguous = !Number.isFinite(longitude)
      || !Number.isFinite(latitude)
      || confidence < 0.85
      || Boolean(second && Math.abs(confidence - second.relevance) < 0.08);
    return { address, longitude, latitude, confidence, ambiguous };
  });
}
