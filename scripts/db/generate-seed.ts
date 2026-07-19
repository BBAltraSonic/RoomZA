import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { faker } from "@faker-js/faker";

faker.seed(20260702);

type Role = "landlord" | "renter";
type AvailabilityLabel = "available" | "recently_listed" | "almost_full";
type ApplicationStatus = "submitted" | "under_review" | "shortlisted" | "approved" | "rejected";
type ViewingMode = "in_person" | "video_call";

type SeedUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

type SeedListing = {
  id: string;
  landlordId: string;
  title: string;
  city: string;
  availabilityLabel: AvailabilityLabel;
};

type SeedApplication = {
  id: string;
  listingId: string;
  renterId: string;
  landlordId: string;
};

type CityConfig = {
  city: string;
  count: number;
  neighborhoods: Array<{ name: string; lat: number; lng: number }>;
  price: { min: number; max: number };
};

const seedFile = path.resolve(process.cwd(), "supabase", "seed.sql");
const sql: string[] = [];

const TEST_PASSWORD = "password";

const cityConfigs: CityConfig[] = [
  {
    city: "Johannesburg",
    count: 60,
    price: { min: 4200, max: 28000 },
    neighborhoods: [
      { name: "Sandton", lat: -26.1076, lng: 28.0567 },
      { name: "Rosebank", lat: -26.1469, lng: 28.0419 },
      { name: "Fourways", lat: -26.0178, lng: 28.0065 },
      { name: "Midrand", lat: -25.9992, lng: 28.1263 },
      { name: "Randburg", lat: -26.0936, lng: 28.0063 },
      { name: "Braamfontein", lat: -26.1929, lng: 28.0362 },
      { name: "Melville", lat: -26.1756, lng: 28.0081 },
      { name: "Parktown", lat: -26.1828, lng: 28.0367 },
      { name: "Bedfordview", lat: -26.1783, lng: 28.1363 },
      { name: "Bryanston", lat: -26.0621, lng: 28.0226 },
    ],
  },
  {
    city: "Cape Town",
    count: 60,
    price: { min: 5200, max: 32000 },
    neighborhoods: [
      { name: "Sea Point", lat: -33.9181, lng: 18.3899 },
      { name: "Green Point", lat: -33.9095, lng: 18.4039 },
      { name: "Observatory", lat: -33.9379, lng: 18.4687 },
      { name: "Woodstock", lat: -33.9301, lng: 18.4475 },
      { name: "Claremont", lat: -33.9823, lng: 18.4656 },
      { name: "Rondebosch", lat: -33.9632, lng: 18.4764 },
      { name: "Bellville", lat: -33.9006, lng: 18.6319 },
      { name: "Century City", lat: -33.8926, lng: 18.5063 },
      { name: "Gardens", lat: -33.9345, lng: 18.4112 },
      { name: "Milnerton", lat: -33.8745, lng: 18.5002 },
    ],
  },
  {
    city: "Pretoria",
    count: 35,
    price: { min: 3800, max: 22000 },
    neighborhoods: [
      { name: "Hatfield", lat: -25.7493, lng: 28.238 },
      { name: "Brooklyn", lat: -25.7731, lng: 28.2356 },
      { name: "Arcadia", lat: -25.7448, lng: 28.2114 },
      { name: "Menlyn", lat: -25.7833, lng: 28.2755 },
      { name: "Centurion", lat: -25.8601, lng: 28.1894 },
      { name: "Sunnyside", lat: -25.7599, lng: 28.2061 },
      { name: "Lynnwood", lat: -25.7653, lng: 28.2727 },
    ],
  },
  {
    city: "Durban",
    count: 35,
    price: { min: 3600, max: 24000 },
    neighborhoods: [
      { name: "Umhlanga", lat: -29.725, lng: 31.0856 },
      { name: "Morningside", lat: -29.8277, lng: 31.0129 },
      { name: "Glenwood", lat: -29.8668, lng: 30.9993 },
      { name: "Berea", lat: -29.8486, lng: 31.0018 },
      { name: "Durban North", lat: -29.7847, lng: 31.0378 },
      { name: "Westville", lat: -29.8318, lng: 30.9272 },
    ],
  },
  {
    city: "Gqeberha",
    count: 20,
    price: { min: 3200, max: 17000 },
    neighborhoods: [
      { name: "Summerstrand", lat: -33.9882, lng: 25.6656 },
      { name: "Walmer", lat: -33.9811, lng: 25.5813 },
      { name: "Richmond Hill", lat: -33.9581, lng: 25.6117 },
      { name: "Humewood", lat: -33.9746, lng: 25.6359 },
      { name: "Newton Park", lat: -33.9466, lng: 25.5684 },
      { name: "Lorraine", lat: -33.9797, lng: 25.5207 },
    ],
  },
  {
    city: "Bloemfontein",
    count: 15,
    price: { min: 3000, max: 14000 },
    neighborhoods: [
      { name: "Westdene", lat: -29.1121, lng: 26.2056 },
      { name: "Universitas", lat: -29.1219, lng: 26.1851 },
      { name: "Dan Pienaar", lat: -29.0867, lng: 26.2195 },
    ],
  },
  {
    city: "East London",
    count: 15,
    price: { min: 3100, max: 15000 },
    neighborhoods: [
      { name: "Beacon Bay", lat: -32.9692, lng: 27.9438 },
      { name: "Nahoon", lat: -32.9858, lng: 27.9464 },
      { name: "Gonubie", lat: -32.9432, lng: 28.0198 },
    ],
  },
  {
    city: "Mbombela",
    count: 15,
    price: { min: 3300, max: 16000 },
    neighborhoods: [
      { name: "Nelspruit Central", lat: -25.4753, lng: 30.9694 },
      { name: "Sonheuwel", lat: -25.4936, lng: 30.9748 },
      { name: "Steiltes", lat: -25.5067, lng: 30.9999 },
    ],
  },
  {
    city: "Polokwane",
    count: 15,
    price: { min: 2900, max: 14500 },
    neighborhoods: [
      { name: "Bendor", lat: -23.8826, lng: 29.4867 },
      { name: "Flora Park", lat: -23.9132, lng: 29.481 },
      { name: "Penina Park", lat: -23.9186, lng: 29.4448 },
    ],
  },
  {
    city: "Kimberley",
    count: 10,
    price: { min: 2800, max: 13000 },
    neighborhoods: [
      { name: "Monument Heights", lat: -28.7429, lng: 24.7713 },
      { name: "Royldene", lat: -28.7147, lng: 24.7686 },
    ],
  },
  {
    city: "Rustenburg",
    count: 10,
    price: { min: 3000, max: 15000 },
    neighborhoods: [
      { name: "Cashan", lat: -25.683, lng: 27.2218 },
      { name: "Safari Gardens", lat: -25.6755, lng: 27.2286 },
    ],
  },
  {
    city: "George",
    count: 10,
    price: { min: 3500, max: 18000 },
    neighborhoods: [
      { name: "Blanco", lat: -33.9473, lng: 22.4073 },
      { name: "Heatherlands", lat: -33.9492, lng: 22.4507 },
    ],
  },
];

