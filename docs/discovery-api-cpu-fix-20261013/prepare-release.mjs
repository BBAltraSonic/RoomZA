import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = process.cwd(), evidence = path.join(root, "docs/discovery-api-cpu-fix-20261013");
const previous = JSON.parse(fs.readFileSync("docs/all-work-deploy-20261013/release.json"));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const snapshot = path.join(root, ".cache/discovery-api-release-20261013");
assert(!fs.existsSync(path.join(evidence, "release.json")), "Release already finalized; do not overwrite");
let verifiedSources = 0;
for (const [file, expected] of Object.entries(previous.sourceHashes)) {
  if (!file.startsWith("src/")) continue;
  assert.equal(hash(path.join(root, file)), expected, "Current application source drift: " + file);
  assert.equal(hash(path.join(previous.snapshot, file)), expected, "Retained source drift: " + file);
  verifiedSources++;
}
assert.equal(hash(path.join(previous.snapshot, ".open-next/server-functions/default/handler.mjs")), previous.packagingMinification.sha256);
assert.equal(hash("package-lock.json"), previous.lockfileHash);
fs.mkdirSync(snapshot, { recursive: true });
fs.cpSync(path.join(previous.snapshot, ".open-next"), path.join(snapshot, ".open-next"), { recursive: true });
fs.cpSync(path.join(root, ".open-next/discovery-api"), path.join(snapshot, ".open-next/discovery-api"), { recursive: true });
for (const file of ["package.json", "package-lock.json", "wrangler.jsonc"]) fs.copyFileSync(path.join(root, file), path.join(snapshot, file));
fs.cpSync(path.join(root, "workers/discovery-api"), path.join(snapshot, "workers/discovery-api"), { recursive: true, filter: file => !file.split(path.sep).includes(".wrangler") });
fs.copyFileSync(path.join(root, "cloudflare/discovery-worker.mjs"), path.join(snapshot, ".open-next/discovery/worker.js"));
fs.copyFileSync(path.join(root, "cloudflare/discovery-api-routing.mjs"), path.join(snapshot, ".open-next/discovery-api-routing.mjs"));
if (!fs.existsSync(path.join(snapshot, "node_modules"))) fs.symlinkSync(path.join(previous.snapshot, "node_modules"), path.join(snapshot, "node_modules"), "junction");
const originalFiles = fs.readdirSync(path.join(previous.snapshot, ".open-next"), { recursive: true }).filter(file => fs.statSync(path.join(previous.snapshot, ".open-next", file)).isFile());
for (const file of originalFiles) {
  if (file === path.join("discovery", "worker.js")) continue;
  assert.equal(hash(path.join(snapshot, ".open-next", file)), hash(path.join(previous.snapshot, ".open-next", file)), "Deployed artifact drift: " + file);
}
const checks = [];
for (const [name, args] of [
  ["app-packaging", ["node_modules/wrangler/bin/wrangler.js", "deploy", "--dry-run", "--outdir", ".wrangler/worker-size"]],
  ["api-packaging", ["node_modules/wrangler/bin/wrangler.js", "deploy", "--config", "workers/discovery-api/wrangler.jsonc", "--dry-run", "--outdir", ".wrangler/api-size"]],
]) {
  const result = spawnSync(process.execPath, args, { cwd: snapshot, windowsHide: true, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: path.join(evidence, name + ".wrangler.log") } });
  fs.writeFileSync(path.join(evidence, name + ".log"), (result.stdout ?? "") + (result.stderr ?? ""));
  assert.equal(result.status, 0, name + " failed: " + result.stderr);
  checks.push({ name, passed: true });
}
const sourceFiles = ["cloudflare/discovery-worker.mjs", "cloudflare/discovery-api-routing.mjs", "scripts/ops/build-discovery-api.mjs", "scripts/ops/prepare-discovery-assets.mjs", "wrangler.jsonc", "package.json", ...fs.readdirSync("workers/discovery-api", { withFileTypes: true }).filter(file => file.isFile()).map(file => "workers/discovery-api/" + file.name)];
const record = {
  preparedAt: new Date().toISOString(), snapshot,
  accountId: previous.accountId, worker: "roomza", apiWorker: "roomza-discovery-api",
  priorVersion: previous.result.version, priorDeployment: previous.result.deployment,
  sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, hash(file)])),
  verifiedApplicationSources: verifiedSources, preservedArtifactFiles: originalFiles.length - 1,
  appBundleHash: hash(path.join(snapshot, ".wrangler/worker-size/worker.js")),
  apiBundleHash: hash(path.join(snapshot, ".open-next/discovery-api/worker.mjs")),
  checks, deployed: false,
};
fs.writeFileSync(path.join(evidence, "release.json"), JSON.stringify(record, null, 2));
console.log(JSON.stringify({ snapshot, verifiedSources, preservedArtifactFiles: record.preservedArtifactFiles, checks }));
