import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextDir = path.join(root, ".next");
const serverAppDir = path.join(nextDir, "server", "app");
const budgetKb = Number(process.env.FIRST_LOAD_JS_BUDGET_KB ?? 1300);
const budgetBytes = budgetKb * 1024;

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function walk(dir, predicate, matches = []) {
  if (!existsSync(dir)) return matches;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, predicate, matches);
      continue;
    }
    if (predicate(entryPath)) {
      matches.push(entryPath);
    }
  }

  return matches;
}

function normalizeChunk(chunk) {
  if (!chunk.endsWith(".js")) return null;
  return chunk.startsWith("static/") ? chunk : `static/${chunk}`;
}

function chunkSize(chunk) {
  const relative = chunk.replaceAll("/", path.sep);
  const filePath = path.join(nextDir, relative);
  if (!existsSync(filePath)) return 0;
  return statSync(filePath).size;
}

function routeFromManifest(filePath) {
  const relative = path.relative(serverAppDir, filePath);
  const route = `/${relative
    .replace(/_client-reference-manifest\.js$/, "")
    .replaceAll(path.sep, "/")
    .replace(/\/page$/, "")}`.replace(/\/$/, "");
  return route === "/page" || route === "" ? "/" : route;
}

function chunksFromClientReferenceManifest(filePath) {
  const source = readFileSync(filePath, "utf8");
  const matches = source.matchAll(/"static\/chunks\/[^"]+\.js"/g);
  return [...matches].map((match) => match[0].slice(1, -1));
}

function rootChunks() {
  const buildManifestPath = path.join(nextDir, "build-manifest.json");
  if (!existsSync(buildManifestPath)) return [];
  const manifest = readJson(buildManifestPath);
  return (manifest.rootMainFiles ?? []).map(normalizeChunk).filter(Boolean);
}

const pageManifests = walk(
  serverAppDir,
  (filePath) => filePath.endsWith("page_client-reference-manifest.js") || filePath.endsWith("_global-error_client-reference-manifest.js"),
);

if (!pageManifests.length) {
  throw new Error("No App Router client reference manifests found under .next/server/app.");
}

const sharedChunks = rootChunks();
const failures = [];

for (const manifestPath of pageManifests) {
  const route = routeFromManifest(manifestPath);
  const chunks = new Set([...sharedChunks, ...chunksFromClientReferenceManifest(manifestPath)]);
  const totalBytes = [...chunks].reduce((total, chunk) => total + chunkSize(chunk), 0);
  const totalKb = totalBytes / 1024;

  if (totalBytes > budgetBytes) {
    failures.push({ route, totalKb });
  }
}

if (failures.length) {
  const details = failures
    .sort((a, b) => b.totalKb - a.totalKb)
    .map((failure) => `${failure.route}: ${failure.totalKb.toFixed(1)} KB`)
    .join("\n");
  throw new Error(`First-load client JS budget exceeded (${budgetKb} KB):\n${details}`);
}

console.log(`First-load client JS budget passed for ${pageManifests.length} route(s) at ${budgetKb} KB.`);