const landlordCompanies = [
  "Mokoena Urban Homes",
  "Cape Key Rentals",
  "Jozi Nest Properties",
  "Student Stay SA",
  "Khumalo Letting Co.",
  "Coastal Room Collective",
  "Prime Pads",
  "Ndlovu Residential",
  "Metro Micro-Living",
  "Garden Route Rentals",
];

const propertyTypes = ["apartment", "house", "cottage", "townhouse", "studio", "room"] as const;
const parkingTypes = ["none", "covered", "uncovered", "garage"] as const;
const electricityTypes = ["prepaid", "conventional", "solar", "none"] as const;
const waterTypes = ["municipal", "borehole", "both", "none"] as const;
const leaseDurations = ["month_to_month", "6_months", "12_months", "24_months"] as const;

const listingImages = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",
  "https://images.unsplash.com/photo-1502672260266-1c15293936f4",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
  "https://images.unsplash.com/photo-1513694203232-719a280e022f",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
  "https://images.unsplash.com/photo-1560184897-ae75f418493e",
  "https://images.unsplash.com/photo-1560448075-bb485b067938",
  "https://images.unsplash.com/photo-1560449752-6fd5f81f4a96",
];

function append(statement = "") {
  sql.push(statement);
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlBool(value: boolean): string {
  return value ? "true" : "false";
}

function stableUuid(namespace: string, index: number): string {
  const hash = createHash("sha256").update(`roomza:${namespace}:${index}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${((parseInt(hash[16] ?? "0", 16) & 0x3) | 0x8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function item<T>(items: readonly T[]): T {
  return items[faker.number.int({ min: 0, max: items.length - 1 })]!;
}

function many<T>(items: readonly T[], min: number, max: number): T[] {
  return faker.helpers.arrayElements(items, faker.number.int({ min, max }));
}

function roundedMoney(min: number, max: number): number {
  return faker.number.int({ min: Math.ceil(min / 100), max: Math.floor(max / 100) }) * 100;
}

function phoneNumber(): string {
  return `+27 ${faker.number.int({ min: 60, max: 84 })} ${faker.number.int({ min: 100, max: 999 })} ${faker.number.int({ min: 1000, max: 9999 })}`;
}

function availabilityForIndex(index: number): AvailabilityLabel {
  if (index < 210) return "available";
  if (index < 270) return "recently_listed";
  return "almost_full";
}

function createdAtForAvailability(label: AvailabilityLabel): string {
  if (label === "recently_listed") return `now() - interval '${faker.number.int({ min: 0, max: 6 })} days'`;
  return `now() - interval '${faker.number.int({ min: 7, max: 90 })} days'`;
}

function dateForAvailability(label: AvailabilityLabel): string {
  if (label === "almost_full") return `(current_date + interval '${faker.number.int({ min: 1, max: 10 })} days')::date`;
  if (label === "recently_listed") return `(current_date + interval '${faker.number.int({ min: 3, max: 35 })} days')::date`;
  return `(current_date + interval '${faker.number.int({ min: 0, max: 60 })} days')::date`;
}

function amenities() {
  return {
    essentials: many(["wifi", "air_conditioning", "heating", "backup_power", "solar_geyser", "furnished", "pet_friendly"], 1, 4),
    security: many(["24hr_security", "cctv", "electric_fencing", "alarm_system", "secure_parking", "gated_complex", "intercom"], 1, 4),
    lifestyle: many(["pool", "gym", "garden", "balcony", "braai_area", "clubhouse", "laundry"], 0, 4),
    appliances: many(["stove", "oven", "fridge", "washing_machine", "dishwasher", "microwave"], 1, 4),
  };
}

function createUser(role: Role, index: number): SeedUser {
  const id = stableUuid(role, index);
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fullName = role === "landlord" && index < landlordCompanies.length ? landlordCompanies[index]! : `${firstName} ${lastName}`;
  const email = `${role}${String(index + 1).padStart(2, "0")}@roomza.test`;
  const rawUserMetadata = { full_name: fullName, role, avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}` };

  append(`insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new,
  recovery_token
) values (
  ${sqlString(id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  ${sqlString(email)}, crypt(${sqlString(TEST_PASSWORD)}, gen_salt('bf')), now(), null, now(),
  '{"provider":"email","providers":["email"]}'::jsonb, ${sqlJson(rawUserMetadata)},
  now(), now(), '', '', '', ''
);`);

  append(`insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values (
  ${sqlString(stableUuid(`${role}-identity`, index))}, ${sqlString(id)},
  ${sqlJson({ sub: id, email, email_verified: true, phone_verified: false })},
  'email', ${sqlString(id)}, now(), now(), now()
) on conflict (provider, provider_id) do nothing;`);

  append(`insert into public.profiles (
  id, email, full_name, avatar_url, role, phone, phone_verified, email_verified_at, about, created_at, updated_at
) values (
  ${sqlString(id)}, ${sqlString(email)}, ${sqlString(fullName)},
  ${sqlString(`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}`)},
  ${sqlString(role)}, ${sqlString(phoneNumber())}, true, now(),
  ${sqlString(role === "landlord" ? "Responsive landlord with verified RoomZA test listings." : "RoomZA test renter profile for local workflow checks.")},
  now(), now()
) on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  role = excluded.role,
  phone = excluded.phone,
  phone_verified = excluded.phone_verified,
  email_verified_at = excluded.email_verified_at,
  about = excluded.about,
  updated_at = now();`);

  return { id, email, fullName, role };
}

