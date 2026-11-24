/**
 * Customer search: typed words -> chips -> the discovery address.
 *
 * Chips are the assistant's whole picture of a search. They are read from and written to
 * the same URL parameters the map and results already follow, so every assistant search can
 * be shared, reloaded and undone with Back. Common phrases are recognised here by rules;
 * only words the rules cannot place are worth sending to the AI.
 */

export const PROPERTY_TYPE_VALUES = ["apartment", "house", "room", "studio", "cottage", "townhouse"] as const;
export type PropertyTypeValue = (typeof PROPERTY_TYPE_VALUES)[number];

export const QUICK_VALUES = ["furnished", "nsfas-approved", "recently-listed", "favourites", "recently-viewed"] as const;
export type QuickValue = (typeof QUICK_VALUES)[number];

export const FLAG_VALUES = ["availableNow", "liveTours", "instantViewings", "repliesUnder5"] as const;
export type FlagValue = (typeof FLAG_VALUES)[number];

export type SearchChip =
  | { kind: "mode"; value: "buy" }
  | { kind: "minPrice"; value: number }
  | { kind: "maxPrice"; value: number }
  | { kind: "beds"; value: number }
  | { kind: "baths"; value: number }
  | { kind: "type"; value: PropertyTypeValue }
  | { kind: "quick"; value: QuickValue }
  | { kind: "flag"; value: FlagValue }
  | { kind: "near"; value: string }
  | { kind: "area"; value: string };

export type SearchChipKind = SearchChip["kind"];

/** What chips need from an address. Next's read-only search params satisfy it. */
export type ReadonlyParams = Pick<URLSearchParams, "get" | "has" | "toString">;

export const GAP_KEYS = [
  "pets",
  "wifi",
  "parking",
  "move-in",
  "unfurnished",
  "security",
  "distance",
  "near-me",
  "which-place",
  "needs-budget",
  "other",
] as const;
export type GapKey = (typeof GAP_KEYS)[number];

export type SearchGap = { key: GapKey; label: string };

export const GAP_LABELS: Record<GapKey, string> = {
  pets: "Pets: can't search this yet",
  wifi: "Wi-Fi: can't search this yet",
  parking: "Parking: can't search this yet",
  "move-in": "Move-in date: can't search this yet",
  unfurnished: "Unfurnished: can't search this yet",
  security: "Security: can't search this yet",
  distance: "Distance: zoom the map instead",
  "near-me": "Near me: use the Nearest sort",
  "which-place": "Near which campus or place? Add its name",
  "needs-budget": "Cheaper: add a budget first",
  other: "Part of this: can't search it yet",
};

export type ParsedSearch = {
  /** The full chip set after merging the current chips with what was just typed. */
  chips: SearchChip[];
  gaps: SearchGap[];
  /** Words the rules could not place. Only then is the AI worth asking. */
  leftover: string;
  needsAi: boolean;
  notEnglish: boolean;
};

const SINGLE_VALUE_KINDS: ReadonlySet<SearchChipKind> = new Set(["mode", "minPrice", "maxPrice", "beds", "baths", "near", "area"]);

const MAX_PRICE = 100_000_000;
const MAX_ROOMS = 10;
const MAX_PLACE_LENGTH = 60;

export function chipId(chip: SearchChip): string {
  return `${chip.kind}:${chip.value}`;
}

function formatRand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

const TYPE_LABELS: Record<PropertyTypeValue, string> = {
  apartment: "Apartment",
  house: "House",
  room: "Room",
  studio: "Studio",
  cottage: "Cottage",
  townhouse: "Townhouse",
};

const QUICK_LABELS: Record<QuickValue, string> = {
  furnished: "Furnished",
  "nsfas-approved": "NSFAS approved",
  "recently-listed": "Recently listed",
  favourites: "Favourites",
  "recently-viewed": "Recently viewed",
};

const FLAG_LABELS: Record<FlagValue, string> = {
  availableNow: "Available now",
  liveTours: "Live tours",
  instantViewings: "Instant viewings",
  repliesUnder5: "Fast replies",
};

export function chipLabel(chip: SearchChip): string {
  switch (chip.kind) {
    case "mode":
      return "Buy";
    case "minPrice":
      return `≥ ${formatRand(chip.value)}`;
    case "maxPrice":
      return `≤ ${formatRand(chip.value)}`;
    case "beds":
      return `${chip.value}+ bed${chip.value === 1 ? "" : "s"}`;
    case "baths":
      return `${chip.value}+ bath${chip.value === 1 ? "" : "s"}`;
    case "type":
      return TYPE_LABELS[chip.value];
    case "quick":
      return QUICK_LABELS[chip.value];
    case "flag":
      return FLAG_LABELS[chip.value];
    case "near":
      return `Near ${chip.value}`;
    case "area":
      return `In ${chip.value.split(",")[0]?.trim() || chip.value}`;
  }
}

