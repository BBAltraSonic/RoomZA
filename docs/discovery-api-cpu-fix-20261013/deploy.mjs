import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = process.cwd(), dir = path.join(root, "docs/discovery-api-cpu-fix-20261013");
const manifest = path.join(dir, "release.json"), release = JSON.parse(fs.readFileSync(manifest));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: release.accountId, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: path.join(dir, "deploy.wrangler.log") };
function cli(args) {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { cwd: release.snapshot, env, windowsHide: true, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
for (const [file, expected] of Object.entries(release.sourceHashes)) assert.equal(hash(path.join(root, file)), expected, "Source drift: " + file);
assert.equal(hash(path.join(release.snapshot, ".wrangler/worker-size/worker.js")), release.appBundleHash);
assert.equal(hash(path.join(release.snapshot, ".open-next/discovery-api/worker.mjs")), release.apiBundleHash);
const before = JSON.parse(cli(["deployments", "list", "--name", "roomza", "--json"])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
assert.equal(before.versions[0].version_id, release.priorVersion, "Production changed before deployment");
release.authorizedAt = new Date().toISOString();
fs.writeFileSync(manifest, JSON.stringify(release, null, 2));
for (const [name, args] of [
  ["api-deploy", ["deploy", "--config", "workers/discovery-api/wrangler.jsonc", "--keep-vars", "--message=discovery-api-cpu-fix-20261013"]],
  ["app-deploy", ["deploy", "--keep-vars", "--message=discovery-api-cpu-fix-20261013"]],
]) {
  const output = cli(args);
  fs.writeFileSync(path.join(dir, name + ".log"), output);
  console.log(name + " completed");
}
for (const worker of ["roomza", "roomza-discovery-api"]) {
  const deployments = JSON.parse(cli(["deployments", "list", "--name", worker, "--json"])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on));
  release[worker === "roomza" ? "app" : "api"] = deployments[0];
}
release.deployed = true;
release.deployedAt = new Date().toISOString();
fs.writeFileSync(manifest, JSON.stringify(release, null, 2));
console.log(JSON.stringify({ app: release.app.versions, api: release.api.versions }));
