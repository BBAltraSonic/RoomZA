import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";

const root = process.cwd();
const dir = path.join(root, "docs/discovery-location-deploy-20261008");
const manifest = path.join(dir, "release.json");
const prior = JSON.parse(fs.readFileSync("docs/shared-cards-deploy-20261008/release.json"));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const expected = [
  "src/app/offers/offers-discovery.tsx",
  "src/app/services/services-url-discovery.tsx",
  "src/features/discovery/url-controls.ts",
];
const added = [
  "src/features/discovery/use-discovery-search-params.ts",
  "src/features/discovery/use-discovery-search-params.test.tsx",
  "src/app/offers/offers-discovery.test.tsx",
];
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ["PATH", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMDATA"].includes(key.toUpperCase())));
Object.assign(env, { CI: "1", NEXT_TELEMETRY_DISABLED: "1", CLOUDFLARE_ACCOUNT_ID: prior.accountId });
let release;
const save = () => fs.writeFileSync(manifest, JSON.stringify(release, null, 2) + "\n");
function assertNoDrift() {
  const repairedFiles = new Set([...release.changedFiles, ...release.addedFiles]);
  const allDrift = Object.entries(release.sourceHashes).filter(([file, digest]) =>
    !fs.existsSync(file) || hash(fs.readFileSync(file)) !== digest).map(([file]) => file);
  const drift = allDrift.filter(file => repairedFiles.has(file));
  release.concurrentUnshippedChanges = allDrift.filter(file => !repairedFiles.has(file));
  save();
  if (drift.length) throw Error("Source drift: " + drift.join(", "));
  const snapshotDrift = Object.entries(release.sourceHashes).filter(([file, digest]) =>
    !file.startsWith(".env") && file !== "next.config.ts" && (!fs.existsSync(path.join(release.snapshot,file)) || hash(fs.readFileSync(path.join(release.snapshot,file))) !== digest)).map(([file]) => file);
  if (snapshotDrift.length) throw Error("Release snapshot drift: " + snapshotDrift.join(", "));
}
function linkTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if ([".cache", ".vite"].includes(entry.name)) continue;
    const source = path.join(from, entry.name), destination = path.join(to, entry.name);
    if (entry.isDirectory()) linkTree(source, destination);
    else if (entry.isSymbolicLink()) throw Error("Unexpected dependency symlink: " + source);
    else fs.linkSync(source, destination);
  }
}
async function run(name, command) {
  const start = Date.now(), log = fs.createWriteStream(path.join(dir, name + ".log"));
  const child = spawn(env.ComSpec ?? env.COMSPEC ?? "cmd.exe", ["/d", "/s", "/c", command], {
    cwd: release.snapshot, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject); child.on("close", resolve);
  });
  await new Promise(resolve => log.end(resolve));
  release.checks.push({ name, command, exitCode, seconds: (Date.now() - start) / 1000 });
  save(); console.log(name + ": " + exitCode);
  if (exitCode !== 0) throw Error(name + " failed; inspect retained log");
}
const mode = process.argv[2];
if (mode === "prepare") {
  const changes = Object.entries(prior.sourceHashes).filter(([file, digest]) =>
    !fs.existsSync(file) || hash(fs.readFileSync(file)) !== digest).map(([file]) => file);
  if (JSON.stringify(changes.sort()) !== JSON.stringify(expected.sort())) throw Error("Unexpected source drift: " + changes);
  const deployments = JSON.parse(fs.readFileSync(path.join(dir, "before-deployments.json")))
    .sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on));
  if (deployments[0].id !== prior.result.deployment) throw Error("Production deployment changed");
  const snapshot = path.join(tmpdir(), "pinpoint-discovery-location-release-" + randomUUID());
  fs.mkdirSync(snapshot);
  release = {
    startedAt: new Date().toISOString(), snapshot, worker: prior.worker, accountId: prior.accountId, origin: prior.origin,
    previousVersion: prior.result.version, previousDeployment: prior.result.deployment,
    changedFiles: changes, addedFiles: added, sourceHashes: {}, checks: [],
    inheritedValidation: { manifest: "docs/shared-cards-deploy-20261008/release.json", scope: "Unchanged source and locked dependencies from verified production release; current card checks rerun below" },
    serverSecretsProvided: false, browserAttempts: 0, databaseChanges: false,
  };
  for (const file of [...Object.keys(prior.sourceHashes), ...added]) {
    release.sourceHashes[file] = hash(fs.readFileSync(file));
    if (file.startsWith(".env")) continue;
    const destination = path.join(snapshot, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
  fs.copyFileSync(path.join(prior.snapshot, "next.config.ts"), path.join(snapshot, "next.config.ts"));
  fs.copyFileSync(path.join(prior.snapshot, ".env.production.local"), path.join(snapshot, ".env.production.local"));
  const publicInputs = fs.readFileSync(path.join(snapshot, ".env.production.local"), "utf8");
  if (publicInputs.split(/\r?\n/).some(line => line.trim() && !line.startsWith("NEXT_PUBLIC_"))) throw Error("Nonpublic build input");
  linkTree(path.join(prior.snapshot, "node_modules"), path.join(snapshot, "node_modules"));
  const nextVersion = JSON.parse(fs.readFileSync(path.join(snapshot, "node_modules/next/package.json"))).version;
  if (nextVersion !== "16.3.8") throw Error("Unexpected installed Next version");
  release.dependencies = "Hardlinks to unchanged verified production installation; generated caches excluded; Next.js " + nextVersion;
  save(); console.log(JSON.stringify({ snapshot, changes, added, nextVersion }));
} else {
  release = JSON.parse(fs.readFileSync(manifest));
  if (mode === "build") {
    env.NODE_OPTIONS = "--max-old-space-size=1536";
    await run("focused-tests", "npx vitest run src/features/discovery/use-discovery-search-params.test.tsx src/app/offers/offers-discovery.test.tsx src/features/discovery/url-controls.test.tsx src/features/discovery/cloudflare-discovery-assets.test.ts --maxWorkers=1");
    await run("lint", "npx eslint src/features/discovery/use-discovery-search-params.ts src/features/discovery/use-discovery-search-params.test.tsx src/features/discovery/url-controls.ts src/app/offers/offers-discovery.tsx src/app/offers/offers-discovery.test.tsx src/app/services/services-url-discovery.tsx");
    await run("typecheck", "npm run typecheck");
    await run("audit", "npm run audit:prod");
    await run("build", "npx opennextjs-cloudflare build");
    await run("discovery", "node scripts/ops/prepare-discovery-assets.mjs");
    await run("size", "npm run cf:check:size");
    release.workerSha256 = hash(fs.readFileSync(path.join(release.snapshot, ".wrangler/worker-size/worker.js")));
    release.readyAt = new Date().toISOString(); save();
  } else if (mode === "package") {
    assertNoDrift();
    release.failedBuildAttempts = [...(release.failedBuildAttempts ?? []), ...release.checks.filter(check => check.name === "build" && check.exitCode !== 0)];
    release.checks = release.checks.filter(check => !(check.name === "build" && check.exitCode !== 0));
    release.buildMemoryLimit = "NODE_OPTIONS=--max-old-space-size=1536; no cache deletion";
    env.NODE_OPTIONS = "--max-old-space-size=1536";
    save();
    await run("build", "npx opennextjs-cloudflare build");
    await run("discovery", "node scripts/ops/prepare-discovery-assets.mjs");
    await run("size", "npm run cf:check:size");
    release.workerSha256 = hash(fs.readFileSync(path.join(release.snapshot, ".wrangler/worker-size/worker.js")));
    release.readyAt = new Date().toISOString(); save();
  } else if (mode === "deploy") {
    if (!release.readyAt) throw Error("Build not ready");
    assertNoDrift();
    const command = path.join(root, "node_modules/wrangler/bin/wrangler.js");
    const deployments = JSON.parse(execFileSync(process.execPath, [command, "deployments", "list", "--json"], { cwd: root, env, windowsHide: true, encoding: "utf8" }))
      .sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on));
    if (deployments[0].id !== release.previousDeployment) throw Error("Production changed during build");
    await run("deploy", "npx opennextjs-cloudflare deploy -- --keep-vars --message discovery-location-repair-20261008");
  } else throw Error("Use prepare, build or deploy");
}

