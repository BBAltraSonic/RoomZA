export const marketplacePersonas = [
  "renter",
  "buyer",
  "landlord",
  "seller",
] as const;

export type MarketplacePersona = (typeof marketplacePersonas)[number];

export const marketplacePersonaLabels: Record<MarketplacePersona, string> = {
  renter: "Renter",
  buyer: "Buyer",
  landlord: "Landlord",
  seller: "Seller",
};

export function isMarketplacePersona(
  value: unknown,
): value is MarketplacePersona {
  return (
    typeof value === "string" &&
    marketplacePersonas.includes(value as MarketplacePersona)
  );
}

export function getPersonaHome(persona: MarketplacePersona) {
  return persona === "landlord" || persona === "seller" ? "/dashboard" : "/";
}

export function isProviderPersona(persona: MarketplacePersona) {
  return persona === "landlord" || persona === "seller";
}
