import fs from "node:fs";
import path from "node:path";
// Only these cookie-free, prerendered public shells may bypass the Next server.
const routes = [["index", "index"], ["offers", "offers"], ["services", "services"]];
const output = ".open-next/assets/__discovery";
fs.mkdirSync(output, { recursive: true });
const prerender = JSON.parse(fs.readFileSync(".next/prerender-manifest.json", "utf8"));
for (const [source, name] of routes) {
  const route = source === "index" ? "/" : "/" + source;
  if (!prerender.routes[route]) throw new Error("Discovery must be prerendered: " + route);
  for (const extension of ["html", "rsc"]) {
    fs.copyFileSync(path.join(".next/server/app", source + "." + extension), path.join(output, name + "." + extension));
  }
}
const manifest = JSON.parse(fs.readFileSync(".next/routes-manifest.json", "utf8"));
const headers = manifest.headers.find(rule => rule.source === "/:path*")?.headers;
if (!headers?.some(header => header.key.toLowerCase() === "content-security-policy")) throw new Error("Security headers missing");
fs.mkdirSync(".open-next/discovery", { recursive: true });
fs.copyFileSync("cloudflare/discovery-worker.mjs", ".open-next/discovery/worker.js");
fs.copyFileSync("cloudflare/discovery-assets.mjs", ".open-next/discovery-assets.mjs");
fs.writeFileSync(".open-next/discovery-headers.mjs", "export default " + JSON.stringify(headers) + ";\n");
console.log("Prepared three cookie-free discovery HTML/RSC shells with production security headers.");