function createListing(index: number, config: CityConfig, landlord: SeedUser): SeedListing {
  const id = stableUuid("listing", index);
  const neighborhood = item(config.neighborhoods);
  const propertyType = item(propertyTypes);
  const bedrooms = propertyType === "studio" || propertyType === "room" ? 1 : faker.number.int({ min: 1, max: 4 });
  const bathrooms = propertyType === "room" ? 1 : faker.number.float({ min: 1, max: 3, fractionDigits: 1 });
  const availabilityLabel = availabilityForIndex(index);
  const lat = Number((neighborhood.lat + faker.number.float({ min: -0.012, max: 0.012, fractionDigits: 6 })).toFixed(6));
  const lng = Number((neighborhood.lng + faker.number.float({ min: -0.012, max: 0.012, fractionDigits: 6 })).toFixed(6));
  const price = propertyType === "room" ? roundedMoney(2200, 5200) : roundedMoney(config.price.min, config.price.max);
  const parkingType = item(parkingTypes);
  const electricityType = item(electricityTypes);
  const waterAvailability = item(waterTypes);
  const wifiAvailable = faker.datatype.boolean({ probability: 0.82 });
  const parkingCount = parkingType === "none" ? 0 : faker.number.int({ min: 1, max: 2 });
  const listingAmenities = amenities();
  const createdAt = createdAtForAvailability(availabilityLabel);
  const titlePrefix = propertyType === "room" ? "Room in" : propertyType === "studio" ? "Light-filled" : item(["Secure", "Modern", "Sunny", "Well-kept", "Spacious"]);
  const title = `${titlePrefix} ${propertyType.replace("_", " ")} in ${neighborhood.name}`;

  append(`insert into public.listings (
  id, landlord_id, title, description, property_type, price, address,
  latitude, longitude, bedrooms, bathrooms, parking_type, parking_count,
  electricity_type, water_availability, lease_duration, availability_date,
  metadata, status, electricity_included, electricity_estimate, water_included,
  water_estimate, wifi_available, wifi_included, wifi_estimate, parking_included,
  parking_estimate, security_fee_estimate, created_at, updated_at
) values (
  ${sqlString(id)}, ${sqlString(landlord.id)}, ${sqlString(title)},
  ${sqlString(`${faker.lorem.sentences(2)} Close to transport, groceries, and neighbourhood amenities in ${neighborhood.name}.`)},
  ${sqlString(propertyType)}, ${price}, ${sqlString(`${faker.number.int({ min: 1, max: 220 })} ${faker.location.street()}, ${neighborhood.name}, ${config.city}`)},
  ${lat}, ${lng}, ${bedrooms}, ${bathrooms}, ${sqlString(parkingType)}, ${parkingCount},
  ${sqlString(electricityType)}, ${sqlString(waterAvailability)}, ${sqlString(item(leaseDurations))}, ${dateForAvailability(availabilityLabel)},
  ${sqlJson({ amenities: listingAmenities, city: config.city, neighborhood: neighborhood.name, availabilityLabel })},
  'published', ${sqlBool(faker.datatype.boolean({ probability: 0.28 }))}, ${faker.datatype.boolean({ probability: 0.7 }) ? roundedMoney(350, 1300) : "null"},
  ${sqlBool(faker.datatype.boolean({ probability: 0.2 }))}, ${faker.datatype.boolean({ probability: 0.65 }) ? roundedMoney(120, 500) : "null"},
  ${sqlBool(wifiAvailable)}, ${sqlBool(wifiAvailable && faker.datatype.boolean({ probability: 0.45 }))}, ${wifiAvailable ? roundedMoney(400, 900) : "null"},
  ${sqlBool(parkingCount > 0 && faker.datatype.boolean({ probability: 0.5 }))}, ${parkingCount > 0 ? roundedMoney(250, 850) : "null"},
  ${faker.datatype.boolean({ probability: 0.35 }) ? roundedMoney(200, 900) : "null"}, ${createdAt}, ${createdAt}
);`);

  const imageCount = faker.number.int({ min: 4, max: 10 });
  for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const url = `${item(listingImages)}?auto=format&fit=crop&w=1200&q=80&roomza=${index}-${imageIndex}`;
    append(`insert into public.listing_images (
  id, listing_id, public_url, path, bucket, sort_order, created_at
) values (
  ${sqlString(stableUuid(`listing-image-${index}`, imageIndex))}, ${sqlString(id)}, ${sqlString(url)},
  ${sqlString(`seed/listings/${id}/${imageIndex}.jpg`)}, 'listing-images', ${imageIndex}, ${createdAt}
);`);
  }

  return { id, landlordId: landlord.id, title, city: config.city, availabilityLabel };
}

