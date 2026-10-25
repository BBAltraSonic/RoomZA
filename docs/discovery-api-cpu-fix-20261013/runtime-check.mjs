import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { parse } = require("dotenv");
const local = parse(fs.readFileSync(".env.local"));
const credentials = Object.fromEntries(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"].map(key => [key, local[key]]));
const { default: worker } = await import(pathToFileURL(path.resolve(".open-next/discovery-api/worker.mjs")));
const bbox = "9.280419982,-36.773241494,39.719580018,-19.956342787";
const origin = "https://roomza.pinpoint-roomza.workers.dev";
const results = [];
for (const [route, expected] of [
  ["/api/listings?bbox=" + bbox, 200],
  ["/api/listings?bbox=" + bbox + "&mode=buy", 200],
  ["/api/listings?bbox=invalid", 400],
  ...["shopping", "tourism", "event", "service"].map(category => ["/api/discovery/viewport?category=" + category + "&bbox=" + bbox, 200]),
  ["/api/saved-specials?stateOnly=1", 200],
  ["/api/favorites", 200],
  ["/api/notifications", 401],
]) {
  const start = Date.now();
  const input = new Request((process.env.DISCOVERY_LOCAL_ORIGIN ?? origin) + route, { headers: { authorization: "RoomzaInternal " + btoa(JSON.stringify(credentials)) } });
  const response = process.env.DISCOVERY_LOCAL_ORIGIN ? await fetch(input) : await worker.fetch(input);
  const data = await response.json();
  assert.equal(response.status, expected, route + ": " + JSON.stringify(data));
  assert.equal(response.headers.get("x-roomza-api"), "discovery-worker");
  assert(response.headers.get("x-request-id"));
  if (route.startsWith("/api/listings?") && expected === 200) assert.equal(data.ok, true);
  if (route.startsWith("/api/discovery/viewport?")) assert(Array.isArray(data.items));
  if (route.startsWith("/api/saved-specials")) assert.equal(data.authenticated, false);
  if (route === "/api/favorites") assert.equal(data.data.authenticated, false);
  results.push({ route, status: response.status, milliseconds: Date.now() - start,
    itemCount: data.items?.length ?? data.data?.listings?.length, cacheControl: response.headers.get("cache-control") });
}
const record = { verifiedAt: new Date().toISOString(), environment: process.env.DISCOVERY_LOCAL_ORIGIN ? "local workerd at app compatibility date 2026-05-26 against production read-only RPCs; no deployment or browser proof" : "compiled native Worker in Node against production read-only RPCs; no deployment or browser proof", checks: results };
fs.writeFileSync("docs/discovery-api-cpu-fix-20261013/" + (process.env.DISCOVERY_LOCAL_ORIGIN ? "workerd-check.json" : "runtime-check.json"), JSON.stringify(record, null, 2));
console.log(JSON.stringify({ checks: results.length, passed: true, statuses: results.map(value => value.status) }));
