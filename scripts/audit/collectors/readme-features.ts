/**
 * README feature collector (Phase 1, R1.1, R1.2).
 *
 * Parses the feature sections of the repository README and resolves each
 * described feature to its implementation file path(s) — or records it as
 * `"missing"` when no implementation can be found. Every feature carries a
 * README reference (its section heading plus the line number of the bullet)
 * so the Gap_Report can point a reviewer straight at the source description.
 *
 * Two surfaces are exported:
 *  - {@link resolveReadmeFeatures} — the full feature inventory (one record per
 *    README feature bullet, with resolved paths or a `"missing"` status). This
 *    satisfies R1.1's "one entry for every feature described in the README".
 *  - {@link collectReadmeFeatures} — the collector contract used by the audit
 *    orchestrator: it returns a `GapEntry[]` containing one `missing-feature`
 *    entry for every feature that could not be resolved to an implementation
 *    (R1.2). Implemented features are not gaps, so they are omitted from the
 *    `GapEntry[]` (their resolution is available via {@link resolveReadmeFeatures}).
 *
 * The collector is a read-only analyser: it never mutates application source.
 *
 * _Requirements: 1.1, 1.2_
 * _Design: Readiness_Audit collectors — readme-features_
 */

import { readFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GapEntry, gapEntryId } from "../schema";
import { assignSeverityAndPhase } from "../severity";

/** Resolution status of a single README feature. */
export type FeatureStatus = "implemented" | "missing";

/** One README feature and how it resolves against the codebase. */
export interface FeatureResolution {
    /** The feature bullet text, verbatim from the README. */
    readonly feature: string;
    /** The `###` subsection heading the feature appears under. */
    readonly section: string;
    /** Human-readable README reference: section heading + file:line (R1.1). */
    readonly readmeRef: string;
    /** 1-based line number of the feature bullet in the README. */
    readonly line: number;
    /** Resolved repo-relative implementation path(s); empty when missing. */
    readonly filePaths: readonly string[];
    /** `"implemented"` when ≥1 candidate path exists, else `"missing"`. */
    readonly status: FeatureStatus;
}

/** Options for the README feature collector (overridable for tests/fixtures). */
export interface ReadmeFeaturesOptions {
    /** Repository root used to resolve candidate implementation paths. */
    readonly rootDir?: string;
    /** Path to the README to parse; defaults to `<rootDir>/README.md`. */
    readonly readmePath?: string;
    /**
     * Map of README `###` section heading → candidate repo-relative
     * implementation paths. A feature resolves to the subset of its section's
     * candidates that exist on disk; if none exist, the feature is `"missing"`.
     */
    readonly sectionPaths?: Readonly<Record<string, readonly string[]>>;
}

/**
 * The repository root, derived from this module's location:
 * `scripts/audit/collectors/readme-features.ts` → four levels up is the root.
 */
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../..");

/** The `##` heading whose `###` subsections enumerate product features. */
const FEATURES_HEADING = "Features";

/**
 * Default mapping of README feature section → candidate implementation paths.
 * Each path is repo-relative; a section's feature is considered implemented
 * when at least one of its candidate paths exists (and, for a directory, is
 * non-empty). These mirror the feature-first layout documented in the README.
 */
const DEFAULT_SECTION_PATHS: Readonly<Record<string, readonly string[]>> = {
    "Discovery & Browsing": [
        "src/features/map-discovery",
        "src/app/listing",
        "src/app/neighborhoods",
        "src/app/saved",
    ],
    "Listing Management": ["src/features/listings", "src/app/dashboard/listings"],
    Applications: ["src/features/applications", "src/app/applications"],
    Communication: ["src/features/chat", "src/app/messages"],
    Viewings: ["src/features/viewings", "src/app/viewings", "src/app/dashboard/viewings"],
    Notifications: [
        "src/features/notifications",
        "src/app/api/jobs/notifications",
        "src/app/api/cron/notifications",
    ],
    "Search Alerts": ["src/app/api/alerts"],
};

/** A raw feature bullet parsed from the README, before resolution. */
interface ParsedFeature {
    readonly feature: string;
    readonly section: string;
    readonly line: number;
}

/**
 * Parse the README's `## Features` section into one record per feature bullet.
 *
 * Only top-level (`- `) bullets that fall under the Features `##` heading and a
 * `###` subsection are treated as features. Line numbers are 1-based.
 */
