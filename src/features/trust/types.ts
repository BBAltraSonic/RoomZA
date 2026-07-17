export const trustDocumentStatuses = ["draft", "in_review", "approved", "published", "superseded"] as const;
export type TrustDocumentStatus = (typeof trustDocumentStatuses)[number];

export type TrustDocumentCategory = "legal" | "safety" | "trust" | "community" | "accessibility" | "technology";

export type TrustDocument = {
  id: string;
  slug: string;
  category: TrustDocumentCategory;
  title: string;
  summary: string;
  currentVersionId: string | null;
};

export type PolicyVersion = {
  id: string;
  documentId: string;
  version: number;
  status: TrustDocumentStatus;
  bodyMarkdown: string;
  changeSummary: string;
  requiresReacceptance: boolean;
  effectiveAt: string | null;
  externalReviewerName: string | null;
  counselReference: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export const privacyRequestTypes = ["export", "correction", "deletion", "objection", "withdraw_consent"] as const;
export type PrivacyRequestType = (typeof privacyRequestTypes)[number];

export const privacyRequestStatuses = ["submitted", "in_review", "waiting_on_user", "completed", "declined", "cancelled"] as const;
export type PrivacyRequestStatus = (typeof privacyRequestStatuses)[number];

export type PrivacyRequest = {
  id: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  details: string;
  dueAt: string;
  artifactExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModerationTarget =
  | { kind: "listing"; id: string }
  | { kind: "profile"; id: string }
  | { kind: "message"; id: string }
  | { kind: "listing_photo"; id: string };

export type TrustSignal = {
  key: "email" | "phone" | "nsfas" | "listing_review";
  label: "Email confirmed" | "Phone confirmed" | "NSFAS accredited" | "Listing reviewed";
  verifiedAt: string | null;
  expiresAt: string | null;
};

export type TransparencyMetric = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  sampleSize: number;
  suppressed: boolean;
};

export type TransparencySnapshot = {
  id: string;
  periodStart: string;
  periodEnd: string;
  minimumGroupSize: number;
  publishedAt: string;
  metrics: TransparencyMetric[];
};
