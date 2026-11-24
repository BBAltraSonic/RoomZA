import type { ListingWritingInput } from "../business/listing-writer";

/**
 * Test set for AI job 3: listing writing. Made-up listings only. A case passes when
 * Pinpoint's checks accept the writing (no invented numbers), the type is right, every
 * expected feature is found and no contact detail appears.
 */

export type WritingCase = { input: ListingWritingInput; propertyType: string | null; features: string[] };

const room = (notes: string, extra: Partial<ListingWritingInput> = {}): ListingWritingInput => ({ propertyType: "room", notes, ...extra });

export const WRITING_CASES: WritingCase[] = [
  { input: { propertyType: "apartment", bedrooms: 2, price: 8500, area: "Bellville", notes: "2 bed apartment in Bellville, R8500, fibre, secure parking and a balcony" }, propertyType: "apartment", features: ["wifi", "secure_parking", "balcony"] },
  { input: room("furnished room near UWC, NSFAS students welcome, wifi included", { price: 3800, area: "Bellville South" }), propertyType: "room", features: ["furnished", "wifi"] },
  { input: { propertyType: "house", bedrooms: 3, bathrooms: 2, price: 14500, area: "Durbanville", notes: "family house with a big garden, pool and braai area, pets welcome" }, propertyType: "house", features: ["garden", "pool", "braai_area", "pet_friendly"] },
  { input: { propertyType: "studio", price: 5200, area: "Sea Point", notes: "studio close to the promenade, inverter for load shedding, washing machine" }, propertyType: "studio", features: ["backup_power", "washing_machine"] },
  { input: { propertyType: "cottage", bedrooms: 1, price: 6000, area: "Constantia", notes: "garden cottage, solar geyser, gated estate with 24 hour security" }, propertyType: "cottage", features: ["solar_geyser", "gated_complex", "24hr_security"] },
  { input: { propertyType: "townhouse", bedrooms: 2, bathrooms: 2, price: 11000, area: "Kenilworth", notes: "townhouse in a gated complex, covered parking for 2 cars, small garden" }, propertyType: "townhouse", features: ["gated_complex", "secure_parking", "garden"] },
  { input: room("room in a shared house, shared kitchen and laundry, close to the taxi rank", { price: 2800, area: "Khayelitsha" }), propertyType: "room", features: ["laundry"] },
  { input: { propertyType: "apartment", bedrooms: 1, price: 7200, area: "Rondebosch", notes: "1 bed flat, walk to UCT, fibre, balcony with mountain views" }, propertyType: "apartment", features: ["wifi", "balcony"] },
  { input: { listingType: "sale", propertyType: "house", bedrooms: 4, bathrooms: 3, price: 2450000, area: "Somerset West", notes: "4 bedroom family home for sale, pool, garden, alarm system and cctv" }, propertyType: "house", features: ["pool", "garden", "cctv"] },
  { input: room("student room, desk and bed, wifi, 5 min walk to campus", { price: 3500, area: "Hatfield" }), propertyType: "room", features: ["wifi"] },
  { input: { notes: "nice spot for a couple, furnished, braai on the patio" }, propertyType: null, features: ["furnished", "braai_area"] },
  { input: { propertyType: "apartment", bedrooms: 3, price: 16000, area: "Sandton", notes: "3 bed apartment, gym and pool in the building, 24hr security, inverter" }, propertyType: "apartment", features: ["pool", "24hr_security", "backup_power"] },
  { input: room("en-suite room, furnished, secure parking, pet friendly", { price: 4500, area: "Observatory" }), propertyType: "room", features: ["furnished", "secure_parking", "pet_friendly"] },
  { input: { propertyType: "studio", price: 4100, area: "Braamfontein", notes: "bachelor flat close to Wits, fibre, laundry in the building" }, propertyType: "studio", features: ["wifi", "laundry"] },
  { input: { propertyType: "house", bedrooms: 2, price: 9000, area: "Mitchells Plain", notes: "2 bed house, garden, carport, prepaid electricity" }, propertyType: "house", features: ["garden"] },
  { input: { propertyType: "cottage", bedrooms: 1, price: 5500, area: "Hout Bay", notes: "cottage on a farm, pets welcome, solar power" }, propertyType: "cottage", features: ["pet_friendly", "backup_power"] },
  { input: { propertyType: "apartment", bedrooms: 2, price: 9800, area: "Umhlanga", notes: "sea facing 2 bed, pool, balcony, covered parking" }, propertyType: "apartment", features: ["pool", "balcony", "secure_parking"] },
  { input: room("room for a working professional, quiet house, fibre, washing machine", { price: 4000, area: "Pinelands" }), propertyType: "room", features: ["wifi", "washing_machine"] },
  { input: { propertyType: "townhouse", bedrooms: 3, price: 13500, area: "Edenvale", notes: "townhouse, braai area, garden, alarm, gated" }, propertyType: "townhouse", features: ["braai_area", "garden", "gated_complex"] },
  { input: { listingType: "sale", propertyType: "apartment", bedrooms: 1, price: 895000, area: "Woodstock", notes: "1 bed for sale, great for investors, balcony, secure parking" }, propertyType: "apartment", features: ["balcony", "secure_parking"] },
  { input: room("room in digs, NSFAS accredited, furnished, wifi", { price: 3200, area: "Stellenbosch" }), propertyType: "room", features: ["furnished", "wifi"] },
  { input: { propertyType: "house", bedrooms: 5, bathrooms: 3, price: 25000, area: "Waterkloof", notes: "big house, pool, garden, cctv, electric fence" }, propertyType: "house", features: ["pool", "garden", "cctv"] },
  { input: { propertyType: "studio", price: 3900, area: "Gqeberha Central", notes: "small studio, furnished, wifi" }, propertyType: "studio", features: ["furnished", "wifi"] },
  { input: { propertyType: "apartment", bedrooms: 2, bathrooms: 1, price: 7600, area: "Bloemfontein", notes: "2 bed flat near the university, secure parking" }, propertyType: "apartment", features: ["secure_parking"] },
  { input: room("garden room with its own entrance, pets allowed", { price: 3700, area: "Claremont" }), propertyType: "room", features: ["garden", "pet_friendly"] },
  { input: { propertyType: "cottage", price: 4800, area: "Muizenberg", notes: "beach cottage, braai, washing machine, close to the train" }, propertyType: "cottage", features: ["braai_area", "washing_machine"] },
  { input: { propertyType: "house", bedrooms: 3, price: 12000, area: "Bellville", notes: "3 bed house, inverter, solar geyser, garden" }, propertyType: "house", features: ["backup_power", "solar_geyser", "garden"] },
  { input: { propertyType: "apartment", bedrooms: 1, price: 6500, area: "Durban North", notes: "1 bed apartment with pool and gym" }, propertyType: "apartment", features: ["pool"] },
  { input: room("room near CPUT, shared bathroom, wifi, laundry", { price: 3300, area: "Bellville" }), propertyType: "room", features: ["wifi", "laundry"] },
  { input: { propertyType: "townhouse", bedrooms: 2, price: 9500, area: "Midrand", notes: "2 bed townhouse in a secure estate with 24hr security and a pool" }, propertyType: "townhouse", features: ["24hr_security", "pool"] },
  { input: { listingType: "sale", propertyType: "cottage", price: 1200000, area: "Franschhoek", notes: "cottage for sale with a garden and solar geyser" }, propertyType: "cottage", features: ["garden", "solar_geyser"] },
  { input: { propertyType: "studio", price: 4600, area: "Green Point", notes: "studio, balcony, fibre, close to the stadium" }, propertyType: "studio", features: ["balcony", "wifi"] },
  { input: room("room in a family home, furnished, call me on 082 123 4567", { price: 3000, area: "Athlone" }), propertyType: "room", features: ["furnished"] },
  { input: { propertyType: "house", bedrooms: 2, price: 8000, area: "Soweto", notes: "2 bed house, garden, braai area, prepaid lights" }, propertyType: "house", features: ["garden", "braai_area"] },
  { input: { propertyType: "apartment", bedrooms: 2, price: 10500, area: "Rosebank", notes: "2 bed apartment, inverter, balcony, secure parking, gym" }, propertyType: "apartment", features: ["backup_power", "balcony", "secure_parking"] },
  { input: room("room for a student, wifi, close to Tuks", { price: 3400, area: "Hatfield" }), propertyType: "room", features: ["wifi"] },
  { input: { propertyType: "cottage", bedrooms: 2, price: 7000, area: "Noordhoek", notes: "2 bed cottage, pet friendly, garden, braai" }, propertyType: "cottage", features: ["pet_friendly", "garden", "braai_area"] },
  { input: { propertyType: "townhouse", bedrooms: 3, price: 15000, area: "Fourways", notes: "townhouse, pool, garden, cctv, covered parking" }, propertyType: "townhouse", features: ["pool", "garden", "cctv", "secure_parking"] },
  { input: { propertyType: "apartment", bedrooms: 1, price: 5900, area: "Hatfield", notes: "1 bed, furnished, fibre, washing machine" }, propertyType: "apartment", features: ["furnished", "wifi", "washing_machine"] },
  { input: { propertyType: "house", bedrooms: 4, price: 18000, area: "Centurion", notes: "4 bed house with pool, garden and alarm system" }, propertyType: "house", features: ["pool", "garden"] },
  { input: room("room, email me at landlord@example.com, furnished", { price: 3600, area: "Rondebosch" }), propertyType: "room", features: ["furnished"] },
  { input: { propertyType: "studio", price: 3500, area: "Pietermaritzburg", notes: "studio near UKZN, wifi, laundry" }, propertyType: "studio", features: ["wifi", "laundry"] },
  { input: { listingType: "sale", propertyType: "townhouse", bedrooms: 2, price: 1650000, area: "Parklands", notes: "2 bed townhouse for sale, gated, garden" }, propertyType: "townhouse", features: ["gated_complex", "garden"] },
  { input: { propertyType: "apartment", bedrooms: 2, price: 8800, area: "Gardens", notes: "2 bed flat, mountain views, balcony, fibre" }, propertyType: "apartment", features: ["balcony", "wifi"] },
  { input: room("room in a quiet house, solar geyser, garden", { price: 3100, area: "Mowbray" }), propertyType: "room", features: ["solar_geyser", "garden"] },
  { input: { propertyType: "house", bedrooms: 3, price: 11500, area: "Kuils River", notes: "3 bed, braai area, garden, carport" }, propertyType: "house", features: ["braai_area", "garden"] },
  { input: { propertyType: "cottage", price: 5000, area: "Kalk Bay", notes: "tiny cottage, furnished, wifi, sea views" }, propertyType: "cottage", features: ["furnished", "wifi"] },
  { input: { propertyType: "apartment", bedrooms: 3, price: 13000, area: "Musgrave", notes: "3 bed apartment, pool, 24hr security, inverter" }, propertyType: "apartment", features: ["pool", "24hr_security", "backup_power"] },
  { input: room("room, washing machine and wifi, walk to the station", { price: 2900, area: "Wynberg" }), propertyType: "room", features: ["washing_machine", "wifi"] },
  { input: { propertyType: "studio", price: 6100, area: "Cape Town CBD", notes: "furnished studio, gym, rooftop pool, fibre" }, propertyType: "studio", features: ["furnished", "pool", "wifi"] },
];