function parseFeatureBullets(readme: string): ParsedFeature[] {
    const lines = readme.split(/\r?\n/);
    const features: ParsedFeature[] = [];

    let currentH2: string | null = null;
    let currentH3: string | null = null;

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] ?? "";

        const h2 = /^##\s+(.+?)\s*$/.exec(raw);
        if (h2) {
            currentH2 = h2[1] ?? null;
            currentH3 = null;
            continue;
        }

        const h3 = /^###\s+(.+?)\s*$/.exec(raw);
        if (h3) {
            currentH3 = h3[1] ?? null;
            continue;
        }

        if (currentH2 !== FEATURES_HEADING || currentH3 === null) {
            continue;
        }

        // Top-level bullet only (no leading whitespace → not a nested item).
        const bullet = /^-\s+(.+?)\s*$/.exec(raw);
        if (bullet) {
            features.push({
                feature: bullet[1] ?? "",
                section: currentH3,
                line: i + 1,
            });
        }
    }

    return features;
}

/**
 * Return true when `absPath` exists and, if it is a directory, is non-empty.
 * Used to decide whether a candidate implementation path counts as present.
 */
async function pathExistsNonEmpty(absPath: string): Promise<boolean> {
    try {
        const stats = await stat(absPath);
        if (!stats.isDirectory()) {
            return true;
        }
        const entries = await readdir(absPath);
        return entries.length > 0;
    } catch {
        return false;
    }
}

/**
 * Resolve every README feature to its implementation path(s) or `"missing"`.
 *
 * @returns the complete feature inventory (R1.1), in README order.
 */
export async function resolveReadmeFeatures(
    options: ReadmeFeaturesOptions = {},
): Promise<FeatureResolution[]> {
    const rootDir = options.rootDir ?? REPO_ROOT;
    const readmePath = options.readmePath ?? path.join(rootDir, "README.md");
    const sectionPaths = options.sectionPaths ?? DEFAULT_SECTION_PATHS;
    const readmeName = path.basename(readmePath);

    const readme = await readFile(readmePath, "utf8");
    const bullets = parseFeatureBullets(readme);

    const resolutions: FeatureResolution[] = [];

    for (const bullet of bullets) {
        const candidates = sectionPaths[bullet.section] ?? [];

        const existing: string[] = [];
        for (const candidate of candidates) {
            const absCandidate = path.resolve(rootDir, candidate);
            if (await pathExistsNonEmpty(absCandidate)) {
                // Normalise to forward-slash repo-relative form for stable output.
                existing.push(candidate.split(path.sep).join("/"));
            }
        }

        const filePaths = [...new Set(existing)].sort();
        const status: FeatureStatus = filePaths.length > 0 ? "implemented" : "missing";

        resolutions.push({
            feature: bullet.feature,
            section: bullet.section,
            readmeRef: `${readmeName} › ${FEATURES_HEADING} › ${bullet.section} (${readmeName}:${bullet.line})`,
            line: bullet.line,
            filePaths,
            status,
        });
    }

    return resolutions;
}

/**
 * Collector contract: emit a `missing-feature` Gap_Report entry for every
 * README feature that resolves to no implementation (R1.2). Implemented
 * features are not gaps and are omitted.
 *
 * @returns validated {@link GapEntry} records (severity/owning-phase assigned
 *   deterministically via {@link assignSeverityAndPhase}, stable ids via
 *   {@link gapEntryId}).
 */
export async function collectReadmeFeatures(
    options: ReadmeFeaturesOptions = {},
): Promise<GapEntry[]> {
    const resolutions = await resolveReadmeFeatures(options);

    return resolutions
        .filter((resolution) => resolution.status === "missing")
        .map((resolution) => {
            const detail = `Feature described in README ("${resolution.feature}") under section "${resolution.section}" has no resolved implementation file path(s).`;
            const { severity, owningPhase } = assignSeverityAndPhase({
                category: "missing-feature",
                detail,
                feature: resolution.feature,
            });

            // GapEntry.parse validates the missing-feature invariants (R1.2):
            // non-null readmeRef and empty filePaths.
            return GapEntry.parse({
                id: gapEntryId({ category: "missing-feature", filePath: "", detail }),
                feature: resolution.feature,
                readmeRef: resolution.readmeRef,
                filePaths: [],
                category: "missing-feature",
                severity,
                owningPhase,
                detail,
                missingState: null,
                missingObservability: null,
                reason: null,
                status: "open",
            });
        });
}
