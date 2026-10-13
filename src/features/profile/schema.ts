import { z } from "zod";

import { marketplacePersonas } from "@/lib/personas";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const stringList = z
  .array(z.string().trim().min(1).max(100))
  .max(20)
  .transform((values) => [...new Set(values)]);

const nullableNonNegative = z.number().finite().nonnegative().nullable();

export const updateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(50, "Phone number is too long"),
});

export const publicIdentitySchema = z.object({
  displayName: z.string().trim().min(1, "Add a display name.").max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,30}$/,
      "Use 3–30 lowercase letters, numbers, or underscores.",
    ),
  avatarUrl: z
    .union([z.string().trim().url("Use a valid image URL."), z.literal("")])
    .transform((value) => value || null),
  bio: nullableText(1000),
  languages: stringList,
});

export const profilePrivacySchema = z.object({
  profile: z.enum(["everyone", "members", "interactions", "no_one"]),
  messaging: z.enum(["everyone", "members", "interactions", "no_one"]),
  phone: z.enum(["members", "interactions", "no_one"]),
  email: z.enum(["members", "interactions", "no_one"]),
  reviews: z.boolean(),
  activity: z.boolean(),
  searchIndexed: z.boolean(),
});

export const addPersonaSchema = z.enum(marketplacePersonas);

export const personaDetailsSchema = z.discriminatedUnion("persona", [
  z.object({
    persona: z.literal("renter"),
    details: z.object({
      occupation: nullableText(120),
      employer: nullableText(160),
      monthlyIncome: nullableNonNegative,
      rentBudgetMin: z.number().int().nonnegative().nullable(),
      rentBudgetMax: z.number().int().nonnegative().nullable(),
      preferredAreas: stringList,
      moveInDate: z.string().date().nullable(),
      householdSize: z.number().int().min(1).max(30).nullable(),
      hasPets: z.boolean().nullable(),
      smokingPreference: z
        .enum(["non_smoker", "smoker", "outdoors_only"])
        .nullable(),
      studentStatus: z.boolean().nullable(),
      nsfasEligible: z.boolean().nullable(),
      governmentAssistance: z.boolean().nullable(),
    }),
  }),
  z.object({
    persona: z.literal("buyer"),
    details: z.object({
      buyingBudget: z.number().int().nonnegative().nullable(),
      depositSaved: z.number().int().nonnegative().nullable(),
      bondStatus: z
        .enum(["not_started", "preparing", "pre_approved", "approved"])
        .nullable(),
      mortgageProvider: nullableText(160),
      buyingTimeline: z
        .enum([
          "now",
          "three_months",
          "six_months",
          "twelve_months",
          "exploring",
        ])
        .nullable(),
      preferredSuburbs: stringList,
      propertyGoals: stringList,
      purchasePurpose: z.enum(["residential", "investment", "both"]).nullable(),
    }),
  }),
  z.object({
    persona: z.literal("landlord"),
    details: z.object({
      businessName: nullableText(160),
      companyLogoUrl: z
        .union([z.string().trim().url(), z.literal("")])
        .transform((value) => value || null),
      portfolioSize: z.number().int().nonnegative().nullable(),
      yearsManaging: z.number().int().min(0).max(100).nullable(),
      ownerType: z.enum(["private_owner", "agency"]).nullable(),
      officeLocation: nullableText(240),
      licenseDetails: nullableText(500),
    }),
  }),
  z.object({
    persona: z.literal("seller"),
    details: z.object({
      businessName: nullableText(160),
      companyLogoUrl: z
        .union([z.string().trim().url(), z.literal("")])
        .transform((value) => value || null),
      officeLocation: nullableText(240),
      propertySpecialties: stringList,
    }),
  }),
]);

export const contactProfileSchema = z.object({
  recipientId: z.string().uuid(),
  intent: z.enum(["rent", "buy", "list", "sell", "general"]),
  listingId: z.string().uuid().nullable(),
  message: z.string().trim().min(10).max(1000),
});

export const reviewSchema = z.object({
  entitlementId: z.string().uuid(),
  overall: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5).nullable(),
  honesty: z.number().int().min(1).max(5).nullable(),
  professionalism: z.number().int().min(1).max(5).nullable(),
  propertyAccuracy: z.number().int().min(1).max(5).nullable(),
  viewingExperience: z.number().int().min(1).max(5).nullable(),
  responsiveness: z.number().int().min(1).max(5).nullable(),
  body: z.string().trim().max(3000),
  submit: z.boolean(),
});

export const notificationPreferenceSchema = z.object({
  category: z.enum([
    "messages",
    "applications",
    "viewings",
    "offers",
    "saved_searches",
    "marketing",
    "security",
    "account_updates",
    "reviews",
    "verification",
    "blog_updates",
  ]),
  channel: z.enum(["in_app", "email", "push"]),
  frequency: z.enum(["instant", "hourly", "daily", "weekly", "never"]),
  enabled: z.boolean(),
});

export function validateProfileUpdateInput(phone: FormDataEntryValue | null) {
  return updateProfileSchema.safeParse({ phone });
}

export const profileActivityQuerySchema = z.object({
  category: z.string().trim().min(1).max(40).optional(),
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const profileNotificationsQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const profileReviewsQuerySchema = z.object({
  direction: z.enum(["received", "written"]).default("received"),
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
