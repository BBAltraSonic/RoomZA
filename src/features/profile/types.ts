import type { MarketplacePersona } from "@/lib/personas";

export type ProfileVisibility =
  | "everyone"
  | "members"
  | "interactions"
  | "no_one";

export type VerificationKind =
  | "email"
  | "phone"
  | "identity"
  | "employment"
  | "income"
  | "student"
  | "nsfas"
  | "business"
  | "landlord"
  | "address"
  | "previous_landlord_reference"
  | "listing_ownership";

export type VerificationStatus =
  | "not_started"
  | "submitted"
  | "in_review"
  | "verified"
  | "rejected"
  | "expired"
  | "revoked";

export type RenterProfileDetails = {
  occupation: string | null;
  employer: string | null;
  monthlyIncome: number | null;
  rentBudgetMin: number | null;
  rentBudgetMax: number | null;
  preferredAreas: string[];
  moveInDate: string | null;
  householdSize: number | null;
  hasPets: boolean | null;
  smokingPreference: string | null;
  studentStatus: boolean | null;
  nsfasEligible: boolean | null;
  governmentAssistance: boolean | null;
};

export type BuyerProfileDetails = {
  buyingBudget: number | null;
  depositSaved: number | null;
  bondStatus: string | null;
  mortgageProvider: string | null;
  buyingTimeline: string | null;
  preferredSuburbs: string[];
  propertyGoals: string[];
  purchasePurpose: string | null;
};

export type LandlordProfileDetails = {
  businessName: string | null;
  companyLogoUrl: string | null;
  portfolioSize: number | null;
  yearsManaging: number | null;
  ownerType: string | null;
  officeLocation: string | null;
  licenseDetails: string | null;
};

export type SellerProfileDetails = {
  businessName: string | null;
  companyLogoUrl: string | null;
  officeLocation: string | null;
  propertySpecialties: string[];
};

export type PersonaDetails = {
  renter: RenterProfileDetails | null;
  buyer: BuyerProfileDetails | null;
  landlord: LandlordProfileDetails | null;
  seller: SellerProfileDetails | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  languages: string[];
  joinedAt: string;
  personas: MarketplacePersona[];
  verificationBadges: VerificationKind[];
  reviewSummary: {
    publishedCount: number;
    average: number | null;
  };
  reviews: Review[];
  responseStatistics: {
    medianFirstResponseSeconds: number | null;
  };
  activeListings: Array<{
    id: string;
    title: string;
    address: string;
    price: number;
    bedrooms: number;
    bathrooms: number;
    listingType: "rent" | "sale";
    imageUrl: string | null;
  }>;
  publicActivity: ProfileActivityEvent[];
  contact: {
    email: string | null;
    phone: string | null;
    canMessage: boolean;
  };
  viewerState: {
    isOwner: boolean;
    isBlocked: boolean;
    isMuted: boolean;
  };
  searchIndexed: boolean;
};

export type PrivateProfile = {
  id: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  languages: string[];
  visibility: {
    profile: ProfileVisibility;
    messaging: ProfileVisibility;
    phone: ProfileVisibility;
    email: ProfileVisibility;
    reviews: boolean;
    activity: boolean;
    searchIndexed: boolean;
  };
  personas: Array<{
    persona: MarketplacePersona;
    isPrimary: boolean;
    isActive: boolean;
    completion: number;
  }>;
  personaDetails: PersonaDetails;
};

export type ProfileActivityEvent = {
  id: string;
  category: string;
  eventKey: string;
  title: string;
  summary: string | null;
  visibility: "private" | "public";
  occurredAt: string;
};

export type ProfileDocumentVersion = {
  id: string;
  version: number;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
};

export type ProfileDocument = {
  id: string;
  documentType: string;
  displayName: string;
  expiresAt: string | null;
  currentVersion: ProfileDocumentVersion | null;
  createdAt: string;
};

export type Review = {
  id: string;
  reviewerId: string;
  subjectId: string;
  overall: number;
  body: string;
  status: "draft" | "submitted" | "published" | "hidden" | "removed";
  verifiedInteraction: true;
  submittedAt: string | null;
  publishedAt: string | null;
  helpfulCount: number;
};

export type NotificationPreference = {
  category:
    | "messages"
    | "applications"
    | "viewings"
    | "offers"
    | "saved_searches"
    | "marketing"
    | "security"
    | "account_updates"
    | "reviews"
    | "verification"
    | "blog_updates";
  channel: "in_app" | "email";
  frequency: "instant" | "hourly" | "daily" | "weekly" | "never";
  enabled: boolean;
  mandatory: boolean;
};

export function isPublishedReviewStatus(status: string): boolean {
  return status === "published";
}

export function isVerifiedStatus(status: string): boolean {
  return status === "verified";
}

export function isPendingStatus(status: string): boolean {
  return status === "submitted" || status === "in_review";
}

export function isRejectedStatus(status: string): boolean {
  return status === "rejected" || status === "revoked";
}
