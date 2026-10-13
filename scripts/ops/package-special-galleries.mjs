import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

const changed = [
  "src/features/discovery/deal-schema.ts", "src/features/discovery/media-fields.tsx",
  "src/features/discovery/published-media.tsx", "src/features/discovery/special-card.tsx",
  "src/features/discovery/special-card.module.css", "src/features/offers/schema.ts",
  "src/features/entries/schema.ts", "src/features/offers/lifecycle.ts", "src/features/entries/lifecycle.ts",
];
const added = [
  "src/features/discovery/media-carousel.tsx", "src/features/discovery/photo-placeholder.tsx",
  "src/features/discovery/media-carousel.test.tsx", "src/features/discovery/media-fields.test.tsx",
  "src/features/discovery/special-gallery-schema.test.ts", "scripts/db/verify-special-galleries.mjs",
  "supabase/migrations/20261011113405_specials_photo_galleries.sql",
  "docs/specials-photo-galleries-20261011.md", "scripts/ops/package-special-galleries.mjs",
];
const modifiedTests = [
  "src/features/discovery/special-card.test.tsx", "src/features/discovery/special-details.test.tsx",
  "src/features/offers/lifecycle.test.ts", "src/features/offers/offer-draft-editor.test.tsx",
  "src/features/entries/schema.test.ts", "src/features/entries/lifecycle.test.ts",
];
const evidence = ["tests.log", "editor-integration-tests.log", "database-with-contacts.log", "database-without-contacts.log", "typecheck.log", "lint.log", "build.log", "diff-check.log"];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const zip = new JSZip(), entries = [];
let patch = "";
for (const file of [...changed, ...added, ...modifiedTests]) {
  const bytes = await fs.readFile(file);
  const entry = { path: file, sha256: digest(bytes), bytes: bytes.length, kind: added.includes(file) ? "added" : modifiedTests.includes(file) ? "test-snapshot" : "runtime-change" };
  zip.file("source/" + file, bytes);
  if (changed.includes(file)) {
    const beforePath = ".cache/specials-photos/before/" + file;
    const before = await fs.readFile(beforePath);
    entry.baselineSha256 = digest(before);
    zip.file("baseline/" + file, before);
    const result = spawnSync("git", ["diff", "--no-index", "--binary", "--", beforePath, file], { encoding: "utf8" });
    if (result.error || ![0, 1].includes(result.status)) throw result.error ?? new Error(result.stderr);
    patch += result.stdout.replaceAll("a/.cache/specials-photos/before/", "a/");
  }
  entries.push(entry);
}
zip.file("runtime-changes.patch", patch);
const logs = new Map();
for (const name of evidence) {
  const bytes = await fs.readFile(".cache/specials-photos/" + name);
  logs.set(name, bytes.toString("utf8"));
  zip.file("validation/" + name, bytes);
}
const testCount = logs.get("tests.log").match(/Tests\s+(\d+) passed/);
const testFiles = logs.get("tests.log").match(/Test Files\s+(\d+) passed/);
const checksWith = logs.get("database-with-contacts.log").match(/(\d+) isolated PostgreSQL checks passed/);
const checksWithout = logs.get("database-without-contacts.log").match(/(\d+) isolated PostgreSQL checks passed/);
if (!testCount || !testFiles || /\d+ failed/.test(logs.get("tests.log")) || !checksWith || !checksWithout
  || logs.get("typecheck.log").trim() || logs.get("lint.log").trim()
  || !logs.get("build.log").includes('Initial client JS budget passed')
  || !logs.get("build.log").includes('First-load client JS budget passed')
  || /trailing whitespace|new blank line at EOF/.test(logs.get("diff-check.log"))) throw new Error("Passing verification evidence required before packaging");
const manifest = {
  createdAt: new Date().toISOString(), kind: "scoped-source-handoff", deployed: false,
  productionMigrationApplied: false, browserVerified: false, hostedStorageVerified: false,
  migration: "20261011113405_specials_photo_galleries.sql",
  prerequisites: ["Existing Shopping and Entry publication migrations", "20261009124326_discovery_cards_media_saves.sql", "20261009151629_shared_special_details_links.sql"],
  optionalPrerequisite: "Guest contacts; rehearsed with and without the separate migration",
  snapshotIncludesExistingEditsInTouchedFiles: true,
  releaseInstruction: "Apply runtime-changes.patch and the added runtime/migration files to an isolated current-production source snapshot. Preserve baseline edits separately; do not deploy this dirty checkout or all pending migrations.",
  declaredNextVersion: JSON.parse(await fs.readFile("package.json", "utf8")).dependencies.next,
  installedNextVersion: JSON.parse(await fs.readFile("node_modules/next/package.json", "utf8")).version,
  verification: { focusedTests: Number(testCount[1]), testFiles: Number(testFiles[1]), databaseChecksWithContacts: Number(checksWith[1]), databaseChecksWithoutContacts: Number(checksWithout[1]), typecheck: "passed", targetedLint: "passed", productionBuild: "passed", clientJsBudgets: "passed" },
  entries,
};
zip.file("manifest.json", JSON.stringify(manifest, null, 2));
for (const entry of entries) if (digest(await fs.readFile(entry.path)) !== entry.sha256) throw new Error("Source changed during packaging: " + entry.path);
const directory = "artifacts/specials-photo-galleries";
await fs.mkdir(directory, { recursive: true });
const output = path.join(directory, "specials-photo-galleries-20261011.zip");
await fs.writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
await fs.writeFile(output + ".manifest.json", JSON.stringify(manifest, null, 2));
await fs.writeFile(output + ".patch", patch);
console.log(JSON.stringify({ output: path.resolve(output), files: entries.length, bytes: (await fs.stat(output)).size, sha256: digest(await fs.readFile(output)) }));
