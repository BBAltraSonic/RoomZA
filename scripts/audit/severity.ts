/**
 * Severity & owning-phase assignment (Phase 1, R1.8).
 *
 * Every Gap_Report entry is assigned exactly one severity from
 * {blocker, major, minor} and exactly one owning phase, via deterministic,
 * pure rules. The owning phase scopes which later phase closes the gap:
 *
 *   2 = Architecture (R2)   3 = Auth (R3)        4 = Landlord (R4)
 *   5 = Renter (R5)         6 = UX (R6)          7 = Performance (R7)
 *   8 = Security (R8)       9 = Database (R9)
 *
 * Reconciliation note: the Gap_Report schema (`scripts/audit/schema.ts`,
 * task 1.1) constrains `owningPhase` to the range 2–8. The design's example
 * nonetheless maps `db-integrity` gaps to phase 9 (the Database phase). This
 * assignment function returns the *correct* owning phase per the design —
 * including 9 for `db-integrity` — and `owningPhase: null` only for
 * `audit-incomplete`. The schema's range is reconciled in task 1.1.
 *
 * The string-literal union types below mirror the `GapCategory`, `Severity`,
 * and route-state/observability enums defined in `scripts/audit/schema.ts`.
 * They are declared locally so this module type-checks independently while
 * task 1.1 lands concurrently; because they are plain string-literal unions
 * they are structurally identical to the schema's enums and interoperate with
 * the generated `GapEntry` type without conversion.
 *
 * _Requirements: 1.8_
 * _Design: Severity & owning-phase assignment_
 */

/** Exactly one severity per entry (R1.8). */
export type Severity = "blocker" | "major" | "minor";

/** Gap categories (mirrors schema.ts `GapCategory`). */
export type GapCategory =
  | "missing-feature"
  | "placeholder"
  | "missing-route-state"
  | "missing-validation"
  | "missing-observability"
  | "dead-code"
  | "architecture"
  | "db-integrity"
  | "in-progress-spec"
  | "audit-incomplete";

/**
 * Owning phase. The schema constrains stored entries to 2–8; this assignment
 * surface additionally yields 9 for `db-integrity` per the design example.
 */
export type OwningPhase = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Which of the three route states is absent (mirrors schema.ts). */
export type MissingRouteState = "loading" | "empty" | "error";

/** Which of the three observability concerns is absent (mirrors schema.ts). */
export type MissingObservability = "analytics" | "logging" | "monitoring";

/**
 * The fields of a (proto-)Gap_Report entry that drive assignment. Collectors
 * pass the classified category plus the free-text detail and, where relevant,
 * the absent route-state / observability discriminators.
 */
export interface SeverityAssignmentInput {
  readonly category: GapCategory;
  readonly detail?: string;
  readonly missingState?: MissingRouteState | null;
  readonly missingObservability?: MissingObservability | null;
  /** Affected feature/area; used as a secondary signal for missing-feature. */
  readonly feature?: string;
}

/** The deterministic result of assignment for a single entry. */
export interface SeverityAssignment {
  readonly severity: Severity;
  /** null only for `audit-incomplete`; a phase 2–9 otherwise. */
  readonly owningPhase: OwningPhase | null;
}

/**
 * Base severity per category. Detail-level refinement (below) can override
 * these for categories whose impact varies by what specifically is wrong
 * (notably `db-integrity` and `missing-route-state`).
 */
const BASE_SEVERITY: Readonly<Record<GapCategory, Severity>> = {
  "missing-feature": "blocker",
  placeholder: "major",
  "missing-route-state": "major",
  "missing-validation": "blocker",
  "missing-observability": "minor",
  "dead-code": "minor",
  architecture: "major",
  "db-integrity": "blocker",
  "in-progress-spec": "major",
  "audit-incomplete": "blocker",
};

/**
 * Base owning phase per category. `audit-incomplete` has no owning phase
 * (it is an audit-completeness signal, not a code gap a phase closes).
 * `missing-feature` and `in-progress-spec` are refined by domain below.
 */
const BASE_PHASE: Readonly<Record<GapCategory, OwningPhase | null>> = {
  "missing-feature": 5,
  placeholder: 6,
  "missing-route-state": 6,
  "missing-validation": 8,
  "missing-observability": 8,
  "dead-code": 2,
  architecture: 2,
  "db-integrity": 9,
  "in-progress-spec": 5,
  "audit-incomplete": null,
};

/**
 * Infer the flow phase (3 = auth, 4 = landlord, 5 = renter) a feature-shaped
 * gap belongs to from its detail/feature text. Defaults to 5 (renter) when no
 * domain signal is present, since renter discovery is the broadest surface.
 */
function inferFlowPhase(text: string): OwningPhase {
  if (/\b(auth|login|signup|sign-?in|sign-?up|password|oauth|session|verif)/.test(text)) {
    return 3;
  }
  if (/\b(landlord|listing|applicant|dashboard|owner)/.test(text)) {
    return 4;
  }
  if (/\b(renter|tenant|map|discovery|saved|application|viewing|message|chat)/.test(text)) {
    return 5;
  }
  return 5;
}

/**
 * Refine `db-integrity` severity by what specifically is wrong. Foreign-key
 * and RLS gaps are launch blockers; missing indexes and constraints are major;
 * naming-convention deviations are minor.
 */
function dbIntegritySeverity(text: string): Severity {
  if (/\b(foreign key|fk|references|rls|policy|security (invoker|definer)|unauthor)/.test(text)) {
    return "blocker";
  }
  if (/\bnaming\b/.test(text)) {
    return "minor";
  }
  // missing index, constraint (not-null/unique/check), trigger context, etc.
  return "major";
}

/**
 * Assign exactly one severity and exactly one owning phase to a Gap_Report
 * entry, deterministically (R1.8). Pure: identical input always yields
 * identical output.
 */
export function assignSeverityAndPhase(
  input: SeverityAssignmentInput,
): SeverityAssignment {
  const { category } = input;
  const text = `${input.detail ?? ""} ${input.feature ?? ""}`.toLowerCase();

  let severity: Severity = BASE_SEVERITY[category];
  let owningPhase: OwningPhase | null = BASE_PHASE[category];

  switch (category) {
    case "db-integrity":
      severity = dbIntegritySeverity(text);
      owningPhase = 9;
      break;

    case "missing-route-state":
      // A missing error boundary is more impactful than a missing loading or
      // empty state; the design example pins error-state gaps at major/phase 6.
      severity = input.missingState === "error" ? "major" : "minor";
      owningPhase = 6;
      break;

    case "missing-observability":
      // Absent structured logging blocks audit-trail requirements (R8.11);
      // missing analytics/monitoring is a minor gap.
      severity = input.missingObservability === "logging" ? "major" : "minor";
      owningPhase = 8;
      break;

    case "missing-feature":
    case "in-progress-spec":
      owningPhase = inferFlowPhase(text);
      break;

    case "audit-incomplete":
      // Audit could not complete: serious (gate cannot pass) but owned by no
      // remediation phase — re-running the audit must resolve it.
      severity = "blocker";
      owningPhase = null;
      break;

    default:
      // missing-validation, placeholder, dead-code, architecture: use the base
      // category mappings as-is.
      break;
  }

  return { severity, owningPhase };
}
