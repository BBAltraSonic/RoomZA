import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { build } from "esbuild";

const output = path.resolve(process.argv[2] ?? ".cache/import-image-function-20261025");
assert.ok(output.startsWith(path.resolve(".cache") + path.sep));
fs.mkdirSync(output, { recursive: true });
const result = await build({ entryPoints: ["workers/import-images/index.ts"], bundle: true, platform: "neutral", format: "esm", target: "es2022", external: ["node:*"], outfile: path.join(output, "index.ts"), metafile: true, write: true });
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const inputs = Object.keys(result.metafile.inputs).map(file => ({ file, sha256: hash(file) }));
const bundle = fs.readFileSync(path.join(output, "index.ts"));
const report = { builtAt: new Date().toISOString(), project: "qleeedwnnfvmfjjymoco", name: "import-image", verifyJwt: true, output, bytes: bundle.length, sha256: hash(path.join(output, "index.ts")), inputs, dependencies: "Only existing Node builtins; no new npm dependency or plan upgrade.", auth: "Gateway JWT plus constant-time comparison with IMPORT_IMAGE_CALLER_SHA256, the hash of the app's existing service-role Authorization header; no browser/user access." };
fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ built: true, bytes: report.bytes, sha256: report.sha256, inputs: inputs.length, output }));
