import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";

const dir = "docs/discovery-api-cpu-fix-20261013", release = JSON.parse(fs.readFileSync(dir + "/release.json"));
const origin = "https://roomza.pinpoint-roomza.workers.dev";
const bbox = "9.280419982,-36.773241494,39.719580018,-19.956342787";
const checks = [], startedAt = new Date().toISOString();
for (const [route, expected] of [
  ["/api/listings?bbox=" + bbox, 200], ["/api/listings?bbox=" + bbox + "&mode=buy", 200],
  ["/api/listings?bbox=invalid", 400],
  ...["shopping", "tourism", "event", "service"].map(category => ["/api/discovery/viewport?category=" + category + "&bbox=" + bbox, 200]),
  ["/api/saved-specials?stateOnly=1", 200], ["/api/favorites", 200], ["/api/notifications", 401],
]) {
  const response = await fetch(origin + route, { headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(20000) });
  const text = await response.text();
  assert.equal(response.status, expected, route + ": " + text.slice(0,100));
  assert.equal(response.headers.get("x-roomza-api"), "discovery-worker", route);
  assert(response.headers.get("content-security-policy"), "Missing security headers");
  const data = JSON.parse(text);
  checks.push({ route, status: response.status, itemCount: data.items?.length ?? data.data?.listings?.length, marker: response.headers.get("x-roomza-api") });
}
const pages = [];
for (const route of ["/", "/offers", "/services"]) {
  const response = await fetch(origin + route, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-roomza-render"), "prerendered-discovery");
  assert.equal(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"), createHash("sha256").update(fs.readFileSync(path.join(release.snapshot, ".open-next/assets/__discovery", (route === "/" ? "index" : route.slice(1)) + ".html"))).digest("hex"));
  pages.push({ route, status: 200, assetHashMatched: true });
}
const record = { startedAt, completedAt: new Date().toISOString(), checks, pages, apiChecks: checks.length, publicAssetHashes: pages.length };
fs.writeFileSync(dir + "/live-check.json", JSON.stringify(record, null, 2));
console.log(JSON.stringify({ apiChecks: checks.length, publicAssetHashes: pages.length, passed: true, inventoryCounts: checks.filter(item => item.itemCount !== undefined).map(item => ({ route: item.route, count: item.itemCount })) }));
