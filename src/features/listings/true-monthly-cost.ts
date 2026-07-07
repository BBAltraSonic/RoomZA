import type { AmenitiesData } from "./schema";

export type HouseholdSize = 1 | 2 | 3 | 4 | 5;
export type TransportMethod = "none" | "taxi" | "public_transport" | "driving" | "uber" | "mixed";
export type CostSource = "rent" | "included" | "landlord estimate" | "Pinpoints estimate" | "renter input";
export type CostCategory =
  | "rent"
  | "electricity"
  | "water"
  | "wifi"
  | "parking"
  | "security"
  | "groceries"
  | "transport";

export type TrueMonthlyCostListing = {
  price: number;
  property_type?: string | null;
  bedrooms?: number | null;
  parking_count?: number | null;
  electricity_type?: string | null;
  water_availability?: string | null;
  electricity_included?: boolean | null;
  electricity_estimate?: number | null;
  water_included?: boolean | null;
  water_estimate?: number | null;
  wifi_available?: boolean | null;
  wifi_included?: boolean | null;
  wifi_estimate?: number | null;
  parking_included?: boolean | null;
  parking_estimate?: number | null;
  security_fee_estimate?: number | null;
  metadata?: { amenities?: AmenitiesData } | null;
};

export type RenterCostInputs = {
  householdSize: HouseholdSize;
  transportMethod: TransportMethod;
  workplaceLabel?: string;
  monthlyTransportCost?: number;
};

export type CostRow = {
  category: CostCategory;
  label: string;
  amount: number;
  source: CostSource;
  detail: string;
};

export type TrueMonthlyCostEstimate = {
  total: number;
  rows: CostRow[];
  warnings: string[];
};

const groceryEstimateByHouseholdSize: Record<HouseholdSize, number> = {
  1: 2100,
  2: 3800,
  3: 5200,
  4: 6500,
  5: 7800,
};

const electricityBaseByPropertyType: Record<string, number> = {
  room: 450,
  studio: 600,
  apartment: 750,
  cottage: 850,
  townhouse: 950,
  house: 1200,
};

function clampMoney(value: number) {
  return Math.max(0, Math.round(value));
}

function hasAmenity(listing: TrueMonthlyCostListing, amenity: string) {
  const amenities = listing.metadata?.amenities;
  if (!amenities) return false;

  return Object.values(amenities).some((items) => items.includes(amenity as never));
}

function landlordEstimate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? clampMoney(value) : null;
}

function estimateElectricity(listing: TrueMonthlyCostListing, householdSize: HouseholdSize) {
  if (listing.electricity_included) {
    return { amount: 0, source: "included" as const, detail: "Electricity is marked as included." };
  }

  const provided = landlordEstimate(listing.electricity_estimate);
  if (provided !== null) {
    return { amount: provided, source: "landlord estimate" as const, detail: "Based on the landlord's monthly estimate." };
  }

  if (listing.electricity_type === "none") {
    return { amount: 0, source: "Pinpoints estimate" as const, detail: "No separate electricity cost was indicated." };
  }

  const propertyBase = electricityBaseByPropertyType[listing.property_type ?? "apartment"] ?? electricityBaseByPropertyType.apartment ?? 750;
  const householdMultiplier = 1 + (householdSize - 1) * 0.35;
  const conventionalAdjustment = listing.electricity_type === "conventional" ? 100 : 0;
  const solarAdjustment = listing.electricity_type === "solar" || hasAmenity(listing, "solar_geyser") ? -180 : 0;
  const backupPowerAdjustment = hasAmenity(listing, "backup_power") ? -80 : 0;

  return {
    amount: clampMoney(propertyBase * householdMultiplier + conventionalAdjustment + solarAdjustment + backupPowerAdjustment),
    source: "Pinpoints estimate" as const,
    detail: "Estimated from property type, household size, electricity setup, and backup-power amenities.",
  };
}

function estimateWater(listing: TrueMonthlyCostListing, householdSize: HouseholdSize) {
  if (listing.water_included) {
    return { amount: 0, source: "included" as const, detail: "Water is marked as included." };
  }

  const provided = landlordEstimate(listing.water_estimate);
  if (provided !== null) {
    return { amount: provided, source: "landlord estimate" as const, detail: "Based on the landlord's monthly estimate." };
  }

  if (listing.water_availability === "none") {
    return { amount: 0, source: "Pinpoints estimate" as const, detail: "No separate municipal water cost was indicated." };
  }

  const base = listing.water_availability === "borehole" ? 90 : 160;
  return {
    amount: clampMoney(base + householdSize * 115),
    source: "Pinpoints estimate" as const,
    detail: "Estimated from household size and the listed water source.",
  };
}

