/**
 * Unit tests for the README feature collector (R1.1, R1.2).
 *
 * Driven by an on-disk fixture tree so the collector exercises real file-system
 * resolution. Asserts:
 *  - implemented features resolve to their existing candidate path(s);
 *  - features whose candidate paths are absent are reported `"missing"`;
 *  - `collectReadmeFeatures` emits well-formed `missing-feature` Gap entries
 *    with a non-null README reference and empty `filePaths` (R1.2);
 *  - the README reference records the section heading and bullet line (R1.1).
 *
 * _Requirements: 1.1, 1.2_
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { collectReadmeFeatures, resolveReadmeFeatures } from "./readme-features";

const README = `# Fixture

## Features

### Discovery & Browsing
- Full-screen Google Maps with custom price-pin markers
- Viewport-based spatial listing queries

### Listing Management
- Full CRUD form with image upload

### Search Alerts
- Saved search criteria
`;

const SECTION_PATHS = {
    "Discovery & Browsing": ["src/features/map-discovery", "src/app/listing"],
    "Listing Management": ["src/features/listings"],
    "Search Alerts": ["src/app/api/alerts"],
};

let rootDir: string;

beforeAll(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "readme-features-"));
    await writeFile(path.join(rootDir, "README.md"), README, "utf8");

    // Implemented sections: create the candidate dirs with a file inside.
    await mkdir(path.join(rootDir, "src/features/map-discovery"), { recursive: true });
    await writeFile(path.join(rootDir, "src/features/map-discovery/index.ts"), "export {};", "utf8");
    await mkdir(path.join(rootDir, "src/features/listings"), { recursive: true });
    await writeFile(path.join(rootDir, "src/features/listings/schema.ts"), "export {};", "utf8");
    // "Search Alerts" candidate (src/app/api/alerts) intentionally absent → missing.
});

afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
});

describe("resolveReadmeFeatures", () => {
    it("produces one record per README feature bullet (R1.1)", async () => {
        const resolutions = await resolveReadmeFeatures({ rootDir, sectionPaths: SECTION_PATHS });
        expect(resolutions).toHaveLength(4);
        expect(resolutions.map((r) => r.feature)).toEqual([
            "Full-screen Google Maps with custom price-pin markers",
            "Viewport-based spatial listing queries",
            "Full CRUD form with image upload",
            "Saved search criteria",
        ]);
    });

    it("resolves implemented features to their existing candidate path(s)", async () => {
        const resolutions = await resolveReadmeFeatures({ rootDir, sectionPaths: SECTION_PATHS });
        const maps = resolutions.find((r) => r.section === "Discovery & Browsing");
        expect(maps?.status).toBe("implemented");
        // Only src/features/map-discovery exists; src/app/listing does not.
        expect(maps?.filePaths).toEqual(["src/features/map-discovery"]);
    });

    it("marks features with no existing candidate path as missing (R1.2)", async () => {
        const resolutions = await resolveReadmeFeatures({ rootDir, sectionPaths: SECTION_PATHS });
        const alerts = resolutions.find((r) => r.section === "Search Alerts");
        expect(alerts?.status).toBe("missing");
        expect(alerts?.filePaths).toEqual([]);
    });

    it("records a README reference with section heading and bullet line (R1.1)", async () => {
        const resolutions = await resolveReadmeFeatures({ rootDir, sectionPaths: SECTION_PATHS });
        const alerts = resolutions.find((r) => r.section === "Search Alerts");
        expect(alerts?.readmeRef).toContain("Search Alerts");
        expect(alerts?.readmeRef).toContain(`README.md:${alerts?.line}`);
        expect(alerts?.line).toBeGreaterThan(0);
    });
});

describe("collectReadmeFeatures", () => {
    it("emits a missing-feature Gap entry per unresolved feature (R1.2)", async () => {
        const entries = await collectReadmeFeatures({ rootDir, sectionPaths: SECTION_PATHS });
        expect(entries).toHaveLength(1);

        const [entry] = entries;
        expect(entry?.category).toBe("missing-feature");
        expect(entry?.feature).toBe("Saved search criteria");
        // R1.2 invariants: non-null README reference, empty implementation paths.
        expect(entry?.readmeRef).not.toBeNull();
        expect(entry?.filePaths).toEqual([]);
        // R1.8: exactly one severity and one owning phase in 2–8.
        expect(["blocker", "major", "minor"]).toContain(entry?.severity);
        expect(entry?.owningPhase).not.toBeNull();
    });

    it("omits implemented features from the Gap entries", async () => {
        const entries = await collectReadmeFeatures({ rootDir, sectionPaths: SECTION_PATHS });
        const features = entries.map((e) => e.feature);
        expect(features).not.toContain("Full CRUD form with image upload");
        expect(features).not.toContain("Full-screen Google Maps with custom price-pin markers");
    });
});