/** Later chips win for single-value kinds; a named place replaces a chosen area and vice versa. */
export function mergeChips(current: readonly SearchChip[], incoming: readonly SearchChip[]): SearchChip[] {
  const incomingKinds = new Set(incoming.filter((chip) => SINGLE_VALUE_KINDS.has(chip.kind)).map((chip) => chip.kind));
  if (incomingKinds.has("near")) incomingKinds.add("area");
  if (incomingKinds.has("area")) incomingKinds.add("near");
  const merged: SearchChip[] = current.filter((chip) => !incomingKinds.has(chip.kind));
  const seen = new Set(merged.map(chipId));
  for (const chip of incoming) {
    const id = chipId(chip);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(chip);
  }
  return normalizeChips(merged);
}

function normalizeChips(chips: SearchChip[]): SearchChip[] {
  const buying = chips.some((chip) => chip.kind === "mode");
  let result = buying ? chips.filter((chip) => !(chip.kind === "quick" && chip.value === "nsfas-approved")) : chips;
  const min = result.find((chip) => chip.kind === "minPrice")?.value;
  const max = result.find((chip) => chip.kind === "maxPrice")?.value;
  if (min !== undefined && max !== undefined && min > max) {
    result = result.filter((chip) => chip.kind !== "minPrice");
  }
  return result;
}

export function removeChip(chips: readonly SearchChip[], id: string): SearchChip[] {
  return chips.filter((chip) => chipId(chip) !== id);
}

// ---------------------------------------------------------------------------
// Address <-> chips
// ---------------------------------------------------------------------------

export const OWNED_PARAMS = ["mode", "minPrice", "maxPrice", "beds", "baths", "type", "quick", "q", ...FLAG_VALUES] as const;

