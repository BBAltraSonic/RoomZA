import type {
  ProfileVisibility,
  PublicProfile,
  PublicProfileSpecialItem,
  VerificationKind,
} from "@/features/profile/types";

export const verificationLabels: Record<VerificationKind, string> = {
  identity: "Identity",
  phone: "Phone number",
  email: "Email address",
  address: "Address",
  employment: "Employment",
  income: "Income",
  student: "Student status",
  nsfas: "NSFAS funding",
  business: "Business",
  landlord: "Landlord",
  previous_landlord_reference: "Landlord reference",
  listing_ownership: "Listing ownership",
};

/** Most reassuring checks first, so the strongest evidence leads. */
const verificationOrder: VerificationKind[] = [
  "identity",
  "business",
  "landlord",
  "listing_ownership",
  "address",
  "previous_landlord_reference",
  "employment",
  "income",
  "student",
  "nsfas",
  "phone",
  "email",
];

export function orderedVerifications(kinds: VerificationKind[]) {
  const unique = [...new Set(kinds)];
  return unique.sort(
    (a, b) => verificationOrder.indexOf(a) - verificationOrder.indexOf(b),
  );
}

/** Who the owner's audience setting lets in, phrased for the owner. */
export const audienceLabels: Record<ProfileVisibility, string> = {
  everyone: "Everyone, including people who aren't signed in",
  members: "Signed-in Pinpoint members",
  interactions: "Only people you've messaged or applied with",
  no_one: "Only you. Your profile is hidden",
};

export function initialsFor(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "P";
}

export function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

/** Compact time on Pinpoint for the stat strip: value plus its unit label. */
export function tenure(joinedAt: string, now = Date.now()) {
  const months = Math.max(
    0,
    Math.floor((now - Date.parse(joinedAt)) / (1000 * 60 * 60 * 24 * 30.44)),
  );
  if (months < 1) return { value: "New", label: "On Pinpoint" };
  if (months < 12)
    return { value: String(months), label: months === 1 ? "Month on Pinpoint" : "Months on Pinpoint" };
  const years = Math.floor(months / 12);
  return { value: String(years), label: years === 1 ? "Year on Pinpoint" : "Years on Pinpoint" };
}

export function responseTimeLabel(seconds: number | null) {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `within about ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `within about ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `within about ${days} ${days === 1 ? "day" : "days"}`;
}

export function formatRand(amount: number) {
  return `R${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(amount)}`;
}

export const specialKindLabels: Record<PublicProfileSpecialItem["kind"], string> = {
  shopping: "Shopping special",
  tourism: "Place",
  event: "Event",
};

export function specialHref(item: Pick<PublicProfileSpecialItem, "id" | "kind">) {
  return item.kind === "shopping" ? `/offers/${item.id}` : `/specials/${item.id}`;
}

export function propertyHref(id: string) {
  return `/?listingId=${encodeURIComponent(id)}`;
}

/** A cover photo makes the identity card feel lived-in. Newest work first. */
export function coverImageFor(profile: Pick<PublicProfile, "activeListings" | "catalogue">) {
  return (
    profile.activeListings.find((listing) => listing.imageUrl)?.imageUrl ??
    profile.catalogue.specials.find((item) => item.imageUrl)?.imageUrl ??
    null
  );
}

export function listingCount(profile: Pick<PublicProfile, "activeListings" | "catalogue">) {
  return (
    profile.activeListings.length +
    profile.catalogue.specials.length
  );
}

/** What the owner could still add. Each item links to where it is fixed. */
export function ownerChecklist(profile: Pick<PublicProfile, "avatarUrl" | "bio" | "languages" | "verificationBadges">) {
  return [
    { key: "photo", label: "Add a photo", done: Boolean(profile.avatarUrl), href: "/profile/edit" },
    { key: "bio", label: "Write a short bio", done: Boolean(profile.bio?.trim()), href: "/profile/edit" },
    { key: "languages", label: "Add languages you speak", done: profile.languages.length > 0, href: "/profile/edit" },
    {
      key: "identity",
      label: "Verify your identity",
      done: profile.verificationBadges.includes("identity"),
      href: "/profile/verification",
    },
  ];
}
