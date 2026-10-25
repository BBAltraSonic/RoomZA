import { z } from "zod";

import {
  DUPLICATE_STRATEGIES,
  IMPORT_JOB_STAGES,
  IMPORT_ROW_STATES,
  IMPORT_SOURCE_KINDS,
} from "./types";

export const createImportJobSchema = z.object({
  sourceKind: z.enum(IMPORT_SOURCE_KINDS),
  sourceName: z.string().trim().min(1).max(240).optional(),
  sourceSizeBytes: z.number().int().nonnegative().max(2 * 1024 * 1024 * 1024).optional(),
});

export const importJobMessageSchema = z.object({
  jobId: z.string().uuid(),
  stage: z.enum(IMPORT_JOB_STAGES),
  cursor: z.number().int().nonnegative(),
  attempt: z.number().int().min(0).max(3),
  version: z.number().int().positive(),
}).strict();

export const importMappingSchema = z.record(z.string(), z.string().nullable()).refine(
  (mapping) => Object.keys(mapping).length <= 300,
  "A mapping can contain at most 300 source columns.",
);

export const importSelectionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("explicit"),
    included: z.array(z.string().uuid()).max(5_000),
  }),
  z.object({
    mode: z.literal("all_matching"),
    filter: z.object({
      query: z.string().trim().max(160).optional(),
      states: z.array(z.enum(IMPORT_ROW_STATES)).max(12).optional(),
      severities: z.array(z.enum(["blocking", "publish_blocker", "warning"])).max(3).optional(),
      duplicateOnly: z.boolean().optional(),
    }),
    excluded: z.array(z.string().uuid()).max(5_000),
  }),
]);

export const duplicateResolutionSchema = z.object({
  rowId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive().optional(),
  strategy: z.enum(DUPLICATE_STRATEGIES),
  listingId: z.string().uuid().nullable(),
});

export const importJobActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("source_uploaded"),
    sourcePath: z.string().min(1).max(1024),
    sourceName: z.string().min(1).max(240),
    sourceSizeBytes: z.number().int().nonnegative(),
    sheetName: z.string().max(240).nullable().optional(),
    recordPath: z.string().max(500).nullable().optional(),
    inspection: z.object({
      headers: z.array(z.string().max(240)).max(300),
      sheets: z.array(z.string().max(240)).max(100).optional(),
      recordPaths: z.array(z.string().max(500)).max(200).optional(),
      estimatedRows: z.number().int().nonnegative().max(25_000).optional(),
      warnings: z.array(z.string().max(500)).max(20),
      adapterVersion: z.string().max(40),
    }),
  }),
  z.object({
    action: z.literal("save_mapping"),
    mapping: importMappingSchema,
    defaults: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    action: z.literal("start_validation"),
  }),
  z.object({
    action: z.literal("resolve_duplicate"),
    resolution: duplicateResolutionSchema,
  }),
  z.object({
    action: z.literal("patch_row"),
    rowId: z.string().uuid(),
    expectedRowVersion: z.number().int().positive().optional(),
    patch: z.object({
      title: z.string().trim().min(1).max(160).optional(),
      address: z.string().trim().min(1).max(500).optional(),
      price: z.number().int().positive().optional(),
      salePrice: z.number().int().positive().optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      availabilityDate: z.string().date().optional(),
      propertyType: z.enum(["apartment", "house", "room", "studio", "cottage", "townhouse"]).optional(),
      responsibleAgentId: z.string().uuid().optional(),
    }).refine((patch) => Object.keys(patch).length > 0, "Choose at least one field."),
  }),
  z.object({
    action: z.literal("save_selection"),
    selection: importSelectionSchema,
  }),
  z.object({
    action: z.literal("bulk_patch"),
    selection: importSelectionSchema,
    patch: z.object({
      price: z.number().int().positive().optional(),
      responsibleAgentId: z.string().uuid().optional(),
      availabilityDate: z.string().date().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      amenities: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
      isFeatured: z.boolean().optional(),
      publicationSelected: z.boolean().optional(),
      archive: z.boolean().optional(),
      removeFromBatch: z.boolean().optional(),
    }).refine((patch) => Object.keys(patch).length > 0, "Choose at least one change."),
  }),
  z.object({ action: z.literal("continue_preview") }),
  z.object({
    action: z.literal("commit_drafts"),
    confirmation: z.literal("CREATE DRAFTS"),
  }),
  z.object({
    action: z.literal("confirm_final"),
    confirmation: z.literal("PUBLISH AND APPLY"),
  }),
  z.object({
    action: z.literal("rollback"),
    confirmation: z.literal("ROLL BACK IMPORT"),
  }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("retry") }),
]).and(z.object({ expectedVersion: z.number().int().positive().optional() }));

export const importRowsQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  state: z.enum(IMPORT_ROW_STATES).optional(),
  severity: z.enum(["blocking", "publish_blocker", "warning"]).optional(),
  query: z.string().trim().max(160).optional(),
});
