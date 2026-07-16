import { z } from "zod";

export const parkingTypes = ["none", "covered", "uncovered", "garage"] as const;
export const electricityTypes = ["prepaid", "conventional", "solar", "none"] as const;
export const waterTypes = ["municipal", "borehole", "both", "none"] as const;
export const leaseDurations = ["month_to_month", "6_months", "12_months", "24_months"] as const;
export const propertyTypes = ["apartment", "house", "room", "studio", "cottage", "townhouse"] as const;
export const listingTypes = ["rent", "sale"] as const;

export const parkingTypeLabels: Record<(typeof parkingTypes)[number], string> = {
  none: "None",
  covered: "Covered",
  uncovered: "Uncovered",
  garage: "Garage",
};

export const electricityTypeLabels: Record<(typeof electricityTypes)[number], string> = {
  prepaid: "Prepaid",
  conventional: "Conventional",
  solar: "Solar",
  none: "None",
};

export const waterTypeLabels: Record<(typeof waterTypes)[number], string> = {
  municipal: "Municipal",
  borehole: "Borehole",
  both: "Both",
  none: "None",
};

export const leaseDurationLabels: Record<(typeof leaseDurations)[number], string> = {
  month_to_month: "Month to month",
  "6_months": "6 months",
  "12_months": "12 months",
  "24_months": "24 months",
};

export const propertyTypeLabels: Record<(typeof propertyTypes)[number], string> = {
  apartment: "Apartment",
  house: "House",
  room: "Room",
  studio: "Studio",
  cottage: "Cottage",
  townhouse: "Townhouse",
};

export const listingTypeLabels: Record<(typeof listingTypes)[number], string> = {
  rent: "For rent",
  sale: "For sale",
};

const titleMinLength = 3;
const titleMaxLength = 120;
const minLatitude = -90;
const maxLatitude = 90;
const minLongitude = -180;
const maxLongitude = 180;

const optionalMoneyField = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().int("Amount must be a whole number").min(0, "Amount cannot be negative").nullable(),
);

const optionalBooleanField = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value === "true" ? true : value === "false" ? false : value),
  z.boolean().nullable(),
);

export const amenityCategories = {
  essentials: {
    label: "Essentials",
    items: ["wifi", "air_conditioning", "heating", "backup_power", "solar_geyser", "furnished", "pet_friendly"] as const,
  },
  security: {
    label: "Security",
    items: ["24hr_security", "cctv", "electric_fencing", "alarm_system", "secure_parking", "gated_complex", "intercom"] as const,
  },
  lifestyle: {
    label: "Lifestyle",
    items: ["pool", "gym", "garden", "balcony", "braai_area", "rooftop", "laundry", "communal_kitchen"] as const,
  },
  appliances: {
    label: "Appliances",
    items: ["washing_machine", "dishwasher", "microwave", "oven_stove", "fridge", "tumble_dryer"] as const,
  },
} as const;

export type AmenityCategory = keyof typeof amenityCategories;

export const amenityLabels: Record<string, string> = {
  wifi: "WiFi",
  air_conditioning: "Air Conditioning",
  heating: "Heating",
  backup_power: "Backup Power (Generator/Inverter)",
  solar_geyser: "Solar Geyser",
  furnished: "Furnished",
  pet_friendly: "Pet Friendly",
  "24hr_security": "24hr Security",
  cctv: "CCTV",
  electric_fencing: "Electric Fencing",
  alarm_system: "Alarm System",
  secure_parking: "Secure Parking",
  gated_complex: "Gated Complex",
  intercom: "Intercom",
  pool: "Pool",
  gym: "Gym",
  garden: "Garden",
  balcony: "Balcony",
  braai_area: "Braai Area",
  rooftop: "Rooftop",
  laundry: "Laundry",
  communal_kitchen: "Communal Kitchen",
  washing_machine: "Washing Machine",
  dishwasher: "Dishwasher",
  microwave: "Microwave",
  oven_stove: "Oven/Stove",
  fridge: "Fridge",
  tumble_dryer: "Tumble Dryer",
};

