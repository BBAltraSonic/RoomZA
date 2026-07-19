import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Initial client JavaScript budget check for the site root (`/`) route.
 *
 * Requirement 9.5 (discovery-page-experience): the initial client JavaScript
 * transferred for the site root route, measured AFTER compression, SHALL NOT
 * exceed 300 kilobytes.
 *
 * This complements `check-first-load-js-budget.mjs` (which enforces a coarse
 * uncompressed ceiling across every route). This check is narrower and stricter:
 * it targets only `/` and measures the gzip-compressed transfer size, matching
 * how Next.js reports "First Load JS" and how Cloudflare serves the assets.
 *
 * The compressed size is computed by gzipping each initial chunk individually
 * and summing the results — the same per-chunk model Next.js uses for its
 * First Load JS reporting.
 */

const DEFAULT_BUDGET_KB = 300;
const DEFAULT_ROUTE = "/";

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

function routeFromManifest(serverAppDir, filePath) {
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

function rootChunks(nextDir) {
  const buildManifestPath = path.join(nextDir, "build-manifest.json");
  if (!existsSync(buildManifestPath)) return [];
  const manifest = readJson(buildManifestPath);
  return (manifest.rootMainFiles ?? []).map(normalizeChunk).filter(Boolean);
}

/**
 * Resolve the set of initial client JS chunks for a single route: the shared
 * root main files plus the chunks referenced by that route's client-reference
 * manifest. Returns a de-duplicated, sorted list of chunk paths (relative to
 * `.next`, e.g. `static/chunks/main-abc.js`).
 */
export function collectRouteInitialChunks(nextDir, route = DEFAULT_ROUTE) {
  const serverAppDir = path.join(nextDir, "server", "app");
  const manifests = walk(
    serverAppDir,
    (filePath) =>
      filePath.endsWith("page_client-reference-manifest.js") ||
      filePath.endsWith("_global-error_client-reference-manifest.js"),
  );

  const manifestPath = manifests.find(
    (filePath) => routeFromManifest(serverAppDir, filePath) === route,
  );

  if (!manifestPath) {
    return null;
  }

  const chunks = new Set([
    ...rootChunks(nextDir),
    ...chunksFromClientReferenceManifest(manifestPath),
  ]);

  return [...chunks].sort();
}

/** Gzip-compressed byte length of a buffer. */
export function gzipSize(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

/**
 * Measure the compressed initial JS transfer size for a route by summing the
 * per-chunk gzip sizes. Missing chunk files contribute zero bytes.
 */
export function measureInitialJsBytes(nextDir, route = DEFAULT_ROUTE) {
  const chunks = collectRouteInitialChunks(nextDir, route);
  if (chunks === null) {
    return null;
  }

  let compressedBytes = 0;
  const perChunk = [];
  for (const chunk of chunks) {
    const filePath = path.join(nextDir, chunk.replaceAll("/", path.sep));
    if (!existsSync(filePath)) continue;
    const size = gzipSize(readFileSync(filePath));
    compressedBytes += size;
    perChunk.push({ chunk, compressedBytes: size });
  }

  return { compressedBytes, chunks: perChunk };
}

/**
 * Evaluate the initial-JS budget for a route. Returns a structured result
 * rather than throwing so it can be unit-tested; the CLI wrapper turns a
 * failing result into a non-zero exit.
 */
export function checkInitialJsBudget({
  nextDir,
  route = DEFAULT_ROUTE,
  budgetKb = DEFAULT_BUDGET_KB,
} = {}) {
  const measurement = measureInitialJsBytes(nextDir, route);
  if (measurement === null) {
    return {
      route,
      budgetKb,
      found: false,
      passed: false,
      compressedKb: null,
      chunks: [],
    };
  }

  const compressedKb = measurement.compressedBytes / 1024;
  return {
    route,
    budgetKb,
    found: true,
    passed: measurement.compressedBytes <= budgetKb * 1024,
    compressedKb,
    chunks: measurement.chunks,
  };
}

function runCli() {
  const root = process.cwd();
  const nextDir = path.join(root, ".next");
  const budgetKb = Number(process.env.INITIAL_JS_BUDGET_KB ?? DEFAULT_BUDGET_KB);
  const route = process.env.INITIAL_JS_BUDGET_ROUTE ?? DEFAULT_ROUTE;

  const result = checkInitialJsBudget({ nextDir, route, budgetKb });

  if (!result.found) {
    throw new Error(
      `No client reference manifest found for route "${route}" under .next/server/app. ` +
        `Run \`next build\` before this check.`,
    );
  }

  if (!result.passed) {
    throw new Error(
      `Initial client JS budget exceeded for "${route}" (compressed): ` +
        `${result.compressedKb.toFixed(1)} KB > ${budgetKb} KB budget.`,
    );
  }

  console.log(
    `Initial client JS budget passed for "${route}": ` +
      `${result.compressedKb.toFixed(1)} KB compressed (budget ${budgetKb} KB).`,
  );
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli();
}
