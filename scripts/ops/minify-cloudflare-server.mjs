import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "acorn";
import { minify } from "terser";

/**
 * Next.js modules OpenNext bundles that this app never runs on the Worker.
 * - jsonwebtoken only reads Pages Router preview-mode cookies, inside a
 *   try/catch that treats a failure as "no preview"; the app has no Pages routes.
 * - @mswjs/interceptors only loads when Next's experimental test proxy is on.
 * Their bodies become a throw, so requiring one fails loudly instead of quietly.
 */
export const UNUSED_NEXT_MODULES = [
  "next/dist/compiled/jsonwebtoken/",
  "next/dist/compiled/@mswjs/interceptors/",
];

function walk(node, visit) {
  if (!node || typeof node.type !== "string") return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const child of value) walk(child, visit);
    else if (value && typeof value.type === "string") walk(value, visit);
  }
}

/**
 * Replace the bodies of esbuild `__commonJS({ "path"(exports, module) {...} })`
 * wrappers whose path is in UNUSED_NEXT_MODULES.
 * @param {string} source
 * @returns {{ code: string; stubbedModules: string[] }}
 */
export function stubUnusedModules(source) {
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const edits = [];
  walk(ast, (node) => {
    if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
    if (!/^__commonJS\d*$/.test(node.callee.name)) return;
    const [wrapper] = node.arguments;
    if (wrapper?.type !== "ObjectExpression" || wrapper.properties.length !== 1) return;
    const [property] = wrapper.properties;
    const key = property.key?.value;
    if (typeof key !== "string" || property.value?.type !== "FunctionExpression") return;
    const match = UNUSED_NEXT_MODULES.find((prefix) => key.includes(`node_modules/${prefix}`));
    if (!match) return;
    const name = key.slice(key.indexOf(match));
    edits.push({ body: property.value.body, name });
  });
  let code = source;
  for (const { body } of [...edits].sort((a, b) => b.body.start - a.body.start)) {
    code = `${code.slice(0, body.start)}{ throw new Error("Not bundled in the Cloudflare Worker"); }${code.slice(body.end)}`;
  }
  return { code, stubbedModules: edits.map((edit) => edit.name) };
}

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
 * @returns {Promise<{ handlerPath: string; bytesBefore: number; bytesAfter: number; stubbedModules: string[] }>}
 */
export async function minifyCloudflareServer({ handlerPath }) {
  if (!handlerPath || !existsSync(handlerPath)) {
    throw new Error(
      `OpenNext server handler not found at ${handlerPath}. ` +
        "Run `opennextjs-cloudflare build` before this step.",
    );
  }

  const source = readFileSync(handlerPath, "utf8");
  const { code: stubbed, stubbedModules } = stubUnusedModules(source);
  const result = await minify(stubbed, {
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
    stubbedModules,
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
      `${formatKib(result.bytesAfter)}. Stubbed: ${result.stubbedModules.join(", ") || "none"}.`,
  );
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runCli();
}
