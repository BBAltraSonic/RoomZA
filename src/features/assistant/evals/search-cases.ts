/**
 * Test set for AI job 1: customer search text -> filters (proposal, "Choosing models").
 *
 * Made-up requests only. `chips` are the expected chip IDs (`kind:value`) and `gaps` the
 * expected grey chips. `rules: true` marks requests the rules must understand on their own,
 * with no AI; the rest are what the AI is for. Run every candidate model against the whole
 * set with `npm run assistant:eval -- --job search`, and again whenever a pinned model
 * leaves the free list.
 */

export type SearchCase = {
  text: string;
  /** Chip IDs already on the search, for refinements ("cheaper"). */
  current?: string[];
  chips: string[];
  gaps?: string[];
  notEnglish?: boolean;
  rules?: boolean;
};

export const SEARCH_CASES: SearchCase[] = [
  // Rules handle these on their own.
  { text: "Furnished room under R4,000 near UWC, NSFAS approved", chips: ["type:room", "maxPrice:4000", "near:UWC", "quick:furnished", "quick:nsfas-approved"], rules: true },
  { text: "2 bedroom apartment in Rondebosch", chips: ["beds:2", "type:apartment", "near:Rondebosch"], rules: true },
  { text: "bachelor flat under 5k", chips: ["type:studio", "maxPrice:5000"], rules: true },
  { text: "room between R3000 and R4500", chips: ["type:room", "minPrice:3000", "maxPrice:4500"], rules: true },
  { text: "3 bed house for sale in Bellville under R1,500,000", chips: ["beds:3", "type:house", "mode:buy", "near:Bellville", "maxPrice:1500000"], rules: true },
  { text: "townhouse to rent with 2 bathrooms", chips: ["type:townhouse", "baths:2"], rules: true },
  { text: "cottage near Stellenbosch", chips: ["type:cottage", "near:Stellenbosch"], rules: true },
  { text: "NSFAS accredited rooms", chips: ["quick:nsfas-approved", "type:room"], rules: true },
  { text: "studio R3500", chips: ["type:studio", "maxPrice:3500"], rules: true },
  { text: "available now furnished apartment", chips: ["flag:availableNow", "quick:furnished", "type:apartment"], rules: true },
  { text: "room with live tours", chips: ["type:room", "flag:liveTours"], rules: true },
  { text: "flat with instant viewings in Observatory", chips: ["type:apartment", "flag:instantViewings", "near:Observatory"], rules: true },
  { text: "newly listed rooms near Wits", chips: ["quick:recently-listed", "type:room", "near:Wits"], rules: true },
  { text: "room with parking under R4000", chips: ["type:room", "maxPrice:4000"], gaps: ["parking"], rules: true },
  { text: "pet friendly house", chips: ["type:house"], gaps: ["pets"], rules: true },
  { text: "apartment with wifi", chips: ["type:apartment"], gaps: ["wifi"], rules: true },
  { text: "room near campus", chips: ["type:room"], gaps: ["which-place"], rules: true },
  { text: "room near me", chips: ["type:room"], gaps: ["near-me"], rules: true },
  { text: "unfurnished flat", chips: ["type:apartment"], gaps: ["unfurnished"], rules: true },
  { text: "move in on 1 February", chips: [], gaps: ["move-in"], rules: true },
  { text: "secure 2 bed apartment", chips: ["beds:2", "type:apartment"], gaps: ["security"], rules: true },
  { text: "cheaper", current: ["type:room", "maxPrice:4000"], chips: ["type:room", "maxPrice:3500"], rules: true },
  { text: "bigger", current: ["type:apartment", "beds:1"], chips: ["type:apartment", "beds:2"], rules: true },
  { text: "cheaper", current: ["type:room"], chips: ["type:room"], gaps: ["needs-budget"], rules: true },
  { text: "closer", current: ["type:room", "near:UCT"], chips: ["type:room", "near:UCT"], gaps: ["distance"], rules: true },
  { text: "to rent", current: ["mode:buy", "type:house"], chips: ["type:house"], rules: true },
  { text: "at least R6000 apartment in Sea Point", chips: ["minPrice:6000", "type:apartment", "near:Sea Point"], rules: true },
  { text: "Ek soek 'n kamer naby die kampus", chips: [], notEnglish: true, rules: true },
  { text: "Ngifuna igumbi eduze nekolishi", chips: [], notEnglish: true, rules: true },
  { text: "2-bed flat R7k-R9k in Claremont", chips: ["beds:2", "type:apartment", "minPrice:7000", "maxPrice:9000", "near:Claremont"], rules: true },
  { text: "2-bed flat R7k-R9k Claremont", chips: ["beds:2", "type:apartment", "minPrice:7000", "maxPrice:9000", "near:Claremont"] },

  // These need the AI: wording the rules don't place.
  { text: "somewhere cheap to stay while I study at UJ, max four grand", chips: ["maxPrice:4000", "near:UJ"] },
  { text: "a place for me and my partner, one bedroom, nothing over 8 thousand", chips: ["beds:1", "maxPrice:8000"] },
  { text: "digs near Tuks that take bursary students", chips: ["near:Tuks", "quick:nsfas-approved"] },
  { text: "family home with a big garden, four bedrooms, buying", chips: ["beds:4", "type:house", "mode:buy"], gaps: ["other"] },
  { text: "something cosy and fully kitted out for a student", chips: ["quick:furnished"] },
  { text: "I need a granny flat", chips: ["type:cottage"] },
  { text: "backpacker style shared room, low budget", chips: ["type:room"], gaps: ["needs-budget"] },
  { text: "spacious duplex, 3 beds 2 baths", chips: ["beds:3", "baths:2", "type:townhouse"] },
  { text: "apartment I can move into straight away", chips: ["type:apartment", "flag:availableNow"] },
  { text: "flat where the landlord replies fast", chips: ["type:apartment"] },
  { text: "a room that's already got a bed and desk", chips: ["type:room", "quick:furnished"] },
  { text: "around two and a half thousand a month", chips: ["maxPrice:2500"] },
  { text: "place in Hatfield, under R3.5k, for one person", chips: ["near:Hatfield", "maxPrice:3500"] },
  { text: "quiet garden cottage near the university of the free state", chips: ["type:cottage", "near:university of the free state"] },
  { text: "invest in a 2 bed unit in Durbanville", chips: ["mode:buy", "beds:2", "type:apartment", "near:Durbanville"] },
  { text: "room with its own bathroom", chips: ["type:room", "baths:1"] },
  { text: "anything with a pool and gym", chips: [], gaps: ["other"] },
  { text: "close to the train station in Rosebank", chips: ["near:Rosebank"], gaps: ["distance"] },
  { text: "can I keep my cat", chips: [], gaps: ["pets"] },
  { text: "fibre included, studio, Cape Town CBD", chips: ["type:studio", "near:Cape Town CBD"], gaps: ["wifi"] },
  { text: "Ndifuna indlu kufutshane nedolophu", chips: [], notEnglish: true },
  { text: "student accommodation near CPUT Bellville campus that NSFAS pays for", chips: ["near:CPUT Bellville", "quick:nsfas-approved"] },
];
