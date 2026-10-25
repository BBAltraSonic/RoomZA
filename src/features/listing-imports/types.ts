import type { Json } from "@/lib/supabase/types";

export const IMPORT_SOURCE_KINDS = [
  "csv",
  "xlsx",
  "xml",
  "json",
  "pasted_table",
  "image_archive",
  "image_folder",
  "image_urls",
  "pinpoint_v1",
] as const;
export type ImportSourceKind = (typeof IMPORT_SOURCE_KINDS)[number];

export const IMPORT_JOB_STAGES = [
  "source",
  "upload",
  "mapping",
  "validating",
  "resolving",
  "preview",
  "committing",
  "confirming",
  "complete",
  "cancelled",
  "failed",
] as const;
export type ImportJobStage = (typeof IMPORT_JOB_STAGES)[number];

export const IMPORT_ROW_STATES = [
  "pending",
  "parse_blocked",
  "draft_ready",
  "publish_blocked",
  "warning",
  "duplicate_review",
  "committed",
  "published",
  "skipped",
  "failed",
  "removed",
] as const;
export type ImportRowState = (typeof IMPORT_ROW_STATES)[number];

export const DUPLICATE_STRATEGIES = ["skip", "replace", "merge", "import_new"] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

export type ImportDuplicateCandidate = {
  id: string;
  title: string;
  address: string;
  status: string;
};

export type ImportIssueSeverity = "blocking" | "publish_blocker" | "warning";

export type ImportIssueCode =
  | "malformed_source"
  | "unsafe_key"
  | "unsupported_formula"
  | "missing_title"
  | "missing_address"
  | "invalid_price"
  | "invalid_number"
  | "invalid_email"
  | "invalid_phone"
  | "invalid_enum"
  | "invalid_date"
  | "invalid_coordinates"
  | "ambiguous_geocode"
  | "too_many_images"
  | "missing_images"
  | "duplicate_external_reference"
  | "duplicate_address"
  | "duplicate_coordinates"
  | "ambiguous_duplicate"
  | "unmatched_image"
  | "unsafe_archive"
  | "unsafe_image_url"
  | "mime_mismatch"
  | "responsible_agent_required"
  | "published_reassignment_blocked"
  | "row_write_failed";

export type ImportSelection =
  | { mode: "explicit"; included: string[] }
  | { mode: "all_matching"; filter: ImportRowFilter; excluded: string[] };

export type ImportRowFilter = {
  query?: string;
  states?: ImportRowState[];
  severities?: ImportIssueSeverity[];
  duplicateOnly?: boolean;
};

export type ImportBulkPatch = Partial<{
  price: number;
  responsibleAgentId: string;
  availabilityDate: string;
  status: "draft" | "published" | "archived";
  amenities: string[];
  isFeatured: boolean;
  publicationSelected: boolean;
  archive: boolean;
  removeFromBatch: boolean;
}>;

export type CanonicalImportListing = {
  sourceReference?: string;
  title?: string;
  description?: string;
  listingType?: "rent" | "sale";
  propertyType?: "apartment" | "house" | "room" | "studio" | "cottage" | "townhouse";
  price?: number;
  salePrice?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingType?: string;
  parkingCount?: number;
  electricityType?: string;
  waterAvailability?: string;
  leaseDuration?: string;
  availabilityDate?: string;
  contactEmail?: string;
  contactPhone?: string;
  amenities?: string[];
  imageReferences?: string[];
  responsibleAgentId?: string;
  officeId?: string;
  isFeatured?: boolean;
  publicationSelected?: boolean;
};

export type SourceInspection = {
  sourceKind: ImportSourceKind;
  adapterVersion: string;
  headers: string[];
  sheets?: string[];
  recordPaths?: string[];
  estimatedRows?: number;
  warnings: string[];
};

export type SourceRecord = Record<string, unknown>;

export type ParsedRecord = {
  rowNumber: number;
  raw: SourceRecord;
};

export type ImportMapping = Record<string, keyof CanonicalImportListing | null>;

export interface ListingSourceAdapter<TSource = unknown> {
  readonly kind: ImportSourceKind;
  readonly version: string;
  inspect(source: TSource): Promise<SourceInspection> | SourceInspection;
  discoverHeaders(source: TSource, options?: AdapterParseOptions): Promise<string[]> | string[];
  discoverRecordPaths?(source: TSource): Promise<string[]> | string[];
  parseChunk(source: TSource, options: AdapterParseOptions): Promise<ParsedRecord[]> | ParsedRecord[];
  normalize(record: ParsedRecord, mapping: ImportMapping, defaults?: Partial<CanonicalImportListing>): CanonicalImportListing;
}

export type AdapterParseOptions = {
  cursor?: number;
  limit?: number;
  sheet?: string;
  recordPath?: string;
  delimiter?: string;
};

export type ImportJobMessage = {
  jobId: string;
  stage: ImportJobStage;
  cursor: number;
  attempt: number;
  version: number;
};

export type ImportJobSummary = {
  id: string;
  organizationId: string;
  sourceKind: ImportSourceKind;
  sourceName: string | null;
  stage: ImportJobStage;
  version: number;
  totalRows: number;
  processedRows: number;
  validRows: number;
  warningRows: number;
  blockedRows: number;
  committedRows: number;
  failedRows: number;
  heartbeatAt: string | null;
  updatedAt: string;
  messageCode: string | null;
  messageDetail: string | null;
};

export type ImportRowView = {
  id: string;
  rowNumber: number;
  state: ImportRowState;
  normalizedData: CanonicalImportListing;
  duplicateCandidateIds: string[];
  duplicateStrategy: DuplicateStrategy | null;
  duplicateListingId: string | null;
  publicationSelected: boolean;
  resultingListingId: string | null;
  issues: Array<{
    id: string;
    severity: ImportIssueSeverity;
    code: ImportIssueCode;
    field: string | null;
    message: string;
  }>;
};

export type ImportReport = {
  schemaVersion: 1;
  job: ImportJobSummary;
  rows: Array<{
    rowNumber: number;
    state: ImportRowState;
    sourceReference?: string;
    issueCodes: ImportIssueCode[];
    resultingListingId?: string;
  }>;
  generatedAt: string;
};

export type JsonRecord = Record<string, Json | undefined>;
