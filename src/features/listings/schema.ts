import { z } from "zod";

export const parkingTypes = ["none", "covered", "uncovered", "garage"] as const;
export const electricityTypes = ["prepaid", "conventional", "solar", "none"] as const;
export const waterTypes = ["municipal", "borehole", "both", "none"] as const;
export const leaseDurations = ["month_to_month", "6_months", "12_months", "24_months"] as const;
export const propertyTypes = ["apartment", "house", "room", "studio", "cottage", "townhouse"] as const;

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

const titleMinLength = 3;
const titleMaxLength = 120;
const minLatitude = -90;
const maxLatitude = 90;
const minLongitude = -180;
const maxLongitude = 180;

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

export const listingSchema = z.object({
  title: z
    .string()
    .min(titleMinLength, `Title must be at least ${titleMinLength} characters`)
    .max(titleMaxLength, `Title must be at most ${titleMaxLength} characters`),
  description: z.string().max(2000, "Description must be at most 2000 characters").optional(),
  property_type: z.enum(propertyTypes, { message: "Select a property type" }),
  price: z.coerce.number().int("Price must be a whole number").positive("Price must be greater than 0"),
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
  lease_duration: z.enum(leaseDurations, { message: "Select a lease duration" }),
  availability_date: z.string().min(1, "Availability date is required"),
});

export type ListingFormData = z.infer<typeof listingSchema>;
