import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { minify } from "terser";

export const SERVER_HANDLER_RELATIVE_PATH = path.join(
  ".open-next",
  "server-functions",
  "default",
  "handler.mjs",
);

/**
 * Re-minify the OpenNext server handler in place so the Worker stays inside the
 * Cloudflare Workers Free compressed-script limit. Wrangler's own minification
 * leaves top-level names unmangled; this pass recovers that weight. Class names
 * are kept because error handling reads them (`constructor.name`, `err.name`).
 * Function names are shortened: Next.js and the app chunks already ship that way,
 * and keeping them cost about 50 KiB gzip, more than the headroom under the limit.
 * @param {{ handlerPath: string }} options
 * @returns {Promise<{ handlerPath: string; bytesBefore: number; bytesAfter: number }>}
 */
export async function minifyCloudflareServer({ handlerPath }) {
  if (!handlerPath || !existsSync(handlerPath)) {
    throw new Error(
      `OpenNext server handler not found at ${handlerPath}. ` +
        "Run `opennextjs-cloudflare build` before this step.",
    );
  }

  const source = readFileSync(handlerPath, "utf8");
  const result = await minify(source, {
    module: true,
    compress: { passes: 3 },
    mangle: { toplevel: true },
    keep_classnames: true,
    keep_fnames: false,
    format: { comments: false, max_line_len: 1000 },
  });

  if (!result.code) {
    throw new Error(`Minifier emitted no code for ${handlerPath}.`);
  }

  writeFileSync(handlerPath, result.code);
  return {
    handlerPath,
    bytesBefore: Buffer.byteLength(source),
    bytesAfter: Buffer.byteLength(result.code),
  };
}

function formatKib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function runCli() {
  const handlerPath = path.join(process.cwd(), SERVER_HANDLER_RELATIVE_PATH);
  const result = await minifyCloudflareServer({ handlerPath });
  console.log(
    `Minified the Cloudflare server handler: ${formatKib(result.bytesBefore)} -> ` +
      `${formatKib(result.bytesAfter)}.`,
  );
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runCli();
}