function positiveInt(value: string | null, max: number) {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 && parsed <= max ? parsed : undefined;
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

export function chipsFromParams(params: ReadonlyParams): SearchChip[] {
  const chips: SearchChip[] = [];
  if (params.get("mode") === "buy") chips.push({ kind: "mode", value: "buy" });
  const minPrice = positiveInt(params.get("minPrice"), MAX_PRICE);
  if (minPrice) chips.push({ kind: "minPrice", value: minPrice });
  const maxPrice = positiveInt(params.get("maxPrice"), MAX_PRICE);
  if (maxPrice) chips.push({ kind: "maxPrice", value: maxPrice });
  const beds = positiveInt(params.get("beds"), MAX_ROOMS);
  if (beds) chips.push({ kind: "beds", value: beds });
  const baths = positiveInt(params.get("baths"), MAX_ROOMS);
  if (baths) chips.push({ kind: "baths", value: baths });
  for (const type of (params.get("type") ?? "").split(",")) {
    if (isOneOf(PROPERTY_TYPE_VALUES, type)) chips.push({ kind: "type", value: type });
  }
  for (const quick of (params.get("quick") ?? "").split(",")) {
    if (isOneOf(QUICK_VALUES, quick)) chips.push({ kind: "quick", value: quick });
  }
  for (const flag of FLAG_VALUES) {
    if (params.has(flag)) chips.push({ kind: "flag", value: flag });
  }
  const query = params.get("q")?.trim();
  if (query) chips.push({ kind: "near", value: query.slice(0, MAX_PLACE_LENGTH) });
  const area = params.get("area")?.trim();
  if (area) chips.push({ kind: "area", value: area });
  return normalizeChips(chips);
}

/** Writes chips into a copy of the discovery address. Parameters chips don't own are kept. */
export function applyChipsToParams(base: ReadonlyParams, chips: readonly SearchChip[]): URLSearchParams {
  const params = new URLSearchParams(base.toString());
  for (const key of OWNED_PARAMS) params.delete(key);
  // A new search closes whatever listing was open and any pending place lookup.
  params.delete("listingId");
  params.delete("placeId");
  const area = chips.find((chip) => chip.kind === "area");
  if (!area || area.value !== base.get("area")) {
    params.delete("area");
    params.delete("areaId");
  }

  const types: string[] = [];
  const quick: string[] = [];
  for (const chip of chips) {
    switch (chip.kind) {
      case "mode":
        params.set("mode", "buy");
        break;
      case "minPrice":
      case "maxPrice":
      case "beds":
      case "baths":
        params.set(chip.kind, String(chip.value));
        break;
      case "type":
        types.push(chip.value);
        break;
      case "quick":
        quick.push(chip.value);
        break;
      case "flag":
        params.set(chip.value, "1");
        break;
      case "near":
        params.set("q", chip.value);
        break;
      case "area":
        break;
    }
  }
  if (types.length) params.set("type", types.join(","));
  if (quick.length) params.set("quick", quick.join(","));
  return params;
}

// ---------------------------------------------------------------------------
// Rules: typed words -> chips
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const AMOUNT = String.raw`(r\s?)?(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)\s?(k\b)?`;

const STOPWORDS = new Set([
  "i", "im", "i'm", "me", "my", "we", "our", "us", "a", "an", "the", "and", "or", "with", "for", "to", "of", "in",
  "on", "at", "near", "around", "please", "pls", "thanks", "thank", "you", "want", "wants", "need", "needs",
  "looking", "look", "find", "show", "search", "searching", "get", "give", "some", "any", "place", "places",
  "that", "which", "is", "are", "be", "it", "has", "have", "having", "can", "could", "would", "like", "also",
  "just", "only", "approved", "friendly", "rent", "rental", "rentals", "renting", "lease", "let", "one", "something",
  "properties", "property", "listing", "listings", "accommodation", "somewhere", "where", "there", "here", "am",
  "home", "homes", "student", "students", "new",
]);

const NON_ENGLISH_MARKERS = new Set([
  // Afrikaans
  "ek", "soek", "kamer", "kamers", "naby", "onder", "huis", "woonstel", "vir", "met", "asseblief", "'n", "kampus", "huur",
  // isiZulu
  "ngifuna", "igumbi", "indlu", "eduze", "ngaphansi", "ngicela", "kwasekolishi", "ifulethi",
  // isiXhosa
  "ndifuna", "kufutshane", "ndicela", "phantsi",
  // Sesotho / Setswana
  "ke", "batla", "ntlo", "kamore", "haufi",
]);

const GENERIC_PLACES = new Set(["campus", "varsity", "university", "uni", "college", "town", "the city", "city", "work", "school"]);
const PLACE_STOP = new Set([
  "a", "an", "the", "my", "some", "and", "with", "under", "below", "for", "that", "which", "who", "nsfas", "furnished",
  "please", "budget", "max", "from", "between", "over", "above", "available", "near", "around", "close", "or",
]);

type Draft = { work: string; chips: SearchChip[]; gaps: Map<GapKey, SearchGap>; removeKinds: Set<SearchChipKind> };

/**
 * Replaces each match with a separator so later rules and place names stop at it.
 * A callback returns a string to put text back instead (a match that wasn't what it looked like).
 */
type Match = [string, string, string, string, string, string, string];

function take(draft: Draft, pattern: RegExp, onMatch: (match: Match) => string | void) {
  draft.work = draft.work.replace(pattern, (...args: unknown[]) => {
    // Unmatched optional groups arrive as undefined; they read as "" here.
    const groups = args.slice(0, -2);
    const match = Array.from({ length: 7 }, (_, index) => (typeof groups[index] === "string" ? groups[index] : "")) as Match;
    const replacement = onMatch(match);
    return typeof replacement === "string" ? replacement : " | ";
  });
}

function addGap(draft: Draft, key: GapKey) {
  draft.gaps.set(key, { key, label: GAP_LABELS[key] });
}

function parseAmount(rand: string | undefined, digits: string, thousands: string | undefined): number | undefined {
  const value = Number(digits.replace(/[ ,]/g, "")) * (thousands ? 1000 : 1);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_PRICE) return undefined;
  // Bare small numbers are counts ("2 to 3 bedrooms"), not prices.
  if (!rand && !thousands && value < 500) return undefined;
  return Math.round(value);
}

function countWord(word: string) {
  return NUMBER_WORDS[word.toLowerCase()] ?? Number(word);
}

function current<K extends SearchChipKind>(chips: readonly SearchChip[], kind: K) {
  return chips.find((chip) => chip.kind === kind) as Extract<SearchChip, { kind: K }> | undefined;
}