function estimateWifi(listing: TrueMonthlyCostListing) {
  if (listing.wifi_included) {
    return { amount: 0, source: "included" as const, detail: "WiFi is marked as included." };
  }

  const provided = landlordEstimate(listing.wifi_estimate);
  if (provided !== null) {
    return { amount: provided, source: "landlord estimate" as const, detail: "Based on the landlord's monthly estimate." };
  }

  if (listing.wifi_available === false) {
    return { amount: 0, source: "Pinpoints estimate" as const, detail: "WiFi availability was not indicated for this listing." };
  }

  return {
    amount: listing.wifi_available ? 699 : 0,
    source: "Pinpoints estimate" as const,
    detail: listing.wifi_available ? "Estimated from a typical entry-level fibre/LTE package." : "No WiFi cost added until availability is confirmed.",
  };
}

function estimateParking(listing: TrueMonthlyCostListing) {
  if (listing.parking_included || !listing.parking_count) {
    return { amount: 0, source: listing.parking_included ? ("included" as const) : ("Pinpoints estimate" as const), detail: "No extra parking cost is expected." };
  }

  const provided = landlordEstimate(listing.parking_estimate);
  if (provided !== null) {
    return { amount: provided, source: "landlord estimate" as const, detail: "Based on the landlord's monthly estimate." };
  }

  return { amount: 350, source: "Pinpoints estimate" as const, detail: "Conservative estimate for an extra bay or parking admin fee." };
}

function estimateSecurity(listing: TrueMonthlyCostListing) {
  const provided = landlordEstimate(listing.security_fee_estimate);
  if (provided !== null) {
    return { amount: provided, source: "landlord estimate" as const, detail: "Based on the landlord's monthly estimate." };
  }

  return { amount: 0, source: "Pinpoints estimate" as const, detail: "No separate security or complex fee was provided." };
}

export function calculateTrueMonthlyCost(
  listing: TrueMonthlyCostListing,
  renterInputs: RenterCostInputs,
): TrueMonthlyCostEstimate {
  const electricity = estimateElectricity(listing, renterInputs.householdSize);
  const water = estimateWater(listing, renterInputs.householdSize);
  const wifi = estimateWifi(listing);
  const parking = estimateParking(listing);
  const security = estimateSecurity(listing);
  const transportAmount = clampMoney(renterInputs.monthlyTransportCost ?? 0);

  const rows: CostRow[] = [
    { category: "rent", label: "Rent", amount: clampMoney(listing.price), source: "rent", detail: "Advertised monthly rental price." },
    { category: "electricity", label: "Electricity", ...electricity },
    { category: "water", label: "Water", ...water },
    { category: "wifi", label: "WiFi", ...wifi },
    { category: "parking", label: "Parking", ...parking },
    { category: "security", label: "Security/complex fees", ...security },
    {
      category: "groceries",
      label: "Groceries",
      amount: groceryEstimateByHouseholdSize[renterInputs.householdSize],
      source: "Pinpoints estimate",
      detail: "Estimated from household size using Pinpoints MVP grocery assumptions.",
    },
    {
      category: "transport",
      label: "Transport",
      amount: transportAmount,
      source: transportAmount > 0 ? "renter input" : "Pinpoints estimate",
      detail:
        transportAmount > 0
          ? `Based on the renter's ${renterInputs.transportMethod.replace("_", " ")} input${renterInputs.workplaceLabel ? ` for ${renterInputs.workplaceLabel}` : ""}.`
          : "Add your expected monthly commute cost to personalize this estimate.",
    },
  ];

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const warnings: string[] = [];

  if (transportAmount > 1000 && transportAmount >= listing.price * 0.2) {
    warnings.push("High transport costs may offset lower rent.");
  }

  if (electricity.amount > 0 && electricity.amount >= listing.price * 0.15) {
    warnings.push("Electricity is a meaningful part of the monthly cost.");
  }

  if (total >= listing.price * 1.7) {
    warnings.push("The total estimate is much higher than rent alone.");
  }

  return { total, rows, warnings };
}

export function formatRand(amount: number) {
  return `R ${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(amount)}`;
}