function generateApplications(listings: SeedListing[], renters: SeedUser[]): SeedApplication[] {
  const applications: SeedApplication[] = [];
  const usedPairs = new Set<string>();
  let attempts = 0;

  while (applications.length < 100 && attempts < 1000) {
    attempts += 1;
    const listing = item(listings);
    const renter = renters[(applications.length + attempts) % renters.length]!;
    const pair = `${renter.id}:${listing.id}`;
    if (usedPairs.has(pair)) continue;
    usedPairs.add(pair);

    const id = stableUuid("application", applications.length);
    const status: ApplicationStatus = item(["submitted", "under_review", "shortlisted", "approved", "rejected"]);
    const createdAt = `now() - interval '${faker.number.int({ min: 1, max: 45 })} days'`;
    append(`insert into public.applications (
  id, listing_id, renter_id, status, full_name, employment_status, income,
  household_size, move_in_date, created_at, updated_at
) values (
  ${sqlString(id)}, ${sqlString(listing.id)}, ${sqlString(renter.id)}, ${sqlString(status)},
  ${sqlString(renter.fullName)}, ${sqlString(item(["Employed", "Self-employed", "Student with guarantor", "Contractor"]))},
  ${faker.number.int({ min: 12000, max: 95000 })}, ${faker.number.int({ min: 1, max: 5 })},
  (current_date + interval '${faker.number.int({ min: 7, max: 70 })} days')::date, ${createdAt}, ${createdAt}
);`);
    append(`insert into public.application_status_events (
  id, application_id, actor_id, from_status, to_status, created_at
) values (
  ${sqlString(stableUuid("application-status-event", applications.length))}, ${sqlString(id)}, ${sqlString(listing.landlordId)},
  null, ${sqlString(status)}, ${createdAt}
);`);
    applications.push({ id, listingId: listing.id, renterId: renter.id, landlordId: listing.landlordId });
  }

  if (applications.length !== 100) {
    throw new Error(`Expected to generate 100 applications, generated ${applications.length}`);
  }

  return applications;
}

