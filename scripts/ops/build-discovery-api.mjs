import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { parse } = require("dotenv");
// Explicit public production inputs; never inline server credentials.
const inputs = {
  ...(fs.existsSync(".env.production.local") ? parse(fs.readFileSync(".env.production.local")) : {}),
  ...Object.fromEntries(Object.entries(process.env).filter(([key, value]) => key.startsWith("NEXT_PUBLIC_") && value !== undefined)),
};
for (const key of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!inputs[key]) throw new Error("Missing public production input: " + key);
}
const define = Object.fromEntries(Object.entries(inputs).filter(([key]) => key.startsWith("NEXT_PUBLIC_")).map(([key, value]) => ["process.env." + key, JSON.stringify(value)]));
define["process.env.NODE_ENV"] = '"production"';
for (const key of ["SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
  define["process.env." + key] = "__discoverySecrets." + key;
}
await build({
  entryPoints: ["workers/discovery-api/worker.ts"], outfile: ".open-next/discovery-api/worker.mjs",
  bundle: true, minify: true, format: "esm", platform: "neutral", target: "es2022", conditions: ["workerd", "worker", "browser"],
  mainFields: ["module", "main"], external: ["node:*"], define,
  inject: ["workers/discovery-api/secrets.mjs"],
  alias: {
    "@/lib/supabase/server": path.resolve("workers/discovery-api/supabase-server.ts"),
    "@": path.resolve("src"), "server-only": path.resolve("src/test/server-only-stub.ts"),
    "next/server": path.resolve("workers/discovery-api/next-response.mjs"),
  },
  plugins: [{ name: "no-next-runtime", setup(builder) {
    builder.onResolve({ filter: /^next\// }, ({ path: importPath }) => {
      if (importPath !== "next/server") throw new Error("Unsupported Next API in discovery Worker: " + importPath);
    });
  } }],
});
console.log("Prepared read-only discovery API Worker from existing application handlers.");
