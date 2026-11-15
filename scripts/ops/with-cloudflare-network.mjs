import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Node connection flags for Wrangler uploads on slow links. Node races each
 * resolved address with a 250 ms attempt timeout, so a TCP or TLS handshake to
 * Cloudflare's API that takes seconds fails as "fetch failed" before it can
 * finish. Using one IPv4 address gives each connection the full timeout.
 */
export const CLOUDFLARE_NETWORK_NODE_OPTIONS = [
  "--dns-result-order=ipv4first",
  "--no-network-family-autoselection",
];

/**
 * Append the connection flags to an existing NODE_OPTIONS value, leaving any
 * flag of the same name that the caller already set.
 * @param {string | undefined} existing
 */
export function withCloudflareNetworkNodeOptions(existing) {
  const current = (existing ?? "").split(/\s+/).filter(Boolean);
  const currentNames = new Set(current.map((option) => option.split("=")[0]));
  const missing = CLOUDFLARE_NETWORK_NODE_OPTIONS.filter(
    (option) => !currentNames.has(option.split("=")[0]),
  );
  return [...current, ...missing].join(" ");
}

/**
 * Join a command and its arguments for a shell, quoting arguments with spaces.
 * @param {string[]} parts
 */
export function toShellCommand(parts) {
  return parts.map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(" ");
}

function runCli() {
  const parts = process.argv.slice(2);
  if (parts.length === 0) {
    throw new Error("Usage: node scripts/ops/with-cloudflare-network.mjs <command> [args...]");
  }

  // A shell resolves package binaries such as `wrangler` on every platform.
  const result = spawnSync(toShellCommand(parts), {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: withCloudflareNetworkNodeOptions(process.env.NODE_OPTIONS),
    },
  });

  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli();
}