function generateConversations(applications: SeedApplication[]) {
  applications.slice(0, 40).forEach((application, index) => {
    const id = stableUuid("conversation", index);
    append(`insert into public.conversations (
  id, listing_id, landlord_id, renter_id, application_id, type, created_at
) values (
  ${sqlString(id)}, ${sqlString(application.listingId)}, ${sqlString(application.landlordId)},
  ${sqlString(application.renterId)}, ${sqlString(application.id)}, 'application',
  now() - interval '${faker.number.int({ min: 1, max: 20 })} days'
);`);

    const messageCount = faker.number.int({ min: 3, max: 8 });
    for (let messageIndex = 0; messageIndex < messageCount; messageIndex += 1) {
      const senderId = messageIndex % 2 === 0 ? application.renterId : application.landlordId;
      append(`insert into public.messages (
  id, conversation_id, listing_id, sender_id, content, created_at, read_at
) values (
  ${sqlString(stableUuid(`message-${index}`, messageIndex))}, ${sqlString(id)}, ${sqlString(application.listingId)},
  ${sqlString(senderId)}, ${sqlString(item([
        "Hi, is this place still available?",
        "Yes, it is available. Happy to answer questions.",
        "Could I arrange a viewing this week?",
        "I have added a few viewing options for you.",
        "Thanks, that works for me.",
        "Please bring your ID and proof of income if you attend in person.",
      ]))},
  now() - interval '${messageCount - messageIndex} hours',
  ${messageIndex < messageCount - 1 ? "now() - interval '30 minutes'" : "null"}
);`);
    }
  });
}

function generateFavorites(listings: SeedListing[], renters: SeedUser[]) {
  const pairs = new Set<string>();
  let index = 0;
  while (pairs.size < 100 && index < 1000) {
    const renter = renters[index % renters.length]!;
    const listing = listings[(index * 7 + 11) % listings.length]!;
    const pair = `${renter.id}:${listing.id}`;
    if (!pairs.has(pair)) {
      pairs.add(pair);
      append(`insert into public.user_favorites (
  id, user_id, listing_id, created_at
) values (
  ${sqlString(stableUuid("favorite", pairs.size - 1))}, ${sqlString(renter.id)}, ${sqlString(listing.id)},
  now() - interval '${faker.number.int({ min: 1, max: 60 })} days'
);`);
    }
    index += 1;
  }
}

