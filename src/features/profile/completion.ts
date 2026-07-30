import type { MarketplacePersona } from "@/lib/personas";

type CompletionRecord = Record<string, unknown>;

const sharedRequiredFields = [
  "displayName",
  "avatarUrl",
  "bio",
  "languages",
] as const;

export const personaRequiredFields: Record<
  MarketplacePersona,
  readonly string[]
> = {
  renter: [
    "occupation",
    "rentBudgetMin",
    "rentBudgetMax",
    "preferredAreas",
    "moveInDate",
    "householdSize",
  ],
  buyer: [
    "buyingBudget",
    "depositSaved",
    "bondStatus",
    "buyingTimeline",
    "preferredSuburbs",
    "purchasePurpose",
  ],
  landlord: [
    "businessName",
    "portfolioSize",
    "yearsManaging",
    "ownerType",
    "officeLocation",
  ],
  seller: ["businessName", "officeLocation", "propertySpecialties"],
};

function isComplete(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

export function calculatePersonaCompletion(
  persona: MarketplacePersona,
  shared: CompletionRecord,
  details: CompletionRecord | null,
) {
  const fields = [...sharedRequiredFields, ...personaRequiredFields[persona]];
  const completed = fields.filter((field) =>
    isComplete(field in shared ? shared[field] : details?.[field]),
  ).length;
  return Math.round((completed / fields.length) * 100);
}