export function parseSearchText(text: string, currentChips: readonly SearchChip[] = []): ParsedSearch {
  const draft: Draft = { work: ` ${text} `, chips: [], gaps: new Map(), removeKinds: new Set() };
  const words = text.toLowerCase().split(/[^a-z']+/).filter(Boolean);
  const markerCount = words.filter((word) => NON_ENGLISH_MARKERS.has(word)).length;
  if (markerCount >= 2) {
    return { chips: [...currentChips], gaps: [], leftover: "", needsAi: false, notEnglish: true };
  }

  // Refinements of the current search.
  take(draft, /\b(?:cheaper|less expensive|lower (?:price|rent)|more affordable)\b/gi, () => {
    const max = current(currentChips, "maxPrice");
    if (max) draft.chips.push({ kind: "maxPrice", value: Math.max(250, Math.floor((max.value * 0.9) / 250) * 250) });
    else addGap(draft, "needs-budget");
  });
  take(draft, /\b(?:bigger|more space|more bedrooms|(?:an)?other bedroom)\b/gi, () => {
    const beds = current(currentChips, "beds");
    draft.chips.push({ kind: "beds", value: Math.min(MAX_ROOMS, (beds?.value ?? 1) + 1) });
  });
  take(draft, /\b(?:closer|nearer|within\s+\d+\s?km|walking distance)\b/gi, () => addGap(draft, "distance"));

  // Flags first, so "move in now" is never read as a date or a place.
  take(draft, /\b(?:available (?:now|immediately|asap)|move[- ]?in (?:now|immediately|asap)|ready now)\b/gi, () =>
    void draft.chips.push({ kind: "flag", value: "availableNow" }));
  take(draft, /\blive[- ]?tours?\b/gi, () => void draft.chips.push({ kind: "flag", value: "liveTours" }));
  take(draft, /\binstant (?:viewings?|bookings?)\b/gi, () => void draft.chips.push({ kind: "flag", value: "instantViewings" }));
  take(draft, /\b(?:newly listed|recently listed|just listed|new listings?|new (?=rooms?|flats?|apartments?|houses?))\b/gi, () =>
    void draft.chips.push({ kind: "quick", value: "recently-listed" }));

  // Move-in dates have no filter yet.
  take(
    draft,
    new RegExp(
      String.raw`\b(?:(?:to\s+)?move[- ]?in|moving in|start(?:ing)?)(?:\s+(?:on|from|by|in|date))?(?:\s+(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s+)?${MONTH}\b(?:\s+\d{1,2}(?:st|nd|rd|th)?)?|\s+next\s+(?:week|month|year)|\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)?|\b(?:from|in|by)\s+(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)?\s+)?${MONTH}\b`,
      "gi",
    ),
    () => addGap(draft, "move-in"),
  );

  // Prices.
  take(draft, new RegExp(String.raw`\bbetween\s+${AMOUNT}\s+and\s+${AMOUNT}`, "gi"), (m) => {
    const low = parseAmount(m[1], m[2], m[3]);
    const high = parseAmount(m[4], m[5], m[6]);
    if (!low && !high) return m[0];
    if (low) draft.chips.push({ kind: "minPrice", value: low });
    if (high) draft.chips.push({ kind: "maxPrice", value: high });
  });
  take(draft, new RegExp(String.raw`(?<![\w])${AMOUNT}\s*(?:-|–|to)\s*${AMOUNT}`, "gi"), (m) => {
    const low = parseAmount(m[1], m[2], m[3]);
    const high = parseAmount(m[4], m[5], m[6]);
    if (!low || !high) return m[0];
    draft.chips.push({ kind: "minPrice", value: low }, { kind: "maxPrice", value: high });
  });
  take(
    draft,
    new RegExp(String.raw`(?:\b(?:under|below|less than|max(?:imum)?|up to|at most|no more than|cheaper than|budget(?:\s+(?:of|is))?)|<=?|≤)\s*${AMOUNT}`, "gi"),
    (m) => {
      const value = parseAmount(m[1], m[2], m[3]);
      if (!value) return m[0];
      draft.chips.push({ kind: "maxPrice", value });
    },
  );
  take(
    draft,
    new RegExp(String.raw`(?:\b(?:over|above|more than|min(?:imum)?|at least|from)|>=?|≥)\s*${AMOUNT}`, "gi"),
    (m) => {
      const value = parseAmount(m[1], m[2], m[3]);
      if (!value) return m[0];
      draft.chips.push({ kind: "minPrice", value });
    },
  );
  take(draft, /(?<![\w])r\s?(\d{1,3}(?:[ ,]\d{3})+|\d+(?:\.\d+)?)\s?(k\b)?/gi, (m) => {
    const value = parseAmount("r", m[1], m[2]);
    if (!value) return m[0];
    draft.chips.push({ kind: "maxPrice", value });
  });

  // Rooms.
  take(draft, /\b(\d+|one|two|three|four|five|six)[\s-]?(?:bed(?:room)?s?|br)\b/gi, (m) => {
    const value = countWord(m[1]);
    if (value > 0 && value <= MAX_ROOMS) draft.chips.push({ kind: "beds", value });
  });
  take(draft, /\b(\d+|one|two|three|four|five|six)[\s-]?(?:bath(?:room)?s?)\b/gi, (m) => {
    const value = countWord(m[1]);
    if (value > 0 && value <= MAX_ROOMS) draft.chips.push({ kind: "baths", value });
  });

  // Property types. "Bachelor flat" before "flat".
  take(draft, /\b(?:bachelor(?:s|'s)?(?:\s+(?:flats?|pads?|units?))?|studios?)\b/gi, () => void draft.chips.push({ kind: "type", value: "studio" }));
  take(draft, /\btown\s?houses?\b/gi, () => void draft.chips.push({ kind: "type", value: "townhouse" }));
  take(draft, /\b(?:apartments?|flats?)\b/gi, () => void draft.chips.push({ kind: "type", value: "apartment" }));
  take(draft, /\bcottages?\b/gi, () => void draft.chips.push({ kind: "type", value: "cottage" }));
  take(draft, /\bhouses?\b/gi, () => void draft.chips.push({ kind: "type", value: "house" }));
  take(draft, /\brooms?\b/gi, () => void draft.chips.push({ kind: "type", value: "room" }));

  // Market.
  take(draft, /\b(?:for sale|to buy|buying|buy|purchase)\b/gi, () => void draft.chips.push({ kind: "mode", value: "buy" }));
  take(draft, /\b(?:to rent|for rent)\b/gi, () => void draft.removeKinds.add("mode"));

  // Gaps: things Pinpoint cannot filter on yet. "Unfurnished" before "furnished".
  take(draft, /\bunfurnished\b/gi, () => addGap(draft, "unfurnished"));
  take(draft, /\b(?:pets?(?:[- ]friendly)?|dogs?|cats?)\b/gi, () => addGap(draft, "pets"));
  take(draft, /\b(?:wi-?fi|internet|fibre|fiber)\b/gi, () => addGap(draft, "wifi"));
  take(draft, /\b(?:parking|garage|carport)\b/gi, () => addGap(draft, "parking"));
  take(draft, /\b(?:secure|security|safe area)\b/gi, () => addGap(draft, "security"));

  // Quick filters.
  take(draft, /\bfurnished\b/gi, () => void draft.chips.push({ kind: "quick", value: "furnished" }));
  take(draft, /\bnsfas(?:[- ](?:approved|accredited|accepted))?\b/gi, () => void draft.chips.push({ kind: "quick", value: "nsfas-approved" }));

  // Places. "Near me" uses the Nearest sort; a bare "campus" needs a name.
  take(draft, /\b(?:near|close to|next to)\s+me\b|\bnearby\b/gi, () => addGap(draft, "near-me"));
  take(draft, /\b(?:near|close to|next to|around|in|at|by)\s+((?:[a-z0-9'’.-]+\s?){1,4})/gi, (m) => {
    const placeWords: string[] = [];
    for (const word of m[1].trim().split(/\s+/)) {
      if (PLACE_STOP.has(word.toLowerCase()) || word === "|") break;
      placeWords.push(word.replace(/[.,]+$/, ""));
    }
    const place = placeWords.join(" ").trim();
    // Not a place after all ("in a quiet street"): put the words back for the AI.
    if (!place) return ` | ${m[1]} `;
    if (GENERIC_PLACES.has(place.toLowerCase())) {
      addGap(draft, "which-place");
    } else {
      draft.chips.push({ kind: "near", value: place.slice(0, MAX_PLACE_LENGTH) });
    }
    // Words after the place stay in play.
    const rest = m[1].trim().split(/\s+/).slice(placeWords.length).join(" ");
    return ` | ${rest} | `;
  });

  const leftoverWords = draft.work
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  const leftover = leftoverWords.join(" ");
  const base = currentChips.filter((chip) => !draft.removeKinds.has(chip.kind));
  return {
    chips: mergeChips(base, draft.chips),
    gaps: [...draft.gaps.values()],
    leftover,
    needsAi: leftoverWords.length > 0,
    notEnglish: false,
  };
}