export const amenitiesSchema = z.object({
  essentials: z.array(z.enum(amenityCategories.essentials.items)).default([]),
  security: z.array(z.enum(amenityCategories.security.items)).default([]),
  lifestyle: z.array(z.enum(amenityCategories.lifestyle.items)).default([]),
  appliances: z.array(z.enum(amenityCategories.appliances.items)).default([]),
});

export type AmenitiesData = z.infer<typeof amenitiesSchema>;

export const emptyAmenities: AmenitiesData = {
  essentials: [],
  security: [],
  lifestyle: [],
  appliances: [],
};

export const MIN_LISTING_IMAGES = 3;

export const listingFieldLabels: Record<string, string> = {
  title: "Listing headline",
  description: "Description",
  listing_type: "Listing type",
  property_type: "Property type",
  price: "Monthly rent",
  sale_price: "Purchase price",
  address: "Location",
  latitude: "Map pin",
  longitude: "Map pin",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  parking_type: "Parking type",
  parking_count: "Parking bays",
  electricity_type: "Electricity",
  water_availability: "Water",
  electricity_included: "Electricity included",
  electricity_estimate: "Electricity estimate",
  water_included: "Water included",
  water_estimate: "Water estimate",
  wifi_available: "WiFi available",
  wifi_included: "WiFi included",
  wifi_estimate: "WiFi estimate",
  parking_included: "Parking included",
  parking_estimate: "Parking estimate",
  security_fee_estimate: "Security/complex fees",
  lease_duration: "Lease term",
  availability_date: "Available from",
};

export const listingSchema = z.object({
  listing_type: z.enum(listingTypes, { message: "Select a listing type" }).default("rent"),
  title: z
    .string()
    .min(titleMinLength, `Title must be at least ${titleMinLength} characters`)
    .max(titleMaxLength, `Title must be at most ${titleMaxLength} characters`),
  description: z.string().max(2000, "Description must be at most 2000 characters").optional(),
  property_type: z.enum(propertyTypes, { message: "Select a property type" }),
  price: z.coerce.number().int("Price must be a whole number").positive("Price must be greater than 0"),
  sale_price: optionalMoneyField,
  address: z.string().min(1, "Address is required"),
  latitude: z.coerce
    .number()
    .min(minLatitude, "Latitude must be between -90 and 90")
    .max(maxLatitude, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(minLongitude, "Longitude must be between -180 and 180")
    .max(maxLongitude, "Longitude must be between -180 and 180"),
  bedrooms: z.coerce.number().min(0, "Bedrooms cannot be negative"),
  bathrooms: z.coerce.number().min(0, "Bathrooms cannot be negative"),
  parking_type: z.enum(parkingTypes, { message: "Select a parking type" }),
  parking_count: z.coerce.number().int().min(0, "Parking count cannot be negative"),
  electricity_type: z.enum(electricityTypes, { message: "Select an electricity type" }),
  water_availability: z.enum(waterTypes, { message: "Select water availability" }),
  electricity_included: optionalBooleanField,
  electricity_estimate: optionalMoneyField,
  water_included: optionalBooleanField,
  water_estimate: optionalMoneyField,
  wifi_available: optionalBooleanField,
  wifi_included: optionalBooleanField,
  wifi_estimate: optionalMoneyField,
  parking_included: optionalBooleanField,
  parking_estimate: optionalMoneyField,
  security_fee_estimate: optionalMoneyField,
  lease_duration: z.enum(leaseDurations, { message: "Select a lease duration" }),
  availability_date: z.string().min(1, "Availability date is required"),
}).superRefine((value, ctx) => {
  if (value.listing_type === "sale" && (!value.sale_price || value.sale_price <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sale_price"],
      message: "Purchase price is required for sale listings",
    });
  }
});

export type ListingFormData = z.infer<typeof listingSchema>;