function generateViewings(applications: SeedApplication[]) {
  applications.slice(0, 25).forEach((application, index) => {
    const slotId = stableUuid("viewing-slot", index);
    const viewingId = stableUuid("viewing", index);
    const mode: ViewingMode = item(["in_person", "video_call"]);
    const startDay = faker.number.int({ min: 1, max: 14 });
    const startHour = faker.number.int({ min: 9, max: 17 });
    const starts = `(date_trunc('day', now()) + interval '${startDay} days' + interval '${startHour} hours')`;
    const roomId = `roomza-seed-viewing-${index + 1}`;

    append(`insert into public.viewing_slots (
  id, listing_id, created_by, start_time, end_time, mode, is_booked, created_at
) values (
  ${sqlString(slotId)}, ${sqlString(application.listingId)}, ${sqlString(application.landlordId)},
  ${starts}, ${starts} + interval '30 minutes', ${sqlString(mode)}, true, now()
);`);
    append(`insert into public.viewing_slot_offers (
  id, slot_id, application_id, created_at
) values (
  ${sqlString(stableUuid("viewing-slot-offer", index))}, ${sqlString(slotId)}, ${sqlString(application.id)}, now()
);`);
    append(`insert into public.viewings (
  id, application_id, slot_id, status, meeting_provider, meeting_room_id,
  meeting_join_url, meeting_starts_at, meeting_ends_at, created_at
) values (
  ${sqlString(viewingId)}, ${sqlString(application.id)}, ${sqlString(slotId)}, 'booked',
  ${mode === "video_call" ? "'jitsi'" : "null"}, ${mode === "video_call" ? sqlString(roomId) : "null"},
  ${mode === "video_call" ? sqlString(`https://meet.jit.si/${roomId}`) : "null"},
  ${mode === "video_call" ? starts : "null"}, ${mode === "video_call" ? `${starts} + interval '30 minutes'` : "null"},
  now()
);`);
  });
}

function generateAnalytics(listings: SeedListing[], renters: SeedUser[]) {
  listings.slice(0, 75).forEach((listing, index) => {
    append(`insert into public.analytics_events (
  id, user_id, event_name, properties, created_at
) values (
  ${sqlString(stableUuid("analytics-event", index))}, ${sqlString(renters[index % renters.length]!.id)},
  ${sqlString(item(["listing_viewed", "listing_saved", "map_marker_clicked", "search_filter_applied"]))},
  ${sqlJson({ listingId: listing.id, city: listing.city, source: "seed" })},
  now() - interval '${faker.number.int({ min: 1, max: 30 })} days'
);`);
  });
}

console.log("Generating deterministic RoomZA seed data...");

append("-- RoomZA Seed Data");
append("-- Generated by scripts/db/generate-seed.ts");
append(`-- Test accounts use password: ${TEST_PASSWORD}`);
append("");
append("set check_function_bodies = off;");
append("");
append("truncate table public.analytics_events cascade;");
append("truncate table public.viewings cascade;");
append("truncate table public.viewing_slot_offers cascade;");
append("truncate table public.viewing_slots cascade;");
append("truncate table public.user_favorites cascade;");
append("truncate table public.messages cascade;");
append("truncate table public.conversations cascade;");
append("truncate table public.application_status_events cascade;");
append("truncate table public.documents cascade;");
append("truncate table public.applications cascade;");
append("truncate table public.notification_events cascade;");
append("truncate table public.listing_images cascade;");
append("truncate table public.listings cascade;");
append("truncate table public.profiles cascade;");
append("truncate table auth.identities cascade;");
append("truncate table auth.users cascade;");
append("");

const landlords = Array.from({ length: 25 }, (_, index) => createUser("landlord", index));
const renters = Array.from({ length: 50 }, (_, index) => createUser("renter", index));

let listingIndex = 0;
const listings: SeedListing[] = [];
for (const config of cityConfigs) {
  for (let i = 0; i < config.count; i += 1) {
    listings.push(createListing(listingIndex, config, landlords[listingIndex % landlords.length]!));
    listingIndex += 1;
  }
}

const applications = generateApplications(listings, renters);
generateConversations(applications);
generateFavorites(listings, renters);
generateViewings(applications);
generateAnalytics(listings, renters);

append("");
append("analyze public.listings;");
append("analyze public.listing_images;");
append("analyze public.applications;");
append("analyze public.conversations;");
append("analyze public.messages;");
append("");
append(`do $$
begin
  raise notice 'RoomZA seed complete: 75 users, 300 listings, 100 applications, 40 conversations, 25 viewings.';
end
$$;`);

writeFileSync(seedFile, `${sql.join("\n")}\n`, "utf8");

console.log(`Seed SQL generated at ${seedFile}`);
