export const adminLevels = ["owner", "admin"] as const;
export type AdminLevel = (typeof adminLevels)[number];

export type AdminMembership = {
  user_id: string;
  level: AdminLevel;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export type AdminContext = {
  user: { id: string; email?: string };
  membership: AdminMembership;
  verifiedFactorCount: number;
  assuranceLevel: "aal1" | "aal2" | null;
};

export const moderationStatuses = ["open", "in_review", "resolved", "dismissed"] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export const moderationPriorities = ["low", "normal", "high", "urgent"] as const;
export type ModerationPriority = (typeof moderationPriorities)[number];

export const moderationCategories = [
  "fraud_or_scam",
  "misleading_listing",
  "duplicate_or_spam",
  "discrimination",
  "harassment",
  "safety",
  "privacy",
  "other",
] as const;
export type ModerationCategory = (typeof moderationCategories)[number];

export type ModerationCase = {
  id: string;
  reporter_id: string;
  listing_id: string | null;
  reported_user_id: string | null;
  message_id: string | null;
  listing_image_id: string | null;
  category: ModerationCategory;
  details: string;
  status: ModerationStatus;
  priority: ModerationPriority;
  assigned_to: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type AdminListParams = {
  q?: string;
  status?: string;
  role?: string;
  priority?: string;
  assignee?: string;
  cursor?: string;
  from?: string;
  to?: string;
  limit?: number;
};
