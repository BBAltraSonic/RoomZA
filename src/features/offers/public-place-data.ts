import "server-only";
import { z } from "zod";
import { offerDiscoveryPlaceSchema, offerPlacesResponseSchema } from "./public-place-contract";
import { readLocationCatalogue, searchLocationCatalogue } from "@/features/places/catalogue";

export async function readOfferDiscoveryPlace(id: string) {
  const place = (await readLocationCatalogue([z.string().uuid().parse(id)]))[0];
  return place ? offerDiscoveryPlaceSchema.parse(place) : null;
}
export async function searchOfferDiscoveryPlaces(query: string) {
  const value = z.string().trim().min(2).max(100).parse(query);
  return offerPlacesResponseSchema.parse({ data: { places: (await searchLocationCatalogue(value)).data.places } });
}
