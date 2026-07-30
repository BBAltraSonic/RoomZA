import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const CLOUDFLARE_FREE_WORKER_SIZE_BYTES = 3 * 1024 * 1024;

/** Return the gzip-compressed byte length using the strongest zlib level. */
export function gzipSize(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

/**
 * Measure the Worker emitted by `wrangler deploy --dry-run` against the
 * Cloudflare Workers Free compressed-script limit.
 */
export function checkCloudflareWorkerSize({
  workerPath,
  budgetBytes = CLOUDFLARE_FREE_WORKER_SIZE_BYTES,
} = {}) {
  if (!workerPath || !existsSync(workerPath)) {
    return {
      workerPath,
      budgetBytes,
      found: false,
      passed: false,
      compressedBytes: null,
    };
  }

  const compressedBytes = gzipSize(readFileSync(workerPath));
  return {
    workerPath,
    budgetBytes,
    found: true,
    passed: compressedBytes <= budgetBytes,
    compressedBytes,
  };
}

function formatKib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function runCli() {
  const workerPath = path.join(process.cwd(), ".wrangler", "worker-size", "worker.js");
  const result = checkCloudflareWorkerSize({ workerPath });

  if (!result.found) {
    throw new Error(
      `Cloudflare Worker artifact not found at ${workerPath}. ` +
        "Run `wrangler deploy --dry-run --outdir .wrangler/worker-size` before this check.",
    );
  }

  if (!result.passed) {
    throw new Error(
      `Cloudflare Worker size budget exceeded: ${formatKib(result.compressedBytes)} gzip > ` +
        `${formatKib(result.budgetBytes)} free-plan limit. ` +
        "Remove server-side bundle weight or split functionality before deploying.",
    );
  }

  console.log(
    `Cloudflare Worker size budget passed: ${formatKib(result.compressedBytes)} gzip ` +
      `(limit ${formatKib(result.budgetBytes)}).`,
  );
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli();
}
