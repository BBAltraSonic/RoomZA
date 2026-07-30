import { unstable_cache } from "next/cache";

import { calculatePersonaCompletion } from "@/features/profile/completion";
import type {
  BuyerProfileDetails,
  LandlordProfileDetails,
  PrivateProfile,
  ProfileActivityEvent,
  ProfileDocument,
  PublicProfile,
  RenterProfileDetails,
  SellerProfileDetails,
  VerificationKind,
} from "@/features/profile/types";
import { getSessionProfile, requireUser } from "@/lib/auth";
import type { MarketplacePersona } from "@/lib/personas";
import { createUntypedClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type ActivityRow = Pick<
  Database["public"]["Tables"]["profile_activity_events"]["Row"],
  | "id"
  | "category"
  | "event_key"
  | "title"
  | "summary"
  | "visibility"
  | "occurred_at"
>;
type RenterRow = Database["public"]["Tables"]["renter_profile_details"]["Row"];
type BuyerRow = Database["public"]["Tables"]["buyer_profile_details"]["Row"];
type LandlordRow =
  Database["public"]["Tables"]["landlord_profile_details"]["Row"];
type SellerRow = Database["public"]["Tables"]["seller_profile_details"]["Row"];
type PersonaRow = Database["public"]["Tables"]["profile_personas"]["Row"];
export type ProfileReviewRow =
  Database["public"]["Tables"]["profile_reviews"]["Row"];
export type ProfileReviewEntitlementRow =
  Database["public"]["Tables"]["profile_review_entitlements"]["Row"];
export type ProfileVerificationCheck = Pick<
  Database["public"]["Tables"]["verification_checks"]["Row"],
  | "id"
  | "check_key"
  | "status"
  | "submitted_at"
  | "reviewed_at"
  | "verified_at"
  | "expires_at"
  | "rejected_reason"
>;
type PublicListingRow = {
  id: string;
  title: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  listing_type: "rent" | "sale";
  listing_images: Array<{ public_url: string; sort_order: number }>;
};
type DocumentVersionRow = {
  id: string;
  version: number;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  created_at: string;
};
type DocumentRow = {
  id: string;
  document_type: string;
  display_name: string;
  expires_at: string | null;
  created_at: string;
  current_version: DocumentVersionRow | DocumentVersionRow[] | null;
};

function mapActivity(row: ActivityRow): ProfileActivityEvent {
  return {
    id: row.id,
    category: row.category,
    eventKey: row.event_key,
    title: row.title,
    summary: row.summary,
    visibility: row.visibility,
    occurredAt: row.occurred_at,
  };
}

function mapRenter(row: RenterRow | null): RenterProfileDetails | null {
  return row
    ? {
        occupation: row.occupation,
        employer: row.employer,
        monthlyIncome:
          row.monthly_income === null ? null : Number(row.monthly_income),
        rentBudgetMin: row.rent_budget_min,
        rentBudgetMax: row.rent_budget_max,
        preferredAreas: row.preferred_areas ?? [],
        moveInDate: row.move_in_date,
        householdSize: row.household_size,
        hasPets: row.has_pets,
        smokingPreference: row.smoking_preference,
        studentStatus: row.student_status,
        nsfasEligible: row.nsfas_eligible,
        governmentAssistance: row.government_assistance,
      }
    : null;
}

function mapBuyer(row: BuyerRow | null): BuyerProfileDetails | null {
  return row
    ? {
        buyingBudget: row.buying_budget,
        depositSaved: row.deposit_saved,
        bondStatus: row.bond_status,
        mortgageProvider: row.mortgage_provider,
        buyingTimeline: row.buying_timeline,
        preferredSuburbs: row.preferred_suburbs ?? [],
        propertyGoals: row.property_goals ?? [],
        purchasePurpose: row.purchase_purpose,
      }
    : null;
}

function mapLandlord(row: LandlordRow | null): LandlordProfileDetails | null {
  return row
    ? {
        businessName: row.business_name,
        companyLogoUrl: row.company_logo_url,
        portfolioSize: row.portfolio_size,
        yearsManaging: row.years_managing,
        ownerType: row.owner_type,
        officeLocation: row.office_location,
        licenseDetails: row.license_details,
      }
    : null;
}

function mapSeller(row: SellerRow | null): SellerProfileDetails | null {
  return row
    ? {
        businessName: row.business_name,
        companyLogoUrl: row.company_logo_url,
        officeLocation: row.office_location,
        propertySpecialties: row.property_specialties ?? [],
      }
    : null;
}

const getCachedPublicProfileBase = unstable_cache(
  async (username: string) => {
    const admin = createUntypedClient();
    const { data: publicProfile } = await admin
      .from("public_profiles")
      .select("*")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (!publicProfile) return null;

    const profileId = publicProfile.profile_id;
    const [
      { data: personas },
      { data: checks },
      { data: reviews },
      { data: listings },
      { data: activity },
      { data: responseMetric },
    ] = await Promise.all([
      admin
        .from("profile_personas")
        .select("persona")
        .eq("profile_id", profileId),
      admin
        .from("verification_checks")
        .select("check_key")
        .eq("profile_id", profileId)
        .eq("status", "verified"),
      admin
        .from("profile_reviews")
        .select(
          "id,reviewer_id,subject_id,overall,body,status,submitted_at,published_at",
        )
        .eq("subject_id", profileId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(20),
      admin
        .from("listings")
        .select(
          "id,title,address,price,bedrooms,bathrooms,listing_type,listing_images(public_url,sort_order)",
        )
        .eq("landlord_id", profileId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(24),
      admin
        .from("profile_activity_events")
        .select("id,category,event_key,title,summary,visibility,occurred_at")
        .eq("profile_id", profileId)
        .eq("visibility", "public")
        .order("occurred_at", { ascending: false })
        .limit(20),
      admin
        .from("landlord_trust_metrics")
        .select("median_first_response_seconds")
        .eq("landlord_id", profileId)
        .maybeSingle(),
    ]);

    return {
      publicProfile,
      personas: (personas ?? []).map(
        (row: Pick<PersonaRow, "persona">) => row.persona as MarketplacePersona,
      ),
      checks: (checks ?? []).map(
        (row: Pick<ProfileVerificationCheck, "check_key">) =>
          row.check_key as VerificationKind,
      ),
      reviews: reviews ?? [],
      listings: listings ?? [],
      activity: activity ?? [],
      responseMetric,
    };
  },
  ["public-profile-v1"],
  { revalidate: 300, tags: ["public-profiles"] },
);

async function hasInteraction(viewerId: string, subjectId: string) {
  const admin = createUntypedClient();
  const { count } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .or(
      `and(renter_id.eq.${viewerId},landlord_id.eq.${subjectId}),and(renter_id.eq.${subjectId},landlord_id.eq.${viewerId})`,
    );
  return Boolean(count);
}

function audienceAllows(
  audience: string,
  context: { isOwner: boolean; isMember: boolean; hasInteraction: boolean },
) {
  if (context.isOwner) return true;
  if (audience === "everyone") return true;
  if (audience === "members") return context.isMember;
  if (audience === "interactions") return context.hasInteraction;
  return false;
}

export async function getPublicProfileByUsername(
  username: string,
): Promise<PublicProfile | null> {
  const base = await getCachedPublicProfileBase(username);
  if (!base) return null;

  const { user } = await getSessionProfile();
  const viewerId = user?.id ?? null;
  const subjectId = base.publicProfile.profile_id;
  const isOwner = viewerId === subjectId;
  const admin = createUntypedClient();

  const [{ data: block }, { data: mute }, interacted] =
    viewerId && !isOwner
      ? await Promise.all([
          admin
            .from("profile_blocks")
            .select("blocker_id")
            .or(
              `and(blocker_id.eq.${viewerId},blocked_id.eq.${subjectId}),and(blocker_id.eq.${subjectId},blocked_id.eq.${viewerId})`,
            )
            .limit(1)
            .maybeSingle(),
          admin
            .from("profile_mutes")
            .select("muter_id")
            .eq("muter_id", viewerId)
            .eq("muted_id", subjectId)
            .maybeSingle(),
          hasInteraction(viewerId, subjectId),
        ])
      : [{ data: null }, { data: null }, false];

  const isBlocked = Boolean(block);
  if (isBlocked && !isOwner) return null;

  const context = {
    isOwner,
    isMember: Boolean(viewerId),
    hasInteraction: interacted,
  };
  if (!audienceAllows(base.publicProfile.profile_audience, context))
    return null;

  const canSeePhone = audienceAllows(
    base.publicProfile.phone_audience,
    context,
  );
  const canSeeEmail = audienceAllows(
    base.publicProfile.email_audience,
    context,
  );
  const canMessage =
    !isOwner &&
    !isBlocked &&
    audienceAllows(base.publicProfile.message_audience, context);
  const { data: privateContact } =
    canSeePhone || canSeeEmail
      ? await admin
          .from("profiles")
          .select("email,phone")
          .eq("id", subjectId)
          .maybeSingle()
      : { data: null };

  const reviewCount = base.reviews.length;
  const publishedReviews = base.reviews as unknown as ProfileReviewRow[];
  const average =
    reviewCount >= 3
      ? Number(
          (
            publishedReviews.reduce((sum, review) => sum + review.overall, 0) /
            reviewCount
          ).toFixed(1),
        )
      : null;

  return {
    id: subjectId,
    username: base.publicProfile.username,
    displayName: base.publicProfile.display_name,
    avatarUrl: base.publicProfile.avatar_url,
    bio: base.publicProfile.bio,
    languages: base.publicProfile.languages ?? [],
    joinedAt: base.publicProfile.joined_at,
    personas: base.personas,
    verificationBadges: base.checks,
    reviewSummary: { publishedCount: reviewCount, average },
    reviews: base.publicProfile.reviews_visible
      ? publishedReviews.map((review) => ({
          id: review.id,
          reviewerId: review.reviewer_id,
          subjectId: review.subject_id,
          overall: review.overall,
          body: review.body,
          status: review.status,
          verifiedInteraction: true as const,
          submittedAt: review.submitted_at,
          publishedAt: review.published_at,
          helpfulCount: 0,
        }))
      : [],
    responseStatistics: {
      medianFirstResponseSeconds:
        base.responseMetric?.median_first_response_seconds ?? null,
    },
    activeListings: (base.listings as PublicListingRow[]).map((listing) => ({
      id: listing.id,
      title: listing.title,
      address: listing.address,
      price: listing.price,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      listingType: listing.listing_type,
      imageUrl:
        [...(listing.listing_images ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        )[0]?.public_url ?? null,
    })),
    publicActivity:
      base.publicProfile.activity_visible && !isBlocked
        ? (base.activity as unknown as ActivityRow[]).map(mapActivity)
        : [],
    contact: {
      email: canSeeEmail ? (privateContact?.email ?? null) : null,
      phone: canSeePhone ? (privateContact?.phone ?? null) : null,
      canMessage,
    },
    viewerState: {
      isOwner,
      isBlocked,
      isMuted: Boolean(mute),
    },
    searchIndexed: Boolean(base.publicProfile.search_indexed),
  };
}

export async function getPrivateProfileData(): Promise<PrivateProfile> {
  const { user, profile } = await requireUser({ redirectTo: "/profile" });
  const admin = createUntypedClient();
  const [
    { data: publicProfile },
    { data: personas },
    { data: renter },
    { data: buyer },
    { data: landlord },
    { data: seller },
  ] = await Promise.all([
    admin
      .from("public_profiles")
      .select("*")
      .eq("profile_id", user.id)
      .single(),
    admin
      .from("profile_personas")
      .select("persona,is_primary,is_active")
      .eq("profile_id", user.id)
      .order("created_at"),
    admin
      .from("renter_profile_details")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
    admin
      .from("buyer_profile_details")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
    admin
      .from("landlord_profile_details")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
    admin
      .from("seller_profile_details")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  if (!publicProfile || !profile)
    throw new Error("Profile core is not initialized.");

  const personaDetails = {
    renter: mapRenter(renter),
    buyer: mapBuyer(buyer),
    landlord: mapLandlord(landlord),
    seller: mapSeller(seller),
  };
  const shared = {
    displayName: publicProfile.display_name,
    avatarUrl: publicProfile.avatar_url,
    bio: publicProfile.bio,
    languages: publicProfile.languages,
  };

  return {
    id: user.id,
    email: profile.email,
    phone: profile.phone,
    phoneVerified: profile.phone_verified,
    emailVerified: Boolean(profile.email_verified_at),
    username: publicProfile.username,
    displayName: publicProfile.display_name,
    avatarUrl: publicProfile.avatar_url,
    bio: publicProfile.bio,
    languages: publicProfile.languages ?? [],
    visibility: {
      profile: publicProfile.profile_audience,
      messaging: publicProfile.message_audience,
      phone: publicProfile.phone_audience,
      email: publicProfile.email_audience,
      reviews: publicProfile.reviews_visible,
      activity: publicProfile.activity_visible,
      searchIndexed: publicProfile.search_indexed,
    },
    personas: ((personas ?? []) as PersonaRow[]).map((row) => ({
      persona: row.persona,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      completion: calculatePersonaCompletion(
        row.persona,
        shared,
        personaDetails[row.persona as MarketplacePersona] as unknown as Record<
          string,
          unknown
        > | null,
      ),
    })),
    personaDetails,
  };
}

export async function getProfileDashboardData() {
  const profile = await getPrivateProfileData();
  const admin = createUntypedClient();
  const [
    { count: applicationCount },
    { count: purchaseCount },
    { count: viewingCount },
    { count: conversationCount },
    { count: notificationCount },
    { count: savedCount },
    { data: activity },
    { data: verification },
  ] = await Promise.all([
    admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("renter_id", profile.id),
    admin
      .from("buyer_interests")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", profile.id),
    admin
      .from("viewings")
      .select(
        "id,applications!left(renter_id),buyer_interests!left(buyer_id)",
        { count: "exact" },
      )
      .or(
        `applications.renter_id.eq.${profile.id},buyer_interests.buyer_id.eq.${profile.id}`,
      )
      .limit(1),
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .or(`renter_id.eq.${profile.id},landlord_id.eq.${profile.id}`),
    admin
      .from("notification_events")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", profile.id)
      .is("read_at", null),
    admin
      .from("user_favorites")
      .select("listing_id", { count: "exact", head: true })
      .eq("user_id", profile.id),
    admin
      .from("profile_activity_events")
      .select("id,category,event_key,title,summary,visibility,occurred_at")
      .eq("profile_id", profile.id)
      .order("occurred_at", { ascending: false })
      .limit(8),
    admin
      .from("verification_checks")
      .select(
        "id,check_key,status,submitted_at,reviewed_at,verified_at,expires_at,rejected_reason",
      )
      .eq("profile_id", profile.id)
      .order("created_at"),
  ]);

  return {
    profile,
    counts: {
      applications: applicationCount ?? 0,
      purchases: purchaseCount ?? 0,
      viewings: viewingCount ?? 0,
      messages: conversationCount ?? 0,
      notifications: notificationCount ?? 0,
      saved: savedCount ?? 0,
    },
    activity: ((activity ?? []) as unknown as ActivityRow[]).map(mapActivity),
    verification: (verification ?? []) as ProfileVerificationCheck[],
  };
}

export async function getProfileActivityPage(
  category?: string,
  before?: string,
) {
  const { user } = await requireUser({ redirectTo: "/profile/activity" });
  const admin = createUntypedClient();
  let query = admin
    .from("profile_activity_events")
    .select("id,category,event_key,title,summary,visibility,occurred_at")
    .eq("profile_id", user.id)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);
  if (category && category !== "all") query = query.eq("category", category);
  if (before) query = query.lt("occurred_at", before);
  const { data } = await query;
  return ((data ?? []) as unknown as ActivityRow[]).map(mapActivity);
}

export async function getProfileDocuments(): Promise<ProfileDocument[]> {
  const { user } = await requireUser({ redirectTo: "/profile/documents" });
  const admin = createUntypedClient();
  const { data } = await admin
    .from("profile_documents")
    .select(
      "id,document_type,display_name,expires_at,created_at,current_version:profile_document_versions!profile_documents_current_version_fkey(id,version,mime_type,size_bytes,checksum_sha256,created_at)",
    )
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as DocumentRow[]).map((row) => {
    const currentVersion = Array.isArray(row.current_version)
      ? (row.current_version[0] ?? null)
      : row.current_version;
    return {
      id: row.id,
      documentType: row.document_type,
      displayName: row.display_name,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            version: currentVersion.version,
            mimeType: currentVersion.mime_type,
            sizeBytes: currentVersion.size_bytes,
            checksumSha256: currentVersion.checksum_sha256,
            createdAt: currentVersion.created_at,
          }
        : null,
    };
  });
}

export async function getProfileReviewsData() {
  const { user } = await requireUser({ redirectTo: "/profile/reviews" });
  const admin = createUntypedClient();
  const [{ data: received }, { data: written }, { data: entitlements }] =
    await Promise.all([
      admin
        .from("profile_reviews")
        .select("*")
        .eq("subject_id", user.id)
        .order("created_at", { ascending: false }),
      admin
        .from("profile_reviews")
        .select("*")
        .eq("reviewer_id", user.id)
        .order("created_at", { ascending: false }),
      admin
        .from("profile_review_entitlements")
        .select("*")
        .eq("reviewer_id", user.id)
        .gt("closes_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);
  return {
    received: (received ?? []) as ProfileReviewRow[],
    written: (written ?? []) as ProfileReviewRow[],
    entitlements: (entitlements ?? []) as ProfileReviewEntitlementRow[],
  };
}

export async function getProfileVerificationData() {
  const { user, profile } = await requireUser({
    redirectTo: "/profile/verification",
  });
  const admin = createUntypedClient();
  const { data } = await admin
    .from("verification_checks")
    .select(
      "id,check_key,status,submitted_at,reviewed_at,verified_at,expires_at,rejected_reason",
    )
    .eq("profile_id", user.id)
    .order("created_at");
  return {
    emailVerified: Boolean(profile?.email_verified_at),
    phoneVerified: Boolean(profile?.phone_verified),
    checks: (data ?? []) as ProfileVerificationCheck[],
  };
}

export async function getPublicUsernameByProfileId(profileId: string) {
  const admin = createUntypedClient();
  const { data } = await admin
    .from("public_profiles")
    .select("username")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data?.username ?? null;
}

export async function getProfileActivityEventsApi(
  userId: string,
  category?: string,
  before?: string,
  limit = 30,
) {
  const admin = createUntypedClient();
  let query = admin
    .from("profile_activity_events")
    .select("id,category,event_key,title,summary,visibility,occurred_at")
    .eq("profile_id", userId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (category) query = query.eq("category", category);
  if (before) query = query.lt("occurred_at", before);
  return query;
}

export async function getProfileNotificationsEventsApi(
  userId: string,
  before?: string,
  limit = 30,
) {
  const admin = createUntypedClient();
  let query = admin
    .from("notification_events")
    .select("id,type,payload,read_at,created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (before) query = query.lt("created_at", before);
  return query;
}

export async function getProfileReviewsEventsApi(
  userId: string,
  direction: "received" | "written",
  before?: string,
  limit = 20,
) {
  const ownerColumn = direction === "received" ? "subject_id" : "reviewer_id";
  const admin = createUntypedClient();
  let query = admin
    .from("profile_reviews")
    .select("id,entitlement_id,reviewer_id,subject_id,overall,body,status,submitted_at,published_at,created_at")
    .eq(ownerColumn, userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (before) query = query.lt("created_at", before);
  return query;
}

type DocumentShareAccessRow = {
  grantee_id: string | null;
  application: Array<{
    listing: Array<{ landlord_id: string }>;
  }>;
};

export async function createProfileDocumentSignedUrl(
  userId: string,
  versionId: string,
  requestId: string,
) {
  const admin = createUntypedClient();
  const { data: version } = await admin
    .from("profile_document_versions")
    .select("id,owner_id,bucket,path,document_id")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return { error: "not_found" as const };

  let authorized = version.owner_id === userId;
  if (!authorized) {
    const now = new Date().toISOString();
    const { data: shares } = await admin
      .from("profile_document_shares")
      .select("id,grantee_id,application:applications(listing:listings(landlord_id))")
      .eq("version_id", version.id)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${now}`);
    authorized = ((shares ?? []) as unknown as DocumentShareAccessRow[]).some(
      (share) =>
        share.grantee_id === userId ||
        share.application.some((application) =>
          application.listing.some((listing) => listing.landlord_id === userId),
        ),
    );
  }

  if (!authorized) {
    const [{ data: membership }, { data: grant }] = await Promise.all([
      admin
        .from("admin_memberships")
        .select("user_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      admin
        .from("sensitive_access_grants")
        .select("id")
        .eq("admin_id", userId)
        .eq("resource_type", "document")
        .in("resource_id", [version.document_id, version.id])
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle(),
    ]);
    authorized = Boolean(membership && grant);
    if (authorized) {
      await admin.from("admin_audit_events").insert({
        actor_id: userId,
        action_key: "profile_document.signed_url",
        target_type: "profile_document_version",
        target_id: version.id,
        request_id: requestId,
      });
    }
  }
  if (!authorized) return { error: "forbidden" as const };

  const expiresIn = 60;
  const { data, error } = await admin.storage
    .from(version.bucket)
    .createSignedUrl(version.path, expiresIn);
  if (error || !data) return { error: "server_error" as const };

  return { signedUrl: data.signedUrl, expiresIn };
}
