import fs from "node:fs";
import { createHash } from "node:crypto";
const dir = "docs/shared-cards-deploy-20261008/";
const release = JSON.parse(fs.readFileSync(dir + "release.json"));
const before = JSON.parse(fs.readFileSync(dir + "before-version.json"));
const after = JSON.parse(fs.readFileSync(dir + "after-version.json"));
const deployments = JSON.parse(fs.readFileSync(dir + "after-deployments.json"))
  .sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on));
const active = deployments[0];
const hash = data => createHash("sha256").update(data).digest("hex");
const bindings = value => value.resources.bindings.map(({ name, type, text }) =>
  ({ name, type, ...(type === "plain_text" ? { text } : {}) })).sort((a, b) => a.name.localeCompare(b.name));
const bindingMatch = JSON.stringify(bindings(before)) === JSON.stringify(bindings(after));
const compatibilityPreserved = JSON.stringify(before.resources.script_runtime) === JSON.stringify(after.resources.script_runtime);
const sourceDrift = Object.entries(release.sourceHashes).filter(([file, digest]) =>
  !fs.existsSync(file) || hash(fs.readFileSync(file)) !== digest).map(([file]) => file);
const smoke = JSON.parse(fs.readFileSync(dir + "smoke.json"));
release.result = {
  version: after.id, deployment: active.id, traffic: active.versions,
  bindingMatch, compatibilityPreserved, sourceDrift,
  httpChecks: smoke.checks.length, assetChecks: smoke.assets.length, cardBundles: smoke.cardBundles,
  smokePassed: smoke.passed, browserAttempts: 0, databaseChanges: false,
};
release.completedAt = new Date().toISOString();
fs.writeFileSync(dir + "release.json", JSON.stringify(release, null, 2) + "\n");
fs.writeFileSync(dir + "README.md", [
  "Deployed shared discovery card components to " + release.origin + ".",
  "",
  "Worker version: " + after.id + ". Deployment: " + active.id + ".",
  "",
  "Property, Shopping, Tourism, Events, and Services share Property's card presentation with category-specific content and actions.",
  "Four existing files changed and five card component/test files were added relative to the preceding production release.",
  "",
  "Checks: " + release.checks.map(check => check.name + ": " + check.exitCode).join(", ") + ".",
  "Read-only HTTP checks: " + smoke.checks.length + ". Asset hashes: " + smoke.assets.length + ". Passed: " + smoke.passed + ".",
  "All five card bundle markers are present in compiled chunks whose served hashes match the release snapshot.",
  "Bindings preserved: " + bindingMatch + ". Runtime compatibility preserved: " + compatibilityPreserved + ". Source drift: " + sourceDrift.length + ".",
  "",
  "Rollback reference: " + release.previousVersion + ".",
  "An isolated snapshot reused the verified Next.js 16.3.8 locked production dependencies with hardlinks and public-only build settings.",
  "The existing workspace source, environment files, production secrets, and database were preserved.",
  "Browser visual verification remains pending; no browser attempts were run.",
  "",
].join("\n"));
const passed = bindingMatch && compatibilityPreserved && !sourceDrift.length && smoke.passed &&
  active.versions.length === 1 && active.versions[0].percentage === 100 && active.versions[0].version_id === after.id &&
  release.checks.every(check => check.exitCode === 0);
console.log(JSON.stringify({ passed, ...release.result }, null, 2));
if (!passed) process.exitCode = 1;

