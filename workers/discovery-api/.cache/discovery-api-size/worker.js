var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../.open-next/discovery-api/worker.mjs
import { AsyncLocalStorage as Tm } from "node:async_hooks";
var sh = Object.create;
var Ks = Object.defineProperty;
var nh = Object.getOwnPropertyDescriptor;
var ih = Object.getOwnPropertyNames;
var ah = Object.getPrototypeOf;
var oh = Object.prototype.hasOwnProperty;
var Ws = /* @__PURE__ */ __name((e20, t) => () => {
  try {
    return t || e20((t = { exports: {} }).exports, t), t.exports;
  } catch (r) {
    throw t = 0, r;
  }
}, "Ws");
var ch = /* @__PURE__ */ __name((e20, t) => {
  for (var r in t) Ks(e20, r, { get: t[r], enumerable: true });
}, "ch");
var lh = /* @__PURE__ */ __name((e20, t, r, s) => {
  if (t && typeof t == "object" || typeof t == "function") for (let n of ih(t)) !oh.call(e20, n) && n !== r && Ks(e20, n, { get: /* @__PURE__ */ __name(() => t[n], "get"), enumerable: !(s = nh(t, n)) || s.enumerable });
  return e20;
}, "lh");
var Gs = /* @__PURE__ */ __name((e20, t, r) => (r = e20 != null ? sh(ah(e20)) : {}, lh(t || !e20 || !e20.__esModule ? Ks(r, "default", { value: e20, enumerable: true }) : r, e20)), "Gs");
var Ln = Ws((Oe) => {
  "use strict";
  Object.defineProperty(Oe, "__esModule", { value: true });
  Oe.parseCookie = Da;
  Oe.parse = Da;
  Oe.stringifyCookie = mm;
  Oe.stringifySetCookie = bs;
  Oe.serialize = bs;
  Oe.parseSetCookie = gm;
  Oe.stringifySetCookie = bs;
  Oe.serialize = bs;
  var ja = /^[\u0021-\u003A\u003C\u003E-\u007E]+$/, Ua = /^[\u0021-\u003A\u003C-\u007E]*$/, um = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i, dm = /^[\u0020-\u003A\u003D-\u007E]*$/, hm = /^-?\d+$/, pm = Object.prototype.toString, fm = (() => {
    let e20 = /* @__PURE__ */ __name(function() {
    }, "e");
    return e20.prototype = /* @__PURE__ */ Object.create(null), e20;
  })();
  function Da(e20, t) {
    let r = new fm(), s = e20.length;
    if (s < 2) return r;
    let n = t?.decode || $a, i = 0;
    do {
      let a = Pn(e20, i, s);
      if (a === -1) break;
      let o = In(e20, i, s);
      if (a > o) {
        i = e20.lastIndexOf(";", a - 1) + 1;
        continue;
      }
      let c = Ge(e20, i, a);
      r[c] === void 0 && (r[c] = n(Ge(e20, a + 1, o))), i = o + 1;
    } while (i < s);
    return r;
  }
  __name(Da, "Da");
  function mm(e20, t) {
    let r = t?.encode || encodeURIComponent, s = [];
    for (let n of Object.keys(e20)) {
      let i = e20[n];
      if (i === void 0) continue;
      if (!ja.test(n)) throw new TypeError(`cookie name is invalid: ${n}`);
      let a = r(i);
      if (!Ua.test(a)) throw new TypeError(`cookie val is invalid: ${i}`);
      s.push(`${n}=${a}`);
    }
    return s.join("; ");
  }
  __name(mm, "mm");
  function bs(e20, t, r) {
    let s = typeof e20 == "object" ? e20 : { ...r, name: e20, value: String(t) }, i = (typeof t == "object" ? t : r)?.encode || encodeURIComponent;
    if (!ja.test(s.name)) throw new TypeError(`argument name is invalid: ${s.name}`);
    let a = s.value ? i(s.value) : "";
    if (!Ua.test(a)) throw new TypeError(`argument val is invalid: ${s.value}`);
    let o = s.name + "=" + a;
    if (s.maxAge !== void 0) {
      if (!Number.isInteger(s.maxAge)) throw new TypeError(`option maxAge is invalid: ${s.maxAge}`);
      o += "; Max-Age=" + s.maxAge;
    }
    if (s.domain) {
      if (!um.test(s.domain)) throw new TypeError(`option domain is invalid: ${s.domain}`);
      o += "; Domain=" + s.domain;
    }
    if (s.path) {
      if (!dm.test(s.path)) throw new TypeError(`option path is invalid: ${s.path}`);
      o += "; Path=" + s.path;
    }
    if (s.expires) {
      if (!ym(s.expires) || !Number.isFinite(s.expires.valueOf())) throw new TypeError(`option expires is invalid: ${s.expires}`);
      o += "; Expires=" + s.expires.toUTCString();
    }
    if (s.httpOnly && (o += "; HttpOnly"), s.secure && (o += "; Secure"), s.partitioned && (o += "; Partitioned"), s.priority) switch (typeof s.priority == "string" ? s.priority.toLowerCase() : void 0) {
      case "low":
        o += "; Priority=Low";
        break;
      case "medium":
        o += "; Priority=Medium";
        break;
      case "high":
        o += "; Priority=High";
        break;
      default:
        throw new TypeError(`option priority is invalid: ${s.priority}`);
    }
    if (s.sameSite) switch (typeof s.sameSite == "string" ? s.sameSite.toLowerCase() : s.sameSite) {
      case true:
      case "strict":
        o += "; SameSite=Strict";
        break;
      case "lax":
        o += "; SameSite=Lax";
        break;
      case "none":
        o += "; SameSite=None";
        break;
      default:
        throw new TypeError(`option sameSite is invalid: ${s.sameSite}`);
    }
    return o;
  }
  __name(bs, "bs");
  function gm(e20, t) {
    let r = t?.decode || $a, s = e20.length, n = In(e20, 0, s), i = Pn(e20, 0, n), a = i === -1 ? { name: "", value: r(Ge(e20, 0, n)) } : { name: Ge(e20, 0, i), value: r(Ge(e20, i + 1, n)) }, o = n + 1;
    for (; o < s; ) {
      let c = In(e20, o, s), l = Pn(e20, o, c), u = l === -1 ? Ge(e20, o, c) : Ge(e20, o, l), d = l === -1 ? void 0 : Ge(e20, l + 1, c);
      switch (u.toLowerCase()) {
        case "httponly":
          a.httpOnly = true;
          break;
        case "secure":
          a.secure = true;
          break;
        case "partitioned":
          a.partitioned = true;
          break;
        case "domain":
          a.domain = d;
          break;
        case "path":
          a.path = d;
          break;
        case "max-age":
          d && hm.test(d) && (a.maxAge = Number(d));
          break;
        case "expires":
          if (!d) break;
          let f = new Date(d);
          Number.isFinite(f.valueOf()) && (a.expires = f);
          break;
        case "priority":
          if (!d) break;
          let p = d.toLowerCase();
          (p === "low" || p === "medium" || p === "high") && (a.priority = p);
          break;
        case "samesite":
          if (!d) break;
          let g = d.toLowerCase();
          (g === "lax" || g === "strict" || g === "none") && (a.sameSite = g);
          break;
      }
      o = c + 1;
    }
    return a;
  }
  __name(gm, "gm");
  function In(e20, t, r) {
    let s = e20.indexOf(";", t);
    return s === -1 ? r : s;
  }
  __name(In, "In");
  function Pn(e20, t, r) {
    let s = e20.indexOf("=", t);
    return s < r ? s : -1;
  }
  __name(Pn, "Pn");
  function Ge(e20, t, r) {
    let s = t, n = r;
    do {
      let i = e20.charCodeAt(s);
      if (i !== 32 && i !== 9) break;
    } while (++s < n);
    for (; n > s; ) {
      let i = e20.charCodeAt(n - 1);
      if (i !== 32 && i !== 9) break;
      n--;
    }
    return e20.slice(s, n);
  }
  __name(Ge, "Ge");
  function $a(e20) {
    if (e20.indexOf("%") === -1) return e20;
    try {
      return decodeURIComponent(e20);
    } catch {
      return e20;
    }
  }
  __name($a, "$a");
  function ym(e20) {
    return pm.call(e20) === "[object Date]";
  }
  __name(ym, "ym");
});
var io = Ws((nx, no) => {
  "use strict";
  var Hn = Object.defineProperty, Fm = Object.getOwnPropertyDescriptor, qm = Object.getOwnPropertyNames, zm = Object.prototype.hasOwnProperty, Vm = /* @__PURE__ */ __name((e20, t) => {
    for (var r in t) Hn(e20, r, { get: t[r], enumerable: true });
  }, "Vm"), Hm = /* @__PURE__ */ __name((e20, t, r, s) => {
    if (t && typeof t == "object" || typeof t == "function") for (let n of qm(t)) !zm.call(e20, n) && n !== r && Hn(e20, n, { get: /* @__PURE__ */ __name(() => t[n], "get"), enumerable: !(s = Fm(t, n)) || s.enumerable });
    return e20;
  }, "Hm"), Km = /* @__PURE__ */ __name((e20) => Hm(Hn({}, "__esModule", { value: true }), e20), "Km"), so = {};
  Vm(so, { Analytics: /* @__PURE__ */ __name(() => Jm, "Analytics") });
  no.exports = Km(so);
  var ro = `
local key = KEYS[1]
local field = ARGV[1]

local data = redis.call("ZRANGE", key, 0, -1, "WITHSCORES")
local count = {}

for i = 1, #data, 2 do
  local json_str = data[i]
  local score = tonumber(data[i + 1])
  local obj = cjson.decode(json_str)

  local fieldValue = obj[field]

  if count[fieldValue] == nil then
    count[fieldValue] = score
  else
    count[fieldValue] = count[fieldValue] + score
  end
end

local result = {}
for k, v in pairs(count) do
  table.insert(result, {k, v})
end

return result
`, Wm = `
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1]) -- First timestamp to check
local increment = tonumber(ARGV[2])       -- Increment between each timestamp
local num_timestamps = tonumber(ARGV[3])  -- Number of timestampts to check (24 for a day and 24 * 7 for a week)
local num_elements = tonumber(ARGV[4])    -- Number of elements to fetch in each category
local check_at_most = tonumber(ARGV[5])   -- Number of elements to check at most.

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

-- select num_elements many items
local true_group = {}
local false_group = {}
local denied_group = {}
local true_count = 0
local false_count = 0
local denied_count = 0
local i = #result - 1

-- index to stop at after going through "checkAtMost" many items:
local cutoff_index = #result - 2 * check_at_most

-- iterate over the results
while (true_count + false_count + denied_count) < (num_elements * 3) and 1 <= i and i >= cutoff_index do
  local score = tonumber(result[i + 1])
  if score > 0 then
    local element = result[i]
    if string.find(element, "success\\":true") and true_count < num_elements then
      table.insert(true_group, {score, element})
      true_count = true_count + 1
    elseif string.find(element, "success\\":false") and false_count < num_elements then
      table.insert(false_group, {score, element})
      false_count = false_count + 1
    elseif string.find(element, "success\\":\\"denied") and denied_count < num_elements then
      table.insert(denied_group, {score, element})
      denied_count = denied_count + 1
    end
  end
  i = i - 2
end

return {true_group, false_group, denied_group}
`, Gm = `
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])
local num_timestamps = tonumber(ARGV[3])

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

return result
`, Jm = class {
    static {
      __name(this, "Jm");
    }
    redis;
    prefix;
    bucketSize;
    constructor(e20) {
      this.redis = e20.redis, this.prefix = e20.prefix ?? "@upstash/analytics", this.bucketSize = this.parseWindow(e20.window);
    }
    validateTableName(e20) {
      if (!/^[a-zA-Z0-9_-]+$/.test(e20)) throw new Error(`Invalid table name: ${e20}. Table names can only contain letters, numbers, dashes and underscores.`);
    }
    parseWindow(e20) {
      if (typeof e20 == "number") {
        if (e20 <= 0) throw new Error(`Invalid window: ${e20}`);
        return e20;
      }
      let t = /^(\d+)([smhd])$/;
      if (!t.test(e20)) throw new Error(`Invalid window: ${e20}`);
      let [, r, s] = e20.match(t), n = parseInt(r);
      switch (s) {
        case "s":
          return n * 1e3;
        case "m":
          return n * 1e3 * 60;
        case "h":
          return n * 1e3 * 60 * 60;
        case "d":
          return n * 1e3 * 60 * 60 * 24;
        default:
          throw new Error(`Invalid window unit: ${s}`);
      }
    }
    getBucket(e20) {
      let t = e20 ?? Date.now();
      return Math.floor(t / this.bucketSize) * this.bucketSize;
    }
    async ingest(e20, ...t) {
      this.validateTableName(e20), await Promise.all(t.map(async (r) => {
        let s = this.getBucket(r.time), n = [this.prefix, e20, s].join(":");
        await this.redis.zincrby(n, 1, JSON.stringify({ ...r, time: void 0 }));
      }));
    }
    formatBucketAggregate(e20, t, r) {
      let s = {};
      return e20.forEach(([n, i]) => {
        t == "success" && (n = n === 1 ? "true" : n === null ? "false" : n), s[t] = s[t] || {}, s[t][(n ?? "null").toString()] = i;
      }), { time: r, ...s };
    }
    async aggregateBucket(e20, t, r) {
      this.validateTableName(e20);
      let s = this.getBucket(r), n = [this.prefix, e20, s].join(":"), i = await this.redis.eval(ro, [n], [t]);
      return this.formatBucketAggregate(i, t, s);
    }
    async aggregateBuckets(e20, t, r, s) {
      this.validateTableName(e20);
      let n = this.getBucket(s), i = [];
      for (let a = 0; a < r; a += 1) i.push(this.aggregateBucket(e20, t, n)), n = n - this.bucketSize;
      return Promise.all(i);
    }
    async aggregateBucketsWithPipeline(e20, t, r, s, n) {
      this.validateTableName(e20), n = n ?? 48;
      let i = this.getBucket(s), a = [], o = this.redis.pipeline(), c = [];
      for (let l = 1; l <= r; l += 1) {
        let u = [this.prefix, e20, i].join(":");
        o.eval(ro, [u], [t]), a.push(i), i = i - this.bucketSize, (l % n == 0 || l == r) && (c.push(o.exec()), o = this.redis.pipeline());
      }
      return (await Promise.all(c)).flat().map((l, u) => this.formatBucketAggregate(l, t, a[u]));
    }
    async getAllowedBlocked(e20, t, r) {
      this.validateTableName(e20);
      let s = [this.prefix, e20].join(":"), n = this.getBucket(r), i = await this.redis.eval(Gm, [s], [n, this.bucketSize, t]), a = {};
      for (let o = 0; o < i.length; o += 2) {
        let c = i[o], l = c.identifier, u = +i[o + 1];
        a[l] || (a[l] = { success: 0, blocked: 0 }), a[l][c.success ? "success" : "blocked"] = u;
      }
      return a;
    }
    async getMostAllowedBlocked(e20, t, r, s, n) {
      this.validateTableName(e20);
      let i = [this.prefix, e20].join(":"), a = this.getBucket(s), o = n ?? r * 5, [c, l, u] = await this.redis.eval(Wm, [i], [a, this.bucketSize, t, r, o]);
      return { allowed: this.toDicts(c), ratelimited: this.toDicts(l), denied: this.toDicts(u) };
    }
    toDicts(e20) {
      let t = [];
      for (let r = 0; r < e20.length; r += 1) {
        let s = +e20[r][0], n = e20[r][1];
        t.push({ identifier: n.identifier, count: s });
      }
      return t;
    }
  };
});
var _o = Ws((ax, vo) => {
  "use strict";
  var Kn = Object.defineProperty, Xm = Object.getOwnPropertyDescriptor, Ym = Object.getOwnPropertyNames, Zm = Object.prototype.hasOwnProperty, co = /* @__PURE__ */ __name((e20, t) => {
    for (var r in t) Kn(e20, r, { get: t[r], enumerable: true });
  }, "co"), Qm = /* @__PURE__ */ __name((e20, t, r, s) => {
    if (t && typeof t == "object" || typeof t == "function") for (let n of Ym(t)) !Zm.call(e20, n) && n !== r && Kn(e20, n, { get: /* @__PURE__ */ __name(() => t[n], "get"), enumerable: !(s = Xm(t, n)) || s.enumerable });
    return e20;
  }, "Qm"), eg = /* @__PURE__ */ __name((e20) => Qm(Kn({}, "__esModule", { value: true }), e20), "eg"), lo = {};
  co(lo, { Analytics: /* @__PURE__ */ __name(() => uo, "Analytics"), IpDenyList: /* @__PURE__ */ __name(() => fo, "IpDenyList"), MultiRegionRatelimit: /* @__PURE__ */ __name(() => Tg, "MultiRegionRatelimit"), Ratelimit: /* @__PURE__ */ __name(() => Ag, "Ratelimit") });
  vo.exports = eg(lo);
  var tg = io(), uo = class {
    static {
      __name(this, "uo");
    }
    analytics;
    table = "events";
    constructor(e20) {
      this.analytics = new tg.Analytics({ redis: e20.redis, window: "1h", prefix: e20.prefix ?? "@upstash/ratelimit", retention: "90d" });
    }
    extractGeo(e20) {
      return e20.geo !== void 0 ? e20.geo : e20.cf !== void 0 ? e20.cf : {};
    }
    async record(e20) {
      await this.analytics.ingest(this.table, e20);
    }
    async series(e20, t) {
      let r = Math.min((this.analytics.getBucket(Date.now()) - this.analytics.getBucket(t)) / 36e5, 256);
      return this.analytics.aggregateBucketsWithPipeline(this.table, e20, r);
    }
    async getUsage(e20 = 0) {
      let t = Math.min((this.analytics.getBucket(Date.now()) - this.analytics.getBucket(e20)) / 36e5, 256);
      return await this.analytics.getAllowedBlocked(this.table, t);
    }
    async getUsageOverTime(e20, t) {
      return await this.analytics.aggregateBucketsWithPipeline(this.table, t, e20);
    }
    async getMostAllowedBlocked(e20, t, r) {
      return t = t ?? 5, this.analytics.getMostAllowedBlocked(this.table, e20, t, void 0, r);
    }
  }, Cs = class {
    static {
      __name(this, "Cs");
    }
    cache;
    constructor(e20) {
      this.cache = e20;
    }
    isBlocked(e20) {
      if (!this.cache.has(e20)) return { blocked: false, reset: 0 };
      let t = this.cache.get(e20);
      return t < Date.now() ? (this.cache.delete(e20), { blocked: false, reset: 0 }) : { blocked: true, reset: t };
    }
    blockUntil(e20, t) {
      this.cache.set(e20, t);
    }
    set(e20, t) {
      this.cache.set(e20, t);
    }
    get(e20) {
      return this.cache.get(e20) || null;
    }
    incr(e20, t = 1) {
      let r = this.cache.get(e20) ?? 0;
      return r += t, this.cache.set(e20, r), r;
    }
    pop(e20) {
      this.cache.delete(e20);
    }
    empty() {
      this.cache.clear();
    }
    size() {
      return this.cache.size;
    }
  }, Ze = ":dynamic:global", Wn = "@upstash/ratelimit";
  function Ct(e20) {
    let t = e20.match(/^(\d+)\s?(ms|s|m|h|d)$/);
    if (!t) throw new Error(`Unable to parse window size: ${e20}`);
    let r = Number.parseInt(t[1]);
    switch (t[2]) {
      case "ms":
        return r;
      case "s":
        return r * 1e3;
      case "m":
        return r * 1e3 * 60;
      case "h":
        return r * 1e3 * 60 * 60;
      case "d":
        return r * 1e3 * 60 * 60 * 24;
      default:
        throw new Error(`Unable to parse window size: ${e20}`);
    }
  }
  __name(Ct, "Ct");
  var V = /* @__PURE__ */ __name(async (e20, t, r, s) => {
    try {
      return await e20.redis.evalsha(t.hash, r, s);
    } catch (n) {
      if (`${n}`.includes("NOSCRIPT")) return await e20.redis.eval(t.script, r, s);
      throw n;
    }
  }, "V"), rg = `
  local key           = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens        = tonumber(ARGV[1])  -- default limit
  local window        = ARGV[2]
  local incrementBy   = ARGV[3] -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return {r, effectiveLimit}
`, sg = `
  local key = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens = tonumber(ARGV[1])  -- default limit

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local value = redis.call('GET', key)
  local usedTokens = 0
  if value then
    usedTokens = tonumber(value)
  end
  
  return {effectiveLimit - usedTokens, effectiveLimit}
`, ng = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = tonumber(ARGV[4]) -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  -- Only check limit if not refunding (negative rate)
  if incrementBy > 0 and requestsInPreviousWindow + requestsInCurrentWindow >= effectiveLimit then
    return {-1, effectiveLimit}
  end

  local newValue = redis.call("INCRBY", currentKey, incrementBy)
  if newValue == incrementBy then
    -- The first time this key is set, the value will be equal to incrementBy.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return {effectiveLimit - ( newValue + requestsInPreviousWindow ), effectiveLimit}
`, ig = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end

  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  local usedTokens = requestsInPreviousWindow + requestsInCurrentWindow
  return {effectiveLimit - usedTokens, effectiveLimit}
`, ag = `
  local key         = KEYS[1]           -- identifier including prefixes
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = effectiveLimit
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(effectiveLimit, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  -- Only reject if tokens are 0 and we're consuming (not refunding)
  if tokens == 0 and incrementBy > 0 then
    return {-1, refilledAt + interval, effectiveLimit}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((effectiveLimit - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)

  if (expireAt > 0) then
    redis.call("PEXPIRE", key, expireAt)
  end
  return {remaining, refilledAt + interval, effectiveLimit}
`, ho = -1, og = `
  local key         = KEYS[1]
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {effectiveLimit, ${ho}, effectiveLimit}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1]), effectiveLimit}
`, cg = `
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`, lg = `
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`, ug = `
	local key           = KEYS[1]
	local id            = ARGV[1]
	local window        = ARGV[2]
	local incrementBy   = tonumber(ARGV[3])

	redis.call("HSET", key, id, incrementBy)
	local fields = redis.call("HGETALL", key)
	if #fields == 2 and tonumber(fields[2])==incrementBy then
	-- The first time this key is set, and the value will be equal to incrementBy.
	-- So we only need the expire command once
	  redis.call("PEXPIRE", key, window)
	end

	return fields
`, dg = `
      local key = KEYS[1]
      local tokens = 0

      local fields = redis.call("HGETALL", key)

      return fields
    `, hg = `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local tokens        = tonumber(ARGV[1]) -- tokens per window
	local now           = ARGV[2]           -- current timestamp in milliseconds
	local window        = ARGV[3]           -- interval in milliseconds
	local requestId     = ARGV[4]           -- uuid for this request
	local incrementBy   = tonumber(ARGV[5]) -- custom rate, default is  1

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window

	-- Only check limit if not refunding (negative rate)
	if incrementBy > 0 and requestsInPreviousWindow * (1 - percentageInCurrent ) + requestsInCurrentWindow + incrementBy > tokens then
	  return {currentFields, previousFields, false}
	end

	redis.call("HSET", currentKey, requestId, incrementBy)

	if requestsInCurrentWindow == 0 then 
	  -- The first time this key is set, the value will be equal to incrementBy.
	  -- So we only need the expire command once
	  redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
	end
	return {currentFields, previousFields, true}
`, pg = `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local now         	= ARGV[1]           -- current timestamp in milliseconds
  	local window      	= ARGV[2]           -- interval in milliseconds

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
  	requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
	
	return requestsInCurrentWindow + requestsInPreviousWindow
`, fg = `
      local pattern = KEYS[1]

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
          redis.call('DEL', keys[i])
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `, ie = { singleRegion: { fixedWindow: { limit: { script: rg, hash: "472e55443b62f60d0991028456c57815a387066d" }, getRemaining: { script: sg, hash: "40515c9dd0a08f8584f5f9b593935f6a87c1c1c3" } }, slidingWindow: { limit: { script: ng, hash: "977fb636fb5ceb7e98a96d1b3a1272ba018efdae" }, getRemaining: { script: ig, hash: "ee3a3265fad822f83acad23f8a1e2f5c0b156b03" } }, tokenBucket: { limit: { script: ag, hash: "b35c5bc0b7fdae7dd0573d4529911cabaf9d1d89" }, getRemaining: { script: og, hash: "deb03663e8af5a968deee895dd081be553d2611b" } }, cachedFixedWindow: { limit: { script: cg, hash: "c26b12703dd137939b9a69a3a9b18e906a2d940f" }, getRemaining: { script: lg, hash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a" } } }, multiRegion: { fixedWindow: { limit: { script: ug, hash: "a8c14f3835aa87bd70e5e2116081b81664abcf5c" }, getRemaining: { script: dg, hash: "8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd" } }, slidingWindow: { limit: { script: hg, hash: "1e7ca8dcd2d600a6d0124a67a57ea225ed62921b" }, getRemaining: { script: pg, hash: "558c9306b7ec54abb50747fe0b17e5d44bd24868" } } } }, Qt = { script: fg, hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50" }, $r = "denyList", po = "ipDenyList", Gn = "ipDenyListStatus", mg = `
  -- Checks if values provideed in ARGV are present in the deny lists.
  -- This is done using the allDenyListsKey below.

  -- Additionally, checks the status of the ip deny list using the
  -- ipDenyListStatusKey below. Here are the possible states of the
  -- ipDenyListStatusKey key:
  -- * status == -1: set to "disabled" with no TTL
  -- * status == -2: not set, meaning that is was set before but expired
  -- * status  >  0: set to "valid", with a TTL
  --
  -- In the case of status == -2, we set the status to "pending" with
  -- 30 second ttl. During this time, the process which got status == -2
  -- will update the ip deny list.

  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`, fo = {};
  co(fo, { ThresholdError: /* @__PURE__ */ __name(() => go, "ThresholdError"), disableIpDenyList: /* @__PURE__ */ __name(() => _g, "disableIpDenyList"), updateIpDenyList: /* @__PURE__ */ __name(() => yo, "updateIpDenyList") });
  var mo = 3600 * 1e3, ao = 24 * mo, gg = 2 * mo, yg = /* @__PURE__ */ __name((e20) => {
    let r = ((e20 || Date.now()) - gg) % ao;
    return ao - r;
  }, "yg"), wg = "https://raw.githubusercontent.com/stamparm/ipsum/master/levels", go = class extends Error {
    static {
      __name(this, "go");
    }
    constructor(e20) {
      super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${e20}`), this.name = "ThresholdError";
    }
  }, vg = /* @__PURE__ */ __name(async (e20) => {
    if (typeof e20 != "number" || e20 < 1 || e20 > 8) throw new go(e20);
    try {
      let t = await fetch(`${wg}/${e20}.txt`);
      if (!t.ok) throw new Error(`Error fetching data: ${t.statusText}`);
      return (await t.text()).split(`
`).filter((n) => n.length > 0);
    } catch (t) {
      throw new Error(`Failed to fetch ip deny list: ${t}`);
    }
  }, "vg"), yo = /* @__PURE__ */ __name(async (e20, t, r, s) => {
    let n = await vg(r), i = [t, $r, "all"].join(":"), a = [t, $r, po].join(":"), o = [t, Gn].join(":"), c = e20.multi();
    return c.sdiffstore(i, i, a), c.del(a), c.sadd(a, n.at(0), ...n.slice(1)), c.sdiffstore(a, a, i), c.sunionstore(i, i, a), c.set(o, "valid", { px: s ?? yg() }), await c.exec();
  }, "yo"), _g = /* @__PURE__ */ __name(async (e20, t) => {
    let r = [t, $r, "all"].join(":"), s = [t, $r, po].join(":"), n = [t, Gn].join(":"), i = e20.multi();
    return i.sdiffstore(r, r, s), i.del(s), i.set(n, "disabled"), await i.exec();
  }, "_g"), Rs = new Cs(/* @__PURE__ */ new Map()), bg = /* @__PURE__ */ __name((e20) => e20.find((t) => Rs.isBlocked(t).blocked), "bg"), xg = /* @__PURE__ */ __name((e20) => {
    Rs.size() > 1e3 && Rs.empty(), Rs.blockUntil(e20, Date.now() + 6e4);
  }, "xg"), Sg = /* @__PURE__ */ __name(async (e20, t, r) => {
    let [s, n] = await e20.eval(mg, [[t, $r, "all"].join(":"), [t, Gn].join(":")], r), i;
    return s.map((a, o) => {
      a && (xg(r[o]), i = r[o]);
    }), { deniedValue: i, invalidIpDenyList: n === -2 };
  }, "Sg"), Eg = /* @__PURE__ */ __name((e20, t, [r, s], n) => {
    if (s.deniedValue && (r.success = false, r.remaining = 0, r.reason = "denyList", r.deniedValue = s.deniedValue), s.invalidIpDenyList) {
      let i = yo(e20, t, n);
      r.pending = Promise.all([r.pending, i]);
    }
    return r;
  }, "Eg"), kg = /* @__PURE__ */ __name((e20) => ({ success: false, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve(), reason: "denyList", deniedValue: e20 }), "kg"), wo = class {
    static {
      __name(this, "wo");
    }
    limiter;
    ctx;
    prefix;
    timeout;
    primaryRedis;
    analytics;
    enableProtection;
    denyListThreshold;
    dynamicLimits;
    constructor(e20) {
      this.ctx = e20.ctx, this.limiter = e20.limiter, this.timeout = e20.timeout ?? 5e3, this.prefix = e20.prefix ?? Wn, this.dynamicLimits = e20.dynamicLimits ?? false, this.enableProtection = e20.enableProtection ?? false, this.denyListThreshold = e20.denyListThreshold ?? 6, this.primaryRedis = "redis" in this.ctx ? this.ctx.redis : this.ctx.regionContexts[0].redis, "redis" in this.ctx && (this.ctx.dynamicLimits = this.dynamicLimits, this.ctx.prefix = this.prefix), this.analytics = e20.analytics ? new uo({ redis: this.primaryRedis, prefix: this.prefix }) : void 0, e20.ephemeralCache instanceof Map ? this.ctx.cache = new Cs(e20.ephemeralCache) : e20.ephemeralCache === void 0 && (this.ctx.cache = new Cs(/* @__PURE__ */ new Map()));
    }
    limit = /* @__PURE__ */ __name(async (e20, t) => {
      let r = null;
      try {
        let s = this.getRatelimitResponse(e20, t), { responseArray: n, newTimeoutId: i } = this.applyTimeout(s);
        r = i;
        let a = await Promise.race(n);
        return this.submitAnalytics(a, e20, t);
      } finally {
        r && clearTimeout(r);
      }
    }, "limit");
    blockUntilReady = /* @__PURE__ */ __name(async (e20, t) => {
      if (t <= 0) throw new Error("timeout must be positive");
      let r, s = Date.now() + t;
      for (; r = await this.limit(e20), !r.success; ) {
        if (r.reset === 0) throw new Error("This should not happen");
        let n = Math.min(r.reset, s) - Date.now();
        if (await new Promise((i) => setTimeout(i, n)), Date.now() > s) break;
      }
      return r;
    }, "blockUntilReady");
    resetUsedTokens = /* @__PURE__ */ __name(async (e20) => {
      let t = [this.prefix, e20].join(":");
      await this.limiter().resetTokens(this.ctx, t);
    }, "resetUsedTokens");
    getRemaining = /* @__PURE__ */ __name(async (e20) => {
      let t = [this.prefix, e20].join(":");
      return await this.limiter().getRemaining(this.ctx, t);
    }, "getRemaining");
    getRatelimitResponse = /* @__PURE__ */ __name(async (e20, t) => {
      let r = this.getKey(e20), s = this.getDefinedMembers(e20, t), n = bg(s), i = n ? [kg(n), { deniedValue: n, invalidIpDenyList: false }] : await Promise.all([this.limiter().limit(this.ctx, r, t?.rate), this.enableProtection ? Sg(this.primaryRedis, this.prefix, s) : { deniedValue: void 0, invalidIpDenyList: false }]);
      return Eg(this.primaryRedis, this.prefix, i, this.denyListThreshold);
    }, "getRatelimitResponse");
    applyTimeout = /* @__PURE__ */ __name((e20) => {
      let t = null, r = [e20];
      if (this.timeout > 0) {
        let s = new Promise((n) => {
          t = setTimeout(() => {
            n({ success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve(), reason: "timeout" });
          }, this.timeout);
        });
        r.push(s);
      }
      return { responseArray: r, newTimeoutId: t };
    }, "applyTimeout");
    submitAnalytics = /* @__PURE__ */ __name((e20, t, r) => {
      if (this.analytics) try {
        let s = r ? this.analytics.extractGeo(r) : void 0, n = this.analytics.record({ identifier: e20.reason === "denyList" ? e20.deniedValue : t, time: Date.now(), success: e20.reason === "denyList" ? "denied" : e20.success, ...s }).catch((i) => {
          let a = "Failed to record analytics";
          `${i}`.includes("WRONGTYPE") && (a = `
    Failed to record analytics. See the information below:

    This can occur when you uprade to Ratelimit version 1.1.2
    or later from an earlier version.

    This occurs simply because the way we store analytics data
    has changed. To avoid getting this error, disable analytics
    for *an hour*, then simply enable it back.

    `), console.warn(a, i);
        });
        e20.pending = Promise.all([e20.pending, n]);
      } catch (s) {
        console.warn("Failed to record analytics", s);
      }
      return e20;
    }, "submitAnalytics");
    getKey = /* @__PURE__ */ __name((e20) => [this.prefix, e20].join(":"), "getKey");
    getDefinedMembers = /* @__PURE__ */ __name((e20, t) => [e20, t?.ip, t?.userAgent, t?.country].filter(Boolean), "getDefinedMembers");
    setDynamicLimit = /* @__PURE__ */ __name(async (e20) => {
      if (!this.dynamicLimits) throw new Error("dynamicLimits must be enabled in the Ratelimit constructor to use setDynamicLimit()");
      let t = `${this.prefix}${Ze}`;
      await (e20.limit === false ? this.primaryRedis.del(t) : this.primaryRedis.set(t, e20.limit));
    }, "setDynamicLimit");
    getDynamicLimit = /* @__PURE__ */ __name(async () => {
      if (!this.dynamicLimits) throw new Error("dynamicLimits must be enabled in the Ratelimit constructor to use getDynamicLimit()");
      let e20 = `${this.prefix}${Ze}`, t = await this.primaryRedis.get(e20);
      return { dynamicLimit: t === null ? null : Number(t) };
    }, "getDynamicLimit");
  };
  function oo() {
    let e20 = "", t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", r = t.length;
    for (let s = 0; s < 16; s++) e20 += t.charAt(Math.floor(Math.random() * r));
    return e20;
  }
  __name(oo, "oo");
  var Tg = class extends wo {
    static {
      __name(this, "Tg");
    }
    constructor(e20) {
      super({ prefix: e20.prefix, limiter: e20.limiter, timeout: e20.timeout, analytics: e20.analytics, dynamicLimits: e20.dynamicLimits, ctx: { regionContexts: e20.redis.map((t) => ({ redis: t, prefix: e20.prefix ?? Wn })), cache: e20.ephemeralCache ? new Cs(e20.ephemeralCache) : void 0 } }), e20.dynamicLimits && console.warn("Warning: Dynamic limits are not yet supported for multi-region rate limiters. The dynamicLimits option will be ignored.");
    }
    static fixedWindow(e20, t) {
      let r = Ct(t);
      return () => ({ async limit(s, n, i) {
        let a = oo(), o = Math.floor(Date.now() / r), c = [n, o].join(":"), l = i ?? 1;
        if (s.cache && l > 0) {
          let { blocked: v, reset: b } = s.cache.isBlocked(n);
          if (v) return { success: false, limit: e20, remaining: 0, reset: b, pending: Promise.resolve(), reason: "cacheBlock" };
        }
        let u = s.regionContexts.map((v) => ({ redis: v.redis, request: V(v, ie.multiRegion.fixedWindow.limit, [c], [a, r, l]) })), f = (await Promise.any(u.map((v) => v.request))).reduce((v, b, _) => {
          let O = 0;
          return _ % 2 && (O = Number.parseInt(b)), v + O;
        }, 0), p = e20 - f;
        async function g() {
          let v = await Promise.all(u.map((_) => _.request)), b = [...new Set(v.flat().reduce((_, O, U) => (U % 2 === 0 && _.push(O), _), [])).values()];
          for (let _ of u) {
            let U = (await _.request).reduce((B, H, he) => {
              let G = 0;
              return he % 2 && (G = Number.parseInt(H)), B + G;
            }, 0), $ = (await _.request).reduce((B, H, he) => (he % 2 === 0 && B.push(H), B), []);
            if (U >= e20) continue;
            let Be = b.filter((B) => !$.includes(B));
            if (Be.length !== 0) for (let B of Be) await _.redis.hset(c, { [B]: l });
          }
        }
        __name(g, "g");
        let y = p >= 0, E = (o + 1) * r;
        return s.cache && (y ? l < 0 && s.cache.pop(n) : s.cache.blockUntil(n, E)), { success: y, limit: e20, remaining: p, reset: E, pending: g() };
      }, async getRemaining(s, n) {
        let i = Math.floor(Date.now() / r), a = [n, i].join(":"), o = s.regionContexts.map((u) => ({ redis: u.redis, request: V(u, ie.multiRegion.fixedWindow.getRemaining, [a], [null]) })), l = (await Promise.any(o.map((u) => u.request))).reduce((u, d, f) => {
          let p = 0;
          return f % 2 && (p = Number.parseInt(d)), u + p;
        }, 0);
        return { remaining: Math.max(0, e20 - l), reset: (i + 1) * r, limit: e20 };
      }, async resetTokens(s, n) {
        let i = [n, "*"].join(":");
        s.cache && s.cache.pop(n), await Promise.all(s.regionContexts.map((a) => {
          V(a, Qt, [i], [null]);
        }));
      } });
    }
    static slidingWindow(e20, t) {
      let r = Ct(t), s = Ct(t);
      return () => ({ async limit(n, i, a) {
        let o = oo(), c = Date.now(), l = Math.floor(c / r), u = [i, l].join(":"), d = l - 1, f = [i, d].join(":"), p = a ?? 1;
        if (n.cache && p > 0) {
          let { blocked: H, reset: he } = n.cache.isBlocked(i);
          if (H) return { success: false, limit: e20, remaining: 0, reset: he, pending: Promise.resolve(), reason: "cacheBlock" };
        }
        let g = n.regionContexts.map((H) => ({ redis: H.redis, request: V(H, ie.multiRegion.slidingWindow.limit, [u, f], [e20, c, s, o, p]) })), y = c % s / s, [E, v, b] = await Promise.any(g.map((H) => H.request));
        b && E.push(o, p.toString());
        let _ = v.reduce((H, he, G) => {
          let we = 0;
          return G % 2 && (we = Number.parseInt(he)), H + we;
        }, 0), O = E.reduce((H, he, G) => {
          let we = 0;
          return G % 2 && (we = Number.parseInt(he)), H + we;
        }, 0), N = Math.ceil(_ * (1 - y)) + O, $ = e20 - N;
        async function Be() {
          let H = await Promise.all(g.map((G) => G.request)), he = [...new Set(H.flatMap(([G]) => G).reduce((G, we, ui) => (ui % 2 === 0 && G.push(we), G), [])).values()];
          for (let G of g) {
            let [we, ui, My] = await G.request, rh = we.reduce((Me, Vs, Hs) => (Hs % 2 === 0 && Me.push(Vs), Me), []);
            if (we.reduce((Me, Vs, Hs) => {
              let hi = 0;
              return Hs % 2 && (hi = Number.parseInt(Vs)), Me + hi;
            }, 0) >= e20) continue;
            let di = he.filter((Me) => !rh.includes(Me));
            if (di.length !== 0) for (let Me of di) await G.redis.hset(u, { [Me]: p });
          }
        }
        __name(Be, "Be");
        let B = (l + 1) * s;
        return n.cache && (b ? p < 0 && n.cache.pop(i) : n.cache.blockUntil(i, B)), { success: !!b, limit: e20, remaining: Math.max(0, $), reset: B, pending: Be() };
      }, async getRemaining(n, i) {
        let a = Date.now(), o = Math.floor(a / r), c = [i, o].join(":"), l = o - 1, u = [i, l].join(":"), d = n.regionContexts.map((p) => ({ redis: p.redis, request: V(p, ie.multiRegion.slidingWindow.getRemaining, [c, u], [a, r]) })), f = await Promise.any(d.map((p) => p.request));
        return { remaining: Math.max(0, e20 - f), reset: (o + 1) * r, limit: e20 };
      }, async resetTokens(n, i) {
        let a = [i, "*"].join(":");
        n.cache && n.cache.pop(i), await Promise.all(n.regionContexts.map((o) => {
          V(o, Qt, [a], [null]);
        }));
      } });
    }
  }, Ag = class extends wo {
    static {
      __name(this, "Ag");
    }
    constructor(e20) {
      super({ prefix: e20.prefix, limiter: e20.limiter, timeout: e20.timeout, analytics: e20.analytics, ctx: { redis: e20.redis, prefix: e20.prefix ?? Wn }, ephemeralCache: e20.ephemeralCache, enableProtection: e20.enableProtection, denyListThreshold: e20.denyListThreshold, dynamicLimits: e20.dynamicLimits });
    }
    static fixedWindow(e20, t) {
      let r = Ct(t);
      return () => ({ async limit(s, n, i) {
        let a = Math.floor(Date.now() / r), o = [n, a].join(":"), c = i ?? 1;
        if (s.cache && c > 0) {
          let { blocked: y, reset: E } = s.cache.isBlocked(n);
          if (y) return { success: false, limit: e20, remaining: 0, reset: E, pending: Promise.resolve(), reason: "cacheBlock" };
        }
        let l = s.dynamicLimits ? `${s.prefix}${Ze}` : "", [u, d] = await V(s, ie.singleRegion.fixedWindow.limit, [o, l], [e20, r, c]), f = u <= d, p = Math.max(0, d - u), g = (a + 1) * r;
        return s.cache && (f ? c < 0 && s.cache.pop(n) : s.cache.blockUntil(n, g)), { success: f, limit: d, remaining: p, reset: g, pending: Promise.resolve() };
      }, async getRemaining(s, n) {
        let i = Math.floor(Date.now() / r), a = [n, i].join(":"), o = s.dynamicLimits ? `${s.prefix}${Ze}` : "", [c, l] = await V(s, ie.singleRegion.fixedWindow.getRemaining, [a, o], [e20]);
        return { remaining: Math.max(0, c), reset: (i + 1) * r, limit: l };
      }, async resetTokens(s, n) {
        let i = [n, "*"].join(":");
        s.cache && s.cache.pop(n), await V(s, Qt, [i], [null]);
      } });
    }
    static slidingWindow(e20, t) {
      let r = Ct(t);
      return () => ({ async limit(s, n, i) {
        let a = Date.now(), o = Math.floor(a / r), c = [n, o].join(":"), l = o - 1, u = [n, l].join(":"), d = i ?? 1;
        if (s.cache && d > 0) {
          let { blocked: v, reset: b } = s.cache.isBlocked(n);
          if (v) return { success: false, limit: e20, remaining: 0, reset: b, pending: Promise.resolve(), reason: "cacheBlock" };
        }
        let f = s.dynamicLimits ? `${s.prefix}${Ze}` : "", [p, g] = await V(s, ie.singleRegion.slidingWindow.limit, [c, u, f], [e20, a, r, d]), y = p >= 0, E = (o + 1) * r;
        return s.cache && (y ? d < 0 && s.cache.pop(n) : s.cache.blockUntil(n, E)), { success: y, limit: g, remaining: Math.max(0, p), reset: E, pending: Promise.resolve() };
      }, async getRemaining(s, n) {
        let i = Date.now(), a = Math.floor(i / r), o = [n, a].join(":"), c = a - 1, l = [n, c].join(":"), u = s.dynamicLimits ? `${s.prefix}${Ze}` : "", [d, f] = await V(s, ie.singleRegion.slidingWindow.getRemaining, [o, l, u], [e20, i, r]);
        return { remaining: Math.max(0, d), reset: (a + 1) * r, limit: f };
      }, async resetTokens(s, n) {
        let i = [n, "*"].join(":");
        s.cache && s.cache.pop(n), await V(s, Qt, [i], [null]);
      } });
    }
    static tokenBucket(e20, t, r) {
      let s = Ct(t);
      return () => ({ async limit(n, i, a) {
        let o = Date.now(), c = a ?? 1;
        if (n.cache && c > 0) {
          let { blocked: g, reset: y } = n.cache.isBlocked(i);
          if (g) return { success: false, limit: r, remaining: 0, reset: y, pending: Promise.resolve(), reason: "cacheBlock" };
        }
        let l = n.dynamicLimits ? `${n.prefix}${Ze}` : "", [u, d, f] = await V(n, ie.singleRegion.tokenBucket.limit, [i, l], [r, s, e20, o, c]), p = u >= 0;
        return n.cache && (p ? c < 0 && n.cache.pop(i) : n.cache.blockUntil(i, d)), { success: p, limit: f, remaining: Math.max(0, u), reset: d, pending: Promise.resolve() };
      }, async getRemaining(n, i) {
        let a = n.dynamicLimits ? `${n.prefix}${Ze}` : "", [o, c, l] = await V(n, ie.singleRegion.tokenBucket.getRemaining, [i, a], [r]), u = Date.now() + s, d = c + s;
        return { remaining: Math.max(0, o), reset: c === ho ? u : d, limit: l };
      }, async resetTokens(n, i) {
        let a = i;
        n.cache && n.cache.pop(i), await V(n, Qt, [a], [null]);
      } });
    }
    static cachedFixedWindow(e20, t) {
      let r = Ct(t);
      return () => ({ async limit(s, n, i) {
        if (!s.cache) throw new Error("This algorithm requires a cache");
        s.dynamicLimits && console.warn("Warning: Dynamic limits are not yet supported for cachedFixedWindow algorithm. The dynamicLimits option will be ignored.");
        let a = Math.floor(Date.now() / r), o = [n, a].join(":"), c = (a + 1) * r, l = i ?? 1;
        if (typeof s.cache.get(o) == "number") {
          let p = s.cache.incr(o, l), g = p < e20, y = g ? V(s, ie.singleRegion.cachedFixedWindow.limit, [o], [r, l]) : Promise.resolve();
          return { success: g, limit: e20, remaining: e20 - p, reset: c, pending: y };
        }
        let d = await V(s, ie.singleRegion.cachedFixedWindow.limit, [o], [r, l]);
        s.cache.set(o, d);
        let f = e20 - d;
        return { success: f >= 0, limit: e20, remaining: f, reset: c, pending: Promise.resolve() };
      }, async getRemaining(s, n) {
        if (!s.cache) throw new Error("This algorithm requires a cache");
        let i = Math.floor(Date.now() / r), a = [n, i].join(":");
        if (typeof s.cache.get(a) == "number") {
          let l = s.cache.get(a) ?? 0;
          return { remaining: Math.max(0, e20 - l), reset: (i + 1) * r, limit: e20 };
        }
        let c = await V(s, ie.singleRegion.cachedFixedWindow.getRemaining, [a], [null]);
        return { remaining: Math.max(0, e20 - c), reset: (i + 1) * r, limit: e20 };
      }, async resetTokens(s, n) {
        if (!s.cache) throw new Error("This algorithm requires a cache");
        let i = Math.floor(Date.now() / r), a = [n, i].join(":");
        s.cache.pop(a);
        let o = [n, "*"].join(":");
        await V(s, Qt, [o], [null]);
      } });
    }
  };
});
var h = {};
ch(h, { BRAND: /* @__PURE__ */ __name(() => jh, "BRAND"), DIRTY: /* @__PURE__ */ __name(() => tt, "DIRTY"), EMPTY_PATH: /* @__PURE__ */ __name(() => ph, "EMPTY_PATH"), INVALID: /* @__PURE__ */ __name(() => R, "INVALID"), NEVER: /* @__PURE__ */ __name(() => vp, "NEVER"), OK: /* @__PURE__ */ __name(() => J, "OK"), ParseStatus: /* @__PURE__ */ __name(() => W, "ParseStatus"), Schema: /* @__PURE__ */ __name(() => L, "Schema"), ZodAny: /* @__PURE__ */ __name(() => ze, "ZodAny"), ZodArray: /* @__PURE__ */ __name(() => Ne, "ZodArray"), ZodBigInt: /* @__PURE__ */ __name(() => st, "ZodBigInt"), ZodBoolean: /* @__PURE__ */ __name(() => nt, "ZodBoolean"), ZodBranded: /* @__PURE__ */ __name(() => ir, "ZodBranded"), ZodCatch: /* @__PURE__ */ __name(() => mt, "ZodCatch"), ZodDate: /* @__PURE__ */ __name(() => it, "ZodDate"), ZodDefault: /* @__PURE__ */ __name(() => ft, "ZodDefault"), ZodDiscriminatedUnion: /* @__PURE__ */ __name(() => Vr, "ZodDiscriminatedUnion"), ZodEffects: /* @__PURE__ */ __name(() => le, "ZodEffects"), ZodEnum: /* @__PURE__ */ __name(() => ht, "ZodEnum"), ZodError: /* @__PURE__ */ __name(() => Y, "ZodError"), ZodFirstPartyTypeKind: /* @__PURE__ */ __name(() => I, "ZodFirstPartyTypeKind"), ZodFunction: /* @__PURE__ */ __name(() => Kr, "ZodFunction"), ZodIntersection: /* @__PURE__ */ __name(() => lt, "ZodIntersection"), ZodIssueCode: /* @__PURE__ */ __name(() => w, "ZodIssueCode"), ZodLazy: /* @__PURE__ */ __name(() => ut, "ZodLazy"), ZodLiteral: /* @__PURE__ */ __name(() => dt, "ZodLiteral"), ZodMap: /* @__PURE__ */ __name(() => Ut, "ZodMap"), ZodNaN: /* @__PURE__ */ __name(() => $t, "ZodNaN"), ZodNativeEnum: /* @__PURE__ */ __name(() => pt, "ZodNativeEnum"), ZodNever: /* @__PURE__ */ __name(() => pe, "ZodNever"), ZodNull: /* @__PURE__ */ __name(() => ot, "ZodNull"), ZodNullable: /* @__PURE__ */ __name(() => be, "ZodNullable"), ZodNumber: /* @__PURE__ */ __name(() => rt, "ZodNumber"), ZodObject: /* @__PURE__ */ __name(() => Z, "ZodObject"), ZodOptional: /* @__PURE__ */ __name(() => oe, "ZodOptional"), ZodParsedType: /* @__PURE__ */ __name(() => k, "ZodParsedType"), ZodPipeline: /* @__PURE__ */ __name(() => ar, "ZodPipeline"), ZodPromise: /* @__PURE__ */ __name(() => Ve, "ZodPromise"), ZodReadonly: /* @__PURE__ */ __name(() => gt, "ZodReadonly"), ZodRecord: /* @__PURE__ */ __name(() => Hr, "ZodRecord"), ZodSchema: /* @__PURE__ */ __name(() => L, "ZodSchema"), ZodSet: /* @__PURE__ */ __name(() => Dt, "ZodSet"), ZodString: /* @__PURE__ */ __name(() => qe, "ZodString"), ZodSymbol: /* @__PURE__ */ __name(() => Nt, "ZodSymbol"), ZodTransformer: /* @__PURE__ */ __name(() => le, "ZodTransformer"), ZodTuple: /* @__PURE__ */ __name(() => _e, "ZodTuple"), ZodType: /* @__PURE__ */ __name(() => L, "ZodType"), ZodUndefined: /* @__PURE__ */ __name(() => at, "ZodUndefined"), ZodUnion: /* @__PURE__ */ __name(() => ct, "ZodUnion"), ZodUnknown: /* @__PURE__ */ __name(() => Le, "ZodUnknown"), ZodVoid: /* @__PURE__ */ __name(() => jt, "ZodVoid"), addIssueToContext: /* @__PURE__ */ __name(() => S, "addIssueToContext"), any: /* @__PURE__ */ __name(() => Vh, "any"), array: /* @__PURE__ */ __name(() => Gh, "array"), bigint: /* @__PURE__ */ __name(() => Bh, "bigint"), boolean: /* @__PURE__ */ __name(() => Si, "boolean"), coerce: /* @__PURE__ */ __name(() => wp, "coerce"), custom: /* @__PURE__ */ __name(() => _i, "custom"), date: /* @__PURE__ */ __name(() => Mh, "date"), datetimeRegex: /* @__PURE__ */ __name(() => wi, "datetimeRegex"), defaultErrorMap: /* @__PURE__ */ __name(() => Ie, "defaultErrorMap"), discriminatedUnion: /* @__PURE__ */ __name(() => Zh, "discriminatedUnion"), effect: /* @__PURE__ */ __name(() => up, "effect"), enum: /* @__PURE__ */ __name(() => op, "enum"), function: /* @__PURE__ */ __name(() => np, "function"), getErrorMap: /* @__PURE__ */ __name(() => It, "getErrorMap"), getParsedType: /* @__PURE__ */ __name(() => ve, "getParsedType"), instanceof: /* @__PURE__ */ __name(() => Dh, "instanceof"), intersection: /* @__PURE__ */ __name(() => Qh, "intersection"), isAborted: /* @__PURE__ */ __name(() => qr, "isAborted"), isAsync: /* @__PURE__ */ __name(() => Pt, "isAsync"), isDirty: /* @__PURE__ */ __name(() => zr, "isDirty"), isValid: /* @__PURE__ */ __name(() => Fe, "isValid"), late: /* @__PURE__ */ __name(() => Uh, "late"), lazy: /* @__PURE__ */ __name(() => ip, "lazy"), literal: /* @__PURE__ */ __name(() => ap, "literal"), makeIssue: /* @__PURE__ */ __name(() => nr, "makeIssue"), map: /* @__PURE__ */ __name(() => rp, "map"), nan: /* @__PURE__ */ __name(() => $h, "nan"), nativeEnum: /* @__PURE__ */ __name(() => cp, "nativeEnum"), never: /* @__PURE__ */ __name(() => Kh, "never"), null: /* @__PURE__ */ __name(() => zh, "null"), nullable: /* @__PURE__ */ __name(() => hp, "nullable"), number: /* @__PURE__ */ __name(() => xi, "number"), object: /* @__PURE__ */ __name(() => Jh, "object"), objectUtil: /* @__PURE__ */ __name(() => Js, "objectUtil"), oboolean: /* @__PURE__ */ __name(() => yp, "oboolean"), onumber: /* @__PURE__ */ __name(() => gp, "onumber"), optional: /* @__PURE__ */ __name(() => dp, "optional"), ostring: /* @__PURE__ */ __name(() => mp, "ostring"), pipeline: /* @__PURE__ */ __name(() => fp, "pipeline"), preprocess: /* @__PURE__ */ __name(() => pp, "preprocess"), promise: /* @__PURE__ */ __name(() => lp, "promise"), quotelessJson: /* @__PURE__ */ __name(() => uh, "quotelessJson"), record: /* @__PURE__ */ __name(() => tp, "record"), set: /* @__PURE__ */ __name(() => sp, "set"), setErrorMap: /* @__PURE__ */ __name(() => hh, "setErrorMap"), strictObject: /* @__PURE__ */ __name(() => Xh, "strictObject"), string: /* @__PURE__ */ __name(() => bi, "string"), symbol: /* @__PURE__ */ __name(() => Fh, "symbol"), transformer: /* @__PURE__ */ __name(() => up, "transformer"), tuple: /* @__PURE__ */ __name(() => ep, "tuple"), undefined: /* @__PURE__ */ __name(() => qh, "undefined"), union: /* @__PURE__ */ __name(() => Yh, "union"), unknown: /* @__PURE__ */ __name(() => Hh, "unknown"), util: /* @__PURE__ */ __name(() => j, "util"), void: /* @__PURE__ */ __name(() => Wh, "void") });
var j;
(function(e20) {
  e20.assertEqual = (n) => {
  };
  function t(n) {
  }
  __name(t, "t");
  e20.assertIs = t;
  function r(n) {
    throw new Error();
  }
  __name(r, "r");
  e20.assertNever = r, e20.arrayToEnum = (n) => {
    let i = {};
    for (let a of n) i[a] = a;
    return i;
  }, e20.getValidEnumValues = (n) => {
    let i = e20.objectKeys(n).filter((o) => typeof n[n[o]] != "number"), a = {};
    for (let o of i) a[o] = n[o];
    return e20.objectValues(a);
  }, e20.objectValues = (n) => e20.objectKeys(n).map(function(i) {
    return n[i];
  }), e20.objectKeys = typeof Object.keys == "function" ? (n) => Object.keys(n) : (n) => {
    let i = [];
    for (let a in n) Object.prototype.hasOwnProperty.call(n, a) && i.push(a);
    return i;
  }, e20.find = (n, i) => {
    for (let a of n) if (i(a)) return a;
  }, e20.isInteger = typeof Number.isInteger == "function" ? (n) => Number.isInteger(n) : (n) => typeof n == "number" && Number.isFinite(n) && Math.floor(n) === n;
  function s(n, i = " | ") {
    return n.map((a) => typeof a == "string" ? `'${a}'` : a).join(i);
  }
  __name(s, "s");
  e20.joinValues = s, e20.jsonStringifyReplacer = (n, i) => typeof i == "bigint" ? i.toString() : i;
})(j || (j = {}));
var Js;
(function(e20) {
  e20.mergeShapes = (t, r) => ({ ...t, ...r });
})(Js || (Js = {}));
var k = j.arrayToEnum(["string", "nan", "number", "integer", "float", "boolean", "date", "bigint", "symbol", "function", "undefined", "null", "array", "object", "unknown", "promise", "void", "never", "map", "set"]);
var ve = /* @__PURE__ */ __name((e20) => {
  switch (typeof e20) {
    case "undefined":
      return k.undefined;
    case "string":
      return k.string;
    case "number":
      return Number.isNaN(e20) ? k.nan : k.number;
    case "boolean":
      return k.boolean;
    case "function":
      return k.function;
    case "bigint":
      return k.bigint;
    case "symbol":
      return k.symbol;
    case "object":
      return Array.isArray(e20) ? k.array : e20 === null ? k.null : e20.then && typeof e20.then == "function" && e20.catch && typeof e20.catch == "function" ? k.promise : typeof Map < "u" && e20 instanceof Map ? k.map : typeof Set < "u" && e20 instanceof Set ? k.set : typeof Date < "u" && e20 instanceof Date ? k.date : k.object;
    default:
      return k.unknown;
  }
}, "ve");
var w = j.arrayToEnum(["invalid_type", "invalid_literal", "custom", "invalid_union", "invalid_union_discriminator", "invalid_enum_value", "unrecognized_keys", "invalid_arguments", "invalid_return_type", "invalid_date", "invalid_string", "too_small", "too_big", "invalid_intersection_types", "not_multiple_of", "not_finite"]);
var uh = /* @__PURE__ */ __name((e20) => JSON.stringify(e20, null, 2).replace(/"([^"]+)":/g, "$1:"), "uh");
var Y = class e extends Error {
  static {
    __name(this, "e");
  }
  get errors() {
    return this.issues;
  }
  constructor(t) {
    super(), this.issues = [], this.addIssue = (s) => {
      this.issues = [...this.issues, s];
    }, this.addIssues = (s = []) => {
      this.issues = [...this.issues, ...s];
    };
    let r = new.target.prototype;
    Object.setPrototypeOf ? Object.setPrototypeOf(this, r) : this.__proto__ = r, this.name = "ZodError", this.issues = t;
  }
  format(t) {
    let r = t || function(i) {
      return i.message;
    }, s = { _errors: [] }, n = /* @__PURE__ */ __name((i) => {
      for (let a of i.issues) if (a.code === "invalid_union") a.unionErrors.map(n);
      else if (a.code === "invalid_return_type") n(a.returnTypeError);
      else if (a.code === "invalid_arguments") n(a.argumentsError);
      else if (a.path.length === 0) s._errors.push(r(a));
      else {
        let o = s, c = 0;
        for (; c < a.path.length; ) {
          let l = a.path[c];
          c === a.path.length - 1 ? (o[l] = o[l] || { _errors: [] }, o[l]._errors.push(r(a))) : o[l] = o[l] || { _errors: [] }, o = o[l], c++;
        }
      }
    }, "n");
    return n(this), s;
  }
  static assert(t) {
    if (!(t instanceof e)) throw new Error(`Not a ZodError: ${t}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, j.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(t = (r) => r.message) {
    let r = {}, s = [];
    for (let n of this.issues) if (n.path.length > 0) {
      let i = n.path[0];
      r[i] = r[i] || [], r[i].push(t(n));
    } else s.push(t(n));
    return { formErrors: s, fieldErrors: r };
  }
  get formErrors() {
    return this.flatten();
  }
};
Y.create = (e20) => new Y(e20);
var dh = /* @__PURE__ */ __name((e20, t) => {
  let r;
  switch (e20.code) {
    case w.invalid_type:
      e20.received === k.undefined ? r = "Required" : r = `Expected ${e20.expected}, received ${e20.received}`;
      break;
    case w.invalid_literal:
      r = `Invalid literal value, expected ${JSON.stringify(e20.expected, j.jsonStringifyReplacer)}`;
      break;
    case w.unrecognized_keys:
      r = `Unrecognized key(s) in object: ${j.joinValues(e20.keys, ", ")}`;
      break;
    case w.invalid_union:
      r = "Invalid input";
      break;
    case w.invalid_union_discriminator:
      r = `Invalid discriminator value. Expected ${j.joinValues(e20.options)}`;
      break;
    case w.invalid_enum_value:
      r = `Invalid enum value. Expected ${j.joinValues(e20.options)}, received '${e20.received}'`;
      break;
    case w.invalid_arguments:
      r = "Invalid function arguments";
      break;
    case w.invalid_return_type:
      r = "Invalid function return type";
      break;
    case w.invalid_date:
      r = "Invalid date";
      break;
    case w.invalid_string:
      typeof e20.validation == "object" ? "includes" in e20.validation ? (r = `Invalid input: must include "${e20.validation.includes}"`, typeof e20.validation.position == "number" && (r = `${r} at one or more positions greater than or equal to ${e20.validation.position}`)) : "startsWith" in e20.validation ? r = `Invalid input: must start with "${e20.validation.startsWith}"` : "endsWith" in e20.validation ? r = `Invalid input: must end with "${e20.validation.endsWith}"` : j.assertNever(e20.validation) : e20.validation !== "regex" ? r = `Invalid ${e20.validation}` : r = "Invalid";
      break;
    case w.too_small:
      e20.type === "array" ? r = `Array must contain ${e20.exact ? "exactly" : e20.inclusive ? "at least" : "more than"} ${e20.minimum} element(s)` : e20.type === "string" ? r = `String must contain ${e20.exact ? "exactly" : e20.inclusive ? "at least" : "over"} ${e20.minimum} character(s)` : e20.type === "number" ? r = `Number must be ${e20.exact ? "exactly equal to " : e20.inclusive ? "greater than or equal to " : "greater than "}${e20.minimum}` : e20.type === "bigint" ? r = `Number must be ${e20.exact ? "exactly equal to " : e20.inclusive ? "greater than or equal to " : "greater than "}${e20.minimum}` : e20.type === "date" ? r = `Date must be ${e20.exact ? "exactly equal to " : e20.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number(e20.minimum))}` : r = "Invalid input";
      break;
    case w.too_big:
      e20.type === "array" ? r = `Array must contain ${e20.exact ? "exactly" : e20.inclusive ? "at most" : "less than"} ${e20.maximum} element(s)` : e20.type === "string" ? r = `String must contain ${e20.exact ? "exactly" : e20.inclusive ? "at most" : "under"} ${e20.maximum} character(s)` : e20.type === "number" ? r = `Number must be ${e20.exact ? "exactly" : e20.inclusive ? "less than or equal to" : "less than"} ${e20.maximum}` : e20.type === "bigint" ? r = `BigInt must be ${e20.exact ? "exactly" : e20.inclusive ? "less than or equal to" : "less than"} ${e20.maximum}` : e20.type === "date" ? r = `Date must be ${e20.exact ? "exactly" : e20.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number(e20.maximum))}` : r = "Invalid input";
      break;
    case w.custom:
      r = "Invalid input";
      break;
    case w.invalid_intersection_types:
      r = "Intersection results could not be merged";
      break;
    case w.not_multiple_of:
      r = `Number must be a multiple of ${e20.multipleOf}`;
      break;
    case w.not_finite:
      r = "Number must be finite";
      break;
    default:
      r = t.defaultError, j.assertNever(e20);
  }
  return { message: r };
}, "dh");
var Ie = dh;
var pi = Ie;
function hh(e20) {
  pi = e20;
}
__name(hh, "hh");
function It() {
  return pi;
}
__name(It, "It");
var nr = /* @__PURE__ */ __name((e20) => {
  let { data: t, path: r, errorMaps: s, issueData: n } = e20, i = [...r, ...n.path || []], a = { ...n, path: i };
  if (n.message !== void 0) return { ...n, path: i, message: n.message };
  let o = "", c = s.filter((l) => !!l).slice().reverse();
  for (let l of c) o = l(a, { data: t, defaultError: o }).message;
  return { ...n, path: i, message: o };
}, "nr");
var ph = [];
function S(e20, t) {
  let r = It(), s = nr({ issueData: t, data: e20.data, path: e20.path, errorMaps: [e20.common.contextualErrorMap, e20.schemaErrorMap, r, r === Ie ? void 0 : Ie].filter((n) => !!n) });
  e20.common.issues.push(s);
}
__name(S, "S");
var W = class e2 {
  static {
    __name(this, "e");
  }
  constructor() {
    this.value = "valid";
  }
  dirty() {
    this.value === "valid" && (this.value = "dirty");
  }
  abort() {
    this.value !== "aborted" && (this.value = "aborted");
  }
  static mergeArray(t, r) {
    let s = [];
    for (let n of r) {
      if (n.status === "aborted") return R;
      n.status === "dirty" && t.dirty(), s.push(n.value);
    }
    return { status: t.value, value: s };
  }
  static async mergeObjectAsync(t, r) {
    let s = [];
    for (let n of r) {
      let i = await n.key, a = await n.value;
      s.push({ key: i, value: a });
    }
    return e2.mergeObjectSync(t, s);
  }
  static mergeObjectSync(t, r) {
    let s = {};
    for (let n of r) {
      let { key: i, value: a } = n;
      if (i.status === "aborted" || a.status === "aborted") return R;
      i.status === "dirty" && t.dirty(), a.status === "dirty" && t.dirty(), i.value !== "__proto__" && (typeof a.value < "u" || n.alwaysSet) && (s[i.value] = a.value);
    }
    return { status: t.value, value: s };
  }
};
var R = Object.freeze({ status: "aborted" });
var tt = /* @__PURE__ */ __name((e20) => ({ status: "dirty", value: e20 }), "tt");
var J = /* @__PURE__ */ __name((e20) => ({ status: "valid", value: e20 }), "J");
var qr = /* @__PURE__ */ __name((e20) => e20.status === "aborted", "qr");
var zr = /* @__PURE__ */ __name((e20) => e20.status === "dirty", "zr");
var Fe = /* @__PURE__ */ __name((e20) => e20.status === "valid", "Fe");
var Pt = /* @__PURE__ */ __name((e20) => typeof Promise < "u" && e20 instanceof Promise, "Pt");
var A;
(function(e20) {
  e20.errToObj = (t) => typeof t == "string" ? { message: t } : t || {}, e20.toString = (t) => typeof t == "string" ? t : t?.message;
})(A || (A = {}));
var ce = class {
  static {
    __name(this, "ce");
  }
  constructor(t, r, s, n) {
    this._cachedPath = [], this.parent = t, this.data = r, this._path = s, this._key = n;
  }
  get path() {
    return this._cachedPath.length || (Array.isArray(this._key) ? this._cachedPath.push(...this._path, ...this._key) : this._cachedPath.push(...this._path, this._key)), this._cachedPath;
  }
};
var fi = /* @__PURE__ */ __name((e20, t) => {
  if (Fe(t)) return { success: true, data: t.value };
  if (!e20.common.issues.length) throw new Error("Validation failed but no issues detected.");
  return { success: false, get error() {
    if (this._error) return this._error;
    let r = new Y(e20.common.issues);
    return this._error = r, this._error;
  } };
}, "fi");
function P(e20) {
  if (!e20) return {};
  let { errorMap: t, invalid_type_error: r, required_error: s, description: n } = e20;
  if (t && (r || s)) throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  return t ? { errorMap: t, description: n } : { errorMap: /* @__PURE__ */ __name((a, o) => {
    let { message: c } = e20;
    return a.code === "invalid_enum_value" ? { message: c ?? o.defaultError } : typeof o.data > "u" ? { message: c ?? s ?? o.defaultError } : a.code !== "invalid_type" ? { message: o.defaultError } : { message: c ?? r ?? o.defaultError };
  }, "errorMap"), description: n };
}
__name(P, "P");
var L = class {
  static {
    __name(this, "L");
  }
  get description() {
    return this._def.description;
  }
  _getType(t) {
    return ve(t.data);
  }
  _getOrReturnCtx(t, r) {
    return r || { common: t.parent.common, data: t.data, parsedType: ve(t.data), schemaErrorMap: this._def.errorMap, path: t.path, parent: t.parent };
  }
  _processInputParams(t) {
    return { status: new W(), ctx: { common: t.parent.common, data: t.data, parsedType: ve(t.data), schemaErrorMap: this._def.errorMap, path: t.path, parent: t.parent } };
  }
  _parseSync(t) {
    let r = this._parse(t);
    if (Pt(r)) throw new Error("Synchronous parse encountered promise.");
    return r;
  }
  _parseAsync(t) {
    let r = this._parse(t);
    return Promise.resolve(r);
  }
  parse(t, r) {
    let s = this.safeParse(t, r);
    if (s.success) return s.data;
    throw s.error;
  }
  safeParse(t, r) {
    let s = { common: { issues: [], async: r?.async ?? false, contextualErrorMap: r?.errorMap }, path: r?.path || [], schemaErrorMap: this._def.errorMap, parent: null, data: t, parsedType: ve(t) }, n = this._parseSync({ data: t, path: s.path, parent: s });
    return fi(s, n);
  }
  "~validate"(t) {
    let r = { common: { issues: [], async: !!this["~standard"].async }, path: [], schemaErrorMap: this._def.errorMap, parent: null, data: t, parsedType: ve(t) };
    if (!this["~standard"].async) try {
      let s = this._parseSync({ data: t, path: [], parent: r });
      return Fe(s) ? { value: s.value } : { issues: r.common.issues };
    } catch (s) {
      s?.message?.toLowerCase()?.includes("encountered") && (this["~standard"].async = true), r.common = { issues: [], async: true };
    }
    return this._parseAsync({ data: t, path: [], parent: r }).then((s) => Fe(s) ? { value: s.value } : { issues: r.common.issues });
  }
  async parseAsync(t, r) {
    let s = await this.safeParseAsync(t, r);
    if (s.success) return s.data;
    throw s.error;
  }
  async safeParseAsync(t, r) {
    let s = { common: { issues: [], contextualErrorMap: r?.errorMap, async: true }, path: r?.path || [], schemaErrorMap: this._def.errorMap, parent: null, data: t, parsedType: ve(t) }, n = this._parse({ data: t, path: s.path, parent: s }), i = await (Pt(n) ? n : Promise.resolve(n));
    return fi(s, i);
  }
  refine(t, r) {
    let s = /* @__PURE__ */ __name((n) => typeof r == "string" || typeof r > "u" ? { message: r } : typeof r == "function" ? r(n) : r, "s");
    return this._refinement((n, i) => {
      let a = t(n), o = /* @__PURE__ */ __name(() => i.addIssue({ code: w.custom, ...s(n) }), "o");
      return typeof Promise < "u" && a instanceof Promise ? a.then((c) => c ? true : (o(), false)) : a ? true : (o(), false);
    });
  }
  refinement(t, r) {
    return this._refinement((s, n) => t(s) ? true : (n.addIssue(typeof r == "function" ? r(s, n) : r), false));
  }
  _refinement(t) {
    return new le({ schema: this, typeName: I.ZodEffects, effect: { type: "refinement", refinement: t } });
  }
  superRefine(t) {
    return this._refinement(t);
  }
  constructor(t) {
    this.spa = this.safeParseAsync, this._def = t, this.parse = this.parse.bind(this), this.safeParse = this.safeParse.bind(this), this.parseAsync = this.parseAsync.bind(this), this.safeParseAsync = this.safeParseAsync.bind(this), this.spa = this.spa.bind(this), this.refine = this.refine.bind(this), this.refinement = this.refinement.bind(this), this.superRefine = this.superRefine.bind(this), this.optional = this.optional.bind(this), this.nullable = this.nullable.bind(this), this.nullish = this.nullish.bind(this), this.array = this.array.bind(this), this.promise = this.promise.bind(this), this.or = this.or.bind(this), this.and = this.and.bind(this), this.transform = this.transform.bind(this), this.brand = this.brand.bind(this), this.default = this.default.bind(this), this.catch = this.catch.bind(this), this.describe = this.describe.bind(this), this.pipe = this.pipe.bind(this), this.readonly = this.readonly.bind(this), this.isNullable = this.isNullable.bind(this), this.isOptional = this.isOptional.bind(this), this["~standard"] = { version: 1, vendor: "zod", validate: /* @__PURE__ */ __name((r) => this["~validate"](r), "validate") };
  }
  optional() {
    return oe.create(this, this._def);
  }
  nullable() {
    return be.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return Ne.create(this);
  }
  promise() {
    return Ve.create(this, this._def);
  }
  or(t) {
    return ct.create([this, t], this._def);
  }
  and(t) {
    return lt.create(this, t, this._def);
  }
  transform(t) {
    return new le({ ...P(this._def), schema: this, typeName: I.ZodEffects, effect: { type: "transform", transform: t } });
  }
  default(t) {
    let r = typeof t == "function" ? t : () => t;
    return new ft({ ...P(this._def), innerType: this, defaultValue: r, typeName: I.ZodDefault });
  }
  brand() {
    return new ir({ typeName: I.ZodBranded, type: this, ...P(this._def) });
  }
  catch(t) {
    let r = typeof t == "function" ? t : () => t;
    return new mt({ ...P(this._def), innerType: this, catchValue: r, typeName: I.ZodCatch });
  }
  describe(t) {
    let r = this.constructor;
    return new r({ ...this._def, description: t });
  }
  pipe(t) {
    return ar.create(this, t);
  }
  readonly() {
    return gt.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var fh = /^c[^\s-]{8,}$/i;
var mh = /^[0-9a-z]+$/;
var gh = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var yh = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var wh = /^[a-z0-9_-]{21}$/i;
var vh = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var _h = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var bh = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var xh = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
var Xs;
var Sh = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var Eh = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var kh = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var Th = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var Ah = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var Rh = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var gi = "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))";
var Ch = new RegExp(`^${gi}$`);
function yi(e20) {
  let t = "[0-5]\\d";
  e20.precision ? t = `${t}\\.\\d{${e20.precision}}` : e20.precision == null && (t = `${t}(\\.\\d+)?`);
  let r = e20.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${t})${r}`;
}
__name(yi, "yi");
function Oh(e20) {
  return new RegExp(`^${yi(e20)}$`);
}
__name(Oh, "Oh");
function wi(e20) {
  let t = `${gi}T${yi(e20)}`, r = [];
  return r.push(e20.local ? "Z?" : "Z"), e20.offset && r.push("([+-]\\d{2}:?\\d{2})"), t = `${t}(${r.join("|")})`, new RegExp(`^${t}$`);
}
__name(wi, "wi");
function Ih(e20, t) {
  return !!((t === "v4" || !t) && Sh.test(e20) || (t === "v6" || !t) && kh.test(e20));
}
__name(Ih, "Ih");
function Ph(e20, t) {
  if (!vh.test(e20)) return false;
  try {
    let [r] = e20.split(".");
    if (!r) return false;
    let s = r.replace(/-/g, "+").replace(/_/g, "/").padEnd(r.length + (4 - r.length % 4) % 4, "="), n = JSON.parse(atob(s));
    return !(typeof n != "object" || n === null || "typ" in n && n?.typ !== "JWT" || !n.alg || t && n.alg !== t);
  } catch {
    return false;
  }
}
__name(Ph, "Ph");
function Lh(e20, t) {
  return !!((t === "v4" || !t) && Eh.test(e20) || (t === "v6" || !t) && Th.test(e20));
}
__name(Lh, "Lh");
var qe = class e3 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    if (this._def.coerce && (t.data = String(t.data)), this._getType(t) !== k.string) {
      let i = this._getOrReturnCtx(t);
      return S(i, { code: w.invalid_type, expected: k.string, received: i.parsedType }), R;
    }
    let s = new W(), n;
    for (let i of this._def.checks) if (i.kind === "min") t.data.length < i.value && (n = this._getOrReturnCtx(t, n), S(n, { code: w.too_small, minimum: i.value, type: "string", inclusive: true, exact: false, message: i.message }), s.dirty());
    else if (i.kind === "max") t.data.length > i.value && (n = this._getOrReturnCtx(t, n), S(n, { code: w.too_big, maximum: i.value, type: "string", inclusive: true, exact: false, message: i.message }), s.dirty());
    else if (i.kind === "length") {
      let a = t.data.length > i.value, o = t.data.length < i.value;
      (a || o) && (n = this._getOrReturnCtx(t, n), a ? S(n, { code: w.too_big, maximum: i.value, type: "string", inclusive: true, exact: true, message: i.message }) : o && S(n, { code: w.too_small, minimum: i.value, type: "string", inclusive: true, exact: true, message: i.message }), s.dirty());
    } else if (i.kind === "email") bh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "email", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "emoji") Xs || (Xs = new RegExp(xh, "u")), Xs.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "emoji", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "uuid") yh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "uuid", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "nanoid") wh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "nanoid", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "cuid") fh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "cuid", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "cuid2") mh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "cuid2", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "ulid") gh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "ulid", code: w.invalid_string, message: i.message }), s.dirty());
    else if (i.kind === "url") try {
      new URL(t.data);
    } catch {
      n = this._getOrReturnCtx(t, n), S(n, { validation: "url", code: w.invalid_string, message: i.message }), s.dirty();
    }
    else i.kind === "regex" ? (i.regex.lastIndex = 0, i.regex.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "regex", code: w.invalid_string, message: i.message }), s.dirty())) : i.kind === "trim" ? t.data = t.data.trim() : i.kind === "includes" ? t.data.includes(i.value, i.position) || (n = this._getOrReturnCtx(t, n), S(n, { code: w.invalid_string, validation: { includes: i.value, position: i.position }, message: i.message }), s.dirty()) : i.kind === "toLowerCase" ? t.data = t.data.toLowerCase() : i.kind === "toUpperCase" ? t.data = t.data.toUpperCase() : i.kind === "startsWith" ? t.data.startsWith(i.value) || (n = this._getOrReturnCtx(t, n), S(n, { code: w.invalid_string, validation: { startsWith: i.value }, message: i.message }), s.dirty()) : i.kind === "endsWith" ? t.data.endsWith(i.value) || (n = this._getOrReturnCtx(t, n), S(n, { code: w.invalid_string, validation: { endsWith: i.value }, message: i.message }), s.dirty()) : i.kind === "datetime" ? wi(i).test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { code: w.invalid_string, validation: "datetime", message: i.message }), s.dirty()) : i.kind === "date" ? Ch.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { code: w.invalid_string, validation: "date", message: i.message }), s.dirty()) : i.kind === "time" ? Oh(i).test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { code: w.invalid_string, validation: "time", message: i.message }), s.dirty()) : i.kind === "duration" ? _h.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "duration", code: w.invalid_string, message: i.message }), s.dirty()) : i.kind === "ip" ? Ih(t.data, i.version) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "ip", code: w.invalid_string, message: i.message }), s.dirty()) : i.kind === "jwt" ? Ph(t.data, i.alg) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "jwt", code: w.invalid_string, message: i.message }), s.dirty()) : i.kind === "cidr" ? Lh(t.data, i.version) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "cidr", code: w.invalid_string, message: i.message }), s.dirty()) : i.kind === "base64" ? Ah.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "base64", code: w.invalid_string, message: i.message }), s.dirty()) : i.kind === "base64url" ? Rh.test(t.data) || (n = this._getOrReturnCtx(t, n), S(n, { validation: "base64url", code: w.invalid_string, message: i.message }), s.dirty()) : j.assertNever(i);
    return { status: s.value, value: t.data };
  }
  _regex(t, r, s) {
    return this.refinement((n) => t.test(n), { validation: r, code: w.invalid_string, ...A.errToObj(s) });
  }
  _addCheck(t) {
    return new e3({ ...this._def, checks: [...this._def.checks, t] });
  }
  email(t) {
    return this._addCheck({ kind: "email", ...A.errToObj(t) });
  }
  url(t) {
    return this._addCheck({ kind: "url", ...A.errToObj(t) });
  }
  emoji(t) {
    return this._addCheck({ kind: "emoji", ...A.errToObj(t) });
  }
  uuid(t) {
    return this._addCheck({ kind: "uuid", ...A.errToObj(t) });
  }
  nanoid(t) {
    return this._addCheck({ kind: "nanoid", ...A.errToObj(t) });
  }
  cuid(t) {
    return this._addCheck({ kind: "cuid", ...A.errToObj(t) });
  }
  cuid2(t) {
    return this._addCheck({ kind: "cuid2", ...A.errToObj(t) });
  }
  ulid(t) {
    return this._addCheck({ kind: "ulid", ...A.errToObj(t) });
  }
  base64(t) {
    return this._addCheck({ kind: "base64", ...A.errToObj(t) });
  }
  base64url(t) {
    return this._addCheck({ kind: "base64url", ...A.errToObj(t) });
  }
  jwt(t) {
    return this._addCheck({ kind: "jwt", ...A.errToObj(t) });
  }
  ip(t) {
    return this._addCheck({ kind: "ip", ...A.errToObj(t) });
  }
  cidr(t) {
    return this._addCheck({ kind: "cidr", ...A.errToObj(t) });
  }
  datetime(t) {
    return typeof t == "string" ? this._addCheck({ kind: "datetime", precision: null, offset: false, local: false, message: t }) : this._addCheck({ kind: "datetime", precision: typeof t?.precision > "u" ? null : t?.precision, offset: t?.offset ?? false, local: t?.local ?? false, ...A.errToObj(t?.message) });
  }
  date(t) {
    return this._addCheck({ kind: "date", message: t });
  }
  time(t) {
    return typeof t == "string" ? this._addCheck({ kind: "time", precision: null, message: t }) : this._addCheck({ kind: "time", precision: typeof t?.precision > "u" ? null : t?.precision, ...A.errToObj(t?.message) });
  }
  duration(t) {
    return this._addCheck({ kind: "duration", ...A.errToObj(t) });
  }
  regex(t, r) {
    return this._addCheck({ kind: "regex", regex: t, ...A.errToObj(r) });
  }
  includes(t, r) {
    return this._addCheck({ kind: "includes", value: t, position: r?.position, ...A.errToObj(r?.message) });
  }
  startsWith(t, r) {
    return this._addCheck({ kind: "startsWith", value: t, ...A.errToObj(r) });
  }
  endsWith(t, r) {
    return this._addCheck({ kind: "endsWith", value: t, ...A.errToObj(r) });
  }
  min(t, r) {
    return this._addCheck({ kind: "min", value: t, ...A.errToObj(r) });
  }
  max(t, r) {
    return this._addCheck({ kind: "max", value: t, ...A.errToObj(r) });
  }
  length(t, r) {
    return this._addCheck({ kind: "length", value: t, ...A.errToObj(r) });
  }
  nonempty(t) {
    return this.min(1, A.errToObj(t));
  }
  trim() {
    return new e3({ ...this._def, checks: [...this._def.checks, { kind: "trim" }] });
  }
  toLowerCase() {
    return new e3({ ...this._def, checks: [...this._def.checks, { kind: "toLowerCase" }] });
  }
  toUpperCase() {
    return new e3({ ...this._def, checks: [...this._def.checks, { kind: "toUpperCase" }] });
  }
  get isDatetime() {
    return !!this._def.checks.find((t) => t.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((t) => t.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((t) => t.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((t) => t.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((t) => t.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((t) => t.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((t) => t.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((t) => t.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((t) => t.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((t) => t.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((t) => t.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((t) => t.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((t) => t.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((t) => t.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((t) => t.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((t) => t.kind === "base64url");
  }
  get minLength() {
    let t = null;
    for (let r of this._def.checks) r.kind === "min" && (t === null || r.value > t) && (t = r.value);
    return t;
  }
  get maxLength() {
    let t = null;
    for (let r of this._def.checks) r.kind === "max" && (t === null || r.value < t) && (t = r.value);
    return t;
  }
};
qe.create = (e20) => new qe({ checks: [], typeName: I.ZodString, coerce: e20?.coerce ?? false, ...P(e20) });
function Nh(e20, t) {
  let r = (e20.toString().split(".")[1] || "").length, s = (t.toString().split(".")[1] || "").length, n = r > s ? r : s, i = Number.parseInt(e20.toFixed(n).replace(".", "")), a = Number.parseInt(t.toFixed(n).replace(".", ""));
  return i % a / 10 ** n;
}
__name(Nh, "Nh");
var rt = class e4 extends L {
  static {
    __name(this, "e");
  }
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte, this.step = this.multipleOf;
  }
  _parse(t) {
    if (this._def.coerce && (t.data = Number(t.data)), this._getType(t) !== k.number) {
      let i = this._getOrReturnCtx(t);
      return S(i, { code: w.invalid_type, expected: k.number, received: i.parsedType }), R;
    }
    let s, n = new W();
    for (let i of this._def.checks) i.kind === "int" ? j.isInteger(t.data) || (s = this._getOrReturnCtx(t, s), S(s, { code: w.invalid_type, expected: "integer", received: "float", message: i.message }), n.dirty()) : i.kind === "min" ? (i.inclusive ? t.data < i.value : t.data <= i.value) && (s = this._getOrReturnCtx(t, s), S(s, { code: w.too_small, minimum: i.value, type: "number", inclusive: i.inclusive, exact: false, message: i.message }), n.dirty()) : i.kind === "max" ? (i.inclusive ? t.data > i.value : t.data >= i.value) && (s = this._getOrReturnCtx(t, s), S(s, { code: w.too_big, maximum: i.value, type: "number", inclusive: i.inclusive, exact: false, message: i.message }), n.dirty()) : i.kind === "multipleOf" ? Nh(t.data, i.value) !== 0 && (s = this._getOrReturnCtx(t, s), S(s, { code: w.not_multiple_of, multipleOf: i.value, message: i.message }), n.dirty()) : i.kind === "finite" ? Number.isFinite(t.data) || (s = this._getOrReturnCtx(t, s), S(s, { code: w.not_finite, message: i.message }), n.dirty()) : j.assertNever(i);
    return { status: n.value, value: t.data };
  }
  gte(t, r) {
    return this.setLimit("min", t, true, A.toString(r));
  }
  gt(t, r) {
    return this.setLimit("min", t, false, A.toString(r));
  }
  lte(t, r) {
    return this.setLimit("max", t, true, A.toString(r));
  }
  lt(t, r) {
    return this.setLimit("max", t, false, A.toString(r));
  }
  setLimit(t, r, s, n) {
    return new e4({ ...this._def, checks: [...this._def.checks, { kind: t, value: r, inclusive: s, message: A.toString(n) }] });
  }
  _addCheck(t) {
    return new e4({ ...this._def, checks: [...this._def.checks, t] });
  }
  int(t) {
    return this._addCheck({ kind: "int", message: A.toString(t) });
  }
  positive(t) {
    return this._addCheck({ kind: "min", value: 0, inclusive: false, message: A.toString(t) });
  }
  negative(t) {
    return this._addCheck({ kind: "max", value: 0, inclusive: false, message: A.toString(t) });
  }
  nonpositive(t) {
    return this._addCheck({ kind: "max", value: 0, inclusive: true, message: A.toString(t) });
  }
  nonnegative(t) {
    return this._addCheck({ kind: "min", value: 0, inclusive: true, message: A.toString(t) });
  }
  multipleOf(t, r) {
    return this._addCheck({ kind: "multipleOf", value: t, message: A.toString(r) });
  }
  finite(t) {
    return this._addCheck({ kind: "finite", message: A.toString(t) });
  }
  safe(t) {
    return this._addCheck({ kind: "min", inclusive: true, value: Number.MIN_SAFE_INTEGER, message: A.toString(t) })._addCheck({ kind: "max", inclusive: true, value: Number.MAX_SAFE_INTEGER, message: A.toString(t) });
  }
  get minValue() {
    let t = null;
    for (let r of this._def.checks) r.kind === "min" && (t === null || r.value > t) && (t = r.value);
    return t;
  }
  get maxValue() {
    let t = null;
    for (let r of this._def.checks) r.kind === "max" && (t === null || r.value < t) && (t = r.value);
    return t;
  }
  get isInt() {
    return !!this._def.checks.find((t) => t.kind === "int" || t.kind === "multipleOf" && j.isInteger(t.value));
  }
  get isFinite() {
    let t = null, r = null;
    for (let s of this._def.checks) {
      if (s.kind === "finite" || s.kind === "int" || s.kind === "multipleOf") return true;
      s.kind === "min" ? (r === null || s.value > r) && (r = s.value) : s.kind === "max" && (t === null || s.value < t) && (t = s.value);
    }
    return Number.isFinite(r) && Number.isFinite(t);
  }
};
rt.create = (e20) => new rt({ checks: [], typeName: I.ZodNumber, coerce: e20?.coerce || false, ...P(e20) });
var st = class e5 extends L {
  static {
    __name(this, "e");
  }
  constructor() {
    super(...arguments), this.min = this.gte, this.max = this.lte;
  }
  _parse(t) {
    if (this._def.coerce) try {
      t.data = BigInt(t.data);
    } catch {
      return this._getInvalidInput(t);
    }
    if (this._getType(t) !== k.bigint) return this._getInvalidInput(t);
    let s, n = new W();
    for (let i of this._def.checks) i.kind === "min" ? (i.inclusive ? t.data < i.value : t.data <= i.value) && (s = this._getOrReturnCtx(t, s), S(s, { code: w.too_small, type: "bigint", minimum: i.value, inclusive: i.inclusive, message: i.message }), n.dirty()) : i.kind === "max" ? (i.inclusive ? t.data > i.value : t.data >= i.value) && (s = this._getOrReturnCtx(t, s), S(s, { code: w.too_big, type: "bigint", maximum: i.value, inclusive: i.inclusive, message: i.message }), n.dirty()) : i.kind === "multipleOf" ? t.data % i.value !== BigInt(0) && (s = this._getOrReturnCtx(t, s), S(s, { code: w.not_multiple_of, multipleOf: i.value, message: i.message }), n.dirty()) : j.assertNever(i);
    return { status: n.value, value: t.data };
  }
  _getInvalidInput(t) {
    let r = this._getOrReturnCtx(t);
    return S(r, { code: w.invalid_type, expected: k.bigint, received: r.parsedType }), R;
  }
  gte(t, r) {
    return this.setLimit("min", t, true, A.toString(r));
  }
  gt(t, r) {
    return this.setLimit("min", t, false, A.toString(r));
  }
  lte(t, r) {
    return this.setLimit("max", t, true, A.toString(r));
  }
  lt(t, r) {
    return this.setLimit("max", t, false, A.toString(r));
  }
  setLimit(t, r, s, n) {
    return new e5({ ...this._def, checks: [...this._def.checks, { kind: t, value: r, inclusive: s, message: A.toString(n) }] });
  }
  _addCheck(t) {
    return new e5({ ...this._def, checks: [...this._def.checks, t] });
  }
  positive(t) {
    return this._addCheck({ kind: "min", value: BigInt(0), inclusive: false, message: A.toString(t) });
  }
  negative(t) {
    return this._addCheck({ kind: "max", value: BigInt(0), inclusive: false, message: A.toString(t) });
  }
  nonpositive(t) {
    return this._addCheck({ kind: "max", value: BigInt(0), inclusive: true, message: A.toString(t) });
  }
  nonnegative(t) {
    return this._addCheck({ kind: "min", value: BigInt(0), inclusive: true, message: A.toString(t) });
  }
  multipleOf(t, r) {
    return this._addCheck({ kind: "multipleOf", value: t, message: A.toString(r) });
  }
  get minValue() {
    let t = null;
    for (let r of this._def.checks) r.kind === "min" && (t === null || r.value > t) && (t = r.value);
    return t;
  }
  get maxValue() {
    let t = null;
    for (let r of this._def.checks) r.kind === "max" && (t === null || r.value < t) && (t = r.value);
    return t;
  }
};
st.create = (e20) => new st({ checks: [], typeName: I.ZodBigInt, coerce: e20?.coerce ?? false, ...P(e20) });
var nt = class extends L {
  static {
    __name(this, "nt");
  }
  _parse(t) {
    if (this._def.coerce && (t.data = !!t.data), this._getType(t) !== k.boolean) {
      let s = this._getOrReturnCtx(t);
      return S(s, { code: w.invalid_type, expected: k.boolean, received: s.parsedType }), R;
    }
    return J(t.data);
  }
};
nt.create = (e20) => new nt({ typeName: I.ZodBoolean, coerce: e20?.coerce || false, ...P(e20) });
var it = class e6 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    if (this._def.coerce && (t.data = new Date(t.data)), this._getType(t) !== k.date) {
      let i = this._getOrReturnCtx(t);
      return S(i, { code: w.invalid_type, expected: k.date, received: i.parsedType }), R;
    }
    if (Number.isNaN(t.data.getTime())) {
      let i = this._getOrReturnCtx(t);
      return S(i, { code: w.invalid_date }), R;
    }
    let s = new W(), n;
    for (let i of this._def.checks) i.kind === "min" ? t.data.getTime() < i.value && (n = this._getOrReturnCtx(t, n), S(n, { code: w.too_small, message: i.message, inclusive: true, exact: false, minimum: i.value, type: "date" }), s.dirty()) : i.kind === "max" ? t.data.getTime() > i.value && (n = this._getOrReturnCtx(t, n), S(n, { code: w.too_big, message: i.message, inclusive: true, exact: false, maximum: i.value, type: "date" }), s.dirty()) : j.assertNever(i);
    return { status: s.value, value: new Date(t.data.getTime()) };
  }
  _addCheck(t) {
    return new e6({ ...this._def, checks: [...this._def.checks, t] });
  }
  min(t, r) {
    return this._addCheck({ kind: "min", value: t.getTime(), message: A.toString(r) });
  }
  max(t, r) {
    return this._addCheck({ kind: "max", value: t.getTime(), message: A.toString(r) });
  }
  get minDate() {
    let t = null;
    for (let r of this._def.checks) r.kind === "min" && (t === null || r.value > t) && (t = r.value);
    return t != null ? new Date(t) : null;
  }
  get maxDate() {
    let t = null;
    for (let r of this._def.checks) r.kind === "max" && (t === null || r.value < t) && (t = r.value);
    return t != null ? new Date(t) : null;
  }
};
it.create = (e20) => new it({ checks: [], coerce: e20?.coerce || false, typeName: I.ZodDate, ...P(e20) });
var Nt = class extends L {
  static {
    __name(this, "Nt");
  }
  _parse(t) {
    if (this._getType(t) !== k.symbol) {
      let s = this._getOrReturnCtx(t);
      return S(s, { code: w.invalid_type, expected: k.symbol, received: s.parsedType }), R;
    }
    return J(t.data);
  }
};
Nt.create = (e20) => new Nt({ typeName: I.ZodSymbol, ...P(e20) });
var at = class extends L {
  static {
    __name(this, "at");
  }
  _parse(t) {
    if (this._getType(t) !== k.undefined) {
      let s = this._getOrReturnCtx(t);
      return S(s, { code: w.invalid_type, expected: k.undefined, received: s.parsedType }), R;
    }
    return J(t.data);
  }
};
at.create = (e20) => new at({ typeName: I.ZodUndefined, ...P(e20) });
var ot = class extends L {
  static {
    __name(this, "ot");
  }
  _parse(t) {
    if (this._getType(t) !== k.null) {
      let s = this._getOrReturnCtx(t);
      return S(s, { code: w.invalid_type, expected: k.null, received: s.parsedType }), R;
    }
    return J(t.data);
  }
};
ot.create = (e20) => new ot({ typeName: I.ZodNull, ...P(e20) });
var ze = class extends L {
  static {
    __name(this, "ze");
  }
  constructor() {
    super(...arguments), this._any = true;
  }
  _parse(t) {
    return J(t.data);
  }
};
ze.create = (e20) => new ze({ typeName: I.ZodAny, ...P(e20) });
var Le = class extends L {
  static {
    __name(this, "Le");
  }
  constructor() {
    super(...arguments), this._unknown = true;
  }
  _parse(t) {
    return J(t.data);
  }
};
Le.create = (e20) => new Le({ typeName: I.ZodUnknown, ...P(e20) });
var pe = class extends L {
  static {
    __name(this, "pe");
  }
  _parse(t) {
    let r = this._getOrReturnCtx(t);
    return S(r, { code: w.invalid_type, expected: k.never, received: r.parsedType }), R;
  }
};
pe.create = (e20) => new pe({ typeName: I.ZodNever, ...P(e20) });
var jt = class extends L {
  static {
    __name(this, "jt");
  }
  _parse(t) {
    if (this._getType(t) !== k.undefined) {
      let s = this._getOrReturnCtx(t);
      return S(s, { code: w.invalid_type, expected: k.void, received: s.parsedType }), R;
    }
    return J(t.data);
  }
};
jt.create = (e20) => new jt({ typeName: I.ZodVoid, ...P(e20) });
var Ne = class e7 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    let { ctx: r, status: s } = this._processInputParams(t), n = this._def;
    if (r.parsedType !== k.array) return S(r, { code: w.invalid_type, expected: k.array, received: r.parsedType }), R;
    if (n.exactLength !== null) {
      let a = r.data.length > n.exactLength.value, o = r.data.length < n.exactLength.value;
      (a || o) && (S(r, { code: a ? w.too_big : w.too_small, minimum: o ? n.exactLength.value : void 0, maximum: a ? n.exactLength.value : void 0, type: "array", inclusive: true, exact: true, message: n.exactLength.message }), s.dirty());
    }
    if (n.minLength !== null && r.data.length < n.minLength.value && (S(r, { code: w.too_small, minimum: n.minLength.value, type: "array", inclusive: true, exact: false, message: n.minLength.message }), s.dirty()), n.maxLength !== null && r.data.length > n.maxLength.value && (S(r, { code: w.too_big, maximum: n.maxLength.value, type: "array", inclusive: true, exact: false, message: n.maxLength.message }), s.dirty()), r.common.async) return Promise.all([...r.data].map((a, o) => n.type._parseAsync(new ce(r, a, r.path, o)))).then((a) => W.mergeArray(s, a));
    let i = [...r.data].map((a, o) => n.type._parseSync(new ce(r, a, r.path, o)));
    return W.mergeArray(s, i);
  }
  get element() {
    return this._def.type;
  }
  min(t, r) {
    return new e7({ ...this._def, minLength: { value: t, message: A.toString(r) } });
  }
  max(t, r) {
    return new e7({ ...this._def, maxLength: { value: t, message: A.toString(r) } });
  }
  length(t, r) {
    return new e7({ ...this._def, exactLength: { value: t, message: A.toString(r) } });
  }
  nonempty(t) {
    return this.min(1, t);
  }
};
Ne.create = (e20, t) => new Ne({ type: e20, minLength: null, maxLength: null, exactLength: null, typeName: I.ZodArray, ...P(t) });
function Lt(e20) {
  if (e20 instanceof Z) {
    let t = {};
    for (let r in e20.shape) {
      let s = e20.shape[r];
      t[r] = oe.create(Lt(s));
    }
    return new Z({ ...e20._def, shape: /* @__PURE__ */ __name(() => t, "shape") });
  } else return e20 instanceof Ne ? new Ne({ ...e20._def, type: Lt(e20.element) }) : e20 instanceof oe ? oe.create(Lt(e20.unwrap())) : e20 instanceof be ? be.create(Lt(e20.unwrap())) : e20 instanceof _e ? _e.create(e20.items.map((t) => Lt(t))) : e20;
}
__name(Lt, "Lt");
var Z = class e8 extends L {
  static {
    __name(this, "e");
  }
  constructor() {
    super(...arguments), this._cached = null, this.nonstrict = this.passthrough, this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null) return this._cached;
    let t = this._def.shape(), r = j.objectKeys(t);
    return this._cached = { shape: t, keys: r }, this._cached;
  }
  _parse(t) {
    if (this._getType(t) !== k.object) {
      let l = this._getOrReturnCtx(t);
      return S(l, { code: w.invalid_type, expected: k.object, received: l.parsedType }), R;
    }
    let { status: s, ctx: n } = this._processInputParams(t), { shape: i, keys: a } = this._getCached(), o = [];
    if (!(this._def.catchall instanceof pe && this._def.unknownKeys === "strip")) for (let l in n.data) a.includes(l) || o.push(l);
    let c = [];
    for (let l of a) {
      let u = i[l], d = n.data[l];
      c.push({ key: { status: "valid", value: l }, value: u._parse(new ce(n, d, n.path, l)), alwaysSet: l in n.data });
    }
    if (this._def.catchall instanceof pe) {
      let l = this._def.unknownKeys;
      if (l === "passthrough") for (let u of o) c.push({ key: { status: "valid", value: u }, value: { status: "valid", value: n.data[u] } });
      else if (l === "strict") o.length > 0 && (S(n, { code: w.unrecognized_keys, keys: o }), s.dirty());
      else if (l !== "strip") throw new Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      let l = this._def.catchall;
      for (let u of o) {
        let d = n.data[u];
        c.push({ key: { status: "valid", value: u }, value: l._parse(new ce(n, d, n.path, u)), alwaysSet: u in n.data });
      }
    }
    return n.common.async ? Promise.resolve().then(async () => {
      let l = [];
      for (let u of c) {
        let d = await u.key, f = await u.value;
        l.push({ key: d, value: f, alwaysSet: u.alwaysSet });
      }
      return l;
    }).then((l) => W.mergeObjectSync(s, l)) : W.mergeObjectSync(s, c);
  }
  get shape() {
    return this._def.shape();
  }
  strict(t) {
    return A.errToObj, new e8({ ...this._def, unknownKeys: "strict", ...t !== void 0 ? { errorMap: /* @__PURE__ */ __name((r, s) => {
      let n = this._def.errorMap?.(r, s).message ?? s.defaultError;
      return r.code === "unrecognized_keys" ? { message: A.errToObj(t).message ?? n } : { message: n };
    }, "errorMap") } : {} });
  }
  strip() {
    return new e8({ ...this._def, unknownKeys: "strip" });
  }
  passthrough() {
    return new e8({ ...this._def, unknownKeys: "passthrough" });
  }
  extend(t) {
    return new e8({ ...this._def, shape: /* @__PURE__ */ __name(() => ({ ...this._def.shape(), ...t }), "shape") });
  }
  merge(t) {
    return new e8({ unknownKeys: t._def.unknownKeys, catchall: t._def.catchall, shape: /* @__PURE__ */ __name(() => ({ ...this._def.shape(), ...t._def.shape() }), "shape"), typeName: I.ZodObject });
  }
  setKey(t, r) {
    return this.augment({ [t]: r });
  }
  catchall(t) {
    return new e8({ ...this._def, catchall: t });
  }
  pick(t) {
    let r = {};
    for (let s of j.objectKeys(t)) t[s] && this.shape[s] && (r[s] = this.shape[s]);
    return new e8({ ...this._def, shape: /* @__PURE__ */ __name(() => r, "shape") });
  }
  omit(t) {
    let r = {};
    for (let s of j.objectKeys(this.shape)) t[s] || (r[s] = this.shape[s]);
    return new e8({ ...this._def, shape: /* @__PURE__ */ __name(() => r, "shape") });
  }
  deepPartial() {
    return Lt(this);
  }
  partial(t) {
    let r = {};
    for (let s of j.objectKeys(this.shape)) {
      let n = this.shape[s];
      t && !t[s] ? r[s] = n : r[s] = n.optional();
    }
    return new e8({ ...this._def, shape: /* @__PURE__ */ __name(() => r, "shape") });
  }
  required(t) {
    let r = {};
    for (let s of j.objectKeys(this.shape)) if (t && !t[s]) r[s] = this.shape[s];
    else {
      let i = this.shape[s];
      for (; i instanceof oe; ) i = i._def.innerType;
      r[s] = i;
    }
    return new e8({ ...this._def, shape: /* @__PURE__ */ __name(() => r, "shape") });
  }
  keyof() {
    return vi(j.objectKeys(this.shape));
  }
};
Z.create = (e20, t) => new Z({ shape: /* @__PURE__ */ __name(() => e20, "shape"), unknownKeys: "strip", catchall: pe.create(), typeName: I.ZodObject, ...P(t) });
Z.strictCreate = (e20, t) => new Z({ shape: /* @__PURE__ */ __name(() => e20, "shape"), unknownKeys: "strict", catchall: pe.create(), typeName: I.ZodObject, ...P(t) });
Z.lazycreate = (e20, t) => new Z({ shape: e20, unknownKeys: "strip", catchall: pe.create(), typeName: I.ZodObject, ...P(t) });
var ct = class extends L {
  static {
    __name(this, "ct");
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t), s = this._def.options;
    function n(i) {
      for (let o of i) if (o.result.status === "valid") return o.result;
      for (let o of i) if (o.result.status === "dirty") return r.common.issues.push(...o.ctx.common.issues), o.result;
      let a = i.map((o) => new Y(o.ctx.common.issues));
      return S(r, { code: w.invalid_union, unionErrors: a }), R;
    }
    __name(n, "n");
    if (r.common.async) return Promise.all(s.map(async (i) => {
      let a = { ...r, common: { ...r.common, issues: [] }, parent: null };
      return { result: await i._parseAsync({ data: r.data, path: r.path, parent: a }), ctx: a };
    })).then(n);
    {
      let i, a = [];
      for (let c of s) {
        let l = { ...r, common: { ...r.common, issues: [] }, parent: null }, u = c._parseSync({ data: r.data, path: r.path, parent: l });
        if (u.status === "valid") return u;
        u.status === "dirty" && !i && (i = { result: u, ctx: l }), l.common.issues.length && a.push(l.common.issues);
      }
      if (i) return r.common.issues.push(...i.ctx.common.issues), i.result;
      let o = a.map((c) => new Y(c));
      return S(r, { code: w.invalid_union, unionErrors: o }), R;
    }
  }
  get options() {
    return this._def.options;
  }
};
ct.create = (e20, t) => new ct({ options: e20, typeName: I.ZodUnion, ...P(t) });
var Pe = /* @__PURE__ */ __name((e20) => e20 instanceof ut ? Pe(e20.schema) : e20 instanceof le ? Pe(e20.innerType()) : e20 instanceof dt ? [e20.value] : e20 instanceof ht ? e20.options : e20 instanceof pt ? j.objectValues(e20.enum) : e20 instanceof ft ? Pe(e20._def.innerType) : e20 instanceof at ? [void 0] : e20 instanceof ot ? [null] : e20 instanceof oe ? [void 0, ...Pe(e20.unwrap())] : e20 instanceof be ? [null, ...Pe(e20.unwrap())] : e20 instanceof ir || e20 instanceof gt ? Pe(e20.unwrap()) : e20 instanceof mt ? Pe(e20._def.innerType) : [], "Pe");
var Vr = class e9 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t);
    if (r.parsedType !== k.object) return S(r, { code: w.invalid_type, expected: k.object, received: r.parsedType }), R;
    let s = this.discriminator, n = r.data[s], i = this.optionsMap.get(n);
    return i ? r.common.async ? i._parseAsync({ data: r.data, path: r.path, parent: r }) : i._parseSync({ data: r.data, path: r.path, parent: r }) : (S(r, { code: w.invalid_union_discriminator, options: Array.from(this.optionsMap.keys()), path: [s] }), R);
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create(t, r, s) {
    let n = /* @__PURE__ */ new Map();
    for (let i of r) {
      let a = Pe(i.shape[t]);
      if (!a.length) throw new Error(`A discriminator value for key \`${t}\` could not be extracted from all schema options`);
      for (let o of a) {
        if (n.has(o)) throw new Error(`Discriminator property ${String(t)} has duplicate value ${String(o)}`);
        n.set(o, i);
      }
    }
    return new e9({ typeName: I.ZodDiscriminatedUnion, discriminator: t, options: r, optionsMap: n, ...P(s) });
  }
};
function Ys(e20, t) {
  let r = ve(e20), s = ve(t);
  if (e20 === t) return { valid: true, data: e20 };
  if (r === k.object && s === k.object) {
    let n = j.objectKeys(t), i = j.objectKeys(e20).filter((o) => n.indexOf(o) !== -1), a = { ...e20, ...t };
    for (let o of i) {
      let c = Ys(e20[o], t[o]);
      if (!c.valid) return { valid: false };
      a[o] = c.data;
    }
    return { valid: true, data: a };
  } else if (r === k.array && s === k.array) {
    if (e20.length !== t.length) return { valid: false };
    let n = [];
    for (let i = 0; i < e20.length; i++) {
      let a = e20[i], o = t[i], c = Ys(a, o);
      if (!c.valid) return { valid: false };
      n.push(c.data);
    }
    return { valid: true, data: n };
  } else return r === k.date && s === k.date && +e20 == +t ? { valid: true, data: e20 } : { valid: false };
}
__name(Ys, "Ys");
var lt = class extends L {
  static {
    __name(this, "lt");
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t), n = /* @__PURE__ */ __name((i, a) => {
      if (qr(i) || qr(a)) return R;
      let o = Ys(i.value, a.value);
      return o.valid ? ((zr(i) || zr(a)) && r.dirty(), { status: r.value, value: o.data }) : (S(s, { code: w.invalid_intersection_types }), R);
    }, "n");
    return s.common.async ? Promise.all([this._def.left._parseAsync({ data: s.data, path: s.path, parent: s }), this._def.right._parseAsync({ data: s.data, path: s.path, parent: s })]).then(([i, a]) => n(i, a)) : n(this._def.left._parseSync({ data: s.data, path: s.path, parent: s }), this._def.right._parseSync({ data: s.data, path: s.path, parent: s }));
  }
};
lt.create = (e20, t, r) => new lt({ left: e20, right: t, typeName: I.ZodIntersection, ...P(r) });
var _e = class e10 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t);
    if (s.parsedType !== k.array) return S(s, { code: w.invalid_type, expected: k.array, received: s.parsedType }), R;
    if (s.data.length < this._def.items.length) return S(s, { code: w.too_small, minimum: this._def.items.length, inclusive: true, exact: false, type: "array" }), R;
    !this._def.rest && s.data.length > this._def.items.length && (S(s, { code: w.too_big, maximum: this._def.items.length, inclusive: true, exact: false, type: "array" }), r.dirty());
    let i = [...s.data].map((a, o) => {
      let c = this._def.items[o] || this._def.rest;
      return c ? c._parse(new ce(s, a, s.path, o)) : null;
    }).filter((a) => !!a);
    return s.common.async ? Promise.all(i).then((a) => W.mergeArray(r, a)) : W.mergeArray(r, i);
  }
  get items() {
    return this._def.items;
  }
  rest(t) {
    return new e10({ ...this._def, rest: t });
  }
};
_e.create = (e20, t) => {
  if (!Array.isArray(e20)) throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new _e({ items: e20, typeName: I.ZodTuple, rest: null, ...P(t) });
};
var Hr = class e11 extends L {
  static {
    __name(this, "e");
  }
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t);
    if (s.parsedType !== k.object) return S(s, { code: w.invalid_type, expected: k.object, received: s.parsedType }), R;
    let n = [], i = this._def.keyType, a = this._def.valueType;
    for (let o in s.data) n.push({ key: i._parse(new ce(s, o, s.path, o)), value: a._parse(new ce(s, s.data[o], s.path, o)), alwaysSet: o in s.data });
    return s.common.async ? W.mergeObjectAsync(r, n) : W.mergeObjectSync(r, n);
  }
  get element() {
    return this._def.valueType;
  }
  static create(t, r, s) {
    return r instanceof L ? new e11({ keyType: t, valueType: r, typeName: I.ZodRecord, ...P(s) }) : new e11({ keyType: qe.create(), valueType: t, typeName: I.ZodRecord, ...P(r) });
  }
};
var Ut = class extends L {
  static {
    __name(this, "Ut");
  }
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t);
    if (s.parsedType !== k.map) return S(s, { code: w.invalid_type, expected: k.map, received: s.parsedType }), R;
    let n = this._def.keyType, i = this._def.valueType, a = [...s.data.entries()].map(([o, c], l) => ({ key: n._parse(new ce(s, o, s.path, [l, "key"])), value: i._parse(new ce(s, c, s.path, [l, "value"])) }));
    if (s.common.async) {
      let o = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (let c of a) {
          let l = await c.key, u = await c.value;
          if (l.status === "aborted" || u.status === "aborted") return R;
          (l.status === "dirty" || u.status === "dirty") && r.dirty(), o.set(l.value, u.value);
        }
        return { status: r.value, value: o };
      });
    } else {
      let o = /* @__PURE__ */ new Map();
      for (let c of a) {
        let l = c.key, u = c.value;
        if (l.status === "aborted" || u.status === "aborted") return R;
        (l.status === "dirty" || u.status === "dirty") && r.dirty(), o.set(l.value, u.value);
      }
      return { status: r.value, value: o };
    }
  }
};
Ut.create = (e20, t, r) => new Ut({ valueType: t, keyType: e20, typeName: I.ZodMap, ...P(r) });
var Dt = class e12 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t);
    if (s.parsedType !== k.set) return S(s, { code: w.invalid_type, expected: k.set, received: s.parsedType }), R;
    let n = this._def;
    n.minSize !== null && s.data.size < n.minSize.value && (S(s, { code: w.too_small, minimum: n.minSize.value, type: "set", inclusive: true, exact: false, message: n.minSize.message }), r.dirty()), n.maxSize !== null && s.data.size > n.maxSize.value && (S(s, { code: w.too_big, maximum: n.maxSize.value, type: "set", inclusive: true, exact: false, message: n.maxSize.message }), r.dirty());
    let i = this._def.valueType;
    function a(c) {
      let l = /* @__PURE__ */ new Set();
      for (let u of c) {
        if (u.status === "aborted") return R;
        u.status === "dirty" && r.dirty(), l.add(u.value);
      }
      return { status: r.value, value: l };
    }
    __name(a, "a");
    let o = [...s.data.values()].map((c, l) => i._parse(new ce(s, c, s.path, l)));
    return s.common.async ? Promise.all(o).then((c) => a(c)) : a(o);
  }
  min(t, r) {
    return new e12({ ...this._def, minSize: { value: t, message: A.toString(r) } });
  }
  max(t, r) {
    return new e12({ ...this._def, maxSize: { value: t, message: A.toString(r) } });
  }
  size(t, r) {
    return this.min(t, r).max(t, r);
  }
  nonempty(t) {
    return this.min(1, t);
  }
};
Dt.create = (e20, t) => new Dt({ valueType: e20, minSize: null, maxSize: null, typeName: I.ZodSet, ...P(t) });
var Kr = class e13 extends L {
  static {
    __name(this, "e");
  }
  constructor() {
    super(...arguments), this.validate = this.implement;
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t);
    if (r.parsedType !== k.function) return S(r, { code: w.invalid_type, expected: k.function, received: r.parsedType }), R;
    function s(o, c) {
      return nr({ data: o, path: r.path, errorMaps: [r.common.contextualErrorMap, r.schemaErrorMap, It(), Ie].filter((l) => !!l), issueData: { code: w.invalid_arguments, argumentsError: c } });
    }
    __name(s, "s");
    function n(o, c) {
      return nr({ data: o, path: r.path, errorMaps: [r.common.contextualErrorMap, r.schemaErrorMap, It(), Ie].filter((l) => !!l), issueData: { code: w.invalid_return_type, returnTypeError: c } });
    }
    __name(n, "n");
    let i = { errorMap: r.common.contextualErrorMap }, a = r.data;
    if (this._def.returns instanceof Ve) {
      let o = this;
      return J(async function(...c) {
        let l = new Y([]), u = await o._def.args.parseAsync(c, i).catch((p) => {
          throw l.addIssue(s(c, p)), l;
        }), d = await Reflect.apply(a, this, u);
        return await o._def.returns._def.type.parseAsync(d, i).catch((p) => {
          throw l.addIssue(n(d, p)), l;
        });
      });
    } else {
      let o = this;
      return J(function(...c) {
        let l = o._def.args.safeParse(c, i);
        if (!l.success) throw new Y([s(c, l.error)]);
        let u = Reflect.apply(a, this, l.data), d = o._def.returns.safeParse(u, i);
        if (!d.success) throw new Y([n(u, d.error)]);
        return d.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...t) {
    return new e13({ ...this._def, args: _e.create(t).rest(Le.create()) });
  }
  returns(t) {
    return new e13({ ...this._def, returns: t });
  }
  implement(t) {
    return this.parse(t);
  }
  strictImplement(t) {
    return this.parse(t);
  }
  static create(t, r, s) {
    return new e13({ args: t || _e.create([]).rest(Le.create()), returns: r || Le.create(), typeName: I.ZodFunction, ...P(s) });
  }
};
var ut = class extends L {
  static {
    __name(this, "ut");
  }
  get schema() {
    return this._def.getter();
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t);
    return this._def.getter()._parse({ data: r.data, path: r.path, parent: r });
  }
};
ut.create = (e20, t) => new ut({ getter: e20, typeName: I.ZodLazy, ...P(t) });
var dt = class extends L {
  static {
    __name(this, "dt");
  }
  _parse(t) {
    if (t.data !== this._def.value) {
      let r = this._getOrReturnCtx(t);
      return S(r, { received: r.data, code: w.invalid_literal, expected: this._def.value }), R;
    }
    return { status: "valid", value: t.data };
  }
  get value() {
    return this._def.value;
  }
};
dt.create = (e20, t) => new dt({ value: e20, typeName: I.ZodLiteral, ...P(t) });
function vi(e20, t) {
  return new ht({ values: e20, typeName: I.ZodEnum, ...P(t) });
}
__name(vi, "vi");
var ht = class e14 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    if (typeof t.data != "string") {
      let r = this._getOrReturnCtx(t), s = this._def.values;
      return S(r, { expected: j.joinValues(s), received: r.parsedType, code: w.invalid_type }), R;
    }
    if (this._cache || (this._cache = new Set(this._def.values)), !this._cache.has(t.data)) {
      let r = this._getOrReturnCtx(t), s = this._def.values;
      return S(r, { received: r.data, code: w.invalid_enum_value, options: s }), R;
    }
    return J(t.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    let t = {};
    for (let r of this._def.values) t[r] = r;
    return t;
  }
  get Values() {
    let t = {};
    for (let r of this._def.values) t[r] = r;
    return t;
  }
  get Enum() {
    let t = {};
    for (let r of this._def.values) t[r] = r;
    return t;
  }
  extract(t, r = this._def) {
    return e14.create(t, { ...this._def, ...r });
  }
  exclude(t, r = this._def) {
    return e14.create(this.options.filter((s) => !t.includes(s)), { ...this._def, ...r });
  }
};
ht.create = vi;
var pt = class extends L {
  static {
    __name(this, "pt");
  }
  _parse(t) {
    let r = j.getValidEnumValues(this._def.values), s = this._getOrReturnCtx(t);
    if (s.parsedType !== k.string && s.parsedType !== k.number) {
      let n = j.objectValues(r);
      return S(s, { expected: j.joinValues(n), received: s.parsedType, code: w.invalid_type }), R;
    }
    if (this._cache || (this._cache = new Set(j.getValidEnumValues(this._def.values))), !this._cache.has(t.data)) {
      let n = j.objectValues(r);
      return S(s, { received: s.data, code: w.invalid_enum_value, options: n }), R;
    }
    return J(t.data);
  }
  get enum() {
    return this._def.values;
  }
};
pt.create = (e20, t) => new pt({ values: e20, typeName: I.ZodNativeEnum, ...P(t) });
var Ve = class extends L {
  static {
    __name(this, "Ve");
  }
  unwrap() {
    return this._def.type;
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t);
    if (r.parsedType !== k.promise && r.common.async === false) return S(r, { code: w.invalid_type, expected: k.promise, received: r.parsedType }), R;
    let s = r.parsedType === k.promise ? r.data : Promise.resolve(r.data);
    return J(s.then((n) => this._def.type.parseAsync(n, { path: r.path, errorMap: r.common.contextualErrorMap })));
  }
};
Ve.create = (e20, t) => new Ve({ type: e20, typeName: I.ZodPromise, ...P(t) });
var le = class extends L {
  static {
    __name(this, "le");
  }
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === I.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t), n = this._def.effect || null, i = { addIssue: /* @__PURE__ */ __name((a) => {
      S(s, a), a.fatal ? r.abort() : r.dirty();
    }, "addIssue"), get path() {
      return s.path;
    } };
    if (i.addIssue = i.addIssue.bind(i), n.type === "preprocess") {
      let a = n.transform(s.data, i);
      if (s.common.async) return Promise.resolve(a).then(async (o) => {
        if (r.value === "aborted") return R;
        let c = await this._def.schema._parseAsync({ data: o, path: s.path, parent: s });
        return c.status === "aborted" ? R : c.status === "dirty" ? tt(c.value) : r.value === "dirty" ? tt(c.value) : c;
      });
      {
        if (r.value === "aborted") return R;
        let o = this._def.schema._parseSync({ data: a, path: s.path, parent: s });
        return o.status === "aborted" ? R : o.status === "dirty" ? tt(o.value) : r.value === "dirty" ? tt(o.value) : o;
      }
    }
    if (n.type === "refinement") {
      let a = /* @__PURE__ */ __name((o) => {
        let c = n.refinement(o, i);
        if (s.common.async) return Promise.resolve(c);
        if (c instanceof Promise) throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return o;
      }, "a");
      if (s.common.async === false) {
        let o = this._def.schema._parseSync({ data: s.data, path: s.path, parent: s });
        return o.status === "aborted" ? R : (o.status === "dirty" && r.dirty(), a(o.value), { status: r.value, value: o.value });
      } else return this._def.schema._parseAsync({ data: s.data, path: s.path, parent: s }).then((o) => o.status === "aborted" ? R : (o.status === "dirty" && r.dirty(), a(o.value).then(() => ({ status: r.value, value: o.value }))));
    }
    if (n.type === "transform") if (s.common.async === false) {
      let a = this._def.schema._parseSync({ data: s.data, path: s.path, parent: s });
      if (!Fe(a)) return R;
      let o = n.transform(a.value, i);
      if (o instanceof Promise) throw new Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");
      return { status: r.value, value: o };
    } else return this._def.schema._parseAsync({ data: s.data, path: s.path, parent: s }).then((a) => Fe(a) ? Promise.resolve(n.transform(a.value, i)).then((o) => ({ status: r.value, value: o })) : R);
    j.assertNever(n);
  }
};
le.create = (e20, t, r) => new le({ schema: e20, typeName: I.ZodEffects, effect: t, ...P(r) });
le.createWithPreprocess = (e20, t, r) => new le({ schema: t, effect: { type: "preprocess", transform: e20 }, typeName: I.ZodEffects, ...P(r) });
var oe = class extends L {
  static {
    __name(this, "oe");
  }
  _parse(t) {
    return this._getType(t) === k.undefined ? J(void 0) : this._def.innerType._parse(t);
  }
  unwrap() {
    return this._def.innerType;
  }
};
oe.create = (e20, t) => new oe({ innerType: e20, typeName: I.ZodOptional, ...P(t) });
var be = class extends L {
  static {
    __name(this, "be");
  }
  _parse(t) {
    return this._getType(t) === k.null ? J(null) : this._def.innerType._parse(t);
  }
  unwrap() {
    return this._def.innerType;
  }
};
be.create = (e20, t) => new be({ innerType: e20, typeName: I.ZodNullable, ...P(t) });
var ft = class extends L {
  static {
    __name(this, "ft");
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t), s = r.data;
    return r.parsedType === k.undefined && (s = this._def.defaultValue()), this._def.innerType._parse({ data: s, path: r.path, parent: r });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ft.create = (e20, t) => new ft({ innerType: e20, typeName: I.ZodDefault, defaultValue: typeof t.default == "function" ? t.default : () => t.default, ...P(t) });
var mt = class extends L {
  static {
    __name(this, "mt");
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t), s = { ...r, common: { ...r.common, issues: [] } }, n = this._def.innerType._parse({ data: s.data, path: s.path, parent: { ...s } });
    return Pt(n) ? n.then((i) => ({ status: "valid", value: i.status === "valid" ? i.value : this._def.catchValue({ get error() {
      return new Y(s.common.issues);
    }, input: s.data }) })) : { status: "valid", value: n.status === "valid" ? n.value : this._def.catchValue({ get error() {
      return new Y(s.common.issues);
    }, input: s.data }) };
  }
  removeCatch() {
    return this._def.innerType;
  }
};
mt.create = (e20, t) => new mt({ innerType: e20, typeName: I.ZodCatch, catchValue: typeof t.catch == "function" ? t.catch : () => t.catch, ...P(t) });
var $t = class extends L {
  static {
    __name(this, "$t");
  }
  _parse(t) {
    if (this._getType(t) !== k.nan) {
      let s = this._getOrReturnCtx(t);
      return S(s, { code: w.invalid_type, expected: k.nan, received: s.parsedType }), R;
    }
    return { status: "valid", value: t.data };
  }
};
$t.create = (e20) => new $t({ typeName: I.ZodNaN, ...P(e20) });
var jh = /* @__PURE__ */ Symbol("zod_brand");
var ir = class extends L {
  static {
    __name(this, "ir");
  }
  _parse(t) {
    let { ctx: r } = this._processInputParams(t), s = r.data;
    return this._def.type._parse({ data: s, path: r.path, parent: r });
  }
  unwrap() {
    return this._def.type;
  }
};
var ar = class e15 extends L {
  static {
    __name(this, "e");
  }
  _parse(t) {
    let { status: r, ctx: s } = this._processInputParams(t);
    if (s.common.async) return (async () => {
      let i = await this._def.in._parseAsync({ data: s.data, path: s.path, parent: s });
      return i.status === "aborted" ? R : i.status === "dirty" ? (r.dirty(), tt(i.value)) : this._def.out._parseAsync({ data: i.value, path: s.path, parent: s });
    })();
    {
      let n = this._def.in._parseSync({ data: s.data, path: s.path, parent: s });
      return n.status === "aborted" ? R : n.status === "dirty" ? (r.dirty(), { status: "dirty", value: n.value }) : this._def.out._parseSync({ data: n.value, path: s.path, parent: s });
    }
  }
  static create(t, r) {
    return new e15({ in: t, out: r, typeName: I.ZodPipeline });
  }
};
var gt = class extends L {
  static {
    __name(this, "gt");
  }
  _parse(t) {
    let r = this._def.innerType._parse(t), s = /* @__PURE__ */ __name((n) => (Fe(n) && (n.value = Object.freeze(n.value)), n), "s");
    return Pt(r) ? r.then((n) => s(n)) : s(r);
  }
  unwrap() {
    return this._def.innerType;
  }
};
gt.create = (e20, t) => new gt({ innerType: e20, typeName: I.ZodReadonly, ...P(t) });
function mi(e20, t) {
  let r = typeof e20 == "function" ? e20(t) : typeof e20 == "string" ? { message: e20 } : e20;
  return typeof r == "string" ? { message: r } : r;
}
__name(mi, "mi");
function _i(e20, t = {}, r) {
  return e20 ? ze.create().superRefine((s, n) => {
    let i = e20(s);
    if (i instanceof Promise) return i.then((a) => {
      if (!a) {
        let o = mi(t, s), c = o.fatal ?? r ?? true;
        n.addIssue({ code: "custom", ...o, fatal: c });
      }
    });
    if (!i) {
      let a = mi(t, s), o = a.fatal ?? r ?? true;
      n.addIssue({ code: "custom", ...a, fatal: o });
    }
  }) : ze.create();
}
__name(_i, "_i");
var Uh = { object: Z.lazycreate };
var I;
(function(e20) {
  e20.ZodString = "ZodString", e20.ZodNumber = "ZodNumber", e20.ZodNaN = "ZodNaN", e20.ZodBigInt = "ZodBigInt", e20.ZodBoolean = "ZodBoolean", e20.ZodDate = "ZodDate", e20.ZodSymbol = "ZodSymbol", e20.ZodUndefined = "ZodUndefined", e20.ZodNull = "ZodNull", e20.ZodAny = "ZodAny", e20.ZodUnknown = "ZodUnknown", e20.ZodNever = "ZodNever", e20.ZodVoid = "ZodVoid", e20.ZodArray = "ZodArray", e20.ZodObject = "ZodObject", e20.ZodUnion = "ZodUnion", e20.ZodDiscriminatedUnion = "ZodDiscriminatedUnion", e20.ZodIntersection = "ZodIntersection", e20.ZodTuple = "ZodTuple", e20.ZodRecord = "ZodRecord", e20.ZodMap = "ZodMap", e20.ZodSet = "ZodSet", e20.ZodFunction = "ZodFunction", e20.ZodLazy = "ZodLazy", e20.ZodLiteral = "ZodLiteral", e20.ZodEnum = "ZodEnum", e20.ZodEffects = "ZodEffects", e20.ZodNativeEnum = "ZodNativeEnum", e20.ZodOptional = "ZodOptional", e20.ZodNullable = "ZodNullable", e20.ZodDefault = "ZodDefault", e20.ZodCatch = "ZodCatch", e20.ZodPromise = "ZodPromise", e20.ZodBranded = "ZodBranded", e20.ZodPipeline = "ZodPipeline", e20.ZodReadonly = "ZodReadonly";
})(I || (I = {}));
var Dh = /* @__PURE__ */ __name((e20, t = { message: `Input not instance of ${e20.name}` }) => _i((r) => r instanceof e20, t), "Dh");
var bi = qe.create;
var xi = rt.create;
var $h = $t.create;
var Bh = st.create;
var Si = nt.create;
var Mh = it.create;
var Fh = Nt.create;
var qh = at.create;
var zh = ot.create;
var Vh = ze.create;
var Hh = Le.create;
var Kh = pe.create;
var Wh = jt.create;
var Gh = Ne.create;
var Jh = Z.create;
var Xh = Z.strictCreate;
var Yh = ct.create;
var Zh = Vr.create;
var Qh = lt.create;
var ep = _e.create;
var tp = Hr.create;
var rp = Ut.create;
var sp = Dt.create;
var np = Kr.create;
var ip = ut.create;
var ap = dt.create;
var op = ht.create;
var cp = pt.create;
var lp = Ve.create;
var up = le.create;
var dp = oe.create;
var hp = be.create;
var pp = le.createWithPreprocess;
var fp = ar.create;
var mp = /* @__PURE__ */ __name(() => bi().optional(), "mp");
var gp = /* @__PURE__ */ __name(() => xi().optional(), "gp");
var yp = /* @__PURE__ */ __name(() => Si().optional(), "yp");
var wp = { string: /* @__PURE__ */ __name(((e20) => qe.create({ ...e20, coerce: true })), "string"), number: /* @__PURE__ */ __name(((e20) => rt.create({ ...e20, coerce: true })), "number"), boolean: /* @__PURE__ */ __name(((e20) => nt.create({ ...e20, coerce: true })), "boolean"), bigint: /* @__PURE__ */ __name(((e20) => st.create({ ...e20, coerce: true })), "bigint"), date: /* @__PURE__ */ __name(((e20) => it.create({ ...e20, coerce: true })), "date") };
var vp = R;
var Zs = Response;
function Wr(e20) {
  return e20.headers.get("x-request-id") ?? crypto.randomUUID();
}
__name(Wr, "Wr");
function or(e20, t) {
  let { requestId: r, headers: s, ...n } = t ?? {};
  return Zs.json({ ok: true, data: e20, requestId: r }, { ...n, headers: { ...r ? { "x-request-id": r } : {}, ...Object.fromEntries(new Headers(s).entries()) } });
}
__name(or, "or");
function xe(e20, t, r) {
  let { requestId: s, headers: n, ...i } = r ?? {};
  return Zs.json({ ok: false, error: e20, requestId: s }, { status: t, ...i, headers: { ...s ? { "x-request-id": s } : {}, ...Object.fromEntries(new Headers(n).entries()) } });
}
__name(xe, "xe");
var Ei = h.string().trim().regex(/^\+[1-9][0-9]{6,14}$/, "Use an international number, for example +27215550100");
var je = h.object({ phone: Ei.optional(), whatsapp: Ei.optional(), email: h.string().trim().max(254).email().optional() }).strict();
function _p(e20) {
  return !!(e20?.phone || e20?.whatsapp || e20?.email);
}
__name(_p, "_p");
function bp(e20, t) {
  if (t !== true) return null;
  let r = je.safeParse(e20);
  return r.success && _p(r.data) ? r.data : null;
}
__name(bp, "bp");
function ki(e20) {
  if (!e20 || typeof e20 != "object" || Array.isArray(e20)) return null;
  let t = e20;
  return bp(t.publicContact, t.contactConsent);
}
__name(ki, "ki");
function yt(e20, t) {
  var r = {};
  for (var s in e20) Object.prototype.hasOwnProperty.call(e20, s) && t.indexOf(s) < 0 && (r[s] = e20[s]);
  if (e20 != null && typeof Object.getOwnPropertySymbols == "function") for (var n = 0, s = Object.getOwnPropertySymbols(e20); n < s.length; n++) t.indexOf(s[n]) < 0 && Object.prototype.propertyIsEnumerable.call(e20, s[n]) && (r[s[n]] = e20[s[n]]);
  return r;
}
__name(yt, "yt");
function Ti(e20, t, r, s) {
  function n(i) {
    return i instanceof r ? i : new r(function(a) {
      a(i);
    });
  }
  __name(n, "n");
  return new (r || (r = Promise))(function(i, a) {
    function o(u) {
      try {
        l(s.next(u));
      } catch (d) {
        a(d);
      }
    }
    __name(o, "o");
    function c(u) {
      try {
        l(s.throw(u));
      } catch (d) {
        a(d);
      }
    }
    __name(c, "c");
    function l(u) {
      u.done ? i(u.value) : n(u.value).then(o, c);
    }
    __name(l, "l");
    l((s = s.apply(e20, t || [])).next());
  });
}
__name(Ti, "Ti");
var Ai = /* @__PURE__ */ __name((e20) => e20 ? (...t) => e20(...t) : (...t) => fetch(...t), "Ai");
var Bt = class extends Error {
  static {
    __name(this, "Bt");
  }
  constructor(t, r = "FunctionsError", s) {
    super(t), this.name = r, this.context = s;
  }
  toJSON() {
    return { name: this.name, message: this.message, context: this.context };
  }
};
var cr = class extends Bt {
  static {
    __name(this, "cr");
  }
  constructor(t) {
    super("Failed to send a request to the Edge Function", "FunctionsFetchError", t);
  }
};
var Mt = class extends Bt {
  static {
    __name(this, "Mt");
  }
  constructor(t) {
    super("Relay Error invoking the Edge Function", "FunctionsRelayError", t);
  }
};
var Ft = class extends Bt {
  static {
    __name(this, "Ft");
  }
  constructor(t) {
    super("Edge Function returned a non-2xx status code", "FunctionsHttpError", t);
  }
};
var lr;
(function(e20) {
  e20.Any = "any", e20.ApNortheast1 = "ap-northeast-1", e20.ApNortheast2 = "ap-northeast-2", e20.ApSouth1 = "ap-south-1", e20.ApSoutheast1 = "ap-southeast-1", e20.ApSoutheast2 = "ap-southeast-2", e20.CaCentral1 = "ca-central-1", e20.EuCentral1 = "eu-central-1", e20.EuWest1 = "eu-west-1", e20.EuWest2 = "eu-west-2", e20.EuWest3 = "eu-west-3", e20.SaEast1 = "sa-east-1", e20.UsEast1 = "us-east-1", e20.UsWest1 = "us-west-1", e20.UsWest2 = "us-west-2";
})(lr || (lr = {}));
var ur = class {
  static {
    __name(this, "ur");
  }
  constructor(t, { headers: r = {}, customFetch: s, region: n = lr.Any } = {}) {
    this.url = t, this.headers = r, this.region = n, this.fetch = Ai(s);
  }
  setAuth(t) {
    this.headers.Authorization = `Bearer ${t}`;
  }
  invoke(t) {
    return Ti(this, arguments, void 0, function* (r, s = {}) {
      var n;
      let i, a;
      try {
        let { headers: o, method: c, body: l, signal: u, timeout: d } = s, f = {}, { region: p } = s;
        p || (p = this.region);
        let g = new URL(`${this.url}/${r}`);
        p && p !== "any" && (f["x-region"] = p, g.searchParams.set("forceFunctionRegion", p));
        let y;
        l && (o && !Object.prototype.hasOwnProperty.call(o, "Content-Type") || !o) ? typeof Blob < "u" && l instanceof Blob || l instanceof ArrayBuffer ? (f["Content-Type"] = "application/octet-stream", y = l) : typeof l == "string" ? (f["Content-Type"] = "text/plain", y = l) : typeof FormData < "u" && l instanceof FormData ? y = l : (f["Content-Type"] = "application/json", y = JSON.stringify(l)) : l && typeof l != "string" && !(typeof Blob < "u" && l instanceof Blob) && !(l instanceof ArrayBuffer) && !(typeof FormData < "u" && l instanceof FormData) ? y = JSON.stringify(l) : y = l;
        let E = u;
        d && (a = new AbortController(), i = setTimeout(() => a.abort(), d), u ? (E = a.signal, u.addEventListener("abort", () => a.abort())) : E = a.signal);
        let v = yield this.fetch(g.toString(), { method: c || "POST", headers: Object.assign(Object.assign(Object.assign({}, f), this.headers), o), body: y, signal: E }).catch((U) => {
          throw new cr(U);
        }), b = v.headers.get("x-relay-error");
        if (b && b === "true") throw new Mt(v);
        if (!v.ok) throw new Ft(v);
        let _ = ((n = v.headers.get("Content-Type")) !== null && n !== void 0 ? n : "text/plain").split(";")[0].trim(), O;
        return _ === "application/json" ? O = yield v.json() : _ === "application/octet-stream" || _ === "application/pdf" ? O = yield v.blob() : _ === "text/event-stream" ? O = v : _ === "multipart/form-data" ? O = yield v.formData() : O = yield v.text(), { data: O, error: null, response: v };
      } catch (o) {
        return { data: null, error: o, response: o instanceof Ft || o instanceof Mt ? o.context : void 0 };
      } finally {
        i && clearTimeout(i);
      }
    });
  }
};
var Ri = /* @__PURE__ */ __name((e20) => Math.min(1e3 * 2 ** e20, 3e4), "Ri");
var xp = [520, 503];
var Pi = ["GET", "HEAD", "OPTIONS"];
var Li = class extends Error {
  static {
    __name(this, "Li");
  }
  constructor(e20) {
    super(e20.message), this.name = "PostgrestError", this.details = e20.details, this.hint = e20.hint, this.code = e20.code;
  }
  toJSON() {
    return { name: this.name, message: this.message, details: this.details, hint: this.hint, code: this.code };
  }
};
function Ci(e20, t) {
  return new Promise((r) => {
    if (t?.aborted) {
      r();
      return;
    }
    let s = setTimeout(() => {
      t?.removeEventListener("abort", n), r();
    }, e20);
    function n() {
      clearTimeout(s), r();
    }
    __name(n, "n");
    t?.addEventListener("abort", n);
  });
}
__name(Ci, "Ci");
function Sp(e20, t, r, s) {
  return !(!s || r >= 3 || !Pi.includes(e20) || !xp.includes(t));
}
__name(Sp, "Sp");
var Ep = class {
  static {
    __name(this, "Ep");
  }
  constructor(e20) {
    var t, r, s, n, i;
    this.shouldThrowOnError = false, this.retryEnabled = true, this.method = e20.method, this.url = e20.url, this.headers = new Headers(e20.headers), this.schema = e20.schema, this.body = e20.body, this.shouldThrowOnError = (t = e20.shouldThrowOnError) !== null && t !== void 0 ? t : false, this.signal = e20.signal, this.isMaybeSingle = (r = e20.isMaybeSingle) !== null && r !== void 0 ? r : false, this.shouldStripNulls = (s = e20.shouldStripNulls) !== null && s !== void 0 ? s : false, this.urlLengthLimit = (n = e20.urlLengthLimit) !== null && n !== void 0 ? n : 8e3, this.retryEnabled = (i = e20.retry) !== null && i !== void 0 ? i : true, e20.fetch ? this.fetch = e20.fetch : this.fetch = fetch;
  }
  throwOnError() {
    return this.shouldThrowOnError = true, this;
  }
  stripNulls() {
    if (this.headers.get("Accept") === "text/csv") throw new Error("stripNulls() cannot be used with csv()");
    return this.shouldStripNulls = true, this;
  }
  setHeader(e20, t) {
    return this.headers = new Headers(this.headers), this.headers.set(e20, t), this;
  }
  retry(e20) {
    return this.retryEnabled = e20, this;
  }
  then(e20, t) {
    var r = this;
    if (this.schema === void 0 || (["GET", "HEAD"].includes(this.method) ? this.headers.set("Accept-Profile", this.schema) : this.headers.set("Content-Profile", this.schema)), this.method !== "GET" && this.method !== "HEAD" && this.headers.set("Content-Type", "application/json"), this.shouldStripNulls) {
      let a = this.headers.get("Accept");
      a === "application/vnd.pgrst.object+json" ? this.headers.set("Accept", "application/vnd.pgrst.object+json;nulls=stripped") : (!a || a === "application/json") && this.headers.set("Accept", "application/vnd.pgrst.array+json;nulls=stripped");
    }
    let s = this.fetch, i = (async () => {
      let a = 0;
      for (; ; ) {
        let l = new Headers(r.headers);
        a > 0 && l.set("X-Retry-Count", String(a));
        let u;
        try {
          u = await s(r.url.toString(), { method: r.method, headers: l, body: JSON.stringify(r.body, (d, f) => typeof f == "bigint" ? f.toString() : f), signal: r.signal });
        } catch (d) {
          if (d?.name === "AbortError" || d?.code === "ABORT_ERR" || !Pi.includes(r.method)) throw d;
          if (r.retryEnabled && a < 3) {
            let f = Ri(a);
            a++, await Ci(f, r.signal);
            continue;
          }
          throw d;
        }
        if (Sp(r.method, u.status, a, r.retryEnabled)) {
          var o, c;
          let d = (o = (c = u.headers) === null || c === void 0 ? void 0 : c.get("Retry-After")) !== null && o !== void 0 ? o : null, f = d !== null ? Math.max(0, parseInt(d, 10) || 0) * 1e3 : Ri(a);
          await u.text(), a++, await Ci(f, r.signal);
          continue;
        }
        return await r.processResponse(u);
      }
    })();
    return this.shouldThrowOnError || (i = i.catch((a) => {
      var o;
      let c = "", l = "", u = "", d = a?.cause;
      if (d) {
        var f, p, g, y;
        let b = (f = d?.message) !== null && f !== void 0 ? f : "", _ = (p = d?.code) !== null && p !== void 0 ? p : "";
        c = `${(g = a?.name) !== null && g !== void 0 ? g : "FetchError"}: ${a?.message}`, c += `

Caused by: ${(y = d?.name) !== null && y !== void 0 ? y : "Error"}: ${b}`, _ && (c += ` (${_})`), d?.stack && (c += `
${d.stack}`);
      } else {
        var E;
        c = (E = a?.stack) !== null && E !== void 0 ? E : "";
      }
      let v = this.url.toString().length;
      return a?.name === "AbortError" || a?.code === "ABORT_ERR" ? (u = "", l = "Request was aborted (timeout or manual cancellation)", v > this.urlLengthLimit && (l += `. Note: Your request URL is ${v} characters, which may exceed server limits. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [many IDs])), consider using an RPC function to pass values server-side.`)) : (d?.name === "HeadersOverflowError" || d?.code === "UND_ERR_HEADERS_OVERFLOW") && (u = "", l = "HTTP headers exceeded server limits (typically 16KB)", v > this.urlLengthLimit && (l += `. Your request URL is ${v} characters. If selecting many fields, consider using views. If filtering with large arrays (e.g., .in('id', [200+ IDs])), consider using an RPC function instead.`)), { success: false, error: { message: `${(o = a?.name) !== null && o !== void 0 ? o : "FetchError"}: ${a?.message}`, details: c, hint: l, code: u }, data: null, count: null, status: 0, statusText: "" };
    })), i.then(e20, t);
  }
  async processResponse(e20) {
    var t = this;
    let r = null, s = null, n = null, i = e20.status, a = e20.statusText;
    if (e20.ok) {
      var o, c;
      if (t.method !== "HEAD") {
        var l;
        let f = await e20.text();
        f === "" || (t.headers.get("Accept") === "text/csv" || t.headers.get("Accept") && (!((l = t.headers.get("Accept")) === null || l === void 0) && l.includes("application/vnd.pgrst.plan+text")) ? s = f : s = JSON.parse(f));
      }
      let u = (o = t.headers.get("Prefer")) === null || o === void 0 ? void 0 : o.match(/count=(exact|planned|estimated)/), d = (c = e20.headers.get("content-range")) === null || c === void 0 ? void 0 : c.split("/");
      u && d && d.length > 1 && (n = parseInt(d[1])), t.isMaybeSingle && Array.isArray(s) && (s.length > 1 ? (r = { code: "PGRST116", details: `Results contain ${s.length} rows, application/vnd.pgrst.object+json requires 1 row`, hint: null, message: "JSON object requested, multiple (or no) rows returned" }, s = null, n = null, i = 406, a = "Not Acceptable") : s.length === 1 ? s = s[0] : s = null);
    } else {
      let u = await e20.text();
      try {
        r = JSON.parse(u), Array.isArray(r) && e20.status === 404 && (s = [], r = null, i = 200, a = "OK");
      } catch {
        e20.status === 404 && u === "" ? (i = 204, a = "No Content") : r = { message: u };
      }
      if (r && t.shouldThrowOnError) throw new Li(r);
    }
    return { success: r === null, error: r, data: s, count: n, status: i, statusText: a };
  }
  returns() {
    return this;
  }
  overrideTypes() {
    return this;
  }
};
var kp = class extends Ep {
  static {
    __name(this, "kp");
  }
  select(e20) {
    let t = false, r = (e20 ?? "*").split("").map((s) => /\s/.test(s) && !t ? "" : (s === '"' && (t = !t), s)).join("");
    return this.url.searchParams.set("select", r), this.headers.append("Prefer", "return=representation"), this;
  }
  order(e20, { ascending: t = true, nullsFirst: r, foreignTable: s, referencedTable: n = s } = {}) {
    let i = n ? `${n}.order` : "order", a = this.url.searchParams.get(i);
    return this.url.searchParams.set(i, `${a ? `${a},` : ""}${e20}.${t ? "asc" : "desc"}${r === void 0 ? "" : r ? ".nullsfirst" : ".nullslast"}`), this;
  }
  limit(e20, { foreignTable: t, referencedTable: r = t } = {}) {
    let s = typeof r > "u" ? "limit" : `${r}.limit`;
    return this.url.searchParams.set(s, `${e20}`), this;
  }
  range(e20, t, { foreignTable: r, referencedTable: s = r } = {}) {
    let n = typeof s > "u" ? "offset" : `${s}.offset`, i = typeof s > "u" ? "limit" : `${s}.limit`;
    return this.url.searchParams.set(n, `${e20}`), this.url.searchParams.set(i, `${t - e20 + 1}`), this;
  }
  abortSignal(e20) {
    return this.signal = e20, this;
  }
  single() {
    return this.headers.set("Accept", "application/vnd.pgrst.object+json"), this;
  }
  maybeSingle() {
    return this.isMaybeSingle = true, this;
  }
  csv() {
    return this.headers.set("Accept", "text/csv"), this;
  }
  geojson() {
    return this.headers.set("Accept", "application/geo+json"), this;
  }
  explain({ analyze: e20 = false, verbose: t = false, settings: r = false, buffers: s = false, wal: n = false, format: i = "text" } = {}) {
    var a;
    let o = [e20 ? "analyze" : null, t ? "verbose" : null, r ? "settings" : null, s ? "buffers" : null, n ? "wal" : null].filter(Boolean).join("|"), c = (a = this.headers.get("Accept")) !== null && a !== void 0 ? a : "application/json";
    return this.headers.set("Accept", `application/vnd.pgrst.plan+${i}; for="${c}"; options=${o};`), i === "json" ? this : this;
  }
  rollback() {
    return this.headers.append("Prefer", "tx=rollback"), this;
  }
  returns() {
    return this;
  }
  maxAffected(e20) {
    return this.headers.append("Prefer", "handling=strict"), this.headers.append("Prefer", `max-affected=${e20}`), this;
  }
};
var Oi = new RegExp("[,()]");
var qt = class extends kp {
  static {
    __name(this, "qt");
  }
  eq(e20, t) {
    return this.url.searchParams.append(e20, `eq.${t}`), this;
  }
  neq(e20, t) {
    return this.url.searchParams.append(e20, `neq.${t}`), this;
  }
  gt(e20, t) {
    return this.url.searchParams.append(e20, `gt.${t}`), this;
  }
  gte(e20, t) {
    return this.url.searchParams.append(e20, `gte.${t}`), this;
  }
  lt(e20, t) {
    return this.url.searchParams.append(e20, `lt.${t}`), this;
  }
  lte(e20, t) {
    return this.url.searchParams.append(e20, `lte.${t}`), this;
  }
  like(e20, t) {
    return this.url.searchParams.append(e20, `like.${t}`), this;
  }
  likeAllOf(e20, t) {
    return this.url.searchParams.append(e20, `like(all).{${t.join(",")}}`), this;
  }
  likeAnyOf(e20, t) {
    return this.url.searchParams.append(e20, `like(any).{${t.join(",")}}`), this;
  }
  ilike(e20, t) {
    return this.url.searchParams.append(e20, `ilike.${t}`), this;
  }
  ilikeAllOf(e20, t) {
    return this.url.searchParams.append(e20, `ilike(all).{${t.join(",")}}`), this;
  }
  ilikeAnyOf(e20, t) {
    return this.url.searchParams.append(e20, `ilike(any).{${t.join(",")}}`), this;
  }
  regexMatch(e20, t) {
    return this.url.searchParams.append(e20, `match.${t}`), this;
  }
  regexIMatch(e20, t) {
    return this.url.searchParams.append(e20, `imatch.${t}`), this;
  }
  is(e20, t) {
    return this.url.searchParams.append(e20, `is.${t}`), this;
  }
  isDistinct(e20, t) {
    return this.url.searchParams.append(e20, `isdistinct.${t}`), this;
  }
  in(e20, t) {
    let r = Array.from(new Set(t)).map((s) => typeof s == "string" && Oi.test(s) ? `"${s}"` : `${s}`).join(",");
    return this.url.searchParams.append(e20, `in.(${r})`), this;
  }
  notIn(e20, t) {
    let r = Array.from(new Set(t)).map((s) => typeof s == "string" && Oi.test(s) ? `"${s}"` : `${s}`).join(",");
    return this.url.searchParams.append(e20, `not.in.(${r})`), this;
  }
  contains(e20, t) {
    return typeof t == "string" ? this.url.searchParams.append(e20, `cs.${t}`) : Array.isArray(t) ? this.url.searchParams.append(e20, `cs.{${t.join(",")}}`) : this.url.searchParams.append(e20, `cs.${JSON.stringify(t)}`), this;
  }
  containedBy(e20, t) {
    return typeof t == "string" ? this.url.searchParams.append(e20, `cd.${t}`) : Array.isArray(t) ? this.url.searchParams.append(e20, `cd.{${t.join(",")}}`) : this.url.searchParams.append(e20, `cd.${JSON.stringify(t)}`), this;
  }
  rangeGt(e20, t) {
    return this.url.searchParams.append(e20, `sr.${t}`), this;
  }
  rangeGte(e20, t) {
    return this.url.searchParams.append(e20, `nxl.${t}`), this;
  }
  rangeLt(e20, t) {
    return this.url.searchParams.append(e20, `sl.${t}`), this;
  }
  rangeLte(e20, t) {
    return this.url.searchParams.append(e20, `nxr.${t}`), this;
  }
  rangeAdjacent(e20, t) {
    return this.url.searchParams.append(e20, `adj.${t}`), this;
  }
  overlaps(e20, t) {
    return typeof t == "string" ? this.url.searchParams.append(e20, `ov.${t}`) : this.url.searchParams.append(e20, `ov.{${t.join(",")}}`), this;
  }
  textSearch(e20, t, { config: r, type: s } = {}) {
    let n = "";
    s === "plain" ? n = "pl" : s === "phrase" ? n = "ph" : s === "websearch" && (n = "w");
    let i = r === void 0 ? "" : `(${r})`;
    return this.url.searchParams.append(e20, `${n}fts${i}.${t}`), this;
  }
  match(e20) {
    return Object.entries(e20).filter(([t, r]) => r !== void 0).forEach(([t, r]) => {
      this.url.searchParams.append(t, `eq.${r}`);
    }), this;
  }
  not(e20, t, r) {
    return this.url.searchParams.append(e20, `not.${t}.${r}`), this;
  }
  or(e20, { foreignTable: t, referencedTable: r = t } = {}) {
    let s = r ? `${r}.or` : "or";
    return this.url.searchParams.append(s, `(${e20})`), this;
  }
  filter(e20, t, r) {
    return this.url.searchParams.append(e20, `${t}.${r}`), this;
  }
};
var Tp = class {
  static {
    __name(this, "Tp");
  }
  constructor(e20, { headers: t = {}, schema: r, fetch: s, urlLengthLimit: n = 8e3, retry: i }) {
    this.url = e20, this.headers = new Headers(t), this.schema = r, this.fetch = s, this.urlLengthLimit = n, this.retry = i;
  }
  cloneRequestState() {
    return { url: new URL(this.url.toString()), headers: new Headers(this.headers) };
  }
  select(e20, t) {
    let { head: r = false, count: s } = t ?? {}, n = r ? "HEAD" : "GET", i = false, a = (e20 ?? "*").split("").map((l) => /\s/.test(l) && !i ? "" : (l === '"' && (i = !i), l)).join(""), { url: o, headers: c } = this.cloneRequestState();
    return o.searchParams.set("select", a), s && c.append("Prefer", `count=${s}`), new qt({ method: n, url: o, headers: c, schema: this.schema, fetch: this.fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
  insert(e20, { count: t, defaultToNull: r = true } = {}) {
    var s;
    let n = "POST", { url: i, headers: a } = this.cloneRequestState();
    if (t && a.append("Prefer", `count=${t}`), r || a.append("Prefer", "missing=default"), Array.isArray(e20)) {
      let o = e20.reduce((c, l) => c.concat(Object.keys(l)), []);
      if (o.length > 0) {
        let c = [...new Set(o)].map((l) => `"${l}"`);
        i.searchParams.set("columns", c.join(","));
      }
    }
    return new qt({ method: n, url: i, headers: a, schema: this.schema, body: e20, fetch: (s = this.fetch) !== null && s !== void 0 ? s : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
  upsert(e20, { onConflict: t, ignoreDuplicates: r = false, count: s, defaultToNull: n = true } = {}) {
    var i;
    let a = "POST", { url: o, headers: c } = this.cloneRequestState();
    if (c.append("Prefer", `resolution=${r ? "ignore" : "merge"}-duplicates`), t !== void 0 && o.searchParams.set("on_conflict", t), s && c.append("Prefer", `count=${s}`), n || c.append("Prefer", "missing=default"), Array.isArray(e20)) {
      let l = e20.reduce((u, d) => u.concat(Object.keys(d)), []);
      if (l.length > 0) {
        let u = [...new Set(l)].map((d) => `"${d}"`);
        o.searchParams.set("columns", u.join(","));
      }
    }
    return new qt({ method: a, url: o, headers: c, schema: this.schema, body: e20, fetch: (i = this.fetch) !== null && i !== void 0 ? i : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
  update(e20, { count: t } = {}) {
    var r;
    let s = "PATCH", { url: n, headers: i } = this.cloneRequestState();
    return t && i.append("Prefer", `count=${t}`), new qt({ method: s, url: n, headers: i, schema: this.schema, body: e20, fetch: (r = this.fetch) !== null && r !== void 0 ? r : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
  delete({ count: e20 } = {}) {
    var t;
    let r = "DELETE", { url: s, headers: n } = this.cloneRequestState();
    return e20 && n.append("Prefer", `count=${e20}`), new qt({ method: r, url: s, headers: n, schema: this.schema, fetch: (t = this.fetch) !== null && t !== void 0 ? t : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
};
function dr(e20) {
  "@babel/helpers - typeof";
  return dr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, dr(e20);
}
__name(dr, "dr");
function Ap(e20, t) {
  if (dr(e20) != "object" || !e20) return e20;
  var r = e20[Symbol.toPrimitive];
  if (r !== void 0) {
    var s = r.call(e20, t || "default");
    if (dr(s) != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e20);
}
__name(Ap, "Ap");
function Rp(e20) {
  var t = Ap(e20, "string");
  return dr(t) == "symbol" ? t : t + "";
}
__name(Rp, "Rp");
function Cp(e20, t, r) {
  return (t = Rp(t)) in e20 ? Object.defineProperty(e20, t, { value: r, enumerable: true, configurable: true, writable: true }) : e20[t] = r, e20;
}
__name(Cp, "Cp");
function Ii(e20, t) {
  var r = Object.keys(e20);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(e20);
    t && (s = s.filter(function(n) {
      return Object.getOwnPropertyDescriptor(e20, n).enumerable;
    })), r.push.apply(r, s);
  }
  return r;
}
__name(Ii, "Ii");
function Gr(e20) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Ii(Object(r), true).forEach(function(s) {
      Cp(e20, s, r[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e20, Object.getOwnPropertyDescriptors(r)) : Ii(Object(r)).forEach(function(s) {
      Object.defineProperty(e20, s, Object.getOwnPropertyDescriptor(r, s));
    });
  }
  return e20;
}
__name(Gr, "Gr");
var Ni = class ji {
  static {
    __name(this, "ji");
  }
  constructor(t, { headers: r = {}, schema: s, fetch: n, timeout: i, urlLengthLimit: a = 8e3, retry: o } = {}) {
    this.url = t, this.headers = new Headers(r), this.schemaName = s, this.urlLengthLimit = a;
    let c = n ?? globalThis.fetch;
    i !== void 0 && i > 0 ? this.fetch = (l, u) => {
      let d = new AbortController(), f = setTimeout(() => d.abort(), i), p = u?.signal;
      if (p) {
        if (p.aborted) return clearTimeout(f), c(l, u);
        let g = /* @__PURE__ */ __name(() => {
          clearTimeout(f), d.abort();
        }, "g");
        return p.addEventListener("abort", g, { once: true }), c(l, Gr(Gr({}, u), {}, { signal: d.signal })).finally(() => {
          clearTimeout(f), p.removeEventListener("abort", g);
        });
      }
      return c(l, Gr(Gr({}, u), {}, { signal: d.signal })).finally(() => clearTimeout(f));
    } : this.fetch = c, this.retry = o;
  }
  from(t) {
    if (!t || typeof t != "string" || t.trim() === "") throw new Error("Invalid relation name: relation must be a non-empty string.");
    return new Tp(new URL(`${this.url}/${t}`), { headers: new Headers(this.headers), schema: this.schemaName, fetch: this.fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
  schema(t) {
    return new ji(this.url, { headers: this.headers, schema: t, fetch: this.fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
  rpc(t, r = {}, { head: s = false, get: n = false, count: i } = {}) {
    var a;
    let o, c = new URL(`${this.url}/rpc/${t}`), l, u = /* @__PURE__ */ __name((p) => p !== null && typeof p == "object" && (!Array.isArray(p) || p.some(u)), "u"), d = s && Object.values(r).some(u);
    d ? (o = "POST", l = r) : s || n ? (o = s ? "HEAD" : "GET", Object.entries(r).filter(([p, g]) => g !== void 0).map(([p, g]) => [p, Array.isArray(g) ? `{${g.join(",")}}` : `${g}`]).forEach(([p, g]) => {
      c.searchParams.append(p, g);
    })) : (o = "POST", l = r);
    let f = new Headers(this.headers);
    return d ? f.set("Prefer", i ? `count=${i},return=minimal` : "return=minimal") : i && f.set("Prefer", `count=${i}`), new qt({ method: o, url: c, headers: f, schema: this.schemaName, body: l, fetch: (a = this.fetch) !== null && a !== void 0 ? a : fetch, urlLengthLimit: this.urlLengthLimit, retry: this.retry });
  }
};
var Qs = class {
  static {
    __name(this, "Qs");
  }
  constructor() {
  }
  static detectEnvironment() {
    var t;
    if (typeof WebSocket < "u") return { type: "native", constructor: WebSocket };
    if (typeof globalThis < "u" && typeof globalThis.WebSocket < "u") return { type: "native", constructor: globalThis.WebSocket };
    if (typeof global < "u" && typeof global.WebSocket < "u") return { type: "native", constructor: global.WebSocket };
    if (typeof globalThis < "u" && typeof globalThis.WebSocketPair < "u" && typeof globalThis.WebSocket > "u") return { type: "cloudflare", error: "Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.", workaround: "Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime." };
    if (typeof globalThis < "u" && globalThis.EdgeRuntime || typeof navigator < "u" && (!((t = "Cloudflare-Workers") === null || t === void 0) && t.includes("Vercel-Edge"))) return { type: "unsupported", error: "Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.", workaround: "Use serverless functions or a different deployment target for WebSocket functionality." };
    let r = globalThis.process;
    if (r) {
      let s = r.versions;
      if (s && s.node) {
        let n = s.node, i = parseInt(n.replace(/^v/, "").split(".")[0]);
        return i >= 22 ? typeof globalThis.WebSocket < "u" ? { type: "native", constructor: globalThis.WebSocket } : { type: "unsupported", error: `Node.js ${i} detected but native WebSocket not found.`, workaround: "Provide a WebSocket implementation via the transport option." } : { type: "unsupported", error: `Node.js ${i} detected without native WebSocket support.`, workaround: `For Node.js < 22, install "ws" package and provide it via the transport option:
import ws from "ws"
new RealtimeClient(url, { transport: ws })` };
      }
    }
    return { type: "unsupported", error: "Unknown JavaScript runtime without WebSocket support.", workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation." };
  }
  static getWebSocketConstructor() {
    let t = this.detectEnvironment();
    if (t.constructor) return t.constructor;
    let r = t.error || "WebSocket not supported in this environment.";
    throw t.workaround && (r += `

Suggested solution: ${t.workaround}`), new Error(r);
  }
  static isWebSocketSupported() {
    try {
      let t = this.detectEnvironment();
      return t.type === "native" || t.type === "ws";
    } catch {
      return false;
    }
  }
};
var en = Qs;
var Ui = "2.105.1";
var Di = `realtime-js/${Ui}`;
var $i = "1.0.0";
var tn = "2.0.0";
var Bi = tn;
var Mi = 1e4;
var Fi = 100;
var Se = { closed: "closed", errored: "errored", joined: "joined", joining: "joining", leaving: "leaving" };
var Jr = { close: "phx_close", error: "phx_error", join: "phx_join", reply: "phx_reply", leave: "phx_leave", access_token: "access_token" };
var hr = { connecting: "connecting", open: "open", closing: "closing", closed: "closed" };
var pr = class {
  static {
    __name(this, "pr");
  }
  constructor(t) {
    this.HEADER_LENGTH = 1, this.USER_BROADCAST_PUSH_META_LENGTH = 6, this.KINDS = { userBroadcastPush: 3, userBroadcast: 4 }, this.BINARY_ENCODING = 0, this.JSON_ENCODING = 1, this.BROADCAST_EVENT = "broadcast", this.allowedMetadataKeys = [], this.allowedMetadataKeys = t ?? [];
  }
  encode(t, r) {
    if (t.event === this.BROADCAST_EVENT && !(t.payload instanceof ArrayBuffer) && typeof t.payload.event == "string") return r(this._binaryEncodeUserBroadcastPush(t));
    let s = [t.join_ref, t.ref, t.topic, t.event, t.payload];
    return r(JSON.stringify(s));
  }
  _binaryEncodeUserBroadcastPush(t) {
    var r;
    return this._isArrayBuffer((r = t.payload) === null || r === void 0 ? void 0 : r.payload) ? this._encodeBinaryUserBroadcastPush(t) : this._encodeJsonUserBroadcastPush(t);
  }
  _encodeBinaryUserBroadcastPush(t) {
    var r, s;
    let n = (s = (r = t.payload) === null || r === void 0 ? void 0 : r.payload) !== null && s !== void 0 ? s : new ArrayBuffer(0);
    return this._encodeUserBroadcastPush(t, this.BINARY_ENCODING, n);
  }
  _encodeJsonUserBroadcastPush(t) {
    var r, s;
    let n = (s = (r = t.payload) === null || r === void 0 ? void 0 : r.payload) !== null && s !== void 0 ? s : {}, a = new TextEncoder().encode(JSON.stringify(n)).buffer;
    return this._encodeUserBroadcastPush(t, this.JSON_ENCODING, a);
  }
  _encodeUserBroadcastPush(t, r, s) {
    var n, i;
    let a = t.topic, o = (n = t.ref) !== null && n !== void 0 ? n : "", c = (i = t.join_ref) !== null && i !== void 0 ? i : "", l = t.payload.event, u = this.allowedMetadataKeys ? this._pick(t.payload, this.allowedMetadataKeys) : {}, d = Object.keys(u).length === 0 ? "" : JSON.stringify(u);
    if (c.length > 255) throw new Error(`joinRef length ${c.length} exceeds maximum of 255`);
    if (o.length > 255) throw new Error(`ref length ${o.length} exceeds maximum of 255`);
    if (a.length > 255) throw new Error(`topic length ${a.length} exceeds maximum of 255`);
    if (l.length > 255) throw new Error(`userEvent length ${l.length} exceeds maximum of 255`);
    if (d.length > 255) throw new Error(`metadata length ${d.length} exceeds maximum of 255`);
    let f = this.USER_BROADCAST_PUSH_META_LENGTH + c.length + o.length + a.length + l.length + d.length, p = new ArrayBuffer(this.HEADER_LENGTH + f), g = new DataView(p), y = 0;
    g.setUint8(y++, this.KINDS.userBroadcastPush), g.setUint8(y++, c.length), g.setUint8(y++, o.length), g.setUint8(y++, a.length), g.setUint8(y++, l.length), g.setUint8(y++, d.length), g.setUint8(y++, r), Array.from(c, (v) => g.setUint8(y++, v.charCodeAt(0))), Array.from(o, (v) => g.setUint8(y++, v.charCodeAt(0))), Array.from(a, (v) => g.setUint8(y++, v.charCodeAt(0))), Array.from(l, (v) => g.setUint8(y++, v.charCodeAt(0))), Array.from(d, (v) => g.setUint8(y++, v.charCodeAt(0)));
    var E = new Uint8Array(p.byteLength + s.byteLength);
    return E.set(new Uint8Array(p), 0), E.set(new Uint8Array(s), p.byteLength), E.buffer;
  }
  decode(t, r) {
    if (this._isArrayBuffer(t)) {
      let s = this._binaryDecode(t);
      return r(s);
    }
    if (typeof t == "string") {
      let s = JSON.parse(t), [n, i, a, o, c] = s;
      return r({ join_ref: n, ref: i, topic: a, event: o, payload: c });
    }
    return r({});
  }
  _binaryDecode(t) {
    let r = new DataView(t), s = r.getUint8(0), n = new TextDecoder();
    if (s === this.KINDS.userBroadcast) return this._decodeUserBroadcast(t, r, n);
  }
  _decodeUserBroadcast(t, r, s) {
    let n = r.getUint8(1), i = r.getUint8(2), a = r.getUint8(3), o = r.getUint8(4), c = this.HEADER_LENGTH + 4, l = s.decode(t.slice(c, c + n));
    c = c + n;
    let u = s.decode(t.slice(c, c + i));
    c = c + i;
    let d = s.decode(t.slice(c, c + a));
    c = c + a;
    let f = t.slice(c, t.byteLength), p = o === this.JSON_ENCODING ? JSON.parse(s.decode(f)) : f, g = { type: this.BROADCAST_EVENT, event: u, payload: p };
    return a > 0 && (g.meta = JSON.parse(d)), { join_ref: null, ref: null, topic: l, event: this.BROADCAST_EVENT, payload: g };
  }
  _isArrayBuffer(t) {
    var r;
    return t instanceof ArrayBuffer || ((r = t?.constructor) === null || r === void 0 ? void 0 : r.name) === "ArrayBuffer";
  }
  _pick(t, r) {
    return !t || typeof t != "object" ? {} : Object.fromEntries(Object.entries(t).filter(([s]) => r.includes(s)));
  }
};
var D;
(function(e20) {
  e20.abstime = "abstime", e20.bool = "bool", e20.date = "date", e20.daterange = "daterange", e20.float4 = "float4", e20.float8 = "float8", e20.int2 = "int2", e20.int4 = "int4", e20.int4range = "int4range", e20.int8 = "int8", e20.int8range = "int8range", e20.json = "json", e20.jsonb = "jsonb", e20.money = "money", e20.numeric = "numeric", e20.oid = "oid", e20.reltime = "reltime", e20.text = "text", e20.time = "time", e20.timestamp = "timestamp", e20.timestamptz = "timestamptz", e20.timetz = "timetz", e20.tsrange = "tsrange", e20.tstzrange = "tstzrange";
})(D || (D = {}));
var sn = /* @__PURE__ */ __name((e20, t, r = {}) => {
  var s;
  let n = (s = r.skipTypes) !== null && s !== void 0 ? s : [];
  return t ? Object.keys(t).reduce((i, a) => (i[a] = Op(a, e20, t, n), i), {}) : {};
}, "sn");
var Op = /* @__PURE__ */ __name((e20, t, r, s) => {
  let n = t.find((o) => o.name === e20), i = n?.type, a = r[e20];
  return i && !s.includes(i) ? qi(i, a) : rn(a);
}, "Op");
var qi = /* @__PURE__ */ __name((e20, t) => {
  if (e20.charAt(0) === "_") {
    let r = e20.slice(1, e20.length);
    return Np(t, r);
  }
  switch (e20) {
    case D.bool:
      return Ip(t);
    case D.float4:
    case D.float8:
    case D.int2:
    case D.int4:
    case D.int8:
    case D.numeric:
    case D.oid:
      return Pp(t);
    case D.json:
    case D.jsonb:
      return Lp(t);
    case D.timestamp:
      return jp(t);
    case D.abstime:
    case D.date:
    case D.daterange:
    case D.int4range:
    case D.int8range:
    case D.money:
    case D.reltime:
    case D.text:
    case D.time:
    case D.timestamptz:
    case D.timetz:
    case D.tsrange:
    case D.tstzrange:
      return rn(t);
    default:
      return rn(t);
  }
}, "qi");
var rn = /* @__PURE__ */ __name((e20) => e20, "rn");
var Ip = /* @__PURE__ */ __name((e20) => {
  switch (e20) {
    case "t":
      return true;
    case "f":
      return false;
    default:
      return e20;
  }
}, "Ip");
var Pp = /* @__PURE__ */ __name((e20) => {
  if (typeof e20 == "string") {
    let t = parseFloat(e20);
    if (!Number.isNaN(t)) return t;
  }
  return e20;
}, "Pp");
var Lp = /* @__PURE__ */ __name((e20) => {
  if (typeof e20 == "string") try {
    return JSON.parse(e20);
  } catch {
    return e20;
  }
  return e20;
}, "Lp");
var Np = /* @__PURE__ */ __name((e20, t) => {
  if (typeof e20 != "string") return e20;
  let r = e20.length - 1, s = e20[r];
  if (e20[0] === "{" && s === "}") {
    let i, a = e20.slice(1, r);
    try {
      i = JSON.parse("[" + a + "]");
    } catch {
      i = a ? a.split(",") : [];
    }
    return i.map((o) => qi(t, o));
  }
  return e20;
}, "Np");
var jp = /* @__PURE__ */ __name((e20) => typeof e20 == "string" ? e20.replace(" ", "T") : e20, "jp");
var Xr = /* @__PURE__ */ __name((e20) => {
  let t = new URL(e20);
  return t.protocol = t.protocol.replace(/^ws/i, "http"), t.pathname = t.pathname.replace(/\/+$/, "").replace(/\/socket\/websocket$/i, "").replace(/\/socket$/i, "").replace(/\/websocket$/i, ""), t.pathname === "" || t.pathname === "/" ? t.pathname = "/api/broadcast" : t.pathname = t.pathname + "/api/broadcast", t.href;
}, "Xr");
var mr = /* @__PURE__ */ __name((e20) => typeof e20 == "function" ? e20 : function() {
  return e20;
}, "mr");
var Dp = typeof self < "u" ? self : null;
var Vt = typeof window < "u" ? window : null;
var Ee = Dp || Vt || globalThis;
var $p = "2.0.0";
var Bp = 1e4;
var Mp = 1e3;
var ke = { connecting: 0, open: 1, closing: 2, closed: 3 };
var Q = { closed: "closed", errored: "errored", joined: "joined", joining: "joining", leaving: "leaving" };
var Ue = { close: "phx_close", error: "phx_error", join: "phx_join", reply: "phx_reply", leave: "phx_leave" };
var nn = { longpoll: "longpoll", websocket: "websocket" };
var Fp = { complete: 4 };
var an = "base64url.bearer.phx.";
var Yr = class {
  static {
    __name(this, "Yr");
  }
  constructor(e20, t, r, s) {
    this.channel = e20, this.event = t, this.payload = r || function() {
      return {};
    }, this.receivedResp = null, this.timeout = s, this.timeoutTimer = null, this.recHooks = [], this.sent = false, this.ref = void 0;
  }
  resend(e20) {
    this.timeout = e20, this.reset(), this.send();
  }
  send() {
    this.hasReceived("timeout") || (this.startTimeout(), this.sent = true, this.channel.socket.push({ topic: this.channel.topic, event: this.event, payload: this.payload(), ref: this.ref, join_ref: this.channel.joinRef() }));
  }
  receive(e20, t) {
    return this.hasReceived(e20) && t(this.receivedResp.response), this.recHooks.push({ status: e20, callback: t }), this;
  }
  reset() {
    this.cancelRefEvent(), this.ref = null, this.refEvent = null, this.receivedResp = null, this.sent = false;
  }
  destroy() {
    this.cancelRefEvent(), this.cancelTimeout();
  }
  matchReceive({ status: e20, response: t, _ref: r }) {
    this.recHooks.filter((s) => s.status === e20).forEach((s) => s.callback(t));
  }
  cancelRefEvent() {
    this.refEvent && this.channel.off(this.refEvent);
  }
  cancelTimeout() {
    clearTimeout(this.timeoutTimer), this.timeoutTimer = null;
  }
  startTimeout() {
    this.timeoutTimer && this.cancelTimeout(), this.ref = this.channel.socket.makeRef(), this.refEvent = this.channel.replyEventName(this.ref), this.channel.on(this.refEvent, (e20) => {
      this.cancelRefEvent(), this.cancelTimeout(), this.receivedResp = e20, this.matchReceive(e20);
    }), this.timeoutTimer = setTimeout(() => {
      this.trigger("timeout", {});
    }, this.timeout);
  }
  hasReceived(e20) {
    return this.receivedResp && this.receivedResp.status === e20;
  }
  trigger(e20, t) {
    this.channel.trigger(this.refEvent, { status: e20, response: t });
  }
};
var zi = class {
  static {
    __name(this, "zi");
  }
  constructor(e20, t) {
    this.callback = e20, this.timerCalc = t, this.timer = void 0, this.tries = 0;
  }
  reset() {
    this.tries = 0, clearTimeout(this.timer);
  }
  scheduleTimeout() {
    clearTimeout(this.timer), this.timer = setTimeout(() => {
      this.tries = this.tries + 1, this.callback();
    }, this.timerCalc(this.tries + 1));
  }
};
var qp = class {
  static {
    __name(this, "qp");
  }
  constructor(e20, t, r) {
    this.state = Q.closed, this.topic = e20, this.params = mr(t || {}), this.socket = r, this.bindings = [], this.bindingRef = 0, this.timeout = this.socket.timeout, this.joinedOnce = false, this.joinPush = new Yr(this, Ue.join, this.params, this.timeout), this.pushBuffer = [], this.stateChangeRefs = [], this.rejoinTimer = new zi(() => {
      this.socket.isConnected() && this.rejoin();
    }, this.socket.rejoinAfterMs), this.stateChangeRefs.push(this.socket.onError(() => this.rejoinTimer.reset())), this.stateChangeRefs.push(this.socket.onOpen(() => {
      this.rejoinTimer.reset(), this.isErrored() && this.rejoin();
    })), this.joinPush.receive("ok", () => {
      this.state = Q.joined, this.rejoinTimer.reset(), this.pushBuffer.forEach((s) => s.send()), this.pushBuffer = [];
    }), this.joinPush.receive("error", (s) => {
      this.state = Q.errored, this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, s), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.onClose(() => {
      this.rejoinTimer.reset(), this.socket.hasLogger() && this.socket.log("channel", `close ${this.topic}`), this.state = Q.closed, this.socket.remove(this);
    }), this.onError((s) => {
      this.socket.hasLogger() && this.socket.log("channel", `error ${this.topic}`, s), this.isJoining() && this.joinPush.reset(), this.state = Q.errored, this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.joinPush.receive("timeout", () => {
      this.socket.hasLogger() && this.socket.log("channel", `timeout ${this.topic}`, this.joinPush.timeout), new Yr(this, Ue.leave, mr({}), this.timeout).send(), this.state = Q.errored, this.joinPush.reset(), this.socket.isConnected() && this.rejoinTimer.scheduleTimeout();
    }), this.on(Ue.reply, (s, n) => {
      this.trigger(this.replyEventName(n), s);
    });
  }
  join(e20 = this.timeout) {
    if (this.joinedOnce) throw new Error("tried to join multiple times. 'join' can only be called a single time per channel instance");
    return this.timeout = e20, this.joinedOnce = true, this.rejoin(), this.joinPush;
  }
  teardown() {
    this.pushBuffer.forEach((e20) => e20.destroy()), this.pushBuffer = [], this.rejoinTimer.reset(), this.joinPush.destroy(), this.state = Q.closed, this.bindings = [];
  }
  onClose(e20) {
    this.on(Ue.close, e20);
  }
  onError(e20) {
    return this.on(Ue.error, (t) => e20(t));
  }
  on(e20, t) {
    let r = this.bindingRef++;
    return this.bindings.push({ event: e20, ref: r, callback: t }), r;
  }
  off(e20, t) {
    this.bindings = this.bindings.filter((r) => !(r.event === e20 && (typeof t > "u" || t === r.ref)));
  }
  canPush() {
    return this.socket.isConnected() && this.isJoined();
  }
  push(e20, t, r = this.timeout) {
    if (t = t || {}, !this.joinedOnce) throw new Error(`tried to push '${e20}' to '${this.topic}' before joining. Use channel.join() before pushing events`);
    let s = new Yr(this, e20, function() {
      return t;
    }, r);
    return this.canPush() ? s.send() : (s.startTimeout(), this.pushBuffer.push(s)), s;
  }
  leave(e20 = this.timeout) {
    this.rejoinTimer.reset(), this.joinPush.cancelTimeout(), this.state = Q.leaving;
    let t = /* @__PURE__ */ __name(() => {
      this.socket.hasLogger() && this.socket.log("channel", `leave ${this.topic}`), this.trigger(Ue.close, "leave");
    }, "t"), r = new Yr(this, Ue.leave, mr({}), e20);
    return r.receive("ok", () => t()).receive("timeout", () => t()), r.send(), this.canPush() || r.trigger("ok", {}), r;
  }
  onMessage(e20, t, r) {
    return t;
  }
  filterBindings(e20, t, r) {
    return true;
  }
  isMember(e20, t, r, s) {
    return this.topic !== e20 ? false : s && s !== this.joinRef() ? (this.socket.hasLogger() && this.socket.log("channel", "dropping outdated message", { topic: e20, event: t, payload: r, joinRef: s }), false) : true;
  }
  joinRef() {
    return this.joinPush.ref;
  }
  rejoin(e20 = this.timeout) {
    this.isLeaving() || (this.socket.leaveOpenTopic(this.topic), this.state = Q.joining, this.joinPush.resend(e20));
  }
  trigger(e20, t, r, s) {
    let n = this.onMessage(e20, t, r, s);
    if (t && !n) throw new Error("channel onMessage callbacks must return the payload, modified or unmodified");
    let i = this.bindings.filter((a) => a.event === e20 && this.filterBindings(a, t, r));
    for (let a = 0; a < i.length; a++) i[a].callback(n, r, s || this.joinRef());
  }
  replyEventName(e20) {
    return `chan_reply_${e20}`;
  }
  isClosed() {
    return this.state === Q.closed;
  }
  isErrored() {
    return this.state === Q.errored;
  }
  isJoined() {
    return this.state === Q.joined;
  }
  isJoining() {
    return this.state === Q.joining;
  }
  isLeaving() {
    return this.state === Q.leaving;
  }
};
var Qr = class {
  static {
    __name(this, "Qr");
  }
  static request(e20, t, r, s, n, i, a) {
    if (Ee.XDomainRequest) {
      let o = new Ee.XDomainRequest();
      return this.xdomainRequest(o, e20, t, s, n, i, a);
    } else if (Ee.XMLHttpRequest) {
      let o = new Ee.XMLHttpRequest();
      return this.xhrRequest(o, e20, t, r, s, n, i, a);
    } else {
      if (Ee.fetch && Ee.AbortController) return this.fetchRequest(e20, t, r, s, n, i, a);
      throw new Error("No suitable XMLHttpRequest implementation found");
    }
  }
  static fetchRequest(e20, t, r, s, n, i, a) {
    let o = { method: e20, headers: r, body: s }, c = null;
    if (n) {
      c = new AbortController();
      let l = setTimeout(() => c.abort(), n);
      o.signal = c.signal;
    }
    return Ee.fetch(t, o).then((l) => l.text()).then((l) => this.parseJSON(l)).then((l) => a && a(l)).catch((l) => {
      l.name === "AbortError" && i ? i() : a && a(null);
    }), c;
  }
  static xdomainRequest(e20, t, r, s, n, i, a) {
    return e20.timeout = n, e20.open(t, r), e20.onload = () => {
      let o = this.parseJSON(e20.responseText);
      a && a(o);
    }, i && (e20.ontimeout = i), e20.onprogress = () => {
    }, e20.send(s), e20;
  }
  static xhrRequest(e20, t, r, s, n, i, a, o) {
    e20.open(t, r, true), e20.timeout = i;
    for (let [c, l] of Object.entries(s)) e20.setRequestHeader(c, l);
    return e20.onerror = () => o && o(null), e20.onreadystatechange = () => {
      if (e20.readyState === Fp.complete && o) {
        let c = this.parseJSON(e20.responseText);
        o(c);
      }
    }, a && (e20.ontimeout = a), e20.send(n), e20;
  }
  static parseJSON(e20) {
    if (!e20 || e20 === "") return null;
    try {
      return JSON.parse(e20);
    } catch {
      return console && console.log("failed to parse JSON response", e20), null;
    }
  }
  static serialize(e20, t) {
    let r = [];
    for (var s in e20) {
      if (!Object.prototype.hasOwnProperty.call(e20, s)) continue;
      let n = t ? `${t}[${s}]` : s, i = e20[s];
      typeof i == "object" ? r.push(this.serialize(i, n)) : r.push(encodeURIComponent(n) + "=" + encodeURIComponent(i));
    }
    return r.join("&");
  }
  static appendParams(e20, t) {
    if (Object.keys(t).length === 0) return e20;
    let r = e20.match(/\?/) ? "&" : "?";
    return `${e20}${r}${this.serialize(t)}`;
  }
};
var zp = /* @__PURE__ */ __name((e20) => {
  let t = "", r = new Uint8Array(e20), s = r.byteLength;
  for (let n = 0; n < s; n++) t += String.fromCharCode(r[n]);
  return btoa(t);
}, "zp");
var zt = class {
  static {
    __name(this, "zt");
  }
  constructor(e20, t) {
    t && t.length === 2 && t[1].startsWith(an) && (this.authToken = atob(t[1].slice(an.length))), this.endPoint = null, this.token = null, this.skipHeartbeat = true, this.reqs = /* @__PURE__ */ new Set(), this.awaitingBatchAck = false, this.currentBatch = null, this.currentBatchTimer = null, this.batchBuffer = [], this.onopen = function() {
    }, this.onerror = function() {
    }, this.onmessage = function() {
    }, this.onclose = function() {
    }, this.pollEndpoint = this.normalizeEndpoint(e20), this.readyState = ke.connecting, setTimeout(() => this.poll(), 0);
  }
  normalizeEndpoint(e20) {
    return e20.replace("ws://", "http://").replace("wss://", "https://").replace(new RegExp("(.*)/" + nn.websocket), "$1/" + nn.longpoll);
  }
  endpointURL() {
    return Qr.appendParams(this.pollEndpoint, { token: this.token });
  }
  closeAndRetry(e20, t, r) {
    this.close(e20, t, r), this.readyState = ke.connecting;
  }
  ontimeout() {
    this.onerror("timeout"), this.closeAndRetry(1005, "timeout", false);
  }
  isActive() {
    return this.readyState === ke.open || this.readyState === ke.connecting;
  }
  poll() {
    let e20 = { Accept: "application/json" };
    this.authToken && (e20["X-Phoenix-AuthToken"] = this.authToken), this.ajax("GET", e20, null, () => this.ontimeout(), (t) => {
      if (t) {
        var { status: r, token: s, messages: n } = t;
        if (r === 410 && this.token !== null) {
          this.onerror(410), this.closeAndRetry(3410, "session_gone", false);
          return;
        }
        this.token = s;
      } else r = 0;
      switch (r) {
        case 200:
          n.forEach((i) => {
            setTimeout(() => this.onmessage({ data: i }), 0);
          }), this.poll();
          break;
        case 204:
          this.poll();
          break;
        case 410:
          this.readyState = ke.open, this.onopen({}), this.poll();
          break;
        case 403:
          this.onerror(403), this.close(1008, "forbidden", false);
          break;
        case 0:
        case 500:
          this.onerror(500), this.closeAndRetry(1011, "internal server error", 500);
          break;
        default:
          throw new Error(`unhandled poll status ${r}`);
      }
    });
  }
  send(e20) {
    typeof e20 != "string" && (e20 = zp(e20)), this.currentBatch ? this.currentBatch.push(e20) : this.awaitingBatchAck ? this.batchBuffer.push(e20) : (this.currentBatch = [e20], this.currentBatchTimer = setTimeout(() => {
      this.batchSend(this.currentBatch), this.currentBatch = null;
    }, 0));
  }
  batchSend(e20) {
    this.awaitingBatchAck = true, this.ajax("POST", { "Content-Type": "application/x-ndjson" }, e20.join(`
`), () => this.onerror("timeout"), (t) => {
      this.awaitingBatchAck = false, !t || t.status !== 200 ? (this.onerror(t && t.status), this.closeAndRetry(1011, "internal server error", false)) : this.batchBuffer.length > 0 && (this.batchSend(this.batchBuffer), this.batchBuffer = []);
    });
  }
  close(e20, t, r) {
    for (let n of this.reqs) n.abort();
    this.readyState = ke.closed;
    let s = Object.assign({ code: 1e3, reason: void 0, wasClean: true }, { code: e20, reason: t, wasClean: r });
    this.batchBuffer = [], clearTimeout(this.currentBatchTimer), this.currentBatchTimer = null, typeof CloseEvent < "u" ? this.onclose(new CloseEvent("close", s)) : this.onclose(s);
  }
  ajax(e20, t, r, s, n) {
    let i, a = /* @__PURE__ */ __name(() => {
      this.reqs.delete(i), s();
    }, "a");
    i = Qr.request(e20, this.endpointURL(), t, r, this.timeout, a, (o) => {
      this.reqs.delete(i), this.isActive() && n(o);
    }), this.reqs.add(i);
  }
};
var Vi = class fr {
  static {
    __name(this, "fr");
  }
  constructor(t, r = {}) {
    let s = r.events || { state: "presence_state", diff: "presence_diff" };
    this.state = {}, this.pendingDiffs = [], this.channel = t, this.joinRef = null, this.caller = { onJoin: /* @__PURE__ */ __name(function() {
    }, "onJoin"), onLeave: /* @__PURE__ */ __name(function() {
    }, "onLeave"), onSync: /* @__PURE__ */ __name(function() {
    }, "onSync") }, this.channel.on(s.state, (n) => {
      let { onJoin: i, onLeave: a, onSync: o } = this.caller;
      this.joinRef = this.channel.joinRef(), this.state = fr.syncState(this.state, n, i, a), this.pendingDiffs.forEach((c) => {
        this.state = fr.syncDiff(this.state, c, i, a);
      }), this.pendingDiffs = [], o();
    }), this.channel.on(s.diff, (n) => {
      let { onJoin: i, onLeave: a, onSync: o } = this.caller;
      this.inPendingSyncState() ? this.pendingDiffs.push(n) : (this.state = fr.syncDiff(this.state, n, i, a), o());
    });
  }
  onJoin(t) {
    this.caller.onJoin = t;
  }
  onLeave(t) {
    this.caller.onLeave = t;
  }
  onSync(t) {
    this.caller.onSync = t;
  }
  list(t) {
    return fr.list(this.state, t);
  }
  inPendingSyncState() {
    return !this.joinRef || this.joinRef !== this.channel.joinRef();
  }
  static syncState(t, r, s, n) {
    let i = this.clone(t), a = {}, o = {};
    return this.map(i, (c, l) => {
      r[c] || (o[c] = l);
    }), this.map(r, (c, l) => {
      let u = i[c];
      if (u) {
        let d = l.metas.map((y) => y.phx_ref), f = u.metas.map((y) => y.phx_ref), p = l.metas.filter((y) => f.indexOf(y.phx_ref) < 0), g = u.metas.filter((y) => d.indexOf(y.phx_ref) < 0);
        p.length > 0 && (a[c] = l, a[c].metas = p), g.length > 0 && (o[c] = this.clone(u), o[c].metas = g);
      } else a[c] = l;
    }), this.syncDiff(i, { joins: a, leaves: o }, s, n);
  }
  static syncDiff(t, r, s, n) {
    let { joins: i, leaves: a } = this.clone(r);
    return s || (s = /* @__PURE__ */ __name(function() {
    }, "s")), n || (n = /* @__PURE__ */ __name(function() {
    }, "n")), this.map(i, (o, c) => {
      let l = t[o];
      if (t[o] = this.clone(c), l) {
        let u = t[o].metas.map((f) => f.phx_ref), d = l.metas.filter((f) => u.indexOf(f.phx_ref) < 0);
        t[o].metas.unshift(...d);
      }
      s(o, l, c);
    }), this.map(a, (o, c) => {
      let l = t[o];
      if (!l) return;
      let u = c.metas.map((d) => d.phx_ref);
      l.metas = l.metas.filter((d) => u.indexOf(d.phx_ref) < 0), n(o, l, c), l.metas.length === 0 && delete t[o];
    }), t;
  }
  static list(t, r) {
    return r || (r = /* @__PURE__ */ __name(function(s, n) {
      return n;
    }, "r")), this.map(t, (s, n) => r(s, n));
  }
  static map(t, r) {
    return Object.getOwnPropertyNames(t).map((s) => r(s, t[s]));
  }
  static clone(t) {
    return JSON.parse(JSON.stringify(t));
  }
};
var Zr = { HEADER_LENGTH: 1, META_LENGTH: 4, KINDS: { push: 0, reply: 1, broadcast: 2 }, encode(e20, t) {
  if (e20.payload.constructor === ArrayBuffer) return t(this.binaryEncode(e20));
  {
    let r = [e20.join_ref, e20.ref, e20.topic, e20.event, e20.payload];
    return t(JSON.stringify(r));
  }
}, decode(e20, t) {
  if (e20.constructor === ArrayBuffer) return t(this.binaryDecode(e20));
  {
    let [r, s, n, i, a] = JSON.parse(e20);
    return t({ join_ref: r, ref: s, topic: n, event: i, payload: a });
  }
}, binaryEncode(e20) {
  let { join_ref: t, ref: r, event: s, topic: n, payload: i } = e20, a = this.META_LENGTH + t.length + r.length + n.length + s.length, o = new ArrayBuffer(this.HEADER_LENGTH + a), c = new DataView(o), l = 0;
  c.setUint8(l++, this.KINDS.push), c.setUint8(l++, t.length), c.setUint8(l++, r.length), c.setUint8(l++, n.length), c.setUint8(l++, s.length), Array.from(t, (d) => c.setUint8(l++, d.charCodeAt(0))), Array.from(r, (d) => c.setUint8(l++, d.charCodeAt(0))), Array.from(n, (d) => c.setUint8(l++, d.charCodeAt(0))), Array.from(s, (d) => c.setUint8(l++, d.charCodeAt(0)));
  var u = new Uint8Array(o.byteLength + i.byteLength);
  return u.set(new Uint8Array(o), 0), u.set(new Uint8Array(i), o.byteLength), u.buffer;
}, binaryDecode(e20) {
  let t = new DataView(e20), r = t.getUint8(0), s = new TextDecoder();
  switch (r) {
    case this.KINDS.push:
      return this.decodePush(e20, t, s);
    case this.KINDS.reply:
      return this.decodeReply(e20, t, s);
    case this.KINDS.broadcast:
      return this.decodeBroadcast(e20, t, s);
  }
}, decodePush(e20, t, r) {
  let s = t.getUint8(1), n = t.getUint8(2), i = t.getUint8(3), a = this.HEADER_LENGTH + this.META_LENGTH - 1, o = r.decode(e20.slice(a, a + s));
  a = a + s;
  let c = r.decode(e20.slice(a, a + n));
  a = a + n;
  let l = r.decode(e20.slice(a, a + i));
  a = a + i;
  let u = e20.slice(a, e20.byteLength);
  return { join_ref: o, ref: null, topic: c, event: l, payload: u };
}, decodeReply(e20, t, r) {
  let s = t.getUint8(1), n = t.getUint8(2), i = t.getUint8(3), a = t.getUint8(4), o = this.HEADER_LENGTH + this.META_LENGTH, c = r.decode(e20.slice(o, o + s));
  o = o + s;
  let l = r.decode(e20.slice(o, o + n));
  o = o + n;
  let u = r.decode(e20.slice(o, o + i));
  o = o + i;
  let d = r.decode(e20.slice(o, o + a));
  o = o + a;
  let f = e20.slice(o, e20.byteLength), p = { status: d, response: f };
  return { join_ref: c, ref: l, topic: u, event: Ue.reply, payload: p };
}, decodeBroadcast(e20, t, r) {
  let s = t.getUint8(1), n = t.getUint8(2), i = this.HEADER_LENGTH + 2, a = r.decode(e20.slice(i, i + s));
  i = i + s;
  let o = r.decode(e20.slice(i, i + n));
  i = i + n;
  let c = e20.slice(i, e20.byteLength);
  return { join_ref: null, ref: null, topic: a, event: o, payload: c };
} };
var Hi = class {
  static {
    __name(this, "Hi");
  }
  constructor(e20, t = {}) {
    this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] }, this.channels = [], this.sendBuffer = [], this.ref = 0, this.fallbackRef = null, this.timeout = t.timeout || Bp, this.transport = t.transport || Ee.WebSocket || zt, this.conn = void 0, this.primaryPassedHealthCheck = false, this.longPollFallbackMs = t.longPollFallbackMs, this.fallbackTimer = null, this.sessionStore = t.sessionStorage || Ee && Ee.sessionStorage, this.establishedConnections = 0, this.defaultEncoder = Zr.encode.bind(Zr), this.defaultDecoder = Zr.decode.bind(Zr), this.closeWasClean = true, this.disconnecting = false, this.binaryType = t.binaryType || "arraybuffer", this.connectClock = 1, this.pageHidden = false, this.encode = void 0, this.decode = void 0, this.transport !== zt ? (this.encode = t.encode || this.defaultEncoder, this.decode = t.decode || this.defaultDecoder) : (this.encode = this.defaultEncoder, this.decode = this.defaultDecoder);
    let r = null;
    Vt && Vt.addEventListener && (Vt.addEventListener("pagehide", (s) => {
      this.conn && (this.disconnect(), r = this.connectClock);
    }), Vt.addEventListener("pageshow", (s) => {
      r === this.connectClock && (r = null, this.connect());
    }), Vt.addEventListener("visibilitychange", () => {
      document.visibilityState === "hidden" ? this.pageHidden = true : (this.pageHidden = false, !this.isConnected() && !this.closeWasClean && this.teardown(() => this.connect()));
    })), this.heartbeatIntervalMs = t.heartbeatIntervalMs || 3e4, this.autoSendHeartbeat = t.autoSendHeartbeat ?? true, this.heartbeatCallback = t.heartbeatCallback ?? (() => {
    }), this.rejoinAfterMs = (s) => t.rejoinAfterMs ? t.rejoinAfterMs(s) : [1e3, 2e3, 5e3][s - 1] || 1e4, this.reconnectAfterMs = (s) => t.reconnectAfterMs ? t.reconnectAfterMs(s) : [10, 50, 100, 150, 200, 250, 500, 1e3, 2e3][s - 1] || 5e3, this.logger = t.logger || null, !this.logger && t.debug && (this.logger = (s, n, i) => {
      console.log(`${s}: ${n}`, i);
    }), this.longpollerTimeout = t.longpollerTimeout || 2e4, this.params = mr(t.params || {}), this.endPoint = `${e20}/${nn.websocket}`, this.vsn = t.vsn || $p, this.heartbeatTimeoutTimer = null, this.heartbeatTimer = null, this.heartbeatSentAt = null, this.pendingHeartbeatRef = null, this.reconnectTimer = new zi(() => {
      if (this.pageHidden) {
        this.log("Not reconnecting as page is hidden!"), this.teardown();
        return;
      }
      this.teardown(async () => {
        t.beforeReconnect && await t.beforeReconnect(), this.connect();
      });
    }, this.reconnectAfterMs), this.authToken = t.authToken;
  }
  getLongPollTransport() {
    return zt;
  }
  replaceTransport(e20) {
    this.connectClock++, this.closeWasClean = true, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.conn && (this.conn.close(), this.conn = null), this.transport = e20;
  }
  protocol() {
    return location.protocol.match(/^https/) ? "wss" : "ws";
  }
  endPointURL() {
    let e20 = Qr.appendParams(Qr.appendParams(this.endPoint, this.params()), { vsn: this.vsn });
    return e20.charAt(0) !== "/" ? e20 : e20.charAt(1) === "/" ? `${this.protocol()}:${e20}` : `${this.protocol()}://${location.host}${e20}`;
  }
  disconnect(e20, t, r) {
    this.connectClock++, this.disconnecting = true, this.closeWasClean = true, clearTimeout(this.fallbackTimer), this.reconnectTimer.reset(), this.teardown(() => {
      this.disconnecting = false, e20 && e20();
    }, t, r);
  }
  connect(e20) {
    e20 && (console && console.log("passing params to connect is deprecated. Instead pass :params to the Socket constructor"), this.params = mr(e20)), !(this.conn && !this.disconnecting) && (this.longPollFallbackMs && this.transport !== zt ? this.connectWithFallback(zt, this.longPollFallbackMs) : this.transportConnect());
  }
  log(e20, t, r) {
    this.logger && this.logger(e20, t, r);
  }
  hasLogger() {
    return this.logger !== null;
  }
  onOpen(e20) {
    let t = this.makeRef();
    return this.stateChangeCallbacks.open.push([t, e20]), t;
  }
  onClose(e20) {
    let t = this.makeRef();
    return this.stateChangeCallbacks.close.push([t, e20]), t;
  }
  onError(e20) {
    let t = this.makeRef();
    return this.stateChangeCallbacks.error.push([t, e20]), t;
  }
  onMessage(e20) {
    let t = this.makeRef();
    return this.stateChangeCallbacks.message.push([t, e20]), t;
  }
  onHeartbeat(e20) {
    this.heartbeatCallback = e20;
  }
  ping(e20) {
    if (!this.isConnected()) return false;
    let t = this.makeRef(), r = Date.now();
    this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: t });
    let s = this.onMessage((n) => {
      n.ref === t && (this.off([s]), e20(Date.now() - r));
    });
    return true;
  }
  transportName(e20) {
    return e20 === zt ? "LongPoll" : e20.name;
  }
  transportConnect() {
    this.connectClock++, this.closeWasClean = false;
    let e20;
    this.authToken && (e20 = ["phoenix", `${an}${btoa(this.authToken).replace(/=/g, "")}`]), this.conn = new this.transport(this.endPointURL(), e20), this.conn.binaryType = this.binaryType, this.conn.timeout = this.longpollerTimeout, this.conn.onopen = () => this.onConnOpen(), this.conn.onerror = (t) => this.onConnError(t), this.conn.onmessage = (t) => this.onConnMessage(t), this.conn.onclose = (t) => this.onConnClose(t);
  }
  getSession(e20) {
    return this.sessionStore && this.sessionStore.getItem(e20);
  }
  storeSession(e20, t) {
    this.sessionStore && this.sessionStore.setItem(e20, t);
  }
  connectWithFallback(e20, t = 2500) {
    clearTimeout(this.fallbackTimer);
    let r = false, s = true, n, i, a = this.transportName(e20), o = /* @__PURE__ */ __name((c) => {
      this.log("transport", `falling back to ${a}...`, c), this.off([n, i]), s = false, this.replaceTransport(e20), this.transportConnect();
    }, "o");
    if (this.getSession(`phx:fallback:${a}`)) return o("memorized");
    this.fallbackTimer = setTimeout(o, t), i = this.onError((c) => {
      this.log("transport", "error", c), s && !r && (clearTimeout(this.fallbackTimer), o(c));
    }), this.fallbackRef && this.off([this.fallbackRef]), this.fallbackRef = this.onOpen(() => {
      if (r = true, !s) {
        let c = this.transportName(e20);
        return this.primaryPassedHealthCheck || this.storeSession(`phx:fallback:${c}`, "true"), this.log("transport", `established ${c} fallback`);
      }
      clearTimeout(this.fallbackTimer), this.fallbackTimer = setTimeout(o, t), this.ping((c) => {
        this.log("transport", "connected to primary after", c), this.primaryPassedHealthCheck = true, clearTimeout(this.fallbackTimer);
      });
    }), this.transportConnect();
  }
  clearHeartbeats() {
    clearTimeout(this.heartbeatTimer), clearTimeout(this.heartbeatTimeoutTimer);
  }
  onConnOpen() {
    this.hasLogger() && this.log("transport", `connected to ${this.endPointURL()}`), this.closeWasClean = false, this.disconnecting = false, this.establishedConnections++, this.flushSendBuffer(), this.reconnectTimer.reset(), this.autoSendHeartbeat && this.resetHeartbeat(), this.triggerStateCallbacks("open");
  }
  heartbeatTimeout() {
    if (this.pendingHeartbeatRef) {
      this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.hasLogger() && this.log("transport", "heartbeat timeout. Attempting to re-establish connection");
      try {
        this.heartbeatCallback("timeout");
      } catch (e20) {
        this.log("error", "error in heartbeat callback", e20);
      }
      this.triggerChanError(new Error("heartbeat timeout")), this.closeWasClean = false, this.teardown(() => this.reconnectTimer.scheduleTimeout(), Mp, "heartbeat timeout");
    }
  }
  resetHeartbeat() {
    this.conn && this.conn.skipHeartbeat || (this.pendingHeartbeatRef = null, this.clearHeartbeats(), this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
  }
  teardown(e20, t, r) {
    if (!this.conn) return e20 && e20();
    let s = this.conn;
    this.waitForBufferDone(s, () => {
      t ? s.close(t, r || "") : s.close(), this.waitForSocketClosed(s, () => {
        this.conn === s && (this.conn.onopen = function() {
        }, this.conn.onerror = function() {
        }, this.conn.onmessage = function() {
        }, this.conn.onclose = function() {
        }, this.conn = null), e20 && e20();
      });
    });
  }
  waitForBufferDone(e20, t, r = 1) {
    if (r === 5 || !e20.bufferedAmount) {
      t();
      return;
    }
    setTimeout(() => {
      this.waitForBufferDone(e20, t, r + 1);
    }, 150 * r);
  }
  waitForSocketClosed(e20, t, r = 1) {
    if (r === 5 || e20.readyState === ke.closed) {
      t();
      return;
    }
    setTimeout(() => {
      this.waitForSocketClosed(e20, t, r + 1);
    }, 150 * r);
  }
  onConnClose(e20) {
    this.conn && (this.conn.onclose = () => {
    }), this.hasLogger() && this.log("transport", "close", e20), this.triggerChanError(e20), this.clearHeartbeats(), this.closeWasClean || this.reconnectTimer.scheduleTimeout(), this.triggerStateCallbacks("close", e20);
  }
  onConnError(e20) {
    this.hasLogger() && this.log("transport", "error", e20);
    let t = this.transport, r = this.establishedConnections;
    this.triggerStateCallbacks("error", e20, t, r), (t === this.transport || r > 0) && this.triggerChanError(e20);
  }
  triggerChanError(e20) {
    this.channels.forEach((t) => {
      t.isErrored() || t.isLeaving() || t.isClosed() || t.trigger(Ue.error, e20);
    });
  }
  connectionState() {
    switch (this.conn && this.conn.readyState) {
      case ke.connecting:
        return "connecting";
      case ke.open:
        return "open";
      case ke.closing:
        return "closing";
      default:
        return "closed";
    }
  }
  isConnected() {
    return this.connectionState() === "open";
  }
  remove(e20) {
    this.off(e20.stateChangeRefs), this.channels = this.channels.filter((t) => t !== e20);
  }
  off(e20) {
    for (let t in this.stateChangeCallbacks) this.stateChangeCallbacks[t] = this.stateChangeCallbacks[t].filter(([r]) => e20.indexOf(r) === -1);
  }
  channel(e20, t = {}) {
    let r = new qp(e20, t, this);
    return this.channels.push(r), r;
  }
  push(e20) {
    if (this.hasLogger()) {
      let { topic: t, event: r, payload: s, ref: n, join_ref: i } = e20;
      this.log("push", `${t} ${r} (${i}, ${n})`, s);
    }
    this.isConnected() ? this.encode(e20, (t) => this.conn.send(t)) : this.sendBuffer.push(() => this.encode(e20, (t) => this.conn.send(t)));
  }
  makeRef() {
    let e20 = this.ref + 1;
    return e20 === this.ref ? this.ref = 0 : this.ref = e20, this.ref.toString();
  }
  sendHeartbeat() {
    if (!this.isConnected()) {
      try {
        this.heartbeatCallback("disconnected");
      } catch (e20) {
        this.log("error", "error in heartbeat callback", e20);
      }
      return;
    }
    if (this.pendingHeartbeatRef) {
      this.heartbeatTimeout();
      return;
    }
    this.pendingHeartbeatRef = this.makeRef(), this.heartbeatSentAt = Date.now(), this.push({ topic: "phoenix", event: "heartbeat", payload: {}, ref: this.pendingHeartbeatRef });
    try {
      this.heartbeatCallback("sent");
    } catch (e20) {
      this.log("error", "error in heartbeat callback", e20);
    }
    this.heartbeatTimeoutTimer = setTimeout(() => this.heartbeatTimeout(), this.heartbeatIntervalMs);
  }
  flushSendBuffer() {
    this.isConnected() && this.sendBuffer.length > 0 && (this.sendBuffer.forEach((e20) => e20()), this.sendBuffer = []);
  }
  onConnMessage(e20) {
    this.decode(e20.data, (t) => {
      let { topic: r, event: s, payload: n, ref: i, join_ref: a } = t;
      if (i && i === this.pendingHeartbeatRef) {
        let o = this.heartbeatSentAt ? Date.now() - this.heartbeatSentAt : void 0;
        this.clearHeartbeats();
        try {
          this.heartbeatCallback(n.status === "ok" ? "ok" : "error", o);
        } catch (c) {
          this.log("error", "error in heartbeat callback", c);
        }
        this.pendingHeartbeatRef = null, this.heartbeatSentAt = null, this.autoSendHeartbeat && (this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), this.heartbeatIntervalMs));
      }
      this.hasLogger() && this.log("receive", `${n.status || ""} ${r} ${s} ${i && "(" + i + ")" || ""}`.trim(), n);
      for (let o = 0; o < this.channels.length; o++) {
        let c = this.channels[o];
        c.isMember(r, s, n, a) && c.trigger(s, n, i, a);
      }
      this.triggerStateCallbacks("message", t);
    });
  }
  triggerStateCallbacks(e20, ...t) {
    try {
      this.stateChangeCallbacks[e20].forEach(([r, s]) => {
        try {
          s(...t);
        } catch (n) {
          this.log("error", `error in ${e20} callback`, n);
        }
      });
    } catch (r) {
      this.log("error", `error triggering ${e20} callbacks`, r);
    }
  }
  leaveOpenTopic(e20) {
    let t = this.channels.find((r) => r.topic === e20 && (r.isJoined() || r.isJoining()));
    t && (this.hasLogger() && this.log("transport", `leaving duplicate topic "${e20}"`), t.leave());
  }
};
var gr = class e16 {
  static {
    __name(this, "e");
  }
  constructor(t, r) {
    let s = Hp(r);
    this.presence = new Vi(t.getChannel(), s), this.presence.onJoin((n, i, a) => {
      let o = e16.onJoinPayload(n, i, a);
      t.getChannel().trigger("presence", o);
    }), this.presence.onLeave((n, i, a) => {
      let o = e16.onLeavePayload(n, i, a);
      t.getChannel().trigger("presence", o);
    }), this.presence.onSync(() => {
      t.getChannel().trigger("presence", { event: "sync" });
    });
  }
  get state() {
    return e16.transformState(this.presence.state);
  }
  static transformState(t) {
    return t = Vp(t), Object.getOwnPropertyNames(t).reduce((r, s) => {
      let n = t[s];
      return r[s] = es(n), r;
    }, {});
  }
  static onJoinPayload(t, r, s) {
    let n = Ki(r), i = es(s);
    return { event: "join", key: t, currentPresences: n, newPresences: i };
  }
  static onLeavePayload(t, r, s) {
    let n = Ki(r), i = es(s);
    return { event: "leave", key: t, currentPresences: n, leftPresences: i };
  }
};
function es(e20) {
  return e20.metas.map((t) => (t.presence_ref = t.phx_ref, delete t.phx_ref, delete t.phx_ref_prev, t));
}
__name(es, "es");
function Vp(e20) {
  return JSON.parse(JSON.stringify(e20));
}
__name(Vp, "Vp");
function Hp(e20) {
  return e20?.events && { events: e20.events };
}
__name(Hp, "Hp");
function Ki(e20) {
  return e20?.metas ? es(e20) : [];
}
__name(Ki, "Ki");
var on;
(function(e20) {
  e20.SYNC = "sync", e20.JOIN = "join", e20.LEAVE = "leave";
})(on || (on = {}));
var Ht = class {
  static {
    __name(this, "Ht");
  }
  get state() {
    return this.presenceAdapter.state;
  }
  constructor(t, r) {
    this.channel = t, this.presenceAdapter = new gr(this.channel.channelAdapter, r);
  }
};
function Wi(e20) {
  if (e20 instanceof Error) return e20;
  if (typeof e20 == "string") return new Error(e20);
  if (e20 && typeof e20 == "object") {
    let t = e20;
    if (typeof t.code == "number") {
      let r = typeof t.reason == "string" && t.reason ? ` (${t.reason})` : "";
      return new Error(`socket closed: ${t.code}${r}`, { cause: e20 });
    }
    return new Error("channel error: transport failure", { cause: e20 });
  }
  return new Error("channel error: connection lost");
}
__name(Wi, "Wi");
var yr = class {
  static {
    __name(this, "yr");
  }
  constructor(t, r, s) {
    let n = Kp(s);
    this.channel = t.getSocket().channel(r, n), this.socket = t;
  }
  get state() {
    return this.channel.state;
  }
  set state(t) {
    this.channel.state = t;
  }
  get joinedOnce() {
    return this.channel.joinedOnce;
  }
  get joinPush() {
    return this.channel.joinPush;
  }
  get rejoinTimer() {
    return this.channel.rejoinTimer;
  }
  on(t, r) {
    return this.channel.on(t, r);
  }
  off(t, r) {
    this.channel.off(t, r);
  }
  subscribe(t) {
    return this.channel.join(t);
  }
  unsubscribe(t) {
    return this.channel.leave(t);
  }
  teardown() {
    this.channel.teardown();
  }
  onClose(t) {
    this.channel.onClose(t);
  }
  onError(t) {
    return this.channel.onError(t);
  }
  push(t, r, s) {
    let n;
    try {
      n = this.channel.push(t, r, s);
    } catch {
      throw new Error(`tried to push '${t}' to '${this.channel.topic}' before joining. Use channel.subscribe() before pushing events`);
    }
    if (this.channel.pushBuffer.length > Fi) {
      let i = this.channel.pushBuffer.shift();
      i.cancelTimeout(), this.socket.log("channel", `discarded push due to buffer overflow: ${i.event}`, i.payload());
    }
    return n;
  }
  updateJoinPayload(t) {
    let r = this.channel.joinPush.payload();
    this.channel.joinPush.payload = () => Object.assign(Object.assign({}, r), t);
  }
  canPush() {
    return this.socket.isConnected() && this.state === Se.joined;
  }
  isJoined() {
    return this.state === Se.joined;
  }
  isJoining() {
    return this.state === Se.joining;
  }
  isClosed() {
    return this.state === Se.closed;
  }
  isLeaving() {
    return this.state === Se.leaving;
  }
  updateFilterBindings(t) {
    this.channel.filterBindings = t;
  }
  updatePayloadTransform(t) {
    this.channel.onMessage = t;
  }
  getChannel() {
    return this.channel;
  }
};
function Kp(e20) {
  return { config: Object.assign({ broadcast: { ack: false, self: false }, presence: { key: "", enabled: false }, private: false }, e20.config) };
}
__name(Kp, "Kp");
var cn;
(function(e20) {
  e20.ALL = "*", e20.INSERT = "INSERT", e20.UPDATE = "UPDATE", e20.DELETE = "DELETE";
})(cn || (cn = {}));
var wt;
(function(e20) {
  e20.BROADCAST = "broadcast", e20.PRESENCE = "presence", e20.POSTGRES_CHANGES = "postgres_changes", e20.SYSTEM = "system";
})(wt || (wt = {}));
var Te;
(function(e20) {
  e20.SUBSCRIBED = "SUBSCRIBED", e20.TIMED_OUT = "TIMED_OUT", e20.CLOSED = "CLOSED", e20.CHANNEL_ERROR = "CHANNEL_ERROR";
})(Te || (Te = {}));
var Kt = class e17 {
  static {
    __name(this, "e");
  }
  get state() {
    return this.channelAdapter.state;
  }
  set state(t) {
    this.channelAdapter.state = t;
  }
  get joinedOnce() {
    return this.channelAdapter.joinedOnce;
  }
  get timeout() {
    return this.socket.timeout;
  }
  get joinPush() {
    return this.channelAdapter.joinPush;
  }
  get rejoinTimer() {
    return this.channelAdapter.rejoinTimer;
  }
  constructor(t, r = { config: {} }, s) {
    var n, i;
    if (this.topic = t, this.params = r, this.socket = s, this.bindings = {}, this.subTopic = t.replace(/^realtime:/i, ""), this.params.config = Object.assign({ broadcast: { ack: false, self: false }, presence: { key: "", enabled: false }, private: false }, r.config), this.channelAdapter = new yr(this.socket.socketAdapter, t, this.params), this.presence = new Ht(this), this._onClose(() => {
      this.socket._remove(this);
    }), this._updateFilterTransform(), this.broadcastEndpointURL = Xr(this.socket.socketAdapter.endPointURL()), this.private = this.params.config.private || false, !this.private && (!((i = (n = this.params.config) === null || n === void 0 ? void 0 : n.broadcast) === null || i === void 0) && i.replay)) throw new Error(`tried to use replay on public channel '${this.topic}'. It must be a private channel.`);
  }
  subscribe(t, r = this.timeout) {
    var s, n, i;
    if (this.socket.isConnected() || this.socket.connect(), this.channelAdapter.isClosed()) {
      let { config: { broadcast: a, presence: o, private: c } } = this.params, l = (n = (s = this.bindings.postgres_changes) === null || s === void 0 ? void 0 : s.map((p) => p.filter)) !== null && n !== void 0 ? n : [], u = !!this.bindings[wt.PRESENCE] && this.bindings[wt.PRESENCE].length > 0 || ((i = this.params.config.presence) === null || i === void 0 ? void 0 : i.enabled) === true, d = {}, f = { broadcast: a, presence: Object.assign(Object.assign({}, o), { enabled: u }), postgres_changes: l, private: c };
      this.socket.accessTokenValue && (d.access_token = this.socket.accessTokenValue), this._onError((p) => {
        t?.(Te.CHANNEL_ERROR, Wi(p));
      }), this._onClose(() => t?.(Te.CLOSED)), this.updateJoinPayload(Object.assign({ config: f }, d)), this._updateFilterMessage(), this.channelAdapter.subscribe(r).receive("ok", async ({ postgres_changes: p }) => {
        if (this.socket._isManualToken() || this.socket.setAuth(), p === void 0) {
          t?.(Te.SUBSCRIBED);
          return;
        }
        this._updatePostgresBindings(p, t);
      }).receive("error", (p) => {
        this.state = Se.errored;
        let g = Object.values(p).join(", ") || "error";
        t?.(Te.CHANNEL_ERROR, new Error(g, { cause: p }));
      }).receive("timeout", () => {
        t?.(Te.TIMED_OUT);
      });
    }
    return this;
  }
  _updatePostgresBindings(t, r) {
    var s;
    let n = this.bindings.postgres_changes, i = (s = n?.length) !== null && s !== void 0 ? s : 0, a = [];
    for (let o = 0; o < i; o++) {
      let c = n[o], { filter: { event: l, schema: u, table: d, filter: f } } = c, p = t && t[o];
      if (p && p.event === l && e17.isFilterValueEqual(p.schema, u) && e17.isFilterValueEqual(p.table, d) && e17.isFilterValueEqual(p.filter, f)) a.push(Object.assign(Object.assign({}, c), { id: p.id }));
      else {
        this.unsubscribe(), this.state = Se.errored, r?.(Te.CHANNEL_ERROR, new Error("mismatch between server and client bindings for postgres changes"));
        return;
      }
    }
    this.bindings.postgres_changes = a, this.state != Se.errored && r && r(Te.SUBSCRIBED);
  }
  presenceState() {
    return this.presence.state;
  }
  async track(t, r = {}) {
    return await this.send({ type: "presence", event: "track", payload: t }, r.timeout || this.timeout);
  }
  async untrack(t = {}) {
    return await this.send({ type: "presence", event: "untrack" }, t);
  }
  on(t, r, s) {
    let n = this.channelAdapter.isJoined() || this.channelAdapter.isJoining(), i = t === wt.PRESENCE || t === wt.POSTGRES_CHANGES;
    if (n && i) throw this.socket.log("channel", `cannot add \`${t}\` callbacks for ${this.topic} after \`subscribe()\`.`), new Error(`cannot add \`${t}\` callbacks for ${this.topic} after \`subscribe()\`.`);
    return this._on(t, r, s);
  }
  async httpSend(t, r, s = {}) {
    var n;
    if (r == null) return Promise.reject(new Error("Payload is required for httpSend()"));
    let i = { apikey: this.socket.apiKey ? this.socket.apiKey : "", "Content-Type": "application/json" };
    this.socket.accessTokenValue && (i.Authorization = `Bearer ${this.socket.accessTokenValue}`);
    let a = { method: "POST", headers: i, body: JSON.stringify({ messages: [{ topic: this.subTopic, event: t, payload: r, private: this.private }] }) }, o = await this._fetchWithTimeout(this.broadcastEndpointURL, a, (n = s.timeout) !== null && n !== void 0 ? n : this.timeout);
    if (o.status === 202) return { success: true };
    let c = o.statusText;
    try {
      let l = await o.json();
      c = l.error || l.message || c;
    } catch {
    }
    return Promise.reject(new Error(c));
  }
  async send(t, r = {}) {
    var s, n;
    if (!this.channelAdapter.canPush() && t.type === "broadcast") {
      console.warn("Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.");
      let { event: i, payload: a } = t, o = { apikey: this.socket.apiKey ? this.socket.apiKey : "", "Content-Type": "application/json" };
      this.socket.accessTokenValue && (o.Authorization = `Bearer ${this.socket.accessTokenValue}`);
      let c = { method: "POST", headers: o, body: JSON.stringify({ messages: [{ topic: this.subTopic, event: i, payload: a, private: this.private }] }) };
      try {
        let l = await this._fetchWithTimeout(this.broadcastEndpointURL, c, (s = r.timeout) !== null && s !== void 0 ? s : this.timeout);
        return await ((n = l.body) === null || n === void 0 ? void 0 : n.cancel()), l.ok ? "ok" : "error";
      } catch (l) {
        return l.name === "AbortError" ? "timed out" : "error";
      }
    } else return new Promise((i) => {
      var a, o, c;
      let l = this.channelAdapter.push(t.type, t, r.timeout || this.timeout);
      t.type === "broadcast" && !(!((c = (o = (a = this.params) === null || a === void 0 ? void 0 : a.config) === null || o === void 0 ? void 0 : o.broadcast) === null || c === void 0) && c.ack) && i("ok"), l.receive("ok", () => i("ok")), l.receive("error", () => i("error")), l.receive("timeout", () => i("timed out"));
    });
  }
  updateJoinPayload(t) {
    this.channelAdapter.updateJoinPayload(t);
  }
  async unsubscribe(t = this.timeout) {
    return new Promise((r) => {
      this.channelAdapter.unsubscribe(t).receive("ok", () => r("ok")).receive("timeout", () => r("timed out")).receive("error", () => r("error"));
    });
  }
  teardown() {
    this.channelAdapter.teardown();
  }
  async _fetchWithTimeout(t, r, s) {
    let n = new AbortController(), i = setTimeout(() => n.abort(), s), a = await this.socket.fetch(t, Object.assign(Object.assign({}, r), { signal: n.signal }));
    return clearTimeout(i), a;
  }
  _on(t, r, s) {
    let n = t.toLocaleLowerCase(), i = this.channelAdapter.on(t, s), a = { type: n, filter: r, callback: s, ref: i };
    return this.bindings[n] ? this.bindings[n].push(a) : this.bindings[n] = [a], this._updateFilterMessage(), this;
  }
  _onClose(t) {
    this.channelAdapter.onClose(t);
  }
  _onError(t) {
    this.channelAdapter.onError(t);
  }
  _updateFilterMessage() {
    this.channelAdapter.updateFilterBindings((t, r, s) => {
      var n, i, a, o, c, l, u;
      let d = t.event.toLocaleLowerCase();
      if (this._notThisChannelEvent(d, s)) return false;
      let f = (n = this.bindings[d]) === null || n === void 0 ? void 0 : n.find((p) => p.ref === t.ref);
      if (!f) return true;
      if (["broadcast", "presence", "postgres_changes"].includes(d)) if ("id" in f) {
        let p = f.id, g = (i = f.filter) === null || i === void 0 ? void 0 : i.event;
        return p && ((a = r.ids) === null || a === void 0 ? void 0 : a.includes(p)) && (g === "*" || g?.toLocaleLowerCase() === ((o = r.data) === null || o === void 0 ? void 0 : o.type.toLocaleLowerCase()));
      } else {
        let p = (l = (c = f?.filter) === null || c === void 0 ? void 0 : c.event) === null || l === void 0 ? void 0 : l.toLocaleLowerCase();
        return p === "*" || p === ((u = r?.event) === null || u === void 0 ? void 0 : u.toLocaleLowerCase());
      }
      else return f.type.toLocaleLowerCase() === d;
    });
  }
  _notThisChannelEvent(t, r) {
    let { close: s, error: n, leave: i, join: a } = Jr;
    return r && [s, n, i, a].includes(t) && r !== this.joinPush.ref;
  }
  _updateFilterTransform() {
    this.channelAdapter.updatePayloadTransform((t, r, s) => {
      if (typeof r == "object" && "ids" in r) {
        let n = r.data, { schema: i, table: a, commit_timestamp: o, type: c, errors: l } = n;
        return Object.assign(Object.assign({}, { schema: i, table: a, commit_timestamp: o, eventType: c, new: {}, old: {}, errors: l }), this._getPayloadRecords(n));
      }
      return r;
    });
  }
  copyBindings(t) {
    if (this.joinedOnce) throw new Error("cannot copy bindings into joined channel");
    for (let r in t.bindings) for (let s of t.bindings[r]) this._on(s.type, s.filter, s.callback);
  }
  static isFilterValueEqual(t, r) {
    return (t ?? void 0) === (r ?? void 0);
  }
  _getPayloadRecords(t) {
    let r = { new: {}, old: {} };
    return (t.type === "INSERT" || t.type === "UPDATE") && (r.new = sn(t.columns, t.record)), (t.type === "UPDATE" || t.type === "DELETE") && (r.old = sn(t.columns, t.old_record)), r;
  }
};
var wr = class {
  static {
    __name(this, "wr");
  }
  constructor(t, r) {
    this.socket = new Hi(t, r);
  }
  get timeout() {
    return this.socket.timeout;
  }
  get endPoint() {
    return this.socket.endPoint;
  }
  get transport() {
    return this.socket.transport;
  }
  get heartbeatIntervalMs() {
    return this.socket.heartbeatIntervalMs;
  }
  get heartbeatCallback() {
    return this.socket.heartbeatCallback;
  }
  set heartbeatCallback(t) {
    this.socket.heartbeatCallback = t;
  }
  get heartbeatTimer() {
    return this.socket.heartbeatTimer;
  }
  get pendingHeartbeatRef() {
    return this.socket.pendingHeartbeatRef;
  }
  get reconnectTimer() {
    return this.socket.reconnectTimer;
  }
  get vsn() {
    return this.socket.vsn;
  }
  get encode() {
    return this.socket.encode;
  }
  get decode() {
    return this.socket.decode;
  }
  get reconnectAfterMs() {
    return this.socket.reconnectAfterMs;
  }
  get sendBuffer() {
    return this.socket.sendBuffer;
  }
  get stateChangeCallbacks() {
    return this.socket.stateChangeCallbacks;
  }
  connect() {
    this.socket.connect();
  }
  disconnect(t, r, s, n = 1e4) {
    return new Promise((i) => {
      setTimeout(() => i("timeout"), n), this.socket.disconnect(() => {
        t(), i("ok");
      }, r, s);
    });
  }
  push(t) {
    this.socket.push(t);
  }
  log(t, r, s) {
    this.socket.log(t, r, s);
  }
  makeRef() {
    return this.socket.makeRef();
  }
  onOpen(t) {
    this.socket.onOpen(t);
  }
  onClose(t) {
    this.socket.onClose(t);
  }
  onError(t) {
    this.socket.onError(t);
  }
  onMessage(t) {
    this.socket.onMessage(t);
  }
  isConnected() {
    return this.socket.isConnected();
  }
  isConnecting() {
    return this.socket.connectionState() == hr.connecting;
  }
  isDisconnecting() {
    return this.socket.connectionState() == hr.closing;
  }
  connectionState() {
    return this.socket.connectionState();
  }
  endPointURL() {
    return this.socket.endPointURL();
  }
  sendHeartbeat() {
    this.socket.sendHeartbeat();
  }
  getSocket() {
    return this.socket;
  }
};
var Gi = { HEARTBEAT_INTERVAL: 25e3, RECONNECT_DELAY: 10, HEARTBEAT_TIMEOUT_FALLBACK: 100 };
var Wp = [1e3, 2e3, 5e3, 1e4];
var Gp = 1e4;
var Jp = `
  addEventListener("message", (e) => {
    if (e.data.event === "start") {
      setInterval(() => postMessage({ event: "keepAlive" }), e.data.interval);
    }
  });`;
var Wt = class {
  static {
    __name(this, "Wt");
  }
  get endPoint() {
    return this.socketAdapter.endPoint;
  }
  get timeout() {
    return this.socketAdapter.timeout;
  }
  get transport() {
    return this.socketAdapter.transport;
  }
  get heartbeatCallback() {
    return this.socketAdapter.heartbeatCallback;
  }
  get heartbeatIntervalMs() {
    return this.socketAdapter.heartbeatIntervalMs;
  }
  get heartbeatTimer() {
    return this.worker ? this._workerHeartbeatTimer : this.socketAdapter.heartbeatTimer;
  }
  get pendingHeartbeatRef() {
    return this.worker ? this._pendingWorkerHeartbeatRef : this.socketAdapter.pendingHeartbeatRef;
  }
  get reconnectTimer() {
    return this.socketAdapter.reconnectTimer;
  }
  get vsn() {
    return this.socketAdapter.vsn;
  }
  get encode() {
    return this.socketAdapter.encode;
  }
  get decode() {
    return this.socketAdapter.decode;
  }
  get reconnectAfterMs() {
    return this.socketAdapter.reconnectAfterMs;
  }
  get sendBuffer() {
    return this.socketAdapter.sendBuffer;
  }
  get stateChangeCallbacks() {
    return this.socketAdapter.stateChangeCallbacks;
  }
  constructor(t, r) {
    var s;
    if (this.channels = new Array(), this.accessTokenValue = null, this.accessToken = null, this.apiKey = null, this.httpEndpoint = "", this.headers = {}, this.params = {}, this.ref = 0, this.serializer = new pr(), this._manuallySetToken = false, this._authPromise = null, this._workerHeartbeatTimer = void 0, this._pendingWorkerHeartbeatRef = null, this._pendingDisconnectTimer = null, this._disconnectOnEmptyChannelsAfterMs = 0, this._resolveFetch = (i) => i ? (...a) => i(...a) : (...a) => fetch(...a), !(!((s = r?.params) === null || s === void 0) && s.apikey)) throw new Error("API key is required to connect to Realtime");
    this.apiKey = r.params.apikey;
    let n = this._initializeOptions(r);
    this.socketAdapter = new wr(t, n), this.httpEndpoint = Xr(t), this.fetch = this._resolveFetch(r?.fetch);
  }
  connect() {
    if (!(this.isConnecting() || this.isDisconnecting() || this.isConnected())) {
      this.accessToken && !this._authPromise && this._setAuthSafely("connect"), this._setupConnectionHandlers();
      try {
        this.socketAdapter.connect();
      } catch (t) {
        let r = t.message;
        throw r.includes("Node.js") ? new Error(`${r}

To use Realtime in Node.js, you need to provide a WebSocket implementation:

Option 1: Use Node.js 22+ which has native WebSocket support
Option 2: Install and provide the "ws" package:

  npm install ws

  import ws from "ws"
  const client = new RealtimeClient(url, {
    ...options,
    transport: ws
  })`) : new Error(`WebSocket not available: ${r}`);
      }
      this._handleNodeJsRaceCondition();
    }
  }
  endpointURL() {
    return this.socketAdapter.endPointURL();
  }
  async disconnect(t, r) {
    return this._cancelPendingDisconnect(), this.isDisconnecting() ? "ok" : await this.socketAdapter.disconnect(() => {
      clearInterval(this._workerHeartbeatTimer), this._terminateWorker();
    }, t, r);
  }
  getChannels() {
    return this.channels;
  }
  async removeChannel(t) {
    let r = await t.unsubscribe();
    return r === "ok" && t.teardown(), r;
  }
  async removeAllChannels() {
    let t = this.channels.map(async (s) => {
      let n = await s.unsubscribe();
      return s.teardown(), n;
    }), r = await Promise.all(t);
    return await this.disconnect(), r;
  }
  log(t, r, s) {
    this.socketAdapter.log(t, r, s);
  }
  connectionState() {
    return this.socketAdapter.connectionState() || hr.closed;
  }
  isConnected() {
    return this.socketAdapter.isConnected();
  }
  isConnecting() {
    return this.socketAdapter.isConnecting();
  }
  isDisconnecting() {
    return this.socketAdapter.isDisconnecting();
  }
  channel(t, r = { config: {} }) {
    let s = `realtime:${t}`, n = this.getChannels().find((i) => i.topic === s);
    if (n) return n;
    {
      let i = new Kt(`realtime:${t}`, r, this);
      return this._cancelPendingDisconnect(), this.channels.push(i), i;
    }
  }
  push(t) {
    this.socketAdapter.push(t);
  }
  async setAuth(t = null) {
    this._authPromise = this._performAuth(t);
    try {
      await this._authPromise;
    } finally {
      this._authPromise = null;
    }
  }
  _isManualToken() {
    return this._manuallySetToken;
  }
  async sendHeartbeat() {
    this.socketAdapter.sendHeartbeat();
  }
  onHeartbeat(t) {
    this.socketAdapter.heartbeatCallback = this._wrapHeartbeatCallback(t);
  }
  _makeRef() {
    return this.socketAdapter.makeRef();
  }
  _remove(t) {
    this.channels = this.channels.filter((r) => r.topic !== t.topic), this.channels.length === 0 && (this.log("transport", "no channels remaining, scheduling disconnect"), this._schedulePendingDisconnect());
  }
  _schedulePendingDisconnect() {
    if (this._cancelPendingDisconnect(), this._disconnectOnEmptyChannelsAfterMs === 0) {
      this.log("transport", "disconnecting immediately - no channels"), this.disconnect();
      return;
    }
    this._pendingDisconnectTimer = setTimeout(() => {
      this._pendingDisconnectTimer = null, this.channels.length === 0 && (this.log("transport", "deferred disconnect fired - no channels, disconnecting"), this.disconnect());
    }, this._disconnectOnEmptyChannelsAfterMs), this.log("transport", `deferred disconnect scheduled in ${this._disconnectOnEmptyChannelsAfterMs}ms`);
  }
  _cancelPendingDisconnect() {
    this._pendingDisconnectTimer !== null && (this.log("transport", "pending disconnect cancelled - channel activity detected"), clearTimeout(this._pendingDisconnectTimer), this._pendingDisconnectTimer = null);
  }
  async _performAuth(t = null) {
    let r, s = false;
    if (t) r = t, s = true;
    else if (this.accessToken) try {
      r = await this.accessToken();
    } catch (n) {
      this.log("error", "Error fetching access token from callback", n), r = this.accessTokenValue;
    }
    else r = this.accessTokenValue;
    s ? this._manuallySetToken = true : this.accessToken && (this._manuallySetToken = false), this.accessTokenValue != r && (this.accessTokenValue = r, this.channels.forEach((n) => {
      let i = { access_token: r, version: Di };
      r && n.updateJoinPayload(i), n.joinedOnce && n.channelAdapter.isJoined() && n.channelAdapter.push(Jr.access_token, { access_token: r });
    }));
  }
  async _waitForAuthIfNeeded() {
    this._authPromise && await this._authPromise;
  }
  _setAuthSafely(t = "general") {
    this._isManualToken() || this.setAuth().catch((r) => {
      this.log("error", `Error setting auth in ${t}`, r);
    });
  }
  _setupConnectionHandlers() {
    this.socketAdapter.onOpen(() => {
      (this._authPromise || (this.accessToken && !this.accessTokenValue ? this.setAuth() : Promise.resolve())).catch((r) => {
        this.log("error", "error waiting for auth on connect", r);
      }), this.worker && !this.workerRef && this._startWorkerHeartbeat();
    }), this.socketAdapter.onClose(() => {
      this.worker && this.workerRef && this._terminateWorker();
    }), this.socketAdapter.onMessage((t) => {
      t.ref && t.ref === this._pendingWorkerHeartbeatRef && (this._pendingWorkerHeartbeatRef = null);
    });
  }
  _handleNodeJsRaceCondition() {
    this.socketAdapter.isConnected() && this.socketAdapter.getSocket().onConnOpen();
  }
  _wrapHeartbeatCallback(t) {
    return (r, s) => {
      r == "sent" && this._setAuthSafely(), t && t(r, s);
    };
  }
  _startWorkerHeartbeat() {
    this.workerUrl ? this.log("worker", `starting worker for from ${this.workerUrl}`) : this.log("worker", "starting default worker");
    let t = this._workerObjectUrl(this.workerUrl);
    this.workerRef = new Worker(t), this.workerRef.onerror = (r) => {
      this.log("worker", "worker error", r.message), this._terminateWorker(), this.disconnect();
    }, this.workerRef.onmessage = (r) => {
      r.data.event === "keepAlive" && this.sendHeartbeat();
    }, this.workerRef.postMessage({ event: "start", interval: this.heartbeatIntervalMs });
  }
  _terminateWorker() {
    this.workerRef && (this.log("worker", "terminating worker"), this.workerRef.terminate(), this.workerRef = void 0);
  }
  _workerObjectUrl(t) {
    let r;
    if (t) r = t;
    else {
      let s = new Blob([Jp], { type: "application/javascript" });
      r = URL.createObjectURL(s);
    }
    return r;
  }
  _initializeOptions(t) {
    var r, s, n, i, a, o, c, l, u, d, f;
    this.worker = (r = t?.worker) !== null && r !== void 0 ? r : false, this.accessToken = (s = t?.accessToken) !== null && s !== void 0 ? s : null;
    let p = {};
    p.timeout = (n = t?.timeout) !== null && n !== void 0 ? n : Mi, p.heartbeatIntervalMs = (i = t?.heartbeatIntervalMs) !== null && i !== void 0 ? i : Gi.HEARTBEAT_INTERVAL, this._disconnectOnEmptyChannelsAfterMs = (a = t?.disconnectOnEmptyChannelsAfterMs) !== null && a !== void 0 ? a : 2 * ((o = t?.heartbeatIntervalMs) !== null && o !== void 0 ? o : Gi.HEARTBEAT_INTERVAL), p.transport = (c = t?.transport) !== null && c !== void 0 ? c : en.getWebSocketConstructor(), p.params = t?.params, p.logger = t?.logger, p.heartbeatCallback = this._wrapHeartbeatCallback(t?.heartbeatCallback), p.reconnectAfterMs = (l = t?.reconnectAfterMs) !== null && l !== void 0 ? l : ((v) => Wp[v - 1] || Gp);
    let g, y, E = (u = t?.vsn) !== null && u !== void 0 ? u : Bi;
    switch (E) {
      case $i:
        g = /* @__PURE__ */ __name((v, b) => b(JSON.stringify(v)), "g"), y = /* @__PURE__ */ __name((v, b) => b(JSON.parse(v)), "y");
        break;
      case tn:
        g = this.serializer.encode.bind(this.serializer), y = this.serializer.decode.bind(this.serializer);
        break;
      default:
        throw new Error(`Unsupported serializer version: ${p.vsn}`);
    }
    if (p.vsn = E, p.encode = (d = t?.encode) !== null && d !== void 0 ? d : g, p.decode = (f = t?.decode) !== null && f !== void 0 ? f : y, p.beforeReconnect = this._reconnectAuth.bind(this), (t?.logLevel || t?.log_level) && (this.logLevel = t.logLevel || t.log_level, p.params = Object.assign(Object.assign({}, p.params), { log_level: this.logLevel })), this.worker) {
      if (typeof window < "u" && !window.Worker) throw new Error("Web Worker is not supported");
      this.workerUrl = t?.workerUrl, p.autoSendHeartbeat = !this.worker;
    }
    return p;
  }
  async _reconnectAuth() {
    await this._waitForAuthIfNeeded(), this.isConnected() || this.connect();
  }
};
var vr = class extends Error {
  static {
    __name(this, "vr");
  }
  constructor(e20, t) {
    super(e20), this.name = "IcebergError", this.status = t.status, this.icebergType = t.icebergType, this.icebergCode = t.icebergCode, this.details = t.details, this.isCommitStateUnknown = t.icebergType === "CommitStateUnknownException" || [500, 502, 504].includes(t.status) && t.icebergType?.includes("CommitState") === true;
  }
  isNotFound() {
    return this.status === 404;
  }
  isConflict() {
    return this.status === 409;
  }
  isAuthenticationTimeout() {
    return this.status === 419;
  }
};
function Xp(e20, t, r) {
  let s = new URL(t, e20);
  if (r) for (let [n, i] of Object.entries(r)) i !== void 0 && s.searchParams.set(n, i);
  return s.toString();
}
__name(Xp, "Xp");
async function Yp(e20) {
  return !e20 || e20.type === "none" ? {} : e20.type === "bearer" ? { Authorization: `Bearer ${e20.token}` } : e20.type === "header" ? { [e20.name]: e20.value } : e20.type === "custom" ? await e20.getHeaders() : {};
}
__name(Yp, "Yp");
function Zp(e20) {
  let t = e20.fetchImpl ?? globalThis.fetch;
  return { async request({ method: r, path: s, query: n, body: i, headers: a }) {
    let o = Xp(e20.baseUrl, s, n), c = await Yp(e20.auth), l = await t(o, { method: r, headers: { ...i ? { "Content-Type": "application/json" } : {}, ...c, ...a }, body: i ? JSON.stringify(i) : void 0 }), u = await l.text(), d = (l.headers.get("content-type") || "").includes("application/json"), f = d && u ? JSON.parse(u) : u;
    if (!l.ok) {
      let p = d ? f : void 0, g = p?.error;
      throw new vr(g?.message ?? `Request failed with status ${l.status}`, { status: l.status, icebergType: g?.type, icebergCode: g?.code, details: p });
    }
    return { status: l.status, headers: l.headers, data: f };
  } };
}
__name(Zp, "Zp");
function ts(e20) {
  return e20.join("");
}
__name(ts, "ts");
var Qp = class {
  static {
    __name(this, "Qp");
  }
  constructor(e20, t = "") {
    this.client = e20, this.prefix = t;
  }
  async listNamespaces(e20) {
    let t = e20 ? { parent: ts(e20.namespace) } : void 0;
    return (await this.client.request({ method: "GET", path: `${this.prefix}/namespaces`, query: t })).data.namespaces.map((s) => ({ namespace: s }));
  }
  async createNamespace(e20, t) {
    let r = { namespace: e20.namespace, properties: t?.properties };
    return (await this.client.request({ method: "POST", path: `${this.prefix}/namespaces`, body: r })).data;
  }
  async dropNamespace(e20) {
    await this.client.request({ method: "DELETE", path: `${this.prefix}/namespaces/${ts(e20.namespace)}` });
  }
  async loadNamespaceMetadata(e20) {
    return { properties: (await this.client.request({ method: "GET", path: `${this.prefix}/namespaces/${ts(e20.namespace)}` })).data.properties };
  }
  async namespaceExists(e20) {
    try {
      return await this.client.request({ method: "HEAD", path: `${this.prefix}/namespaces/${ts(e20.namespace)}` }), true;
    } catch (t) {
      if (t instanceof vr && t.status === 404) return false;
      throw t;
    }
  }
  async createNamespaceIfNotExists(e20, t) {
    try {
      return await this.createNamespace(e20, t);
    } catch (r) {
      if (r instanceof vr && r.status === 409) return;
      throw r;
    }
  }
};
function Gt(e20) {
  return e20.join("");
}
__name(Gt, "Gt");
var ef = class {
  static {
    __name(this, "ef");
  }
  constructor(e20, t = "", r) {
    this.client = e20, this.prefix = t, this.accessDelegation = r;
  }
  async listTables(e20) {
    return (await this.client.request({ method: "GET", path: `${this.prefix}/namespaces/${Gt(e20.namespace)}/tables` })).data.identifiers;
  }
  async createTable(e20, t) {
    let r = {};
    return this.accessDelegation && (r["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({ method: "POST", path: `${this.prefix}/namespaces/${Gt(e20.namespace)}/tables`, body: t, headers: r })).data.metadata;
  }
  async updateTable(e20, t) {
    let r = await this.client.request({ method: "POST", path: `${this.prefix}/namespaces/${Gt(e20.namespace)}/tables/${e20.name}`, body: t });
    return { "metadata-location": r.data["metadata-location"], metadata: r.data.metadata };
  }
  async dropTable(e20, t) {
    await this.client.request({ method: "DELETE", path: `${this.prefix}/namespaces/${Gt(e20.namespace)}/tables/${e20.name}`, query: { purgeRequested: String(t?.purge ?? false) } });
  }
  async loadTable(e20) {
    let t = {};
    return this.accessDelegation && (t["X-Iceberg-Access-Delegation"] = this.accessDelegation), (await this.client.request({ method: "GET", path: `${this.prefix}/namespaces/${Gt(e20.namespace)}/tables/${e20.name}`, headers: t })).data.metadata;
  }
  async tableExists(e20) {
    let t = {};
    this.accessDelegation && (t["X-Iceberg-Access-Delegation"] = this.accessDelegation);
    try {
      return await this.client.request({ method: "HEAD", path: `${this.prefix}/namespaces/${Gt(e20.namespace)}/tables/${e20.name}`, headers: t }), true;
    } catch (r) {
      if (r instanceof vr && r.status === 404) return false;
      throw r;
    }
  }
  async createTableIfNotExists(e20, t) {
    try {
      return await this.createTable(e20, t);
    } catch (r) {
      if (r instanceof vr && r.status === 409) return await this.loadTable({ namespace: e20.namespace, name: t.name });
      throw r;
    }
  }
};
var Ji = class {
  static {
    __name(this, "Ji");
  }
  constructor(e20) {
    let t = "v1";
    e20.catalogName && (t += `/${e20.catalogName}`);
    let r = e20.baseUrl.endsWith("/") ? e20.baseUrl : `${e20.baseUrl}/`;
    this.client = Zp({ baseUrl: r, auth: e20.auth, fetchImpl: e20.fetch }), this.accessDelegation = e20.accessDelegation?.join(","), this.namespaceOps = new Qp(this.client, t), this.tableOps = new ef(this.client, t, this.accessDelegation);
  }
  async listNamespaces(e20) {
    return this.namespaceOps.listNamespaces(e20);
  }
  async createNamespace(e20, t) {
    return this.namespaceOps.createNamespace(e20, t);
  }
  async dropNamespace(e20) {
    await this.namespaceOps.dropNamespace(e20);
  }
  async loadNamespaceMetadata(e20) {
    return this.namespaceOps.loadNamespaceMetadata(e20);
  }
  async listTables(e20) {
    return this.tableOps.listTables(e20);
  }
  async createTable(e20, t) {
    return this.tableOps.createTable(e20, t);
  }
  async updateTable(e20, t) {
    return this.tableOps.updateTable(e20, t);
  }
  async dropTable(e20, t) {
    await this.tableOps.dropTable(e20, t);
  }
  async loadTable(e20) {
    return this.tableOps.loadTable(e20);
  }
  async namespaceExists(e20) {
    return this.namespaceOps.namespaceExists(e20);
  }
  async tableExists(e20) {
    return this.tableOps.tableExists(e20);
  }
  async createNamespaceIfNotExists(e20, t) {
    return this.namespaceOps.createNamespaceIfNotExists(e20, t);
  }
  async createTableIfNotExists(e20, t) {
    return this.tableOps.createTableIfNotExists(e20, t);
  }
};
function br(e20) {
  "@babel/helpers - typeof";
  return br = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, br(e20);
}
__name(br, "br");
function tf(e20, t) {
  if (br(e20) != "object" || !e20) return e20;
  var r = e20[Symbol.toPrimitive];
  if (r !== void 0) {
    var s = r.call(e20, t || "default");
    if (br(s) != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e20);
}
__name(tf, "tf");
function rf(e20) {
  var t = tf(e20, "string");
  return br(t) == "symbol" ? t : t + "";
}
__name(rf, "rf");
function sf(e20, t, r) {
  return (t = rf(t)) in e20 ? Object.defineProperty(e20, t, { value: r, enumerable: true, configurable: true, writable: true }) : e20[t] = r, e20;
}
__name(sf, "sf");
function Xi(e20, t) {
  var r = Object.keys(e20);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(e20);
    t && (s = s.filter(function(n) {
      return Object.getOwnPropertyDescriptor(e20, n).enumerable;
    })), r.push.apply(r, s);
  }
  return r;
}
__name(Xi, "Xi");
function C(e20) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Xi(Object(r), true).forEach(function(s) {
      sf(e20, s, r[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e20, Object.getOwnPropertyDescriptors(r)) : Xi(Object(r)).forEach(function(s) {
      Object.defineProperty(e20, s, Object.getOwnPropertyDescriptor(r, s));
    });
  }
  return e20;
}
__name(C, "C");
var ns = class extends Error {
  static {
    __name(this, "ns");
  }
  constructor(e20, t = "storage", r, s) {
    super(e20), this.__isStorageError = true, this.namespace = t, this.name = t === "vectors" ? "StorageVectorsError" : "StorageError", this.status = r, this.statusCode = s;
  }
  toJSON() {
    return { name: this.name, message: this.message, status: this.status, statusCode: this.statusCode };
  }
};
function is(e20) {
  return typeof e20 == "object" && e20 !== null && "__isStorageError" in e20;
}
__name(is, "is");
var rs = class extends ns {
  static {
    __name(this, "rs");
  }
  constructor(e20, t, r, s = "storage") {
    super(e20, s, t, r), this.name = s === "vectors" ? "StorageVectorsApiError" : "StorageApiError", this.status = t, this.statusCode = r;
  }
  toJSON() {
    return C({}, super.toJSON());
  }
};
var Qi = class extends ns {
  static {
    __name(this, "Qi");
  }
  constructor(e20, t, r = "storage") {
    super(e20, r), this.name = r === "vectors" ? "StorageVectorsUnknownError" : "StorageUnknownError", this.originalError = t;
  }
};
function ss(e20, t, r) {
  let s = C({}, e20), n = t.toLowerCase();
  for (let i of Object.keys(s)) i.toLowerCase() === n && delete s[i];
  return s[n] = r, s;
}
__name(ss, "ss");
function nf(e20) {
  let t = {};
  for (let [r, s] of Object.entries(e20)) t[r.toLowerCase()] = s;
  return t;
}
__name(nf, "nf");
var af = /* @__PURE__ */ __name((e20) => e20 ? (...t) => e20(...t) : (...t) => fetch(...t), "af");
var of = /* @__PURE__ */ __name((e20) => {
  if (typeof e20 != "object" || e20 === null) return false;
  let t = Object.getPrototypeOf(e20);
  return (t === null || t === Object.prototype || Object.getPrototypeOf(t) === null) && !(Symbol.toStringTag in e20) && !(Symbol.iterator in e20);
}, "of");
var ln = /* @__PURE__ */ __name((e20) => {
  if (Array.isArray(e20)) return e20.map((r) => ln(r));
  if (typeof e20 == "function" || e20 !== Object(e20)) return e20;
  let t = {};
  return Object.entries(e20).forEach(([r, s]) => {
    let n = r.replace(/([-_][a-z])/gi, (i) => i.toUpperCase().replace(/[-_]/g, ""));
    t[n] = ln(s);
  }), t;
}, "ln");
var cf = /* @__PURE__ */ __name((e20) => !e20 || typeof e20 != "string" || e20.length === 0 || e20.length > 100 || e20.trim() !== e20 || e20.includes("/") || e20.includes("\\") ? false : /^[\w!.\*'() &$@=;:+,?-]+$/.test(e20), "cf");
var Yi = /* @__PURE__ */ __name((e20) => {
  var t;
  return e20.msg || e20.message || e20.error_description || (typeof e20.error == "string" ? e20.error : (t = e20.error) === null || t === void 0 ? void 0 : t.message) || JSON.stringify(e20);
}, "Yi");
var lf = /* @__PURE__ */ __name(async (e20, t, r, s) => {
  if (e20 !== null && typeof e20 == "object" && typeof e20.json == "function") {
    let n = e20, i = parseInt(n.status, 10);
    Number.isFinite(i) || (i = 500), n.json().then((a) => {
      let o = a?.statusCode || a?.code || i + "";
      t(new rs(Yi(a), i, o, s));
    }).catch(() => {
      let a = i + "";
      t(new rs(n.statusText || `HTTP ${i} error`, i, a, s));
    });
  } else t(new Qi(Yi(e20), e20, s));
}, "lf");
var uf = /* @__PURE__ */ __name((e20, t, r, s) => {
  let n = { method: e20, headers: t?.headers || {} };
  if (e20 === "GET" || e20 === "HEAD" || !s) return C(C({}, n), r);
  if (of(s)) {
    var i;
    let a = t?.headers || {}, o;
    for (let [c, l] of Object.entries(a)) c.toLowerCase() === "content-type" && (o = l);
    n.headers = ss(a, "Content-Type", (i = o) !== null && i !== void 0 ? i : "application/json"), n.body = JSON.stringify(s);
  } else n.body = s;
  return t?.duplex && (n.duplex = t.duplex), C(C({}, n), r);
}, "uf");
async function _r(e20, t, r, s, n, i, a) {
  return new Promise((o, c) => {
    e20(r, uf(t, s, n, i)).then((l) => {
      if (!l.ok) throw l;
      if (s?.noResolveJson) return l;
      if (a === "vectors") {
        let u = l.headers.get("content-type");
        if (l.headers.get("content-length") === "0" || l.status === 204) return {};
        if (!u || !u.includes("application/json")) return {};
      }
      return l.json();
    }).then((l) => o(l)).catch((l) => lf(l, c, s, a));
  });
}
__name(_r, "_r");
function ea(e20 = "storage") {
  return { get: /* @__PURE__ */ __name(async (t, r, s, n) => _r(t, "GET", r, s, n, void 0, e20), "get"), post: /* @__PURE__ */ __name(async (t, r, s, n, i) => _r(t, "POST", r, n, i, s, e20), "post"), put: /* @__PURE__ */ __name(async (t, r, s, n, i) => _r(t, "PUT", r, n, i, s, e20), "put"), head: /* @__PURE__ */ __name(async (t, r, s, n) => _r(t, "HEAD", r, C(C({}, s), {}, { noResolveJson: true }), n, void 0, e20), "head"), remove: /* @__PURE__ */ __name(async (t, r, s, n, i) => _r(t, "DELETE", r, n, i, s, e20), "remove") };
}
__name(ea, "ea");
var df = ea("storage");
var { get: xr, post: fe, put: un, head: hf, remove: dn } = df;
var re = ea("vectors");
var Jt = class {
  static {
    __name(this, "Jt");
  }
  constructor(e20, t = {}, r, s = "storage") {
    this.shouldThrowOnError = false, this.url = e20, this.headers = nf(t), this.fetch = af(r), this.namespace = s;
  }
  throwOnError() {
    return this.shouldThrowOnError = true, this;
  }
  setHeader(e20, t) {
    return this.headers = ss(this.headers, e20, t), this;
  }
  async handleOperation(e20) {
    var t = this;
    try {
      return { data: await e20(), error: null };
    } catch (r) {
      if (t.shouldThrowOnError) throw r;
      if (is(r)) return { data: null, error: r };
      throw r;
    }
  }
};
var pf = class {
  static {
    __name(this, "pf");
  }
  constructor(e20, t) {
    this.downloadFn = e20, this.shouldThrowOnError = t;
  }
  then(e20, t) {
    return this.execute().then(e20, t);
  }
  async execute() {
    var e20 = this;
    try {
      return { data: (await e20.downloadFn()).body, error: null };
    } catch (t) {
      if (e20.shouldThrowOnError) throw t;
      if (is(t)) return { data: null, error: t };
      throw t;
    }
  }
};
var ta;
ta = Symbol.toStringTag;
var ff = class {
  static {
    __name(this, "ff");
  }
  constructor(e20, t) {
    this.downloadFn = e20, this.shouldThrowOnError = t, this[ta] = "BlobDownloadBuilder", this.promise = null;
  }
  asStream() {
    return new pf(this.downloadFn, this.shouldThrowOnError);
  }
  then(e20, t) {
    return this.getPromise().then(e20, t);
  }
  catch(e20) {
    return this.getPromise().catch(e20);
  }
  finally(e20) {
    return this.getPromise().finally(e20);
  }
  getPromise() {
    return this.promise || (this.promise = this.execute()), this.promise;
  }
  async execute() {
    var e20 = this;
    try {
      return { data: await (await e20.downloadFn()).blob(), error: null };
    } catch (t) {
      if (e20.shouldThrowOnError) throw t;
      if (is(t)) return { data: null, error: t };
      throw t;
    }
  }
};
var mf = { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } };
var Zi = { cacheControl: "3600", contentType: "text/plain;charset=UTF-8", upsert: false };
var gf = class extends Jt {
  static {
    __name(this, "gf");
  }
  constructor(e20, t = {}, r, s) {
    super(e20, t, s, "storage"), this.bucketId = r;
  }
  async uploadOrUpdate(e20, t, r, s) {
    var n = this;
    return n.handleOperation(async () => {
      let i, a = C(C({}, Zi), s), o = C(C({}, n.headers), e20 === "POST" && { "x-upsert": String(a.upsert) }), c = a.metadata;
      if (typeof Blob < "u" && r instanceof Blob ? (i = new FormData(), i.append("cacheControl", a.cacheControl), c && i.append("metadata", n.encodeMetadata(c)), i.append("", r)) : typeof FormData < "u" && r instanceof FormData ? (i = r, i.has("cacheControl") || i.append("cacheControl", a.cacheControl), c && !i.has("metadata") && i.append("metadata", n.encodeMetadata(c))) : (i = r, o["cache-control"] = `max-age=${a.cacheControl}`, o["content-type"] = a.contentType, c && (o["x-metadata"] = n.toBase64(n.encodeMetadata(c))), (typeof ReadableStream < "u" && i instanceof ReadableStream || i && typeof i == "object" && "pipe" in i && typeof i.pipe == "function") && !a.duplex && (a.duplex = "half")), s?.headers) for (let [f, p] of Object.entries(s.headers)) o = ss(o, f, p);
      let l = n._removeEmptyFolders(t), u = n._getFinalPath(l), d = await (e20 == "PUT" ? un : fe)(n.fetch, `${n.url}/object/${u}`, i, C({ headers: o }, a?.duplex ? { duplex: a.duplex } : {}));
      return { path: l, id: d.Id, fullPath: d.Key };
    });
  }
  async upload(e20, t, r) {
    return this.uploadOrUpdate("POST", e20, t, r);
  }
  async uploadToSignedUrl(e20, t, r, s) {
    var n = this;
    let i = n._removeEmptyFolders(e20), a = n._getFinalPath(i), o = new URL(n.url + `/object/upload/sign/${a}`);
    return o.searchParams.set("token", t), n.handleOperation(async () => {
      let c, l = C(C({}, Zi), s), u = C(C({}, n.headers), { "x-upsert": String(l.upsert) }), d = l.metadata;
      if (typeof Blob < "u" && r instanceof Blob ? (c = new FormData(), c.append("cacheControl", l.cacheControl), d && c.append("metadata", n.encodeMetadata(d)), c.append("", r)) : typeof FormData < "u" && r instanceof FormData ? (c = r, c.has("cacheControl") || c.append("cacheControl", l.cacheControl), d && !c.has("metadata") && c.append("metadata", n.encodeMetadata(d))) : (c = r, u["cache-control"] = `max-age=${l.cacheControl}`, u["content-type"] = l.contentType, d && (u["x-metadata"] = n.toBase64(n.encodeMetadata(d))), (typeof ReadableStream < "u" && c instanceof ReadableStream || c && typeof c == "object" && "pipe" in c && typeof c.pipe == "function") && !l.duplex && (l.duplex = "half")), s?.headers) for (let [f, p] of Object.entries(s.headers)) u = ss(u, f, p);
      return { path: i, fullPath: (await un(n.fetch, o.toString(), c, C({ headers: u }, l?.duplex ? { duplex: l.duplex } : {}))).Key };
    });
  }
  async createSignedUploadUrl(e20, t) {
    var r = this;
    return r.handleOperation(async () => {
      let s = r._getFinalPath(e20), n = C({}, r.headers);
      t?.upsert && (n["x-upsert"] = "true");
      let i = await fe(r.fetch, `${r.url}/object/upload/sign/${s}`, {}, { headers: n }), a = new URL(r.url + i.url), o = a.searchParams.get("token");
      if (!o) throw new ns("No token returned by API");
      return { signedUrl: a.toString(), path: e20, token: o };
    });
  }
  async update(e20, t, r) {
    return this.uploadOrUpdate("PUT", e20, t, r);
  }
  async move(e20, t, r) {
    var s = this;
    return s.handleOperation(async () => await fe(s.fetch, `${s.url}/object/move`, { bucketId: s.bucketId, sourceKey: e20, destinationKey: t, destinationBucket: r?.destinationBucket }, { headers: s.headers }));
  }
  async copy(e20, t, r) {
    var s = this;
    return s.handleOperation(async () => ({ path: (await fe(s.fetch, `${s.url}/object/copy`, { bucketId: s.bucketId, sourceKey: e20, destinationKey: t, destinationBucket: r?.destinationBucket }, { headers: s.headers })).Key }));
  }
  async createSignedUrl(e20, t, r) {
    var s = this;
    return s.handleOperation(async () => {
      let n = s._getFinalPath(e20), i = typeof r?.transform == "object" && r.transform !== null && Object.keys(r.transform).length > 0, a = await fe(s.fetch, `${s.url}/object/sign/${n}`, C({ expiresIn: t }, i ? { transform: r.transform } : {}), { headers: s.headers }), o = new URLSearchParams();
      r?.download && o.set("download", r.download === true ? "" : r.download), r?.cacheNonce != null && o.set("cacheNonce", String(r.cacheNonce));
      let c = o.toString();
      return { signedUrl: encodeURI(`${s.url}${a.signedURL}${c ? `&${c}` : ""}`) };
    });
  }
  async createSignedUrls(e20, t, r) {
    var s = this;
    return s.handleOperation(async () => {
      let n = await fe(s.fetch, `${s.url}/object/sign/${s.bucketId}`, { expiresIn: t, paths: e20 }, { headers: s.headers }), i = new URLSearchParams();
      r?.download && i.set("download", r.download === true ? "" : r.download), r?.cacheNonce != null && i.set("cacheNonce", String(r.cacheNonce));
      let a = i.toString();
      return n.map((o) => C(C({}, o), {}, { signedUrl: o.signedURL ? encodeURI(`${s.url}${o.signedURL}${a ? `&${a}` : ""}`) : null }));
    });
  }
  download(e20, t, r) {
    let s = typeof t?.transform == "object" && t.transform !== null && Object.keys(t.transform).length > 0 ? "render/image/authenticated" : "object", n = new URLSearchParams();
    t?.transform && this.applyTransformOptsToQuery(n, t.transform), t?.cacheNonce != null && n.set("cacheNonce", String(t.cacheNonce));
    let i = n.toString(), a = this._getFinalPath(e20), o = /* @__PURE__ */ __name(() => xr(this.fetch, `${this.url}/${s}/${a}${i ? `?${i}` : ""}`, { headers: this.headers, noResolveJson: true }, r), "o");
    return new ff(o, this.shouldThrowOnError);
  }
  async info(e20) {
    var t = this;
    let r = t._getFinalPath(e20);
    return t.handleOperation(async () => ln(await xr(t.fetch, `${t.url}/object/info/${r}`, { headers: t.headers })));
  }
  async exists(e20) {
    var t = this;
    let r = t._getFinalPath(e20);
    try {
      return await hf(t.fetch, `${t.url}/object/${r}`, { headers: t.headers }), { data: true, error: null };
    } catch (n) {
      if (t.shouldThrowOnError) throw n;
      if (is(n)) {
        var s;
        let i = n instanceof rs ? n.status : n instanceof Qi ? (s = n.originalError) === null || s === void 0 ? void 0 : s.status : void 0;
        if (i !== void 0 && [400, 404].includes(i)) return { data: false, error: n };
      }
      throw n;
    }
  }
  getPublicUrl(e20, t) {
    let r = this._getFinalPath(e20), s = new URLSearchParams();
    t?.download && s.set("download", t.download === true ? "" : t.download), t?.transform && this.applyTransformOptsToQuery(s, t.transform), t?.cacheNonce != null && s.set("cacheNonce", String(t.cacheNonce));
    let n = s.toString(), i = typeof t?.transform == "object" && t.transform !== null && Object.keys(t.transform).length > 0 ? "render/image" : "object";
    return { data: { publicUrl: encodeURI(`${this.url}/${i}/public/${r}`) + (n ? `?${n}` : "") } };
  }
  async remove(e20) {
    var t = this;
    return t.handleOperation(async () => await dn(t.fetch, `${t.url}/object/${t.bucketId}`, { prefixes: e20 }, { headers: t.headers }));
  }
  async list(e20, t, r) {
    var s = this;
    return s.handleOperation(async () => {
      let n = C(C(C({}, mf), t), {}, { prefix: e20 || "" });
      return await fe(s.fetch, `${s.url}/object/list/${s.bucketId}`, n, { headers: s.headers }, r);
    });
  }
  async listV2(e20, t) {
    var r = this;
    return r.handleOperation(async () => {
      let s = C({}, e20);
      return await fe(r.fetch, `${r.url}/object/list-v2/${r.bucketId}`, s, { headers: r.headers }, t);
    });
  }
  encodeMetadata(e20) {
    return JSON.stringify(e20);
  }
  toBase64(e20) {
    return typeof Buffer < "u" ? Buffer.from(e20).toString("base64") : btoa(e20);
  }
  _getFinalPath(e20) {
    return `${this.bucketId}/${e20.replace(/^\/+/, "")}`;
  }
  _removeEmptyFolders(e20) {
    return e20.replace(/^\/|\/$/g, "").replace(/\/+/g, "/");
  }
  applyTransformOptsToQuery(e20, t) {
    return t.width && e20.set("width", t.width.toString()), t.height && e20.set("height", t.height.toString()), t.resize && e20.set("resize", t.resize), t.format && e20.set("format", t.format), t.quality && e20.set("quality", t.quality.toString()), e20;
  }
};
var yf = "2.105.1";
var Sr = { "X-Client-Info": `storage-js/${yf}` };
var wf = class extends Jt {
  static {
    __name(this, "wf");
  }
  constructor(e20, t = {}, r, s) {
    let n = new URL(e20);
    s?.useNewHostname && /supabase\.(co|in|red)$/.test(n.hostname) && !n.hostname.includes("storage.supabase.") && (n.hostname = n.hostname.replace("supabase.", "storage.supabase."));
    let i = n.href.replace(/\/$/, ""), a = C(C({}, Sr), t);
    super(i, a, r, "storage");
  }
  async listBuckets(e20) {
    var t = this;
    return t.handleOperation(async () => {
      let r = t.listBucketOptionsToQueryString(e20);
      return await xr(t.fetch, `${t.url}/bucket${r}`, { headers: t.headers });
    });
  }
  async getBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await xr(t.fetch, `${t.url}/bucket/${e20}`, { headers: t.headers }));
  }
  async createBucket(e20, t = { public: false }) {
    var r = this;
    return r.handleOperation(async () => await fe(r.fetch, `${r.url}/bucket`, { id: e20, name: e20, type: t.type, public: t.public, file_size_limit: t.fileSizeLimit, allowed_mime_types: t.allowedMimeTypes }, { headers: r.headers }));
  }
  async updateBucket(e20, t) {
    var r = this;
    return r.handleOperation(async () => await un(r.fetch, `${r.url}/bucket/${e20}`, { id: e20, name: e20, public: t.public, file_size_limit: t.fileSizeLimit, allowed_mime_types: t.allowedMimeTypes }, { headers: r.headers }));
  }
  async emptyBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await fe(t.fetch, `${t.url}/bucket/${e20}/empty`, {}, { headers: t.headers }));
  }
  async deleteBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await dn(t.fetch, `${t.url}/bucket/${e20}`, {}, { headers: t.headers }));
  }
  listBucketOptionsToQueryString(e20) {
    let t = {};
    return e20 && ("limit" in e20 && (t.limit = String(e20.limit)), "offset" in e20 && (t.offset = String(e20.offset)), e20.search && (t.search = e20.search), e20.sortColumn && (t.sortColumn = e20.sortColumn), e20.sortOrder && (t.sortOrder = e20.sortOrder)), Object.keys(t).length > 0 ? "?" + new URLSearchParams(t).toString() : "";
  }
};
var vf = class extends Jt {
  static {
    __name(this, "vf");
  }
  constructor(e20, t = {}, r) {
    let s = e20.replace(/\/$/, ""), n = C(C({}, Sr), t);
    super(s, n, r, "storage");
  }
  async createBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await fe(t.fetch, `${t.url}/bucket`, { name: e20 }, { headers: t.headers }));
  }
  async listBuckets(e20) {
    var t = this;
    return t.handleOperation(async () => {
      let r = new URLSearchParams();
      e20?.limit !== void 0 && r.set("limit", e20.limit.toString()), e20?.offset !== void 0 && r.set("offset", e20.offset.toString()), e20?.sortColumn && r.set("sortColumn", e20.sortColumn), e20?.sortOrder && r.set("sortOrder", e20.sortOrder), e20?.search && r.set("search", e20.search);
      let s = r.toString(), n = s ? `${t.url}/bucket?${s}` : `${t.url}/bucket`;
      return await xr(t.fetch, n, { headers: t.headers });
    });
  }
  async deleteBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await dn(t.fetch, `${t.url}/bucket/${e20}`, {}, { headers: t.headers }));
  }
  from(e20) {
    var t = this;
    if (!cf(e20)) throw new ns("Invalid bucket name: File, folder, and bucket names must follow AWS object key naming guidelines and should avoid the use of any other characters.");
    let r = new Ji({ baseUrl: this.url, catalogName: e20, auth: { type: "custom", getHeaders: /* @__PURE__ */ __name(async () => t.headers, "getHeaders") }, fetch: this.fetch }), s = this.shouldThrowOnError;
    return new Proxy(r, { get(n, i) {
      let a = n[i];
      return typeof a != "function" ? a : async (...o) => {
        try {
          return { data: await a.apply(n, o), error: null };
        } catch (c) {
          if (s) throw c;
          return { data: null, error: c };
        }
      };
    } });
  }
};
var _f = class extends Jt {
  static {
    __name(this, "_f");
  }
  constructor(e20, t = {}, r) {
    let s = e20.replace(/\/$/, ""), n = C(C({}, Sr), {}, { "Content-Type": "application/json" }, t);
    super(s, n, r, "vectors");
  }
  async createIndex(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/CreateIndex`, e20, { headers: t.headers }) || {});
  }
  async getIndex(e20, t) {
    var r = this;
    return r.handleOperation(async () => await re.post(r.fetch, `${r.url}/GetIndex`, { vectorBucketName: e20, indexName: t }, { headers: r.headers }));
  }
  async listIndexes(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/ListIndexes`, e20, { headers: t.headers }));
  }
  async deleteIndex(e20, t) {
    var r = this;
    return r.handleOperation(async () => await re.post(r.fetch, `${r.url}/DeleteIndex`, { vectorBucketName: e20, indexName: t }, { headers: r.headers }) || {});
  }
};
var bf = class extends Jt {
  static {
    __name(this, "bf");
  }
  constructor(e20, t = {}, r) {
    let s = e20.replace(/\/$/, ""), n = C(C({}, Sr), {}, { "Content-Type": "application/json" }, t);
    super(s, n, r, "vectors");
  }
  async putVectors(e20) {
    var t = this;
    if (e20.vectors.length < 1 || e20.vectors.length > 500) throw new Error("Vector batch size must be between 1 and 500 items");
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/PutVectors`, e20, { headers: t.headers }) || {});
  }
  async getVectors(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/GetVectors`, e20, { headers: t.headers }));
  }
  async listVectors(e20) {
    var t = this;
    if (e20.segmentCount !== void 0) {
      if (e20.segmentCount < 1 || e20.segmentCount > 16) throw new Error("segmentCount must be between 1 and 16");
      if (e20.segmentIndex !== void 0 && (e20.segmentIndex < 0 || e20.segmentIndex >= e20.segmentCount)) throw new Error(`segmentIndex must be between 0 and ${e20.segmentCount - 1}`);
    }
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/ListVectors`, e20, { headers: t.headers }));
  }
  async queryVectors(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/QueryVectors`, e20, { headers: t.headers }));
  }
  async deleteVectors(e20) {
    var t = this;
    if (e20.keys.length < 1 || e20.keys.length > 500) throw new Error("Keys batch size must be between 1 and 500 items");
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/DeleteVectors`, e20, { headers: t.headers }) || {});
  }
};
var xf = class extends Jt {
  static {
    __name(this, "xf");
  }
  constructor(e20, t = {}, r) {
    let s = e20.replace(/\/$/, ""), n = C(C({}, Sr), {}, { "Content-Type": "application/json" }, t);
    super(s, n, r, "vectors");
  }
  async createBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/CreateVectorBucket`, { vectorBucketName: e20 }, { headers: t.headers }) || {});
  }
  async getBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/GetVectorBucket`, { vectorBucketName: e20 }, { headers: t.headers }));
  }
  async listBuckets(e20 = {}) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/ListVectorBuckets`, e20, { headers: t.headers }));
  }
  async deleteBucket(e20) {
    var t = this;
    return t.handleOperation(async () => await re.post(t.fetch, `${t.url}/DeleteVectorBucket`, { vectorBucketName: e20 }, { headers: t.headers }) || {});
  }
};
var Sf = class extends xf {
  static {
    __name(this, "Sf");
  }
  constructor(e20, t = {}) {
    super(e20, t.headers || {}, t.fetch);
  }
  from(e20) {
    return new Ef(this.url, this.headers, e20, this.fetch);
  }
  async createBucket(e20) {
    var t = /* @__PURE__ */ __name(() => super.createBucket, "t"), r = this;
    return t().call(r, e20);
  }
  async getBucket(e20) {
    var t = /* @__PURE__ */ __name(() => super.getBucket, "t"), r = this;
    return t().call(r, e20);
  }
  async listBuckets(e20 = {}) {
    var t = /* @__PURE__ */ __name(() => super.listBuckets, "t"), r = this;
    return t().call(r, e20);
  }
  async deleteBucket(e20) {
    var t = /* @__PURE__ */ __name(() => super.deleteBucket, "t"), r = this;
    return t().call(r, e20);
  }
};
var Ef = class extends _f {
  static {
    __name(this, "Ef");
  }
  constructor(e20, t, r, s) {
    super(e20, t, s), this.vectorBucketName = r;
  }
  async createIndex(e20) {
    var t = /* @__PURE__ */ __name(() => super.createIndex, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName }));
  }
  async listIndexes(e20 = {}) {
    var t = /* @__PURE__ */ __name(() => super.listIndexes, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName }));
  }
  async getIndex(e20) {
    var t = /* @__PURE__ */ __name(() => super.getIndex, "t"), r = this;
    return t().call(r, r.vectorBucketName, e20);
  }
  async deleteIndex(e20) {
    var t = /* @__PURE__ */ __name(() => super.deleteIndex, "t"), r = this;
    return t().call(r, r.vectorBucketName, e20);
  }
  index(e20) {
    return new kf(this.url, this.headers, this.vectorBucketName, e20, this.fetch);
  }
};
var kf = class extends bf {
  static {
    __name(this, "kf");
  }
  constructor(e20, t, r, s, n) {
    super(e20, t, n), this.vectorBucketName = r, this.indexName = s;
  }
  async putVectors(e20) {
    var t = /* @__PURE__ */ __name(() => super.putVectors, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName, indexName: r.indexName }));
  }
  async getVectors(e20) {
    var t = /* @__PURE__ */ __name(() => super.getVectors, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName, indexName: r.indexName }));
  }
  async listVectors(e20 = {}) {
    var t = /* @__PURE__ */ __name(() => super.listVectors, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName, indexName: r.indexName }));
  }
  async queryVectors(e20) {
    var t = /* @__PURE__ */ __name(() => super.queryVectors, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName, indexName: r.indexName }));
  }
  async deleteVectors(e20) {
    var t = /* @__PURE__ */ __name(() => super.deleteVectors, "t"), r = this;
    return t().call(r, C(C({}, e20), {}, { vectorBucketName: r.vectorBucketName, indexName: r.indexName }));
  }
};
var ra = class extends wf {
  static {
    __name(this, "ra");
  }
  constructor(e20, t = {}, r, s) {
    super(e20, t, r, s);
  }
  from(e20) {
    return new gf(this.url, this.headers, e20, this.fetch);
  }
  get vectors() {
    return new Sf(this.url + "/vector", { headers: this.headers, fetch: this.fetch });
  }
  get analytics() {
    return new vf(this.url + "/iceberg", this.headers, this.fetch);
  }
};
var as = "2.105.1";
var vt = 30 * 1e3;
var os = 3;
var cs = os * vt;
var sa = "http://localhost:9999";
var na = "supabase.auth.token";
var ia = { "X-Client-Info": `gotrue-js/${as}` };
var Er = "X-Supabase-Api-Version";
var hn = { "2024-01-01": { timestamp: Date.parse("2024-01-01T00:00:00.0Z"), name: "2024-01-01" } };
var aa = /^([a-z0-9_-]{4})*($|[a-z0-9_-]{3}$|[a-z0-9_-]{2}$)$/i;
var oa = 600 * 1e3;
var He = class extends Error {
  static {
    __name(this, "He");
  }
  constructor(t, r, s) {
    super(t), this.__isAuthError = true, this.name = "AuthError", this.status = r, this.code = s;
  }
  toJSON() {
    return { name: this.name, message: this.message, status: this.status, code: this.code };
  }
};
function x(e20) {
  return typeof e20 == "object" && e20 !== null && "__isAuthError" in e20;
}
__name(x, "x");
var ls = class extends He {
  static {
    __name(this, "ls");
  }
  constructor(t, r, s) {
    super(t, r, s), this.name = "AuthApiError", this.status = r, this.code = s;
  }
};
function ca(e20) {
  return x(e20) && e20.name === "AuthApiError";
}
__name(ca, "ca");
var X = class extends He {
  static {
    __name(this, "X");
  }
  constructor(t, r) {
    super(t), this.name = "AuthUnknownError", this.originalError = r;
  }
};
var me = class extends He {
  static {
    __name(this, "me");
  }
  constructor(t, r, s, n) {
    super(t, s, n), this.name = r, this.status = s;
  }
};
var F = class extends me {
  static {
    __name(this, "F");
  }
  constructor() {
    super("Auth session missing!", "AuthSessionMissingError", 400, void 0);
  }
};
function Ar(e20) {
  return x(e20) && e20.name === "AuthSessionMissingError";
}
__name(Ar, "Ar");
var De = class extends me {
  static {
    __name(this, "De");
  }
  constructor() {
    super("Auth session or user missing", "AuthInvalidTokenResponseError", 500, void 0);
  }
};
var _t = class extends me {
  static {
    __name(this, "_t");
  }
  constructor(t) {
    super(t, "AuthInvalidCredentialsError", 400, void 0);
  }
};
var bt = class extends me {
  static {
    __name(this, "bt");
  }
  constructor(t, r = null) {
    super(t, "AuthImplicitGrantRedirectError", 500, void 0), this.details = null, this.details = r;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
  }
};
function la(e20) {
  return x(e20) && e20.name === "AuthImplicitGrantRedirectError";
}
__name(la, "la");
var kr = class extends me {
  static {
    __name(this, "kr");
  }
  constructor(t, r = null) {
    super(t, "AuthPKCEGrantCodeExchangeError", 500, void 0), this.details = null, this.details = r;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { details: this.details });
  }
};
var us = class extends me {
  static {
    __name(this, "us");
  }
  constructor() {
    super("PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.", "AuthPKCECodeVerifierMissingError", 400, "pkce_code_verifier_not_found");
  }
};
var Xt = class extends me {
  static {
    __name(this, "Xt");
  }
  constructor(t, r) {
    super(t, "AuthRetryableFetchError", r, void 0);
  }
};
function ds(e20) {
  return x(e20) && e20.name === "AuthRetryableFetchError";
}
__name(ds, "ds");
var Tr = class extends me {
  static {
    __name(this, "Tr");
  }
  constructor(t, r, s) {
    super(t, "AuthWeakPasswordError", r, "weak_password"), this.reasons = s;
  }
  toJSON() {
    return Object.assign(Object.assign({}, super.toJSON()), { reasons: this.reasons });
  }
};
var xt = class extends me {
  static {
    __name(this, "xt");
  }
  constructor(t) {
    super(t, "AuthInvalidJwtError", 400, "invalid_jwt");
  }
};
var hs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
var ua = ` 	
\r=`.split("");
var Tf = (() => {
  let e20 = new Array(128);
  for (let t = 0; t < e20.length; t += 1) e20[t] = -1;
  for (let t = 0; t < ua.length; t += 1) e20[ua[t].charCodeAt(0)] = -2;
  for (let t = 0; t < hs.length; t += 1) e20[hs[t].charCodeAt(0)] = t;
  return e20;
})();
function da(e20, t, r) {
  if (e20 !== null) for (t.queue = t.queue << 8 | e20, t.queuedBits += 8; t.queuedBits >= 6; ) {
    let s = t.queue >> t.queuedBits - 6 & 63;
    r(hs[s]), t.queuedBits -= 6;
  }
  else if (t.queuedBits > 0) for (t.queue = t.queue << 6 - t.queuedBits, t.queuedBits = 6; t.queuedBits >= 6; ) {
    let s = t.queue >> t.queuedBits - 6 & 63;
    r(hs[s]), t.queuedBits -= 6;
  }
}
__name(da, "da");
function ha(e20, t, r) {
  let s = Tf[e20];
  if (s > -1) for (t.queue = t.queue << 6 | s, t.queuedBits += 6; t.queuedBits >= 8; ) r(t.queue >> t.queuedBits - 8 & 255), t.queuedBits -= 8;
  else {
    if (s === -2) return;
    throw new Error(`Invalid Base64-URL character "${String.fromCharCode(e20)}"`);
  }
}
__name(ha, "ha");
function pn(e20) {
  let t = [], r = /* @__PURE__ */ __name((a) => {
    t.push(String.fromCodePoint(a));
  }, "r"), s = { utf8seq: 0, codepoint: 0 }, n = { queue: 0, queuedBits: 0 }, i = /* @__PURE__ */ __name((a) => {
    Cf(a, s, r);
  }, "i");
  for (let a = 0; a < e20.length; a += 1) ha(e20.charCodeAt(a), n, i);
  return t.join("");
}
__name(pn, "pn");
function Af(e20, t) {
  if (e20 <= 127) {
    t(e20);
    return;
  } else if (e20 <= 2047) {
    t(192 | e20 >> 6), t(128 | e20 & 63);
    return;
  } else if (e20 <= 65535) {
    t(224 | e20 >> 12), t(128 | e20 >> 6 & 63), t(128 | e20 & 63);
    return;
  } else if (e20 <= 1114111) {
    t(240 | e20 >> 18), t(128 | e20 >> 12 & 63), t(128 | e20 >> 6 & 63), t(128 | e20 & 63);
    return;
  }
  throw new Error(`Unrecognized Unicode codepoint: ${e20.toString(16)}`);
}
__name(Af, "Af");
function Rf(e20, t) {
  for (let r = 0; r < e20.length; r += 1) {
    let s = e20.charCodeAt(r);
    if (s > 55295 && s <= 56319) {
      let n = (s - 55296) * 1024 & 65535;
      s = (e20.charCodeAt(r + 1) - 56320 & 65535 | n) + 65536, r += 1;
    }
    Af(s, t);
  }
}
__name(Rf, "Rf");
function Cf(e20, t, r) {
  if (t.utf8seq === 0) {
    if (e20 <= 127) {
      r(e20);
      return;
    }
    for (let s = 1; s < 6; s += 1) if ((e20 >> 7 - s & 1) === 0) {
      t.utf8seq = s;
      break;
    }
    if (t.utf8seq === 2) t.codepoint = e20 & 31;
    else if (t.utf8seq === 3) t.codepoint = e20 & 15;
    else if (t.utf8seq === 4) t.codepoint = e20 & 7;
    else throw new Error("Invalid UTF-8 sequence");
    t.utf8seq -= 1;
  } else if (t.utf8seq > 0) {
    if (e20 <= 127) throw new Error("Invalid UTF-8 sequence");
    t.codepoint = t.codepoint << 6 | e20 & 63, t.utf8seq -= 1, t.utf8seq === 0 && r(t.codepoint);
  }
}
__name(Cf, "Cf");
function Ke(e20) {
  let t = [], r = { queue: 0, queuedBits: 0 }, s = /* @__PURE__ */ __name((n) => {
    t.push(n);
  }, "s");
  for (let n = 0; n < e20.length; n += 1) ha(e20.charCodeAt(n), r, s);
  return new Uint8Array(t);
}
__name(Ke, "Ke");
function pa(e20) {
  let t = [];
  return Rf(e20, (r) => t.push(r)), new Uint8Array(t);
}
__name(pa, "pa");
function $e(e20) {
  let t = [], r = { queue: 0, queuedBits: 0 }, s = /* @__PURE__ */ __name((n) => {
    t.push(n);
  }, "s");
  return e20.forEach((n) => da(n, r, s)), da(null, r, s), t.join("");
}
__name($e, "$e");
function fa(e20) {
  return Math.round(Date.now() / 1e3) + e20;
}
__name(fa, "fa");
function ma() {
  return /* @__PURE__ */ Symbol("auth-callback");
}
__name(ma, "ma");
var z = /* @__PURE__ */ __name(() => typeof window < "u" && typeof document < "u", "z");
var St = { tested: false, writable: false };
var ps = /* @__PURE__ */ __name(() => {
  if (!z()) return false;
  try {
    if (typeof globalThis.localStorage != "object") return false;
  } catch {
    return false;
  }
  if (St.tested) return St.writable;
  let e20 = `lswt-${Math.random()}${Math.random()}`;
  try {
    globalThis.localStorage.setItem(e20, e20), globalThis.localStorage.removeItem(e20), St.tested = true, St.writable = true;
  } catch {
    St.tested = true, St.writable = false;
  }
  return St.writable;
}, "ps");
function ga(e20) {
  let t = {}, r = new URL(e20);
  if (r.hash && r.hash[0] === "#") try {
    new URLSearchParams(r.hash.substring(1)).forEach((n, i) => {
      t[i] = n;
    });
  } catch {
  }
  return r.searchParams.forEach((s, n) => {
    t[n] = s;
  }), t;
}
__name(ga, "ga");
var fs = /* @__PURE__ */ __name((e20) => e20 ? (...t) => e20(...t) : (...t) => fetch(...t), "fs");
var ya = /* @__PURE__ */ __name((e20) => typeof e20 == "object" && e20 !== null && "status" in e20 && "ok" in e20 && "json" in e20 && typeof e20.json == "function", "ya");
var Et = /* @__PURE__ */ __name(async (e20, t, r) => {
  await e20.setItem(t, JSON.stringify(r));
}, "Et");
var We = /* @__PURE__ */ __name(async (e20, t) => {
  let r = await e20.getItem(t);
  if (!r) return null;
  try {
    return JSON.parse(r);
  } catch {
    return r;
  }
}, "We");
var K = /* @__PURE__ */ __name(async (e20, t) => {
  await e20.removeItem(t);
}, "K");
var Rr = class e18 {
  static {
    __name(this, "e");
  }
  constructor() {
    this.promise = new e18.promiseConstructor((t, r) => {
      this.resolve = t, this.reject = r;
    });
  }
};
Rr.promiseConstructor = Promise;
function Cr(e20) {
  let t = e20.split(".");
  if (t.length !== 3) throw new xt("Invalid JWT structure");
  for (let s = 0; s < t.length; s++) if (!aa.test(t[s])) throw new xt("JWT not in base64url format");
  return { header: JSON.parse(pn(t[0])), payload: JSON.parse(pn(t[1])), signature: Ke(t[2]), raw: { header: t[0], payload: t[1] } };
}
__name(Cr, "Cr");
async function wa(e20) {
  return await new Promise((t) => {
    setTimeout(() => t(null), e20);
  });
}
__name(wa, "wa");
function va(e20, t) {
  return new Promise((s, n) => {
    (async () => {
      for (let i = 0; i < 1 / 0; i++) try {
        let a = await e20(i);
        if (!t(i, null, a)) {
          s(a);
          return;
        }
      } catch (a) {
        if (!t(i, a)) {
          n(a);
          return;
        }
      }
    })();
  });
}
__name(va, "va");
function Of(e20) {
  return ("0" + e20.toString(16)).substr(-2);
}
__name(Of, "Of");
function If() {
  let t = new Uint32Array(56);
  if (typeof crypto > "u") {
    let r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~", s = r.length, n = "";
    for (let i = 0; i < 56; i++) n += r.charAt(Math.floor(Math.random() * s));
    return n;
  }
  return crypto.getRandomValues(t), Array.from(t, Of).join("");
}
__name(If, "If");
async function Pf(e20) {
  let r = new TextEncoder().encode(e20), s = await crypto.subtle.digest("SHA-256", r), n = new Uint8Array(s);
  return Array.from(n).map((i) => String.fromCharCode(i)).join("");
}
__name(Pf, "Pf");
async function Lf(e20) {
  if (!(typeof crypto < "u" && typeof crypto.subtle < "u" && typeof TextEncoder < "u")) return console.warn("WebCrypto API is not supported. Code challenge method will default to use plain instead of sha256."), e20;
  let r = await Pf(e20);
  return btoa(r).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(Lf, "Lf");
async function kt(e20, t, r = false) {
  let s = If(), n = s;
  r && (n += "/recovery"), await Et(e20, `${t}-code-verifier`, n);
  let i = await Lf(s);
  return [i, s === i ? "plain" : "s256"];
}
__name(kt, "kt");
var Nf = /^2[0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|1[0-9]|2[0-9]|3[0-1])$/i;
function _a(e20) {
  let t = e20.headers.get(Er);
  if (!t || !t.match(Nf)) return null;
  try {
    return /* @__PURE__ */ new Date(`${t}T00:00:00.0Z`);
  } catch {
    return null;
  }
}
__name(_a, "_a");
function ba(e20) {
  if (!e20) throw new Error("Missing exp claim");
  let t = Math.floor(Date.now() / 1e3);
  if (e20 <= t) throw new Error("JWT has expired");
}
__name(ba, "ba");
function xa(e20) {
  switch (e20) {
    case "RS256":
      return { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } };
    case "ES256":
      return { name: "ECDSA", namedCurve: "P-256", hash: { name: "SHA-256" } };
    default:
      throw new Error("Invalid alg claim");
  }
}
__name(xa, "xa");
var jf = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function Ae(e20) {
  if (!jf.test(e20)) throw new Error("@supabase/auth-js: Expected parameter to be UUID but is not");
}
__name(Ae, "Ae");
function se(e20) {
  if (!e20.passkey) throw new Error("@supabase/auth-js: the passkey API is experimental and disabled by default. Enable it by passing `auth: { experimental: { passkey: true } }` to createClient (or to the GoTrueClient constructor).");
}
__name(se, "se");
function ms() {
  let e20 = {};
  return new Proxy(e20, { get: /* @__PURE__ */ __name((t, r) => {
    if (r === "__isUserNotAvailableProxy") return true;
    if (typeof r == "symbol") {
      let s = r.toString();
      if (s === "Symbol(Symbol.toPrimitive)" || s === "Symbol(Symbol.toStringTag)" || s === "Symbol(util.inspect.custom)") return;
    }
    throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Accessing the "${r}" property of the session object is not supported. Please use getUser() instead.`);
  }, "get"), set: /* @__PURE__ */ __name((t, r) => {
    throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Setting the "${r}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
  }, "set"), deleteProperty: /* @__PURE__ */ __name((t, r) => {
    throw new Error(`@supabase/auth-js: client was created with userStorage option and there was no user stored in the user storage. Deleting the "${r}" property of the session object is not supported. Please use getUser() to fetch a user object you can manipulate.`);
  }, "deleteProperty") });
}
__name(ms, "ms");
function Sa(e20, t) {
  return new Proxy(e20, { get: /* @__PURE__ */ __name((r, s, n) => {
    if (s === "__isInsecureUserWarningProxy") return true;
    if (typeof s == "symbol") {
      let i = s.toString();
      if (i === "Symbol(Symbol.toPrimitive)" || i === "Symbol(Symbol.toStringTag)" || i === "Symbol(util.inspect.custom)" || i === "Symbol(nodejs.util.inspect.custom)") return Reflect.get(r, s, n);
    }
    return !t.value && typeof s == "string" && (console.warn("Using the user object as returned from supabase.auth.getSession() or from some supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from the storage medium (usually cookies on the server) and may not be authentic. Use supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server."), t.value = true), Reflect.get(r, s, n);
  }, "get") });
}
__name(Sa, "Sa");
function fn(e20) {
  return JSON.parse(JSON.stringify(e20));
}
__name(fn, "fn");
var Tt = /* @__PURE__ */ __name((e20) => e20.msg || e20.message || e20.error_description || e20.error || JSON.stringify(e20), "Tt");
var Uf = [502, 503, 504, 520, 521, 522, 523, 524, 530];
async function Ea(e20) {
  var t;
  if (!ya(e20)) throw new Xt(Tt(e20), 0);
  if (Uf.includes(e20.status)) throw new Xt(Tt(e20), e20.status);
  let r;
  try {
    r = await e20.json();
  } catch (i) {
    throw new X(Tt(i), i);
  }
  let s, n = _a(e20);
  if (n && n.getTime() >= hn["2024-01-01"].timestamp && typeof r == "object" && r && typeof r.code == "string" ? s = r.code : typeof r == "object" && r && typeof r.error_code == "string" && (s = r.error_code), s) {
    if (s === "weak_password") throw new Tr(Tt(r), e20.status, ((t = r.weak_password) === null || t === void 0 ? void 0 : t.reasons) || []);
    if (s === "session_not_found") throw new F();
  } else if (typeof r == "object" && r && typeof r.weak_password == "object" && r.weak_password && Array.isArray(r.weak_password.reasons) && r.weak_password.reasons.length && r.weak_password.reasons.reduce((i, a) => i && typeof a == "string", true)) throw new Tr(Tt(r), e20.status, r.weak_password.reasons);
  throw new ls(Tt(r), e20.status || 500, s);
}
__name(Ea, "Ea");
var Df = /* @__PURE__ */ __name((e20, t, r, s) => {
  let n = { method: e20, headers: t?.headers || {} };
  return e20 === "GET" ? n : (n.headers = Object.assign({ "Content-Type": "application/json;charset=UTF-8" }, t?.headers), n.body = JSON.stringify(s), Object.assign(Object.assign({}, n), r));
}, "Df");
async function T(e20, t, r, s) {
  var n;
  let i = Object.assign({}, s?.headers);
  i[Er] || (i[Er] = hn["2024-01-01"].name), s?.jwt && (i.Authorization = `Bearer ${s.jwt}`);
  let a = (n = s?.query) !== null && n !== void 0 ? n : {};
  s?.redirectTo && (a.redirect_to = s.redirectTo);
  let o = Object.keys(a).length ? "?" + new URLSearchParams(a).toString() : "", c = await $f(e20, t, r + o, { headers: i, noResolveJson: s?.noResolveJson }, {}, s?.body);
  return s?.xform ? s?.xform(c) : { data: Object.assign({}, c), error: null };
}
__name(T, "T");
async function $f(e20, t, r, s, n, i) {
  let a = Df(t, s, n, i), o;
  try {
    o = await e20(r, Object.assign({}, a));
  } catch (c) {
    throw console.error(c), new Xt(Tt(c), 0);
  }
  if (o.ok || await Ea(o), s?.noResolveJson) return o;
  try {
    return await o.json();
  } catch (c) {
    await Ea(c);
  }
}
__name($f, "$f");
function ne(e20) {
  var t;
  let r = null;
  Bf(e20) && (r = Object.assign({}, e20), e20.expires_at || (r.expires_at = fa(e20.expires_in)));
  let s = (t = e20.user) !== null && t !== void 0 ? t : e20;
  return { data: { session: r, user: s }, error: null };
}
__name(ne, "ne");
function mn(e20) {
  let t = ne(e20);
  return !t.error && e20.weak_password && typeof e20.weak_password == "object" && Array.isArray(e20.weak_password.reasons) && e20.weak_password.reasons.length && e20.weak_password.message && typeof e20.weak_password.message == "string" && e20.weak_password.reasons.reduce((r, s) => r && typeof s == "string", true) && (t.data.weak_password = e20.weak_password), t;
}
__name(mn, "mn");
function Re(e20) {
  var t;
  return { data: { user: (t = e20.user) !== null && t !== void 0 ? t : e20 }, error: null };
}
__name(Re, "Re");
function ka(e20) {
  return { data: e20, error: null };
}
__name(ka, "ka");
function Ta(e20) {
  let { action_link: t, email_otp: r, hashed_token: s, redirect_to: n, verification_type: i } = e20, a = yt(e20, ["action_link", "email_otp", "hashed_token", "redirect_to", "verification_type"]), o = { action_link: t, email_otp: r, hashed_token: s, redirect_to: n, verification_type: i }, c = Object.assign({}, a);
  return { data: { properties: o, user: c }, error: null };
}
__name(Ta, "Ta");
function gn(e20) {
  return e20;
}
__name(gn, "gn");
function Bf(e20) {
  return e20.access_token && e20.refresh_token && e20.expires_in;
}
__name(Bf, "Bf");
var gs = ["global", "local", "others"];
var At = class {
  static {
    __name(this, "At");
  }
  constructor({ url: t = "", headers: r = {}, fetch: s, experimental: n }) {
    this.url = t, this.headers = r, this.fetch = fs(s), this.experimental = n ?? {}, this.mfa = { listFactors: this._listFactors.bind(this), deleteFactor: this._deleteFactor.bind(this) }, this.oauth = { listClients: this._listOAuthClients.bind(this), createClient: this._createOAuthClient.bind(this), getClient: this._getOAuthClient.bind(this), updateClient: this._updateOAuthClient.bind(this), deleteClient: this._deleteOAuthClient.bind(this), regenerateClientSecret: this._regenerateOAuthClientSecret.bind(this) }, this.customProviders = { listProviders: this._listCustomProviders.bind(this), createProvider: this._createCustomProvider.bind(this), getProvider: this._getCustomProvider.bind(this), updateProvider: this._updateCustomProvider.bind(this), deleteProvider: this._deleteCustomProvider.bind(this) }, this.passkey = { listPasskeys: this._adminListPasskeys.bind(this), deletePasskey: this._adminDeletePasskey.bind(this) };
  }
  async signOut(t, r = gs[0]) {
    if (gs.indexOf(r) < 0) throw new Error(`@supabase/auth-js: Parameter scope must be one of ${gs.join(", ")}`);
    try {
      return await T(this.fetch, "POST", `${this.url}/logout?scope=${r}`, { headers: this.headers, jwt: t, noResolveJson: true }), { data: null, error: null };
    } catch (s) {
      if (x(s)) return { data: null, error: s };
      throw s;
    }
  }
  async inviteUserByEmail(t, r = {}) {
    try {
      return await T(this.fetch, "POST", `${this.url}/invite`, { body: { email: t, data: r.data }, headers: this.headers, redirectTo: r.redirectTo, xform: Re });
    } catch (s) {
      if (x(s)) return { data: { user: null }, error: s };
      throw s;
    }
  }
  async generateLink(t) {
    try {
      let { options: r } = t, s = yt(t, ["options"]), n = Object.assign(Object.assign({}, s), r);
      return "newEmail" in s && (n.new_email = s?.newEmail, delete n.newEmail), await T(this.fetch, "POST", `${this.url}/admin/generate_link`, { body: n, headers: this.headers, xform: Ta, redirectTo: r?.redirectTo });
    } catch (r) {
      if (x(r)) return { data: { properties: null, user: null }, error: r };
      throw r;
    }
  }
  async createUser(t) {
    try {
      return await T(this.fetch, "POST", `${this.url}/admin/users`, { body: t, headers: this.headers, xform: Re });
    } catch (r) {
      if (x(r)) return { data: { user: null }, error: r };
      throw r;
    }
  }
  async listUsers(t) {
    var r, s, n, i, a, o, c;
    try {
      let l = { nextPage: null, lastPage: 0, total: 0 }, u = await T(this.fetch, "GET", `${this.url}/admin/users`, { headers: this.headers, noResolveJson: true, query: { page: (s = (r = t?.page) === null || r === void 0 ? void 0 : r.toString()) !== null && s !== void 0 ? s : "", per_page: (i = (n = t?.perPage) === null || n === void 0 ? void 0 : n.toString()) !== null && i !== void 0 ? i : "" }, xform: gn });
      if (u.error) throw u.error;
      let d = await u.json(), f = (a = u.headers.get("x-total-count")) !== null && a !== void 0 ? a : 0, p = (c = (o = u.headers.get("link")) === null || o === void 0 ? void 0 : o.split(",")) !== null && c !== void 0 ? c : [];
      return p.length > 0 && (p.forEach((g) => {
        let y = parseInt(g.split(";")[0].split("=")[1].substring(0, 1)), E = JSON.parse(g.split(";")[1].split("=")[1]);
        l[`${E}Page`] = y;
      }), l.total = parseInt(f)), { data: Object.assign(Object.assign({}, d), l), error: null };
    } catch (l) {
      if (x(l)) return { data: { users: [] }, error: l };
      throw l;
    }
  }
  async getUserById(t) {
    Ae(t);
    try {
      return await T(this.fetch, "GET", `${this.url}/admin/users/${t}`, { headers: this.headers, xform: Re });
    } catch (r) {
      if (x(r)) return { data: { user: null }, error: r };
      throw r;
    }
  }
  async updateUserById(t, r) {
    Ae(t);
    try {
      return await T(this.fetch, "PUT", `${this.url}/admin/users/${t}`, { body: r, headers: this.headers, xform: Re });
    } catch (s) {
      if (x(s)) return { data: { user: null }, error: s };
      throw s;
    }
  }
  async deleteUser(t, r = false) {
    Ae(t);
    try {
      return await T(this.fetch, "DELETE", `${this.url}/admin/users/${t}`, { headers: this.headers, body: { should_soft_delete: r }, xform: Re });
    } catch (s) {
      if (x(s)) return { data: { user: null }, error: s };
      throw s;
    }
  }
  async _listFactors(t) {
    Ae(t.userId);
    try {
      let { data: r, error: s } = await T(this.fetch, "GET", `${this.url}/admin/users/${t.userId}/factors`, { headers: this.headers, xform: /* @__PURE__ */ __name((n) => ({ data: { factors: n }, error: null }), "xform") });
      return { data: r, error: s };
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _deleteFactor(t) {
    Ae(t.userId), Ae(t.id);
    try {
      return { data: await T(this.fetch, "DELETE", `${this.url}/admin/users/${t.userId}/factors/${t.id}`, { headers: this.headers }), error: null };
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _listOAuthClients(t) {
    var r, s, n, i, a, o, c;
    try {
      let l = { nextPage: null, lastPage: 0, total: 0 }, u = await T(this.fetch, "GET", `${this.url}/admin/oauth/clients`, { headers: this.headers, noResolveJson: true, query: { page: (s = (r = t?.page) === null || r === void 0 ? void 0 : r.toString()) !== null && s !== void 0 ? s : "", per_page: (i = (n = t?.perPage) === null || n === void 0 ? void 0 : n.toString()) !== null && i !== void 0 ? i : "" }, xform: gn });
      if (u.error) throw u.error;
      let d = await u.json(), f = (a = u.headers.get("x-total-count")) !== null && a !== void 0 ? a : 0, p = (c = (o = u.headers.get("link")) === null || o === void 0 ? void 0 : o.split(",")) !== null && c !== void 0 ? c : [];
      return p.length > 0 && (p.forEach((g) => {
        let y = parseInt(g.split(";")[0].split("=")[1].substring(0, 1)), E = JSON.parse(g.split(";")[1].split("=")[1]);
        l[`${E}Page`] = y;
      }), l.total = parseInt(f)), { data: Object.assign(Object.assign({}, d), l), error: null };
    } catch (l) {
      if (x(l)) return { data: { clients: [] }, error: l };
      throw l;
    }
  }
  async _createOAuthClient(t) {
    try {
      return await T(this.fetch, "POST", `${this.url}/admin/oauth/clients`, { body: t, headers: this.headers, xform: /* @__PURE__ */ __name((r) => ({ data: r, error: null }), "xform") });
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _getOAuthClient(t) {
    try {
      return await T(this.fetch, "GET", `${this.url}/admin/oauth/clients/${t}`, { headers: this.headers, xform: /* @__PURE__ */ __name((r) => ({ data: r, error: null }), "xform") });
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _updateOAuthClient(t, r) {
    try {
      return await T(this.fetch, "PUT", `${this.url}/admin/oauth/clients/${t}`, { body: r, headers: this.headers, xform: /* @__PURE__ */ __name((s) => ({ data: s, error: null }), "xform") });
    } catch (s) {
      if (x(s)) return { data: null, error: s };
      throw s;
    }
  }
  async _deleteOAuthClient(t) {
    try {
      return await T(this.fetch, "DELETE", `${this.url}/admin/oauth/clients/${t}`, { headers: this.headers, noResolveJson: true }), { data: null, error: null };
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _regenerateOAuthClientSecret(t) {
    try {
      return await T(this.fetch, "POST", `${this.url}/admin/oauth/clients/${t}/regenerate_secret`, { headers: this.headers, xform: /* @__PURE__ */ __name((r) => ({ data: r, error: null }), "xform") });
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _listCustomProviders(t) {
    try {
      let r = {};
      return t?.type && (r.type = t.type), await T(this.fetch, "GET", `${this.url}/admin/custom-providers`, { headers: this.headers, query: r, xform: /* @__PURE__ */ __name((s) => {
        var n;
        return { data: { providers: (n = s?.providers) !== null && n !== void 0 ? n : [] }, error: null };
      }, "xform") });
    } catch (r) {
      if (x(r)) return { data: { providers: [] }, error: r };
      throw r;
    }
  }
  async _createCustomProvider(t) {
    try {
      return await T(this.fetch, "POST", `${this.url}/admin/custom-providers`, { body: t, headers: this.headers, xform: /* @__PURE__ */ __name((r) => ({ data: r, error: null }), "xform") });
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _getCustomProvider(t) {
    try {
      return await T(this.fetch, "GET", `${this.url}/admin/custom-providers/${t}`, { headers: this.headers, xform: /* @__PURE__ */ __name((r) => ({ data: r, error: null }), "xform") });
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _updateCustomProvider(t, r) {
    try {
      return await T(this.fetch, "PUT", `${this.url}/admin/custom-providers/${t}`, { body: r, headers: this.headers, xform: /* @__PURE__ */ __name((s) => ({ data: s, error: null }), "xform") });
    } catch (s) {
      if (x(s)) return { data: null, error: s };
      throw s;
    }
  }
  async _deleteCustomProvider(t) {
    try {
      return await T(this.fetch, "DELETE", `${this.url}/admin/custom-providers/${t}`, { headers: this.headers, noResolveJson: true }), { data: null, error: null };
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _adminListPasskeys(t) {
    se(this.experimental), Ae(t.userId);
    try {
      return await T(this.fetch, "GET", `${this.url}/admin/users/${t.userId}/passkeys`, { headers: this.headers, xform: /* @__PURE__ */ __name((r) => ({ data: r, error: null }), "xform") });
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
  async _adminDeletePasskey(t) {
    se(this.experimental), Ae(t.userId), Ae(t.passkeyId);
    try {
      return await T(this.fetch, "DELETE", `${this.url}/admin/users/${t.userId}/passkeys/${t.passkeyId}`, { headers: this.headers, noResolveJson: true }), { data: null, error: null };
    } catch (r) {
      if (x(r)) return { data: null, error: r };
      throw r;
    }
  }
};
function yn(e20 = {}) {
  return { getItem: /* @__PURE__ */ __name((t) => e20[t] || null, "getItem"), setItem: /* @__PURE__ */ __name((t, r) => {
    e20[t] = r;
  }, "setItem"), removeItem: /* @__PURE__ */ __name((t) => {
    delete e20[t];
  }, "removeItem") };
}
__name(yn, "yn");
var ge = { debug: !!(globalThis && ps() && globalThis.localStorage && globalThis.localStorage.getItem("supabase.gotrue-js.locks.debug") === "true") };
var Or = class extends Error {
  static {
    __name(this, "Or");
  }
  constructor(t) {
    super(t), this.isAcquireTimeout = true;
  }
};
var Ir = class extends Or {
  static {
    __name(this, "Ir");
  }
};
async function wn(e20, t, r) {
  ge.debug && console.log("@supabase/gotrue-js: navigatorLock: acquire lock", e20, t);
  let s = new globalThis.AbortController(), n;
  t > 0 && (n = setTimeout(() => {
    s.abort(), ge.debug && console.log("@supabase/gotrue-js: navigatorLock acquire timed out", e20);
  }, t)), await Promise.resolve();
  try {
    return await globalThis.navigator.locks.request(e20, t === 0 ? { mode: "exclusive", ifAvailable: true } : { mode: "exclusive", signal: s.signal }, async (i) => {
      if (i) {
        clearTimeout(n), ge.debug && console.log("@supabase/gotrue-js: navigatorLock: acquired", e20, i.name);
        try {
          return await r();
        } finally {
          ge.debug && console.log("@supabase/gotrue-js: navigatorLock: released", e20, i.name);
        }
      } else {
        if (t === 0) throw ge.debug && console.log("@supabase/gotrue-js: navigatorLock: not immediately available", e20), new Ir(`Acquiring an exclusive Navigator LockManager lock "${e20}" immediately failed`);
        if (ge.debug) try {
          let a = await globalThis.navigator.locks.query();
          console.log("@supabase/gotrue-js: Navigator LockManager state", JSON.stringify(a, null, "  "));
        } catch (a) {
          console.warn("@supabase/gotrue-js: Error when querying Navigator LockManager state", a);
        }
        return console.warn("@supabase/gotrue-js: Navigator LockManager returned a null lock when using #request without ifAvailable set to true, it appears this browser is not following the LockManager spec https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request"), clearTimeout(n), await r();
      }
    });
  } catch (i) {
    if (t > 0 && clearTimeout(n), i?.name === "AbortError" && t > 0) {
      if (s.signal.aborted) return ge.debug && console.log("@supabase/gotrue-js: navigatorLock: acquire timeout, recovering by stealing lock", e20), console.warn(`@supabase/gotrue-js: Lock "${e20}" was not released within ${t}ms. This may indicate an orphaned lock from a component unmount (e.g., React Strict Mode). Forcefully acquiring the lock to recover.`), await Promise.resolve().then(() => globalThis.navigator.locks.request(e20, { mode: "exclusive", steal: true }, async (a) => {
        if (a) {
          ge.debug && console.log("@supabase/gotrue-js: navigatorLock: recovered (stolen)", e20, a.name);
          try {
            return await r();
          } finally {
            ge.debug && console.log("@supabase/gotrue-js: navigatorLock: released (stolen)", e20, a.name);
          }
        } else return console.warn("@supabase/gotrue-js: Navigator LockManager returned null lock even with steal: true"), await r();
      }));
      throw ge.debug && console.log("@supabase/gotrue-js: navigatorLock: lock was stolen by another request", e20), new Ir(`Lock "${e20}" was released because another request stole it`);
    }
    throw i;
  }
}
__name(wn, "wn");
function Aa() {
  if (typeof globalThis != "object") try {
    Object.defineProperty(Object.prototype, "__magic__", { get: /* @__PURE__ */ __name(function() {
      return this;
    }, "get"), configurable: true }), __magic__.globalThis = __magic__, delete Object.prototype.__magic__;
  } catch {
    typeof self < "u" && (self.globalThis = self);
  }
}
__name(Aa, "Aa");
function vn(e20) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(e20)) throw new Error(`@supabase/auth-js: Address "${e20}" is invalid.`);
  return e20.toLowerCase();
}
__name(vn, "vn");
function Ra(e20) {
  return parseInt(e20, 16);
}
__name(Ra, "Ra");
function Ca(e20) {
  let t = new TextEncoder().encode(e20);
  return "0x" + Array.from(t, (s) => s.toString(16).padStart(2, "0")).join("");
}
__name(Ca, "Ca");
function Oa(e20) {
  var t;
  let { chainId: r, domain: s, expirationTime: n, issuedAt: i = /* @__PURE__ */ new Date(), nonce: a, notBefore: o, requestId: c, resources: l, scheme: u, uri: d, version: f } = e20;
  {
    if (!Number.isInteger(r)) throw new Error(`@supabase/auth-js: Invalid SIWE message field "chainId". Chain ID must be a EIP-155 chain ID. Provided value: ${r}`);
    if (!s) throw new Error('@supabase/auth-js: Invalid SIWE message field "domain". Domain must be provided.');
    if (a && a.length < 8) throw new Error(`@supabase/auth-js: Invalid SIWE message field "nonce". Nonce must be at least 8 characters. Provided value: ${a}`);
    if (!d) throw new Error('@supabase/auth-js: Invalid SIWE message field "uri". URI must be provided.');
    if (f !== "1") throw new Error(`@supabase/auth-js: Invalid SIWE message field "version". Version must be '1'. Provided value: ${f}`);
    if (!((t = e20.statement) === null || t === void 0) && t.includes(`
`)) throw new Error(`@supabase/auth-js: Invalid SIWE message field "statement". Statement must not include '\\n'. Provided value: ${e20.statement}`);
  }
  let p = vn(e20.address), g = u ? `${u}://${s}` : s, y = e20.statement ? `${e20.statement}
` : "", E = `${g} wants you to sign in with your Ethereum account:
${p}

${y}`, v = `URI: ${d}
Version: ${f}
Chain ID: ${r}${a ? `
Nonce: ${a}` : ""}
Issued At: ${i.toISOString()}`;
  if (n && (v += `
Expiration Time: ${n.toISOString()}`), o && (v += `
Not Before: ${o.toISOString()}`), c && (v += `
Request ID: ${c}`), l) {
    let b = `
Resources:`;
    for (let _ of l) {
      if (!_ || typeof _ != "string") throw new Error(`@supabase/auth-js: Invalid SIWE message field "resources". Every resource must be a valid string. Provided value: ${_}`);
      b += `
- ${_}`;
    }
    v += b;
  }
  return `${E}
${v}`;
}
__name(Oa, "Oa");
var M = class extends Error {
  static {
    __name(this, "M");
  }
  constructor({ message: t, code: r, cause: s, name: n }) {
    var i;
    super(t, { cause: s }), this.__isWebAuthnError = true, this.name = (i = n ?? (s instanceof Error ? s.name : void 0)) !== null && i !== void 0 ? i : "Unknown Error", this.code = r;
  }
};
var Rt = class extends M {
  static {
    __name(this, "Rt");
  }
  constructor(t, r) {
    super({ code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: r, message: t }), this.name = "WebAuthnUnknownError", this.originalError = r;
  }
};
function Ia({ error: e20, options: t }) {
  var r, s, n;
  let { publicKey: i } = t;
  if (!i) throw Error("options was missing required publicKey property");
  if (e20.name === "AbortError") {
    if (t.signal instanceof AbortSignal) return new M({ message: "Registration ceremony was sent an abort signal", code: "ERROR_CEREMONY_ABORTED", cause: e20 });
  } else if (e20.name === "ConstraintError") {
    if (((r = i.authenticatorSelection) === null || r === void 0 ? void 0 : r.requireResidentKey) === true) return new M({ message: "Discoverable credentials were required but no available authenticator supported it", code: "ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT", cause: e20 });
    if (t.mediation === "conditional" && ((s = i.authenticatorSelection) === null || s === void 0 ? void 0 : s.userVerification) === "required") return new M({ message: "User verification was required during automatic registration but it could not be performed", code: "ERROR_AUTO_REGISTER_USER_VERIFICATION_FAILURE", cause: e20 });
    if (((n = i.authenticatorSelection) === null || n === void 0 ? void 0 : n.userVerification) === "required") return new M({ message: "User verification was required but no available authenticator supported it", code: "ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT", cause: e20 });
  } else {
    if (e20.name === "InvalidStateError") return new M({ message: "The authenticator was previously registered", code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", cause: e20 });
    if (e20.name === "NotAllowedError") return new M({ message: e20.message, code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: e20 });
    if (e20.name === "NotSupportedError") return i.pubKeyCredParams.filter((o) => o.type === "public-key").length === 0 ? new M({ message: 'No entry in pubKeyCredParams was of type "public-key"', code: "ERROR_MALFORMED_PUBKEYCREDPARAMS", cause: e20 }) : new M({ message: "No available authenticator supported any of the specified pubKeyCredParams algorithms", code: "ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG", cause: e20 });
    if (e20.name === "SecurityError") {
      let a = window.location.hostname;
      if (_n(a)) {
        if (i.rp.id !== a) return new M({ message: `The RP ID "${i.rp.id}" is invalid for this domain`, code: "ERROR_INVALID_RP_ID", cause: e20 });
      } else return new M({ message: `${window.location.hostname} is an invalid domain`, code: "ERROR_INVALID_DOMAIN", cause: e20 });
    } else if (e20.name === "TypeError") {
      if (i.user.id.byteLength < 1 || i.user.id.byteLength > 64) return new M({ message: "User ID was not between 1 and 64 characters", code: "ERROR_INVALID_USER_ID_LENGTH", cause: e20 });
    } else if (e20.name === "UnknownError") return new M({ message: "The authenticator was unable to process the specified options, or could not create a new credential", code: "ERROR_AUTHENTICATOR_GENERAL_ERROR", cause: e20 });
  }
  return new M({ message: "a Non-Webauthn related error has occurred", code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: e20 });
}
__name(Ia, "Ia");
function Pa({ error: e20, options: t }) {
  let { publicKey: r } = t;
  if (!r) throw Error("options was missing required publicKey property");
  if (e20.name === "AbortError") {
    if (t.signal instanceof AbortSignal) return new M({ message: "Authentication ceremony was sent an abort signal", code: "ERROR_CEREMONY_ABORTED", cause: e20 });
  } else {
    if (e20.name === "NotAllowedError") return new M({ message: e20.message, code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: e20 });
    if (e20.name === "SecurityError") {
      let s = window.location.hostname;
      if (_n(s)) {
        if (r.rpId !== s) return new M({ message: `The RP ID "${r.rpId}" is invalid for this domain`, code: "ERROR_INVALID_RP_ID", cause: e20 });
      } else return new M({ message: `${window.location.hostname} is an invalid domain`, code: "ERROR_INVALID_DOMAIN", cause: e20 });
    } else if (e20.name === "UnknownError") return new M({ message: "The authenticator was unable to process the specified options, or could not create a new assertion signature", code: "ERROR_AUTHENTICATOR_GENERAL_ERROR", cause: e20 });
  }
  return new M({ message: "a Non-Webauthn related error has occurred", code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: e20 });
}
__name(Pa, "Pa");
var bn = class {
  static {
    __name(this, "bn");
  }
  createNewAbortSignal() {
    if (this.controller) {
      let r = new Error("Cancelling existing WebAuthn API call for new one");
      r.name = "AbortError", this.controller.abort(r);
    }
    let t = new AbortController();
    return this.controller = t, t.signal;
  }
  cancelCeremony() {
    if (this.controller) {
      let t = new Error("Manually cancelling existing WebAuthn API call");
      t.name = "AbortError", this.controller.abort(t), this.controller = void 0;
    }
  }
};
var vs = new bn();
function xn(e20) {
  if (!e20) throw new Error("Credential creation options are required");
  if (typeof PublicKeyCredential < "u" && "parseCreationOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON == "function") return PublicKeyCredential.parseCreationOptionsFromJSON(e20);
  let { challenge: t, user: r, excludeCredentials: s } = e20, n = yt(e20, ["challenge", "user", "excludeCredentials"]), i = Ke(t).buffer, a = Object.assign(Object.assign({}, r), { id: Ke(r.id).buffer }), o = Object.assign(Object.assign({}, n), { challenge: i, user: a });
  if (s && s.length > 0) {
    o.excludeCredentials = new Array(s.length);
    for (let c = 0; c < s.length; c++) {
      let l = s[c];
      o.excludeCredentials[c] = Object.assign(Object.assign({}, l), { id: Ke(l.id).buffer, type: l.type || "public-key", transports: l.transports });
    }
  }
  return o;
}
__name(xn, "xn");
function Sn(e20) {
  if (!e20) throw new Error("Credential request options are required");
  if (typeof PublicKeyCredential < "u" && "parseRequestOptionsFromJSON" in PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON == "function") return PublicKeyCredential.parseRequestOptionsFromJSON(e20);
  let { challenge: t, allowCredentials: r } = e20, s = yt(e20, ["challenge", "allowCredentials"]), n = Ke(t).buffer, i = Object.assign(Object.assign({}, s), { challenge: n });
  if (r && r.length > 0) {
    i.allowCredentials = new Array(r.length);
    for (let a = 0; a < r.length; a++) {
      let o = r[a];
      i.allowCredentials[a] = Object.assign(Object.assign({}, o), { id: Ke(o.id).buffer, type: o.type || "public-key", transports: o.transports });
    }
  }
  return i;
}
__name(Sn, "Sn");
function En(e20) {
  var t;
  if ("toJSON" in e20 && typeof e20.toJSON == "function") return e20.toJSON();
  let r = e20;
  return { id: e20.id, rawId: e20.id, response: { attestationObject: $e(new Uint8Array(e20.response.attestationObject)), clientDataJSON: $e(new Uint8Array(e20.response.clientDataJSON)) }, type: "public-key", clientExtensionResults: e20.getClientExtensionResults(), authenticatorAttachment: (t = r.authenticatorAttachment) !== null && t !== void 0 ? t : void 0 };
}
__name(En, "En");
function kn(e20) {
  var t;
  if ("toJSON" in e20 && typeof e20.toJSON == "function") return e20.toJSON();
  let r = e20, s = e20.getClientExtensionResults(), n = e20.response;
  return { id: e20.id, rawId: e20.id, response: { authenticatorData: $e(new Uint8Array(n.authenticatorData)), clientDataJSON: $e(new Uint8Array(n.clientDataJSON)), signature: $e(new Uint8Array(n.signature)), userHandle: n.userHandle ? $e(new Uint8Array(n.userHandle)) : void 0 }, type: "public-key", clientExtensionResults: s, authenticatorAttachment: (t = r.authenticatorAttachment) !== null && t !== void 0 ? t : void 0 };
}
__name(kn, "kn");
function _n(e20) {
  return e20 === "localhost" || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(e20);
}
__name(_n, "_n");
function Pr() {
  var e20, t;
  return !!(z() && "PublicKeyCredential" in window && window.PublicKeyCredential && "credentials" in navigator && typeof ((e20 = navigator?.credentials) === null || e20 === void 0 ? void 0 : e20.create) == "function" && typeof ((t = navigator?.credentials) === null || t === void 0 ? void 0 : t.get) == "function");
}
__name(Pr, "Pr");
async function Tn(e20) {
  try {
    let t = await navigator.credentials.create(e20);
    return t ? t instanceof PublicKeyCredential ? { data: t, error: null } : { data: null, error: new Rt("Browser returned unexpected credential type", t) } : { data: null, error: new Rt("Empty credential response", t) };
  } catch (t) {
    return { data: null, error: Ia({ error: t, options: e20 }) };
  }
}
__name(Tn, "Tn");
async function An(e20) {
  try {
    let t = await navigator.credentials.get(e20);
    return t ? t instanceof PublicKeyCredential ? { data: t, error: null } : { data: null, error: new Rt("Browser returned unexpected credential type", t) } : { data: null, error: new Rt("Empty credential response", t) };
  } catch (t) {
    return { data: null, error: Pa({ error: t, options: e20 }) };
  }
}
__name(An, "An");
var Mf = { hints: ["security-key"], authenticatorSelection: { authenticatorAttachment: "cross-platform", requireResidentKey: false, userVerification: "preferred", residentKey: "discouraged" }, attestation: "direct" };
var Ff = { userVerification: "preferred", hints: ["security-key"], attestation: "direct" };
function ys(...e20) {
  let t = /* @__PURE__ */ __name((n) => n !== null && typeof n == "object" && !Array.isArray(n), "t"), r = /* @__PURE__ */ __name((n) => n instanceof ArrayBuffer || ArrayBuffer.isView(n), "r"), s = {};
  for (let n of e20) if (n) for (let i in n) {
    let a = n[i];
    if (a !== void 0) if (Array.isArray(a)) s[i] = a;
    else if (r(a)) s[i] = a;
    else if (t(a)) {
      let o = s[i];
      t(o) ? s[i] = ys(o, a) : s[i] = ys(a);
    } else s[i] = a;
  }
  return s;
}
__name(ys, "ys");
function qf(e20, t) {
  return ys(Mf, e20, t || {});
}
__name(qf, "qf");
function zf(e20, t) {
  return ys(Ff, e20, t || {});
}
__name(zf, "zf");
var ws = class {
  static {
    __name(this, "ws");
  }
  constructor(t) {
    this.client = t, this.enroll = this._enroll.bind(this), this.challenge = this._challenge.bind(this), this.verify = this._verify.bind(this), this.authenticate = this._authenticate.bind(this), this.register = this._register.bind(this);
  }
  async _enroll(t) {
    return this.client.mfa.enroll(Object.assign(Object.assign({}, t), { factorType: "webauthn" }));
  }
  async _challenge({ factorId: t, webauthn: r, friendlyName: s, signal: n }, i) {
    var a;
    try {
      let { data: o, error: c } = await this.client.mfa.challenge({ factorId: t, webauthn: r });
      if (!o) return { data: null, error: c };
      let l = n ?? vs.createNewAbortSignal();
      if (o.webauthn.type === "create") {
        let { user: u } = o.webauthn.credential_options.publicKey;
        if (!u.name) {
          let d = s;
          if (d) u.name = `${u.id}:${d}`;
          else {
            let p = (await this.client.getUser()).data.user, g = ((a = p?.user_metadata) === null || a === void 0 ? void 0 : a.name) || p?.email || p?.id || "User";
            u.name = `${u.id}:${g}`;
          }
        }
        u.displayName || (u.displayName = u.name);
      }
      switch (o.webauthn.type) {
        case "create": {
          let u = qf(o.webauthn.credential_options.publicKey, i?.create), { data: d, error: f } = await Tn({ publicKey: u, signal: l });
          return d ? { data: { factorId: t, challengeId: o.id, webauthn: { type: o.webauthn.type, credential_response: d } }, error: null } : { data: null, error: f };
        }
        case "request": {
          let u = zf(o.webauthn.credential_options.publicKey, i?.request), { data: d, error: f } = await An(Object.assign(Object.assign({}, o.webauthn.credential_options), { publicKey: u, signal: l }));
          return d ? { data: { factorId: t, challengeId: o.id, webauthn: { type: o.webauthn.type, credential_response: d } }, error: null } : { data: null, error: f };
        }
      }
    } catch (o) {
      return x(o) ? { data: null, error: o } : { data: null, error: new X("Unexpected error in challenge", o) };
    }
  }
  async _verify({ challengeId: t, factorId: r, webauthn: s }) {
    return this.client.mfa.verify({ factorId: r, challengeId: t, webauthn: s });
  }
  async _authenticate({ factorId: t, webauthn: { rpId: r = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: s = typeof window < "u" ? [window.location.origin] : void 0, signal: n } = {} }, i) {
    if (!r) return { data: null, error: new He("rpId is required for WebAuthn authentication") };
    try {
      if (!Pr()) return { data: null, error: new X("Browser does not support WebAuthn", null) };
      let { data: a, error: o } = await this.challenge({ factorId: t, webauthn: { rpId: r, rpOrigins: s }, signal: n }, { request: i });
      if (!a) return { data: null, error: o };
      let { webauthn: c } = a;
      return this._verify({ factorId: t, challengeId: a.challengeId, webauthn: { type: c.type, rpId: r, rpOrigins: s, credential_response: c.credential_response } });
    } catch (a) {
      return x(a) ? { data: null, error: a } : { data: null, error: new X("Unexpected error in authenticate", a) };
    }
  }
  async _register({ friendlyName: t, webauthn: { rpId: r = typeof window < "u" ? window.location.hostname : void 0, rpOrigins: s = typeof window < "u" ? [window.location.origin] : void 0, signal: n } = {} }, i) {
    if (!r) return { data: null, error: new He("rpId is required for WebAuthn registration") };
    try {
      if (!Pr()) return { data: null, error: new X("Browser does not support WebAuthn", null) };
      let { data: a, error: o } = await this._enroll({ friendlyName: t });
      if (!a) return await this.client.mfa.listFactors().then((u) => {
        var d;
        return (d = u.data) === null || d === void 0 ? void 0 : d.all.find((f) => f.factor_type === "webauthn" && f.friendly_name === t && f.status !== "unverified");
      }).then((u) => u ? this.client.mfa.unenroll({ factorId: u?.id }) : void 0), { data: null, error: o };
      let { data: c, error: l } = await this._challenge({ factorId: a.id, friendlyName: a.friendly_name, webauthn: { rpId: r, rpOrigins: s }, signal: n }, { create: i });
      return c ? this._verify({ factorId: a.id, challengeId: c.challengeId, webauthn: { rpId: r, rpOrigins: s, type: c.webauthn.type, credential_response: c.webauthn.credential_response } }) : { data: null, error: l };
    } catch (a) {
      return x(a) ? { data: null, error: a } : { data: null, error: new X("Unexpected error in register", a) };
    }
  }
};
Aa();
var Vf = { url: sa, storageKey: na, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, headers: ia, flowType: "implicit", debug: false, hasCustomAuthorizationHeader: false, throwOnError: false, lockAcquireTimeout: 5e3, skipAutoInitialize: false, experimental: {} };
async function La(e20, t, r) {
  return await r();
}
__name(La, "La");
var Yt = {};
var _s = class e19 {
  static {
    __name(this, "e");
  }
  get jwks() {
    var t, r;
    return (r = (t = Yt[this.storageKey]) === null || t === void 0 ? void 0 : t.jwks) !== null && r !== void 0 ? r : { keys: [] };
  }
  set jwks(t) {
    Yt[this.storageKey] = Object.assign(Object.assign({}, Yt[this.storageKey]), { jwks: t });
  }
  get jwks_cached_at() {
    var t, r;
    return (r = (t = Yt[this.storageKey]) === null || t === void 0 ? void 0 : t.cachedAt) !== null && r !== void 0 ? r : Number.MIN_SAFE_INTEGER;
  }
  set jwks_cached_at(t) {
    Yt[this.storageKey] = Object.assign(Object.assign({}, Yt[this.storageKey]), { cachedAt: t });
  }
  constructor(t) {
    var r, s, n, i;
    this.userStorage = null, this.memoryStorage = null, this.stateChangeEmitters = /* @__PURE__ */ new Map(), this.autoRefreshTicker = null, this.autoRefreshTickTimeout = null, this.visibilityChangedCallback = null, this.refreshingDeferred = null, this.initializePromise = null, this.detectSessionInUrl = true, this.hasCustomAuthorizationHeader = false, this.suppressGetSessionWarning = false, this.lockAcquired = false, this.pendingInLock = [], this.broadcastChannel = null, this.logger = console.log;
    let a = Object.assign(Object.assign({}, Vf), t);
    if (this.storageKey = a.storageKey, this.instanceID = (r = e19.nextInstanceID[this.storageKey]) !== null && r !== void 0 ? r : 0, e19.nextInstanceID[this.storageKey] = this.instanceID + 1, this.logDebugMessages = !!a.debug, typeof a.debug == "function" && (this.logger = a.debug), this.instanceID > 0 && z()) {
      let o = `${this._logPrefix()} Multiple GoTrueClient instances detected in the same browser context. It is not an error, but this should be avoided as it may produce undefined behavior when used concurrently under the same storage key.`;
      console.warn(o), this.logDebugMessages && console.trace(o);
    }
    if (this.persistSession = a.persistSession, this.autoRefreshToken = a.autoRefreshToken, this.experimental = (s = a.experimental) !== null && s !== void 0 ? s : {}, this.admin = new At({ url: a.url, headers: a.headers, fetch: a.fetch, experimental: this.experimental }), this.url = a.url, this.headers = a.headers, this.fetch = fs(a.fetch), this.lock = a.lock || La, this.detectSessionInUrl = a.detectSessionInUrl, this.flowType = a.flowType, this.hasCustomAuthorizationHeader = a.hasCustomAuthorizationHeader, this.throwOnError = a.throwOnError, this.lockAcquireTimeout = a.lockAcquireTimeout, a.lock ? this.lock = a.lock : this.persistSession && z() && (!((n = globalThis?.navigator) === null || n === void 0) && n.locks) ? this.lock = wn : this.lock = La, this.jwks || (this.jwks = { keys: [] }, this.jwks_cached_at = Number.MIN_SAFE_INTEGER), this.mfa = { verify: this._verify.bind(this), enroll: this._enroll.bind(this), unenroll: this._unenroll.bind(this), challenge: this._challenge.bind(this), listFactors: this._listFactors.bind(this), challengeAndVerify: this._challengeAndVerify.bind(this), getAuthenticatorAssuranceLevel: this._getAuthenticatorAssuranceLevel.bind(this), webauthn: new ws(this) }, this.oauth = { getAuthorizationDetails: this._getAuthorizationDetails.bind(this), approveAuthorization: this._approveAuthorization.bind(this), denyAuthorization: this._denyAuthorization.bind(this), listGrants: this._listOAuthGrants.bind(this), revokeGrant: this._revokeOAuthGrant.bind(this) }, this.passkey = { startRegistration: this._startPasskeyRegistration.bind(this), verifyRegistration: this._verifyPasskeyRegistration.bind(this), startAuthentication: this._startPasskeyAuthentication.bind(this), verifyAuthentication: this._verifyPasskeyAuthentication.bind(this), list: this._listPasskeys.bind(this), update: this._updatePasskey.bind(this), delete: this._deletePasskey.bind(this) }, this.persistSession ? (a.storage ? this.storage = a.storage : ps() ? this.storage = globalThis.localStorage : (this.memoryStorage = {}, this.storage = yn(this.memoryStorage)), a.userStorage && (this.userStorage = a.userStorage)) : (this.memoryStorage = {}, this.storage = yn(this.memoryStorage)), z() && globalThis.BroadcastChannel && this.persistSession && this.storageKey) {
      try {
        this.broadcastChannel = new globalThis.BroadcastChannel(this.storageKey);
      } catch (o) {
        console.error("Failed to create a new BroadcastChannel, multi-tab state changes will not be available", o);
      }
      (i = this.broadcastChannel) === null || i === void 0 || i.addEventListener("message", async (o) => {
        this._debug("received broadcast notification from other tab or client", o);
        try {
          await this._notifyAllSubscribers(o.data.event, o.data.session, false);
        } catch (c) {
          this._debug("#broadcastChannel", "error", c);
        }
      });
    }
    a.skipAutoInitialize || this.initialize().catch((o) => {
      this._debug("#initialize()", "error", o);
    });
  }
  isThrowOnErrorEnabled() {
    return this.throwOnError;
  }
  _returnResult(t) {
    if (this.throwOnError && t && t.error) throw t.error;
    return t;
  }
  _logPrefix() {
    return `GoTrueClient@${this.storageKey}:${this.instanceID} (${as}) ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  _debug(...t) {
    return this.logDebugMessages && this.logger(this._logPrefix(), ...t), this;
  }
  async initialize() {
    return this.initializePromise ? await this.initializePromise : (this.initializePromise = (async () => await this._acquireLock(this.lockAcquireTimeout, async () => await this._initialize()))(), await this.initializePromise);
  }
  async _initialize() {
    var t;
    try {
      let r = {}, s = "none";
      if (z() && (r = ga(window.location.href), this._isImplicitGrantCallback(r) ? s = "implicit" : await this._isPKCECallback(r) && (s = "pkce")), z() && this.detectSessionInUrl && s !== "none") {
        let { data: n, error: i } = await this._getSessionFromURL(r, s);
        if (i) {
          if (this._debug("#_initialize()", "error detecting session from URL", i), la(i)) {
            let c = (t = i.details) === null || t === void 0 ? void 0 : t.code;
            if (c === "identity_already_exists" || c === "identity_not_found" || c === "single_identity_not_deletable") return { error: i };
          }
          return { error: i };
        }
        let { session: a, redirectType: o } = n;
        return this._debug("#_initialize()", "detected session in URL", a, "redirect type", o), await this._saveSession(a), setTimeout(async () => {
          o === "recovery" ? await this._notifyAllSubscribers("PASSWORD_RECOVERY", a) : await this._notifyAllSubscribers("SIGNED_IN", a);
        }, 0), { error: null };
      }
      return await this._recoverAndRefresh(), { error: null };
    } catch (r) {
      return x(r) ? this._returnResult({ error: r }) : this._returnResult({ error: new X("Unexpected error during initialization", r) });
    } finally {
      await this._handleVisibilityChange(), this._debug("#_initialize()", "end");
    }
  }
  async signInAnonymously(t) {
    var r, s, n;
    try {
      let i = await T(this.fetch, "POST", `${this.url}/signup`, { headers: this.headers, body: { data: (s = (r = t?.options) === null || r === void 0 ? void 0 : r.data) !== null && s !== void 0 ? s : {}, gotrue_meta_security: { captcha_token: (n = t?.options) === null || n === void 0 ? void 0 : n.captchaToken } }, xform: ne }), { data: a, error: o } = i;
      if (o || !a) return this._returnResult({ data: { user: null, session: null }, error: o });
      let c = a.session, l = a.user;
      return a.session && (await this._saveSession(a.session), await this._notifyAllSubscribers("SIGNED_IN", c)), this._returnResult({ data: { user: l, session: c }, error: null });
    } catch (i) {
      if (x(i)) return this._returnResult({ data: { user: null, session: null }, error: i });
      throw i;
    }
  }
  async signUp(t) {
    var r, s, n;
    try {
      let i;
      if ("email" in t) {
        let { email: u, password: d, options: f } = t, p = null, g = null;
        this.flowType === "pkce" && ([p, g] = await kt(this.storage, this.storageKey)), i = await T(this.fetch, "POST", `${this.url}/signup`, { headers: this.headers, redirectTo: f?.emailRedirectTo, body: { email: u, password: d, data: (r = f?.data) !== null && r !== void 0 ? r : {}, gotrue_meta_security: { captcha_token: f?.captchaToken }, code_challenge: p, code_challenge_method: g }, xform: ne });
      } else if ("phone" in t) {
        let { phone: u, password: d, options: f } = t;
        i = await T(this.fetch, "POST", `${this.url}/signup`, { headers: this.headers, body: { phone: u, password: d, data: (s = f?.data) !== null && s !== void 0 ? s : {}, channel: (n = f?.channel) !== null && n !== void 0 ? n : "sms", gotrue_meta_security: { captcha_token: f?.captchaToken } }, xform: ne });
      } else throw new _t("You must provide either an email or phone number and a password");
      let { data: a, error: o } = i;
      if (o || !a) return await K(this.storage, `${this.storageKey}-code-verifier`), this._returnResult({ data: { user: null, session: null }, error: o });
      let c = a.session, l = a.user;
      return a.session && (await this._saveSession(a.session), await this._notifyAllSubscribers("SIGNED_IN", c)), this._returnResult({ data: { user: l, session: c }, error: null });
    } catch (i) {
      if (await K(this.storage, `${this.storageKey}-code-verifier`), x(i)) return this._returnResult({ data: { user: null, session: null }, error: i });
      throw i;
    }
  }
  async signInWithPassword(t) {
    try {
      let r;
      if ("email" in t) {
        let { email: i, password: a, options: o } = t;
        r = await T(this.fetch, "POST", `${this.url}/token?grant_type=password`, { headers: this.headers, body: { email: i, password: a, gotrue_meta_security: { captcha_token: o?.captchaToken } }, xform: mn });
      } else if ("phone" in t) {
        let { phone: i, password: a, options: o } = t;
        r = await T(this.fetch, "POST", `${this.url}/token?grant_type=password`, { headers: this.headers, body: { phone: i, password: a, gotrue_meta_security: { captcha_token: o?.captchaToken } }, xform: mn });
      } else throw new _t("You must provide either an email or phone number and a password");
      let { data: s, error: n } = r;
      if (n) return this._returnResult({ data: { user: null, session: null }, error: n });
      if (!s || !s.session || !s.user) {
        let i = new De();
        return this._returnResult({ data: { user: null, session: null }, error: i });
      }
      return s.session && (await this._saveSession(s.session), await this._notifyAllSubscribers("SIGNED_IN", s.session)), this._returnResult({ data: Object.assign({ user: s.user, session: s.session }, s.weak_password ? { weakPassword: s.weak_password } : null), error: n });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  async signInWithOAuth(t) {
    var r, s, n, i;
    return await this._handleProviderSignIn(t.provider, { redirectTo: (r = t.options) === null || r === void 0 ? void 0 : r.redirectTo, scopes: (s = t.options) === null || s === void 0 ? void 0 : s.scopes, queryParams: (n = t.options) === null || n === void 0 ? void 0 : n.queryParams, skipBrowserRedirect: (i = t.options) === null || i === void 0 ? void 0 : i.skipBrowserRedirect });
  }
  async exchangeCodeForSession(t) {
    return await this.initializePromise, this._acquireLock(this.lockAcquireTimeout, async () => this._exchangeCodeForSession(t));
  }
  async signInWithWeb3(t) {
    let { chain: r } = t;
    switch (r) {
      case "ethereum":
        return await this.signInWithEthereum(t);
      case "solana":
        return await this.signInWithSolana(t);
      default:
        throw new Error(`@supabase/auth-js: Unsupported chain "${r}"`);
    }
  }
  async signInWithEthereum(t) {
    var r, s, n, i, a, o, c, l, u, d, f;
    let p, g;
    if ("message" in t) p = t.message, g = t.signature;
    else {
      let { chain: y, wallet: E, statement: v, options: b } = t, _;
      if (z()) if (typeof E == "object") _ = E;
      else {
        let B = window;
        if ("ethereum" in B && typeof B.ethereum == "object" && "request" in B.ethereum && typeof B.ethereum.request == "function") _ = B.ethereum;
        else throw new Error("@supabase/auth-js: No compatible Ethereum wallet interface on the window object (window.ethereum) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'ethereum', wallet: resolvedUserWallet }) instead.");
      }
      else {
        if (typeof E != "object" || !b?.url) throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        _ = E;
      }
      let O = new URL((r = b?.url) !== null && r !== void 0 ? r : window.location.href), U = await _.request({ method: "eth_requestAccounts" }).then((B) => B).catch(() => {
        throw new Error("@supabase/auth-js: Wallet method eth_requestAccounts is missing or invalid");
      });
      if (!U || U.length === 0) throw new Error("@supabase/auth-js: No accounts available. Please ensure the wallet is connected.");
      let N = vn(U[0]), $ = (s = b?.signInWithEthereum) === null || s === void 0 ? void 0 : s.chainId;
      if (!$) {
        let B = await _.request({ method: "eth_chainId" });
        $ = Ra(B);
      }
      let Be = { domain: O.host, address: N, statement: v, uri: O.href, version: "1", chainId: $, nonce: (n = b?.signInWithEthereum) === null || n === void 0 ? void 0 : n.nonce, issuedAt: (a = (i = b?.signInWithEthereum) === null || i === void 0 ? void 0 : i.issuedAt) !== null && a !== void 0 ? a : /* @__PURE__ */ new Date(), expirationTime: (o = b?.signInWithEthereum) === null || o === void 0 ? void 0 : o.expirationTime, notBefore: (c = b?.signInWithEthereum) === null || c === void 0 ? void 0 : c.notBefore, requestId: (l = b?.signInWithEthereum) === null || l === void 0 ? void 0 : l.requestId, resources: (u = b?.signInWithEthereum) === null || u === void 0 ? void 0 : u.resources };
      p = Oa(Be), g = await _.request({ method: "personal_sign", params: [Ca(p), N] });
    }
    try {
      let { data: y, error: E } = await T(this.fetch, "POST", `${this.url}/token?grant_type=web3`, { headers: this.headers, body: Object.assign({ chain: "ethereum", message: p, signature: g }, !((d = t.options) === null || d === void 0) && d.captchaToken ? { gotrue_meta_security: { captcha_token: (f = t.options) === null || f === void 0 ? void 0 : f.captchaToken } } : null), xform: ne });
      if (E) throw E;
      if (!y || !y.session || !y.user) {
        let v = new De();
        return this._returnResult({ data: { user: null, session: null }, error: v });
      }
      return y.session && (await this._saveSession(y.session), await this._notifyAllSubscribers("SIGNED_IN", y.session)), this._returnResult({ data: Object.assign({}, y), error: E });
    } catch (y) {
      if (x(y)) return this._returnResult({ data: { user: null, session: null }, error: y });
      throw y;
    }
  }
  async signInWithSolana(t) {
    var r, s, n, i, a, o, c, l, u, d, f, p;
    let g, y;
    if ("message" in t) g = t.message, y = t.signature;
    else {
      let { chain: E, wallet: v, statement: b, options: _ } = t, O;
      if (z()) if (typeof v == "object") O = v;
      else {
        let N = window;
        if ("solana" in N && typeof N.solana == "object" && ("signIn" in N.solana && typeof N.solana.signIn == "function" || "signMessage" in N.solana && typeof N.solana.signMessage == "function")) O = N.solana;
        else throw new Error("@supabase/auth-js: No compatible Solana wallet interface on the window object (window.solana) detected. Make sure the user already has a wallet installed and connected for this app. Prefer passing the wallet interface object directly to signInWithWeb3({ chain: 'solana', wallet: resolvedUserWallet }) instead.");
      }
      else {
        if (typeof v != "object" || !_?.url) throw new Error("@supabase/auth-js: Both wallet and url must be specified in non-browser environments.");
        O = v;
      }
      let U = new URL((r = _?.url) !== null && r !== void 0 ? r : window.location.href);
      if ("signIn" in O && O.signIn) {
        let N = await O.signIn(Object.assign(Object.assign(Object.assign({ issuedAt: (/* @__PURE__ */ new Date()).toISOString() }, _?.signInWithSolana), { version: "1", domain: U.host, uri: U.href }), b ? { statement: b } : null)), $;
        if (Array.isArray(N) && N[0] && typeof N[0] == "object") $ = N[0];
        else if (N && typeof N == "object" && "signedMessage" in N && "signature" in N) $ = N;
        else throw new Error("@supabase/auth-js: Wallet method signIn() returned unrecognized value");
        if ("signedMessage" in $ && "signature" in $ && (typeof $.signedMessage == "string" || $.signedMessage instanceof Uint8Array) && $.signature instanceof Uint8Array) g = typeof $.signedMessage == "string" ? $.signedMessage : new TextDecoder().decode($.signedMessage), y = $.signature;
        else throw new Error("@supabase/auth-js: Wallet method signIn() API returned object without signedMessage and signature fields");
      } else {
        if (!("signMessage" in O) || typeof O.signMessage != "function" || !("publicKey" in O) || typeof O != "object" || !O.publicKey || !("toBase58" in O.publicKey) || typeof O.publicKey.toBase58 != "function") throw new Error("@supabase/auth-js: Wallet does not have a compatible signMessage() and publicKey.toBase58() API");
        g = [`${U.host} wants you to sign in with your Solana account:`, O.publicKey.toBase58(), ...b ? ["", b, ""] : [""], "Version: 1", `URI: ${U.href}`, `Issued At: ${(n = (s = _?.signInWithSolana) === null || s === void 0 ? void 0 : s.issuedAt) !== null && n !== void 0 ? n : (/* @__PURE__ */ new Date()).toISOString()}`, ...!((i = _?.signInWithSolana) === null || i === void 0) && i.notBefore ? [`Not Before: ${_.signInWithSolana.notBefore}`] : [], ...!((a = _?.signInWithSolana) === null || a === void 0) && a.expirationTime ? [`Expiration Time: ${_.signInWithSolana.expirationTime}`] : [], ...!((o = _?.signInWithSolana) === null || o === void 0) && o.chainId ? [`Chain ID: ${_.signInWithSolana.chainId}`] : [], ...!((c = _?.signInWithSolana) === null || c === void 0) && c.nonce ? [`Nonce: ${_.signInWithSolana.nonce}`] : [], ...!((l = _?.signInWithSolana) === null || l === void 0) && l.requestId ? [`Request ID: ${_.signInWithSolana.requestId}`] : [], ...!((d = (u = _?.signInWithSolana) === null || u === void 0 ? void 0 : u.resources) === null || d === void 0) && d.length ? ["Resources", ..._.signInWithSolana.resources.map(($) => `- ${$}`)] : []].join(`
`);
        let N = await O.signMessage(new TextEncoder().encode(g), "utf8");
        if (!N || !(N instanceof Uint8Array)) throw new Error("@supabase/auth-js: Wallet signMessage() API returned an recognized value");
        y = N;
      }
    }
    try {
      let { data: E, error: v } = await T(this.fetch, "POST", `${this.url}/token?grant_type=web3`, { headers: this.headers, body: Object.assign({ chain: "solana", message: g, signature: $e(y) }, !((f = t.options) === null || f === void 0) && f.captchaToken ? { gotrue_meta_security: { captcha_token: (p = t.options) === null || p === void 0 ? void 0 : p.captchaToken } } : null), xform: ne });
      if (v) throw v;
      if (!E || !E.session || !E.user) {
        let b = new De();
        return this._returnResult({ data: { user: null, session: null }, error: b });
      }
      return E.session && (await this._saveSession(E.session), await this._notifyAllSubscribers("SIGNED_IN", E.session)), this._returnResult({ data: Object.assign({}, E), error: v });
    } catch (E) {
      if (x(E)) return this._returnResult({ data: { user: null, session: null }, error: E });
      throw E;
    }
  }
  async _exchangeCodeForSession(t) {
    let r = await We(this.storage, `${this.storageKey}-code-verifier`), [s, n] = (r ?? "").split("/");
    try {
      if (!s && this.flowType === "pkce") throw new us();
      let { data: i, error: a } = await T(this.fetch, "POST", `${this.url}/token?grant_type=pkce`, { headers: this.headers, body: { auth_code: t, code_verifier: s }, xform: ne });
      if (await K(this.storage, `${this.storageKey}-code-verifier`), a) throw a;
      if (!i || !i.session || !i.user) {
        let o = new De();
        return this._returnResult({ data: { user: null, session: null, redirectType: null }, error: o });
      }
      return i.session && (await this._saveSession(i.session), await this._notifyAllSubscribers(n === "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", i.session)), this._returnResult({ data: Object.assign(Object.assign({}, i), { redirectType: n ?? null }), error: a });
    } catch (i) {
      if (await K(this.storage, `${this.storageKey}-code-verifier`), x(i)) return this._returnResult({ data: { user: null, session: null, redirectType: null }, error: i });
      throw i;
    }
  }
  async signInWithIdToken(t) {
    try {
      let { options: r, provider: s, token: n, access_token: i, nonce: a } = t, o = await T(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, { headers: this.headers, body: { provider: s, id_token: n, access_token: i, nonce: a, gotrue_meta_security: { captcha_token: r?.captchaToken } }, xform: ne }), { data: c, error: l } = o;
      if (l) return this._returnResult({ data: { user: null, session: null }, error: l });
      if (!c || !c.session || !c.user) {
        let u = new De();
        return this._returnResult({ data: { user: null, session: null }, error: u });
      }
      return c.session && (await this._saveSession(c.session), await this._notifyAllSubscribers("SIGNED_IN", c.session)), this._returnResult({ data: c, error: l });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  async signInWithOtp(t) {
    var r, s, n, i, a;
    try {
      if ("email" in t) {
        let { email: o, options: c } = t, l = null, u = null;
        this.flowType === "pkce" && ([l, u] = await kt(this.storage, this.storageKey));
        let { error: d } = await T(this.fetch, "POST", `${this.url}/otp`, { headers: this.headers, body: { email: o, data: (r = c?.data) !== null && r !== void 0 ? r : {}, create_user: (s = c?.shouldCreateUser) !== null && s !== void 0 ? s : true, gotrue_meta_security: { captcha_token: c?.captchaToken }, code_challenge: l, code_challenge_method: u }, redirectTo: c?.emailRedirectTo });
        return this._returnResult({ data: { user: null, session: null }, error: d });
      }
      if ("phone" in t) {
        let { phone: o, options: c } = t, { data: l, error: u } = await T(this.fetch, "POST", `${this.url}/otp`, { headers: this.headers, body: { phone: o, data: (n = c?.data) !== null && n !== void 0 ? n : {}, create_user: (i = c?.shouldCreateUser) !== null && i !== void 0 ? i : true, gotrue_meta_security: { captcha_token: c?.captchaToken }, channel: (a = c?.channel) !== null && a !== void 0 ? a : "sms" } });
        return this._returnResult({ data: { user: null, session: null, messageId: l?.message_id }, error: u });
      }
      throw new _t("You must provide either an email or phone number.");
    } catch (o) {
      if (await K(this.storage, `${this.storageKey}-code-verifier`), x(o)) return this._returnResult({ data: { user: null, session: null }, error: o });
      throw o;
    }
  }
  async verifyOtp(t) {
    var r, s;
    try {
      let n, i;
      "options" in t && (n = (r = t.options) === null || r === void 0 ? void 0 : r.redirectTo, i = (s = t.options) === null || s === void 0 ? void 0 : s.captchaToken);
      let { data: a, error: o } = await T(this.fetch, "POST", `${this.url}/verify`, { headers: this.headers, body: Object.assign(Object.assign({}, t), { gotrue_meta_security: { captcha_token: i } }), redirectTo: n, xform: ne });
      if (o) throw o;
      if (!a) throw new Error("An error occurred on token verification.");
      let c = a.session, l = a.user;
      return c?.access_token && (await this._saveSession(c), await this._notifyAllSubscribers(t.type == "recovery" ? "PASSWORD_RECOVERY" : "SIGNED_IN", c)), this._returnResult({ data: { user: l, session: c }, error: null });
    } catch (n) {
      if (x(n)) return this._returnResult({ data: { user: null, session: null }, error: n });
      throw n;
    }
  }
  async signInWithSSO(t) {
    var r, s, n, i, a;
    try {
      let o = null, c = null;
      this.flowType === "pkce" && ([o, c] = await kt(this.storage, this.storageKey));
      let l = await T(this.fetch, "POST", `${this.url}/sso`, { body: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, "providerId" in t ? { provider_id: t.providerId } : null), "domain" in t ? { domain: t.domain } : null), { redirect_to: (s = (r = t.options) === null || r === void 0 ? void 0 : r.redirectTo) !== null && s !== void 0 ? s : void 0 }), !((n = t?.options) === null || n === void 0) && n.captchaToken ? { gotrue_meta_security: { captcha_token: t.options.captchaToken } } : null), { skip_http_redirect: true, code_challenge: o, code_challenge_method: c }), headers: this.headers, xform: ka });
      return !((i = l.data) === null || i === void 0) && i.url && z() && !(!((a = t.options) === null || a === void 0) && a.skipBrowserRedirect) && window.location.assign(l.data.url), this._returnResult(l);
    } catch (o) {
      if (await K(this.storage, `${this.storageKey}-code-verifier`), x(o)) return this._returnResult({ data: null, error: o });
      throw o;
    }
  }
  async reauthenticate() {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._reauthenticate());
  }
  async _reauthenticate() {
    try {
      return await this._useSession(async (t) => {
        let { data: { session: r }, error: s } = t;
        if (s) throw s;
        if (!r) throw new F();
        let { error: n } = await T(this.fetch, "GET", `${this.url}/reauthenticate`, { headers: this.headers, jwt: r.access_token });
        return this._returnResult({ data: { user: null, session: null }, error: n });
      });
    } catch (t) {
      if (x(t)) return this._returnResult({ data: { user: null, session: null }, error: t });
      throw t;
    }
  }
  async resend(t) {
    try {
      let r = `${this.url}/resend`;
      if ("email" in t) {
        let { email: s, type: n, options: i } = t, { error: a } = await T(this.fetch, "POST", r, { headers: this.headers, body: { email: s, type: n, gotrue_meta_security: { captcha_token: i?.captchaToken } }, redirectTo: i?.emailRedirectTo });
        return this._returnResult({ data: { user: null, session: null }, error: a });
      } else if ("phone" in t) {
        let { phone: s, type: n, options: i } = t, { data: a, error: o } = await T(this.fetch, "POST", r, { headers: this.headers, body: { phone: s, type: n, gotrue_meta_security: { captcha_token: i?.captchaToken } } });
        return this._returnResult({ data: { user: null, session: null, messageId: a?.message_id }, error: o });
      }
      throw new _t("You must provide either an email or phone number and a type");
    } catch (r) {
      if (x(r)) return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  async getSession() {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => this._useSession(async (r) => r));
  }
  async _acquireLock(t, r) {
    this._debug("#_acquireLock", "begin", t);
    try {
      if (this.lockAcquired) {
        let s = this.pendingInLock.length ? this.pendingInLock[this.pendingInLock.length - 1] : Promise.resolve(), n = (async () => (await s, await r()))();
        return this.pendingInLock.push((async () => {
          try {
            await n;
          } catch {
          }
        })()), n;
      }
      return await this.lock(`lock:${this.storageKey}`, t, async () => {
        this._debug("#_acquireLock", "lock acquired for storage key", this.storageKey);
        try {
          this.lockAcquired = true;
          let s = r();
          for (this.pendingInLock.push((async () => {
            try {
              await s;
            } catch {
            }
          })()), await s; this.pendingInLock.length; ) {
            let n = [...this.pendingInLock];
            await Promise.all(n), this.pendingInLock.splice(0, n.length);
          }
          return await s;
        } finally {
          this._debug("#_acquireLock", "lock released for storage key", this.storageKey), this.lockAcquired = false;
        }
      });
    } finally {
      this._debug("#_acquireLock", "end");
    }
  }
  async _useSession(t) {
    this._debug("#_useSession", "begin");
    try {
      let r = await this.__loadSession();
      return await t(r);
    } finally {
      this._debug("#_useSession", "end");
    }
  }
  async __loadSession() {
    this._debug("#__loadSession()", "begin"), this.lockAcquired || this._debug("#__loadSession()", "used outside of an acquired lock!", new Error().stack);
    try {
      let t = null, r = await We(this.storage, this.storageKey);
      if (this._debug("#getSession()", "session from storage", r), r !== null && (this._isValidSession(r) ? t = r : (this._debug("#getSession()", "session from storage is not valid"), await this._removeSession())), !t) return { data: { session: null }, error: null };
      let s = t.expires_at ? t.expires_at * 1e3 - Date.now() < cs : false;
      if (this._debug("#__loadSession()", `session has${s ? "" : " not"} expired`, "expires_at", t.expires_at), !s) {
        if (this.userStorage) {
          let a = await We(this.userStorage, this.storageKey + "-user");
          a?.user ? t.user = a.user : t.user = ms();
        }
        if (this.storage.isServer && t.user && !t.user.__isUserNotAvailableProxy) {
          let a = { value: this.suppressGetSessionWarning };
          t.user = Sa(t.user, a), a.value && (this.suppressGetSessionWarning = true);
        }
        return { data: { session: t }, error: null };
      }
      let { data: n, error: i } = await this._callRefreshToken(t.refresh_token);
      return i ? this._returnResult({ data: { session: null }, error: i }) : this._returnResult({ data: { session: n }, error: null });
    } finally {
      this._debug("#__loadSession()", "end");
    }
  }
  async getUser(t) {
    if (t) return await this._getUser(t);
    await this.initializePromise;
    let r = await this._acquireLock(this.lockAcquireTimeout, async () => await this._getUser());
    return r.data.user && (this.suppressGetSessionWarning = true), r;
  }
  async _getUser(t) {
    try {
      return t ? await T(this.fetch, "GET", `${this.url}/user`, { headers: this.headers, jwt: t, xform: Re }) : await this._useSession(async (r) => {
        var s, n, i;
        let { data: a, error: o } = r;
        if (o) throw o;
        return !(!((s = a.session) === null || s === void 0) && s.access_token) && !this.hasCustomAuthorizationHeader ? { data: { user: null }, error: new F() } : await T(this.fetch, "GET", `${this.url}/user`, { headers: this.headers, jwt: (i = (n = a.session) === null || n === void 0 ? void 0 : n.access_token) !== null && i !== void 0 ? i : void 0, xform: Re });
      });
    } catch (r) {
      if (x(r)) return Ar(r) && (await this._removeSession(), await K(this.storage, `${this.storageKey}-code-verifier`)), this._returnResult({ data: { user: null }, error: r });
      throw r;
    }
  }
  async updateUser(t, r = {}) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._updateUser(t, r));
  }
  async _updateUser(t, r = {}) {
    try {
      return await this._useSession(async (s) => {
        let { data: n, error: i } = s;
        if (i) throw i;
        if (!n.session) throw new F();
        let a = n.session, o = null, c = null;
        this.flowType === "pkce" && t.email != null && ([o, c] = await kt(this.storage, this.storageKey));
        let { data: l, error: u } = await T(this.fetch, "PUT", `${this.url}/user`, { headers: this.headers, redirectTo: r?.emailRedirectTo, body: Object.assign(Object.assign({}, t), { code_challenge: o, code_challenge_method: c }), jwt: a.access_token, xform: Re });
        if (u) throw u;
        return a.user = l.user, await this._saveSession(a), await this._notifyAllSubscribers("USER_UPDATED", a), this._returnResult({ data: { user: a.user }, error: null });
      });
    } catch (s) {
      if (await K(this.storage, `${this.storageKey}-code-verifier`), x(s)) return this._returnResult({ data: { user: null }, error: s });
      throw s;
    }
  }
  async setSession(t) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._setSession(t));
  }
  async _setSession(t) {
    try {
      if (!t.access_token || !t.refresh_token) throw new F();
      let r = Date.now() / 1e3, s = r, n = true, i = null, { payload: a } = Cr(t.access_token);
      if (a.exp && (s = a.exp, n = s <= r), n) {
        let { data: o, error: c } = await this._callRefreshToken(t.refresh_token);
        if (c) return this._returnResult({ data: { user: null, session: null }, error: c });
        if (!o) return { data: { user: null, session: null }, error: null };
        i = o;
      } else {
        let { data: o, error: c } = await this._getUser(t.access_token);
        if (c) return this._returnResult({ data: { user: null, session: null }, error: c });
        i = { access_token: t.access_token, refresh_token: t.refresh_token, user: o.user, token_type: "bearer", expires_in: s - r, expires_at: s }, await this._saveSession(i), await this._notifyAllSubscribers("SIGNED_IN", i);
      }
      return this._returnResult({ data: { user: i.user, session: i }, error: null });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: { session: null, user: null }, error: r });
      throw r;
    }
  }
  async refreshSession(t) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._refreshSession(t));
  }
  async _refreshSession(t) {
    try {
      return await this._useSession(async (r) => {
        var s;
        if (!t) {
          let { data: a, error: o } = r;
          if (o) throw o;
          t = (s = a.session) !== null && s !== void 0 ? s : void 0;
        }
        if (!t?.refresh_token) throw new F();
        let { data: n, error: i } = await this._callRefreshToken(t.refresh_token);
        return i ? this._returnResult({ data: { user: null, session: null }, error: i }) : n ? this._returnResult({ data: { user: n.user, session: n }, error: null }) : this._returnResult({ data: { user: null, session: null }, error: null });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: { user: null, session: null }, error: r });
      throw r;
    }
  }
  async _getSessionFromURL(t, r) {
    var s;
    try {
      if (!z()) throw new bt("No browser detected.");
      if (t.error || t.error_description || t.error_code) throw new bt(t.error_description || "Error in URL with unspecified error_description", { error: t.error || "unspecified_error", code: t.error_code || "unspecified_code" });
      switch (r) {
        case "implicit":
          if (this.flowType === "pkce") throw new kr("Not a valid PKCE flow url.");
          break;
        case "pkce":
          if (this.flowType === "implicit") throw new bt("Not a valid implicit grant flow url.");
          break;
        default:
      }
      if (r === "pkce") {
        if (this._debug("#_initialize()", "begin", "is PKCE flow", true), !t.code) throw new kr("No code detected.");
        let { data: _, error: O } = await this._exchangeCodeForSession(t.code);
        if (O) throw O;
        let U = new URL(window.location.href);
        return U.searchParams.delete("code"), window.history.replaceState(window.history.state, "", U.toString()), { data: { session: _.session, redirectType: (s = _.redirectType) !== null && s !== void 0 ? s : null }, error: null };
      }
      let { provider_token: n, provider_refresh_token: i, access_token: a, refresh_token: o, expires_in: c, expires_at: l, token_type: u } = t;
      if (!a || !c || !o || !u) throw new bt("No session defined in URL");
      let d = Math.round(Date.now() / 1e3), f = parseInt(c), p = d + f;
      l && (p = parseInt(l));
      let g = p - d;
      g * 1e3 <= vt && console.warn(`@supabase/gotrue-js: Session as retrieved from URL expires in ${g}s, should have been closer to ${f}s`);
      let y = p - f;
      d - y >= 120 ? console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued over 120s ago, URL could be stale", y, p, d) : d - y < 0 && console.warn("@supabase/gotrue-js: Session as retrieved from URL was issued in the future? Check the device clock for skew", y, p, d);
      let { data: E, error: v } = await this._getUser(a);
      if (v) throw v;
      let b = { provider_token: n, provider_refresh_token: i, access_token: a, expires_in: f, expires_at: p, refresh_token: o, token_type: u, user: E.user };
      return window.location.hash = "", this._debug("#_getSessionFromURL()", "clearing window.location.hash"), this._returnResult({ data: { session: b, redirectType: t.type }, error: null });
    } catch (n) {
      if (x(n)) return this._returnResult({ data: { session: null, redirectType: null }, error: n });
      throw n;
    }
  }
  _isImplicitGrantCallback(t) {
    return typeof this.detectSessionInUrl == "function" ? this.detectSessionInUrl(new URL(window.location.href), t) : !!(t.access_token || t.error_description);
  }
  async _isPKCECallback(t) {
    let r = await We(this.storage, `${this.storageKey}-code-verifier`);
    return !!(t.code && r);
  }
  async signOut(t = { scope: "global" }) {
    return await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => await this._signOut(t));
  }
  async _signOut({ scope: t } = { scope: "global" }) {
    return await this._useSession(async (r) => {
      var s;
      let { data: n, error: i } = r;
      if (i && !Ar(i)) return this._returnResult({ error: i });
      let a = (s = n.session) === null || s === void 0 ? void 0 : s.access_token;
      if (a) {
        let { error: o } = await this.admin.signOut(a, t);
        if (o && !(ca(o) && (o.status === 404 || o.status === 401 || o.status === 403) || Ar(o))) return this._returnResult({ error: o });
      }
      return t !== "others" && (await this._removeSession(), await K(this.storage, `${this.storageKey}-code-verifier`)), this._returnResult({ error: null });
    });
  }
  onAuthStateChange(t) {
    let r = ma(), s = { id: r, callback: t, unsubscribe: /* @__PURE__ */ __name(() => {
      this._debug("#unsubscribe()", "state change callback with id removed", r), this.stateChangeEmitters.delete(r);
    }, "unsubscribe") };
    return this._debug("#onAuthStateChange()", "registered callback with id", r), this.stateChangeEmitters.set(r, s), (async () => (await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => {
      this._emitInitialSession(r);
    })))(), { data: { subscription: s } };
  }
  async _emitInitialSession(t) {
    return await this._useSession(async (r) => {
      var s, n;
      try {
        let { data: { session: i }, error: a } = r;
        if (a) throw a;
        await ((s = this.stateChangeEmitters.get(t)) === null || s === void 0 ? void 0 : s.callback("INITIAL_SESSION", i)), this._debug("INITIAL_SESSION", "callback id", t, "session", i);
      } catch (i) {
        await ((n = this.stateChangeEmitters.get(t)) === null || n === void 0 ? void 0 : n.callback("INITIAL_SESSION", null)), this._debug("INITIAL_SESSION", "callback id", t, "error", i), Ar(i) ? console.warn(i) : console.error(i);
      }
    });
  }
  async resetPasswordForEmail(t, r = {}) {
    let s = null, n = null;
    this.flowType === "pkce" && ([s, n] = await kt(this.storage, this.storageKey, true));
    try {
      return await T(this.fetch, "POST", `${this.url}/recover`, { body: { email: t, code_challenge: s, code_challenge_method: n, gotrue_meta_security: { captcha_token: r.captchaToken } }, headers: this.headers, redirectTo: r.redirectTo });
    } catch (i) {
      if (await K(this.storage, `${this.storageKey}-code-verifier`), x(i)) return this._returnResult({ data: null, error: i });
      throw i;
    }
  }
  async getUserIdentities() {
    var t;
    try {
      let { data: r, error: s } = await this.getUser();
      if (s) throw s;
      return this._returnResult({ data: { identities: (t = r.user.identities) !== null && t !== void 0 ? t : [] }, error: null });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async linkIdentity(t) {
    return "token" in t ? this.linkIdentityIdToken(t) : this.linkIdentityOAuth(t);
  }
  async linkIdentityOAuth(t) {
    var r;
    try {
      let { data: s, error: n } = await this._useSession(async (i) => {
        var a, o, c, l, u;
        let { data: d, error: f } = i;
        if (f) throw f;
        let p = await this._getUrlForProvider(`${this.url}/user/identities/authorize`, t.provider, { redirectTo: (a = t.options) === null || a === void 0 ? void 0 : a.redirectTo, scopes: (o = t.options) === null || o === void 0 ? void 0 : o.scopes, queryParams: (c = t.options) === null || c === void 0 ? void 0 : c.queryParams, skipBrowserRedirect: true });
        return await T(this.fetch, "GET", p, { headers: this.headers, jwt: (u = (l = d.session) === null || l === void 0 ? void 0 : l.access_token) !== null && u !== void 0 ? u : void 0 });
      });
      if (n) throw n;
      return z() && !(!((r = t.options) === null || r === void 0) && r.skipBrowserRedirect) && window.location.assign(s?.url), this._returnResult({ data: { provider: t.provider, url: s?.url }, error: null });
    } catch (s) {
      if (x(s)) return this._returnResult({ data: { provider: t.provider, url: null }, error: s });
      throw s;
    }
  }
  async linkIdentityIdToken(t) {
    return await this._useSession(async (r) => {
      var s;
      try {
        let { error: n, data: { session: i } } = r;
        if (n) throw n;
        let { options: a, provider: o, token: c, access_token: l, nonce: u } = t, d = await T(this.fetch, "POST", `${this.url}/token?grant_type=id_token`, { headers: this.headers, jwt: (s = i?.access_token) !== null && s !== void 0 ? s : void 0, body: { provider: o, id_token: c, access_token: l, nonce: u, link_identity: true, gotrue_meta_security: { captcha_token: a?.captchaToken } }, xform: ne }), { data: f, error: p } = d;
        return p ? this._returnResult({ data: { user: null, session: null }, error: p }) : !f || !f.session || !f.user ? this._returnResult({ data: { user: null, session: null }, error: new De() }) : (f.session && (await this._saveSession(f.session), await this._notifyAllSubscribers("USER_UPDATED", f.session)), this._returnResult({ data: f, error: p }));
      } catch (n) {
        if (await K(this.storage, `${this.storageKey}-code-verifier`), x(n)) return this._returnResult({ data: { user: null, session: null }, error: n });
        throw n;
      }
    });
  }
  async unlinkIdentity(t) {
    try {
      return await this._useSession(async (r) => {
        var s, n;
        let { data: i, error: a } = r;
        if (a) throw a;
        return await T(this.fetch, "DELETE", `${this.url}/user/identities/${t.identity_id}`, { headers: this.headers, jwt: (n = (s = i.session) === null || s === void 0 ? void 0 : s.access_token) !== null && n !== void 0 ? n : void 0 });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _refreshAccessToken(t) {
    let r = `#_refreshAccessToken(${t.substring(0, 5)}...)`;
    this._debug(r, "begin");
    try {
      let s = Date.now();
      return await va(async (n) => (n > 0 && await wa(200 * Math.pow(2, n - 1)), this._debug(r, "refreshing attempt", n), await T(this.fetch, "POST", `${this.url}/token?grant_type=refresh_token`, { body: { refresh_token: t }, headers: this.headers, xform: ne })), (n, i) => {
        let a = 200 * Math.pow(2, n);
        return i && ds(i) && Date.now() + a - s < vt;
      });
    } catch (s) {
      if (this._debug(r, "error", s), x(s)) return this._returnResult({ data: { session: null, user: null }, error: s });
      throw s;
    } finally {
      this._debug(r, "end");
    }
  }
  _isValidSession(t) {
    return typeof t == "object" && t !== null && "access_token" in t && "refresh_token" in t && "expires_at" in t;
  }
  async _handleProviderSignIn(t, r) {
    let s = await this._getUrlForProvider(`${this.url}/authorize`, t, { redirectTo: r.redirectTo, scopes: r.scopes, queryParams: r.queryParams });
    return this._debug("#_handleProviderSignIn()", "provider", t, "options", r, "url", s), z() && !r.skipBrowserRedirect && window.location.assign(s), { data: { provider: t, url: s }, error: null };
  }
  async _recoverAndRefresh() {
    var t, r;
    let s = "#_recoverAndRefresh()";
    this._debug(s, "begin");
    try {
      let n = await We(this.storage, this.storageKey);
      if (n && this.userStorage) {
        let a = await We(this.userStorage, this.storageKey + "-user");
        !this.storage.isServer && Object.is(this.storage, this.userStorage) && !a && (a = { user: n.user }, await Et(this.userStorage, this.storageKey + "-user", a)), n.user = (t = a?.user) !== null && t !== void 0 ? t : ms();
      } else if (n && !n.user && !n.user) {
        let a = await We(this.storage, this.storageKey + "-user");
        a && a?.user ? (n.user = a.user, await K(this.storage, this.storageKey + "-user"), await Et(this.storage, this.storageKey, n)) : n.user = ms();
      }
      if (this._debug(s, "session from storage", n), !this._isValidSession(n)) {
        this._debug(s, "session is not valid"), n !== null && await this._removeSession();
        return;
      }
      let i = ((r = n.expires_at) !== null && r !== void 0 ? r : 1 / 0) * 1e3 - Date.now() < cs;
      if (this._debug(s, `session has${i ? "" : " not"} expired with margin of ${cs}s`), i) {
        if (this.autoRefreshToken && n.refresh_token) {
          let { error: a } = await this._callRefreshToken(n.refresh_token);
          a && (console.error(a), ds(a) || (this._debug(s, "refresh failed with a non-retryable error, removing the session", a), await this._removeSession()));
        }
      } else if (n.user && n.user.__isUserNotAvailableProxy === true) try {
        let { data: a, error: o } = await this._getUser(n.access_token);
        !o && a?.user ? (n.user = a.user, await this._saveSession(n), await this._notifyAllSubscribers("SIGNED_IN", n)) : this._debug(s, "could not get user data, skipping SIGNED_IN notification");
      } catch (a) {
        console.error("Error getting user data:", a), this._debug(s, "error getting user data, skipping SIGNED_IN notification", a);
      }
      else await this._notifyAllSubscribers("SIGNED_IN", n);
    } catch (n) {
      this._debug(s, "error", n), console.error(n);
      return;
    } finally {
      this._debug(s, "end");
    }
  }
  async _callRefreshToken(t) {
    var r, s;
    if (!t) throw new F();
    if (this.refreshingDeferred) return this.refreshingDeferred.promise;
    let n = `#_callRefreshToken(${t.substring(0, 5)}...)`;
    this._debug(n, "begin");
    try {
      this.refreshingDeferred = new Rr();
      let { data: i, error: a } = await this._refreshAccessToken(t);
      if (a) throw a;
      if (!i.session) throw new F();
      await this._saveSession(i.session), await this._notifyAllSubscribers("TOKEN_REFRESHED", i.session);
      let o = { data: i.session, error: null };
      return this.refreshingDeferred.resolve(o), o;
    } catch (i) {
      if (this._debug(n, "error", i), x(i)) {
        let a = { data: null, error: i };
        return ds(i) || await this._removeSession(), (r = this.refreshingDeferred) === null || r === void 0 || r.resolve(a), a;
      }
      throw (s = this.refreshingDeferred) === null || s === void 0 || s.reject(i), i;
    } finally {
      this.refreshingDeferred = null, this._debug(n, "end");
    }
  }
  async _notifyAllSubscribers(t, r, s = true) {
    let n = `#_notifyAllSubscribers(${t})`;
    this._debug(n, "begin", r, `broadcast = ${s}`);
    try {
      this.broadcastChannel && s && this.broadcastChannel.postMessage({ event: t, session: r });
      let i = [], a = Array.from(this.stateChangeEmitters.values()).map(async (o) => {
        try {
          await o.callback(t, r);
        } catch (c) {
          i.push(c);
        }
      });
      if (await Promise.all(a), i.length > 0) {
        for (let o = 0; o < i.length; o += 1) console.error(i[o]);
        throw i[0];
      }
    } finally {
      this._debug(n, "end");
    }
  }
  async _saveSession(t) {
    this._debug("#_saveSession()", t), this.suppressGetSessionWarning = true, await K(this.storage, `${this.storageKey}-code-verifier`);
    let r = Object.assign({}, t), s = r.user && r.user.__isUserNotAvailableProxy === true;
    if (this.userStorage) {
      !s && r.user && await Et(this.userStorage, this.storageKey + "-user", { user: r.user });
      let n = Object.assign({}, r);
      delete n.user;
      let i = fn(n);
      await Et(this.storage, this.storageKey, i);
    } else {
      let n = fn(r);
      await Et(this.storage, this.storageKey, n);
    }
  }
  async _removeSession() {
    this._debug("#_removeSession()"), this.suppressGetSessionWarning = false, await K(this.storage, this.storageKey), await K(this.storage, this.storageKey + "-code-verifier"), await K(this.storage, this.storageKey + "-user"), this.userStorage && await K(this.userStorage, this.storageKey + "-user"), await this._notifyAllSubscribers("SIGNED_OUT", null);
  }
  _removeVisibilityChangedCallback() {
    this._debug("#_removeVisibilityChangedCallback()");
    let t = this.visibilityChangedCallback;
    this.visibilityChangedCallback = null;
    try {
      t && z() && window?.removeEventListener && window.removeEventListener("visibilitychange", t);
    } catch (r) {
      console.error("removing visibilitychange callback failed", r);
    }
  }
  async _startAutoRefresh() {
    await this._stopAutoRefresh(), this._debug("#_startAutoRefresh()");
    let t = setInterval(() => this._autoRefreshTokenTick(), vt);
    this.autoRefreshTicker = t, t && typeof t == "object" && typeof t.unref == "function" ? t.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(t);
    let r = setTimeout(async () => {
      await this.initializePromise, await this._autoRefreshTokenTick();
    }, 0);
    this.autoRefreshTickTimeout = r, r && typeof r == "object" && typeof r.unref == "function" ? r.unref() : typeof Deno < "u" && typeof Deno.unrefTimer == "function" && Deno.unrefTimer(r);
  }
  async _stopAutoRefresh() {
    this._debug("#_stopAutoRefresh()");
    let t = this.autoRefreshTicker;
    this.autoRefreshTicker = null, t && clearInterval(t);
    let r = this.autoRefreshTickTimeout;
    this.autoRefreshTickTimeout = null, r && clearTimeout(r);
  }
  async startAutoRefresh() {
    this._removeVisibilityChangedCallback(), await this._startAutoRefresh();
  }
  async stopAutoRefresh() {
    this._removeVisibilityChangedCallback(), await this._stopAutoRefresh();
  }
  async _autoRefreshTokenTick() {
    this._debug("#_autoRefreshTokenTick()", "begin");
    try {
      await this._acquireLock(0, async () => {
        try {
          let t = Date.now();
          try {
            return await this._useSession(async (r) => {
              let { data: { session: s } } = r;
              if (!s || !s.refresh_token || !s.expires_at) {
                this._debug("#_autoRefreshTokenTick()", "no session");
                return;
              }
              let n = Math.floor((s.expires_at * 1e3 - t) / vt);
              this._debug("#_autoRefreshTokenTick()", `access token expires in ${n} ticks, a tick lasts ${vt}ms, refresh threshold is ${os} ticks`), n <= os && await this._callRefreshToken(s.refresh_token);
            });
          } catch (r) {
            console.error("Auto refresh tick failed with error. This is likely a transient error.", r);
          }
        } finally {
          this._debug("#_autoRefreshTokenTick()", "end");
        }
      });
    } catch (t) {
      if (t.isAcquireTimeout || t instanceof Or) this._debug("auto refresh token tick lock not available");
      else throw t;
    }
  }
  async _handleVisibilityChange() {
    if (this._debug("#_handleVisibilityChange()"), !z() || !window?.addEventListener) return this.autoRefreshToken && this.startAutoRefresh(), false;
    try {
      this.visibilityChangedCallback = async () => {
        try {
          await this._onVisibilityChanged(false);
        } catch (t) {
          this._debug("#visibilityChangedCallback", "error", t);
        }
      }, window?.addEventListener("visibilitychange", this.visibilityChangedCallback), await this._onVisibilityChanged(true);
    } catch (t) {
      console.error("_handleVisibilityChange", t);
    }
  }
  async _onVisibilityChanged(t) {
    let r = `#_onVisibilityChanged(${t})`;
    this._debug(r, "visibilityState", document.visibilityState), document.visibilityState === "visible" ? (this.autoRefreshToken && this._startAutoRefresh(), t || (await this.initializePromise, await this._acquireLock(this.lockAcquireTimeout, async () => {
      if (document.visibilityState !== "visible") {
        this._debug(r, "acquired the lock to recover the session, but the browser visibilityState is no longer visible, aborting");
        return;
      }
      await this._recoverAndRefresh();
    }))) : document.visibilityState === "hidden" && this.autoRefreshToken && this._stopAutoRefresh();
  }
  async _getUrlForProvider(t, r, s) {
    let n = [`provider=${encodeURIComponent(r)}`];
    if (s?.redirectTo && n.push(`redirect_to=${encodeURIComponent(s.redirectTo)}`), s?.scopes && n.push(`scopes=${encodeURIComponent(s.scopes)}`), this.flowType === "pkce") {
      let [i, a] = await kt(this.storage, this.storageKey), o = new URLSearchParams({ code_challenge: `${encodeURIComponent(i)}`, code_challenge_method: `${encodeURIComponent(a)}` });
      n.push(o.toString());
    }
    if (s?.queryParams) {
      let i = new URLSearchParams(s.queryParams);
      n.push(i.toString());
    }
    return s?.skipBrowserRedirect && n.push(`skip_http_redirect=${s.skipBrowserRedirect}`), `${t}?${n.join("&")}`;
  }
  async _unenroll(t) {
    try {
      return await this._useSession(async (r) => {
        var s;
        let { data: n, error: i } = r;
        return i ? this._returnResult({ data: null, error: i }) : await T(this.fetch, "DELETE", `${this.url}/factors/${t.factorId}`, { headers: this.headers, jwt: (s = n?.session) === null || s === void 0 ? void 0 : s.access_token });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _enroll(t) {
    try {
      return await this._useSession(async (r) => {
        var s, n;
        let { data: i, error: a } = r;
        if (a) return this._returnResult({ data: null, error: a });
        let o = Object.assign({ friendly_name: t.friendlyName, factor_type: t.factorType }, t.factorType === "phone" ? { phone: t.phone } : t.factorType === "totp" ? { issuer: t.issuer } : {}), { data: c, error: l } = await T(this.fetch, "POST", `${this.url}/factors`, { body: o, headers: this.headers, jwt: (s = i?.session) === null || s === void 0 ? void 0 : s.access_token });
        return l ? this._returnResult({ data: null, error: l }) : (t.factorType === "totp" && c.type === "totp" && (!((n = c?.totp) === null || n === void 0) && n.qr_code) && (c.totp.qr_code = `data:image/svg+xml;utf-8,${c.totp.qr_code}`), this._returnResult({ data: c, error: null }));
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _verify(t) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (r) => {
          var s;
          let { data: n, error: i } = r;
          if (i) return this._returnResult({ data: null, error: i });
          let a = Object.assign({ challenge_id: t.challengeId }, "webauthn" in t ? { webauthn: Object.assign(Object.assign({}, t.webauthn), { credential_response: t.webauthn.type === "create" ? En(t.webauthn.credential_response) : kn(t.webauthn.credential_response) }) } : { code: t.code }), { data: o, error: c } = await T(this.fetch, "POST", `${this.url}/factors/${t.factorId}/verify`, { body: a, headers: this.headers, jwt: (s = n?.session) === null || s === void 0 ? void 0 : s.access_token });
          return c ? this._returnResult({ data: null, error: c }) : (await this._saveSession(Object.assign({ expires_at: Math.round(Date.now() / 1e3) + o.expires_in }, o)), await this._notifyAllSubscribers("MFA_CHALLENGE_VERIFIED", o), this._returnResult({ data: o, error: c }));
        });
      } catch (r) {
        if (x(r)) return this._returnResult({ data: null, error: r });
        throw r;
      }
    });
  }
  async _challenge(t) {
    return this._acquireLock(this.lockAcquireTimeout, async () => {
      try {
        return await this._useSession(async (r) => {
          var s;
          let { data: n, error: i } = r;
          if (i) return this._returnResult({ data: null, error: i });
          let a = await T(this.fetch, "POST", `${this.url}/factors/${t.factorId}/challenge`, { body: t, headers: this.headers, jwt: (s = n?.session) === null || s === void 0 ? void 0 : s.access_token });
          if (a.error) return a;
          let { data: o } = a;
          if (o.type !== "webauthn") return { data: o, error: null };
          switch (o.webauthn.type) {
            case "create":
              return { data: Object.assign(Object.assign({}, o), { webauthn: Object.assign(Object.assign({}, o.webauthn), { credential_options: Object.assign(Object.assign({}, o.webauthn.credential_options), { publicKey: xn(o.webauthn.credential_options.publicKey) }) }) }), error: null };
            case "request":
              return { data: Object.assign(Object.assign({}, o), { webauthn: Object.assign(Object.assign({}, o.webauthn), { credential_options: Object.assign(Object.assign({}, o.webauthn.credential_options), { publicKey: Sn(o.webauthn.credential_options.publicKey) }) }) }), error: null };
          }
        });
      } catch (r) {
        if (x(r)) return this._returnResult({ data: null, error: r });
        throw r;
      }
    });
  }
  async _challengeAndVerify(t) {
    let { data: r, error: s } = await this._challenge({ factorId: t.factorId });
    return s ? this._returnResult({ data: null, error: s }) : await this._verify({ factorId: t.factorId, challengeId: r.id, code: t.code });
  }
  async _listFactors() {
    var t;
    let { data: { user: r }, error: s } = await this.getUser();
    if (s) return { data: null, error: s };
    let n = { all: [], phone: [], totp: [], webauthn: [] };
    for (let i of (t = r?.factors) !== null && t !== void 0 ? t : []) n.all.push(i), i.status === "verified" && n[i.factor_type].push(i);
    return { data: n, error: null };
  }
  async _getAuthenticatorAssuranceLevel(t) {
    var r, s, n, i;
    if (t) try {
      let { payload: p } = Cr(t), g = null;
      p.aal && (g = p.aal);
      let y = g, { data: { user: E }, error: v } = await this.getUser(t);
      if (v) return this._returnResult({ data: null, error: v });
      ((s = (r = E?.factors) === null || r === void 0 ? void 0 : r.filter((O) => O.status === "verified")) !== null && s !== void 0 ? s : []).length > 0 && (y = "aal2");
      let _ = p.amr || [];
      return { data: { currentLevel: g, nextLevel: y, currentAuthenticationMethods: _ }, error: null };
    } catch (p) {
      if (x(p)) return this._returnResult({ data: null, error: p });
      throw p;
    }
    let { data: { session: a }, error: o } = await this.getSession();
    if (o) return this._returnResult({ data: null, error: o });
    if (!a) return { data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] }, error: null };
    let { payload: c } = Cr(a.access_token), l = null;
    c.aal && (l = c.aal);
    let u = l;
    ((i = (n = a.user.factors) === null || n === void 0 ? void 0 : n.filter((p) => p.status === "verified")) !== null && i !== void 0 ? i : []).length > 0 && (u = "aal2");
    let f = c.amr || [];
    return { data: { currentLevel: l, nextLevel: u, currentAuthenticationMethods: f }, error: null };
  }
  async _getAuthorizationDetails(t) {
    try {
      return await this._useSession(async (r) => {
        let { data: { session: s }, error: n } = r;
        return n ? this._returnResult({ data: null, error: n }) : s ? await T(this.fetch, "GET", `${this.url}/oauth/authorizations/${t}`, { headers: this.headers, jwt: s.access_token, xform: /* @__PURE__ */ __name((i) => ({ data: i, error: null }), "xform") }) : this._returnResult({ data: null, error: new F() });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _approveAuthorization(t, r) {
    try {
      return await this._useSession(async (s) => {
        let { data: { session: n }, error: i } = s;
        if (i) return this._returnResult({ data: null, error: i });
        if (!n) return this._returnResult({ data: null, error: new F() });
        let a = await T(this.fetch, "POST", `${this.url}/oauth/authorizations/${t}/consent`, { headers: this.headers, jwt: n.access_token, body: { action: "approve" }, xform: /* @__PURE__ */ __name((o) => ({ data: o, error: null }), "xform") });
        return a.data && a.data.redirect_url && z() && !r?.skipBrowserRedirect && window.location.assign(a.data.redirect_url), a;
      });
    } catch (s) {
      if (x(s)) return this._returnResult({ data: null, error: s });
      throw s;
    }
  }
  async _denyAuthorization(t, r) {
    try {
      return await this._useSession(async (s) => {
        let { data: { session: n }, error: i } = s;
        if (i) return this._returnResult({ data: null, error: i });
        if (!n) return this._returnResult({ data: null, error: new F() });
        let a = await T(this.fetch, "POST", `${this.url}/oauth/authorizations/${t}/consent`, { headers: this.headers, jwt: n.access_token, body: { action: "deny" }, xform: /* @__PURE__ */ __name((o) => ({ data: o, error: null }), "xform") });
        return a.data && a.data.redirect_url && z() && !r?.skipBrowserRedirect && window.location.assign(a.data.redirect_url), a;
      });
    } catch (s) {
      if (x(s)) return this._returnResult({ data: null, error: s });
      throw s;
    }
  }
  async _listOAuthGrants() {
    try {
      return await this._useSession(async (t) => {
        let { data: { session: r }, error: s } = t;
        return s ? this._returnResult({ data: null, error: s }) : r ? await T(this.fetch, "GET", `${this.url}/user/oauth/grants`, { headers: this.headers, jwt: r.access_token, xform: /* @__PURE__ */ __name((n) => ({ data: n, error: null }), "xform") }) : this._returnResult({ data: null, error: new F() });
      });
    } catch (t) {
      if (x(t)) return this._returnResult({ data: null, error: t });
      throw t;
    }
  }
  async _revokeOAuthGrant(t) {
    try {
      return await this._useSession(async (r) => {
        let { data: { session: s }, error: n } = r;
        return n ? this._returnResult({ data: null, error: n }) : s ? (await T(this.fetch, "DELETE", `${this.url}/user/oauth/grants`, { headers: this.headers, jwt: s.access_token, query: { client_id: t.clientId }, noResolveJson: true }), { data: {}, error: null }) : this._returnResult({ data: null, error: new F() });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async fetchJwk(t, r = { keys: [] }) {
    let s = r.keys.find((o) => o.kid === t);
    if (s) return s;
    let n = Date.now();
    if (s = this.jwks.keys.find((o) => o.kid === t), s && this.jwks_cached_at + oa > n) return s;
    let { data: i, error: a } = await T(this.fetch, "GET", `${this.url}/.well-known/jwks.json`, { headers: this.headers });
    if (a) throw a;
    return !i.keys || i.keys.length === 0 || (this.jwks = i, this.jwks_cached_at = n, s = i.keys.find((o) => o.kid === t), !s) ? null : s;
  }
  async getClaims(t, r = {}) {
    try {
      let s = t;
      if (!s) {
        let { data: p, error: g } = await this.getSession();
        if (g || !p.session) return this._returnResult({ data: null, error: g });
        s = p.session.access_token;
      }
      let { header: n, payload: i, signature: a, raw: { header: o, payload: c } } = Cr(s);
      r?.allowExpired || ba(i.exp);
      let l = !n.alg || n.alg.startsWith("HS") || !n.kid || !("crypto" in globalThis && "subtle" in globalThis.crypto) ? null : await this.fetchJwk(n.kid, r?.keys ? { keys: r.keys } : r?.jwks);
      if (!l) {
        let { error: p } = await this.getUser(s);
        if (p) throw p;
        return { data: { claims: i, header: n, signature: a }, error: null };
      }
      let u = xa(n.alg), d = await crypto.subtle.importKey("jwk", l, u, true, ["verify"]);
      if (!await crypto.subtle.verify(u, d, a, pa(`${o}.${c}`))) throw new xt("Invalid JWT signature");
      return { data: { claims: i, header: n, signature: a }, error: null };
    } catch (s) {
      if (x(s)) return this._returnResult({ data: null, error: s });
      throw s;
    }
  }
  async signInWithPasskey(t) {
    var r, s, n;
    se(this.experimental);
    try {
      if (!Pr()) return this._returnResult({ data: null, error: new X("Browser does not support WebAuthn", null) });
      let { data: i, error: a } = await this._startPasskeyAuthentication({ options: { captchaToken: (r = t?.options) === null || r === void 0 ? void 0 : r.captchaToken } });
      if (a || !i) return this._returnResult({ data: null, error: a });
      let o = Sn(i.options), c = (n = (s = t?.options) === null || s === void 0 ? void 0 : s.signal) !== null && n !== void 0 ? n : vs.createNewAbortSignal(), { data: l, error: u } = await An({ publicKey: o, signal: c });
      if (u || !l) return this._returnResult({ data: null, error: u ?? new X("WebAuthn ceremony failed", null) });
      let d = kn(l);
      return this._verifyPasskeyAuthentication({ challengeId: i.challenge_id, credential: d });
    } catch (i) {
      if (x(i)) return this._returnResult({ data: null, error: i });
      throw i;
    }
  }
  async registerPasskey(t) {
    var r, s;
    se(this.experimental);
    try {
      if (!Pr()) return this._returnResult({ data: null, error: new X("Browser does not support WebAuthn", null) });
      let { data: n, error: i } = await this._startPasskeyRegistration();
      if (i || !n) return this._returnResult({ data: null, error: i });
      let a = xn(n.options), o = (s = (r = t?.options) === null || r === void 0 ? void 0 : r.signal) !== null && s !== void 0 ? s : vs.createNewAbortSignal(), { data: c, error: l } = await Tn({ publicKey: a, signal: o });
      if (l || !c) return this._returnResult({ data: null, error: l ?? new X("WebAuthn ceremony failed", null) });
      let u = En(c);
      return this._verifyPasskeyRegistration({ challengeId: n.challenge_id, credential: u });
    } catch (n) {
      if (x(n)) return this._returnResult({ data: null, error: n });
      throw n;
    }
  }
  async _startPasskeyRegistration() {
    se(this.experimental);
    try {
      return await this._useSession(async (t) => {
        let { data: { session: r }, error: s } = t;
        if (s) return this._returnResult({ data: null, error: s });
        if (!r) return this._returnResult({ data: null, error: new F() });
        let { data: n, error: i } = await T(this.fetch, "POST", `${this.url}/passkeys/registration/options`, { headers: this.headers, jwt: r.access_token, body: {} });
        return i ? this._returnResult({ data: null, error: i }) : this._returnResult({ data: n, error: null });
      });
    } catch (t) {
      if (x(t)) return this._returnResult({ data: null, error: t });
      throw t;
    }
  }
  async _verifyPasskeyRegistration(t) {
    se(this.experimental);
    try {
      return await this._useSession(async (r) => {
        let { data: { session: s }, error: n } = r;
        if (n) return this._returnResult({ data: null, error: n });
        if (!s) return this._returnResult({ data: null, error: new F() });
        let { data: i, error: a } = await T(this.fetch, "POST", `${this.url}/passkeys/registration/verify`, { headers: this.headers, jwt: s.access_token, body: { challenge_id: t.challengeId, credential: t.credential } });
        return a ? this._returnResult({ data: null, error: a }) : this._returnResult({ data: i, error: null });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _startPasskeyAuthentication(t) {
    var r;
    se(this.experimental);
    try {
      let { data: s, error: n } = await T(this.fetch, "POST", `${this.url}/passkeys/authentication/options`, { headers: this.headers, body: { gotrue_meta_security: { captcha_token: (r = t?.options) === null || r === void 0 ? void 0 : r.captchaToken } } });
      return n ? this._returnResult({ data: null, error: n }) : this._returnResult({ data: s, error: null });
    } catch (s) {
      if (x(s)) return this._returnResult({ data: null, error: s });
      throw s;
    }
  }
  async _verifyPasskeyAuthentication(t) {
    se(this.experimental);
    try {
      let { data: r, error: s } = await T(this.fetch, "POST", `${this.url}/passkeys/authentication/verify`, { headers: this.headers, body: { challenge_id: t.challengeId, credential: t.credential }, xform: ne });
      return s ? this._returnResult({ data: null, error: s }) : (r.session && (await this._saveSession(r.session), await this._notifyAllSubscribers("SIGNED_IN", r.session)), this._returnResult({ data: r, error: null }));
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _listPasskeys() {
    se(this.experimental);
    try {
      return await this._useSession(async (t) => {
        let { data: { session: r }, error: s } = t;
        if (s) return this._returnResult({ data: null, error: s });
        if (!r) return this._returnResult({ data: null, error: new F() });
        let { data: n, error: i } = await T(this.fetch, "GET", `${this.url}/passkeys`, { headers: this.headers, jwt: r.access_token, xform: /* @__PURE__ */ __name((a) => ({ data: a, error: null }), "xform") });
        return i ? this._returnResult({ data: null, error: i }) : this._returnResult({ data: n, error: null });
      });
    } catch (t) {
      if (x(t)) return this._returnResult({ data: null, error: t });
      throw t;
    }
  }
  async _updatePasskey(t) {
    se(this.experimental);
    try {
      return await this._useSession(async (r) => {
        let { data: { session: s }, error: n } = r;
        if (n) return this._returnResult({ data: null, error: n });
        if (!s) return this._returnResult({ data: null, error: new F() });
        let { data: i, error: a } = await T(this.fetch, "PATCH", `${this.url}/passkeys/${t.passkeyId}`, { headers: this.headers, jwt: s.access_token, body: { friendly_name: t.friendlyName } });
        return a ? this._returnResult({ data: null, error: a }) : this._returnResult({ data: i, error: null });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
  async _deletePasskey(t) {
    se(this.experimental);
    try {
      return await this._useSession(async (r) => {
        let { data: { session: s }, error: n } = r;
        if (n) return this._returnResult({ data: null, error: n });
        if (!s) return this._returnResult({ data: null, error: new F() });
        let { error: i } = await T(this.fetch, "DELETE", `${this.url}/passkeys/${t.passkeyId}`, { headers: this.headers, jwt: s.access_token, noResolveJson: true });
        return i ? this._returnResult({ data: null, error: i }) : this._returnResult({ data: null, error: null });
      });
    } catch (r) {
      if (x(r)) return this._returnResult({ data: null, error: r });
      throw r;
    }
  }
};
_s.nextInstanceID = {};
var Rn = _s;
var Hf = Rn;
var Cn = Hf;
var Kf = "2.105.1";
var Lr = "";
typeof Deno < "u" ? Lr = "deno" : typeof document < "u" ? Lr = "web" : typeof navigator < "u" && navigator.product === "ReactNative" ? Lr = "react-native" : Lr = "node";
var Wf = { "X-Client-Info": `supabase-js-${Lr}/${Kf}` };
var Gf = { headers: Wf };
var Jf = { schema: "public" };
var Xf = { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: "implicit" };
var Yf = {};
function Nr(e20) {
  "@babel/helpers - typeof";
  return Nr = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(t) {
    return typeof t;
  } : function(t) {
    return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t;
  }, Nr(e20);
}
__name(Nr, "Nr");
function Zf(e20, t) {
  if (Nr(e20) != "object" || !e20) return e20;
  var r = e20[Symbol.toPrimitive];
  if (r !== void 0) {
    var s = r.call(e20, t || "default");
    if (Nr(s) != "object") return s;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (t === "string" ? String : Number)(e20);
}
__name(Zf, "Zf");
function Qf(e20) {
  var t = Zf(e20, "string");
  return Nr(t) == "symbol" ? t : t + "";
}
__name(Qf, "Qf");
function em(e20, t, r) {
  return (t = Qf(t)) in e20 ? Object.defineProperty(e20, t, { value: r, enumerable: true, configurable: true, writable: true }) : e20[t] = r, e20;
}
__name(em, "em");
function Na(e20, t) {
  var r = Object.keys(e20);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(e20);
    t && (s = s.filter(function(n) {
      return Object.getOwnPropertyDescriptor(e20, n).enumerable;
    })), r.push.apply(r, s);
  }
  return r;
}
__name(Na, "Na");
function q(e20) {
  for (var t = 1; t < arguments.length; t++) {
    var r = arguments[t] != null ? arguments[t] : {};
    t % 2 ? Na(Object(r), true).forEach(function(s) {
      em(e20, s, r[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e20, Object.getOwnPropertyDescriptors(r)) : Na(Object(r)).forEach(function(s) {
      Object.defineProperty(e20, s, Object.getOwnPropertyDescriptor(r, s));
    });
  }
  return e20;
}
__name(q, "q");
var tm = /* @__PURE__ */ __name((e20) => e20 ? (...t) => e20(...t) : (...t) => fetch(...t), "tm");
var rm = /* @__PURE__ */ __name(() => Headers, "rm");
var sm = /* @__PURE__ */ __name((e20, t, r) => {
  let s = tm(r), n = rm();
  return async (i, a) => {
    var o;
    let c = (o = await t()) !== null && o !== void 0 ? o : e20, l = new n(a?.headers);
    return l.has("apikey") || l.set("apikey", e20), l.has("Authorization") || l.set("Authorization", `Bearer ${c}`), s(i, q(q({}, a), {}, { headers: l }));
  };
}, "sm");
function nm(e20) {
  return e20.endsWith("/") ? e20 : e20 + "/";
}
__name(nm, "nm");
function im(e20, t) {
  var r, s;
  let { db: n, auth: i, realtime: a, global: o } = e20, { db: c, auth: l, realtime: u, global: d } = t, f = { db: q(q({}, c), n), auth: q(q({}, l), i), realtime: q(q({}, u), a), storage: {}, global: q(q(q({}, d), o), {}, { headers: q(q({}, (r = d?.headers) !== null && r !== void 0 ? r : {}), (s = o?.headers) !== null && s !== void 0 ? s : {}) }), accessToken: /* @__PURE__ */ __name(async () => "", "accessToken") };
  return e20.accessToken ? f.accessToken = e20.accessToken : delete f.accessToken, f;
}
__name(im, "im");
function am(e20) {
  let t = e20?.trim();
  if (!t) throw new Error("supabaseUrl is required.");
  if (!t.match(/^https?:\/\//i)) throw new Error("Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.");
  try {
    return new URL(nm(t));
  } catch {
    throw Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
}
__name(am, "am");
var om = class extends Cn {
  static {
    __name(this, "om");
  }
  constructor(e20) {
    super(e20);
  }
};
var cm = class {
  static {
    __name(this, "cm");
  }
  constructor(e20, t, r) {
    var s, n;
    this.supabaseUrl = e20, this.supabaseKey = t;
    let i = am(e20);
    if (!t) throw new Error("supabaseKey is required.");
    this.realtimeUrl = new URL("realtime/v1", i), this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace("http", "ws"), this.authUrl = new URL("auth/v1", i), this.storageUrl = new URL("storage/v1", i), this.functionsUrl = new URL("functions/v1", i);
    let a = `sb-${i.hostname.split(".")[0]}-auth-token`, o = { db: Jf, realtime: Yf, auth: q(q({}, Xf), {}, { storageKey: a }), global: Gf }, c = im(r ?? {}, o);
    if (this.storageKey = (s = c.auth.storageKey) !== null && s !== void 0 ? s : "", this.headers = (n = c.global.headers) !== null && n !== void 0 ? n : {}, c.accessToken) this.accessToken = c.accessToken, this.auth = new Proxy({}, { get: /* @__PURE__ */ __name((u, d) => {
      throw new Error(`@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(d)} is not possible`);
    }, "get") });
    else {
      var l;
      this.auth = this._initSupabaseAuthClient((l = c.auth) !== null && l !== void 0 ? l : {}, this.headers, c.global.fetch);
    }
    this.fetch = sm(t, this._getAccessToken.bind(this), c.global.fetch), this.realtime = this._initRealtimeClient(q({ headers: this.headers, accessToken: this._getAccessToken.bind(this), fetch: this.fetch }, c.realtime)), this.accessToken && Promise.resolve(this.accessToken()).then((u) => this.realtime.setAuth(u)).catch((u) => console.warn("Failed to set initial Realtime auth token:", u)), this.rest = new Ni(new URL("rest/v1", i).href, { headers: this.headers, schema: c.db.schema, fetch: this.fetch, timeout: c.db.timeout, urlLengthLimit: c.db.urlLengthLimit }), this.storage = new ra(this.storageUrl.href, this.headers, this.fetch, r?.storage), c.accessToken || this._listenForAuthEvents();
  }
  get functions() {
    return new ur(this.functionsUrl.href, { headers: this.headers, customFetch: this.fetch });
  }
  from(e20) {
    return this.rest.from(e20);
  }
  schema(e20) {
    return this.rest.schema(e20);
  }
  rpc(e20, t = {}, r = { head: false, get: false, count: void 0 }) {
    return this.rest.rpc(e20, t, r);
  }
  channel(e20, t = { config: {} }) {
    return this.realtime.channel(e20, t);
  }
  getChannels() {
    return this.realtime.getChannels();
  }
  removeChannel(e20) {
    return this.realtime.removeChannel(e20);
  }
  removeAllChannels() {
    return this.realtime.removeAllChannels();
  }
  async _getAccessToken() {
    var e20 = this, t, r;
    if (e20.accessToken) return await e20.accessToken();
    let { data: s } = await e20.auth.getSession();
    return (t = (r = s.session) === null || r === void 0 ? void 0 : r.access_token) !== null && t !== void 0 ? t : e20.supabaseKey;
  }
  _initSupabaseAuthClient({ autoRefreshToken: e20, persistSession: t, detectSessionInUrl: r, storage: s, userStorage: n, storageKey: i, flowType: a, lock: o, debug: c, throwOnError: l, experimental: u }, d, f) {
    let p = { Authorization: `Bearer ${this.supabaseKey}`, apikey: `${this.supabaseKey}` };
    return new om({ url: this.authUrl.href, headers: q(q({}, p), d), storageKey: i, autoRefreshToken: e20, persistSession: t, detectSessionInUrl: r, storage: s, userStorage: n, flowType: a, lock: o, debug: c, throwOnError: l, experimental: u, fetch: f, hasCustomAuthorizationHeader: Object.keys(this.headers).some((g) => g.toLowerCase() === "authorization") });
  }
  _initRealtimeClient(e20) {
    return new Wt(this.realtimeUrl.href, q(q({}, e20), {}, { params: q(q({}, { apikey: this.supabaseKey }), e20?.params) }));
  }
  _listenForAuthEvents() {
    return this.auth.onAuthStateChange((e20, t) => {
      this._handleTokenChanged(e20, "CLIENT", t?.access_token);
    });
  }
  _handleTokenChanged(e20, t, r) {
    (e20 === "TOKEN_REFRESHED" || e20 === "SIGNED_IN") && this.changedAccessToken !== r ? (this.changedAccessToken = r, this.realtime.setAuth(r)) : e20 === "SIGNED_OUT" && (this.realtime.setAuth(), t == "STORAGE" && this.auth.signOut(), this.changedAccessToken = void 0);
  }
};
var Ce = /* @__PURE__ */ __name((e20, t, r) => new cm(e20, t, r), "Ce");
function lm() {
  if (typeof window < "u") return false;
  let e20 = globalThis.process;
  if (!e20) return false;
  let t = e20.version;
  if (t == null) return false;
  let r = t.match(/^v(\d+)\./);
  return r ? parseInt(r[1], 10) <= 18 : false;
}
__name(lm, "lm");
lm() && console.warn("\u26A0\uFE0F  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 or later. For more information, visit: https://github.com/orgs/supabase/discussions/37217");
var On = "0.10.2";
var xs = Gs(Ln());
function Ba(e20) {
  let t = xs.parse(e20);
  return Object.keys(t ?? {}).map((r) => ({ name: r, value: t[r] }));
}
__name(Ba, "Ba");
function Ma(e20, t, r) {
  return xs.serialize(e20, t, r);
}
__name(Ma, "Ma");
function Ss() {
  return typeof window < "u" && typeof window.document < "u";
}
__name(Ss, "Ss");
function Fa(e20 = {}) {
  return { getItem: /* @__PURE__ */ __name((t) => e20[t] || null, "getItem"), setItem: /* @__PURE__ */ __name((t, r) => {
    e20[t] = r;
  }, "setItem"), removeItem: /* @__PURE__ */ __name((t) => {
    delete e20[t];
  }, "removeItem") };
}
__name(Fa, "Fa");
var Je = { path: "/", sameSite: "lax", httpOnly: false, maxAge: 3456e4 };
var wm = /^(.*)[.](0|[1-9][0-9]*)$/;
function jr(e20, t) {
  if (e20 === t) return true;
  let r = e20.match(wm);
  return !!(r && r[1] === t);
}
__name(jr, "jr");
function Nn(e20, t, r) {
  let s = r ?? 3180, n = encodeURIComponent(t);
  if (n.length <= s) return [{ name: e20, value: t }];
  let i = [];
  for (; n.length > 0; ) {
    let a = n.slice(0, s), o = a.lastIndexOf("%");
    o > s - 3 && (a = a.slice(0, o));
    let c = "";
    for (; a.length > 0; ) try {
      c = decodeURIComponent(a);
      break;
    } catch (l) {
      if (l instanceof URIError && a.at(-3) === "%" && a.length > 3) a = a.slice(0, a.length - 3);
      else throw l;
    }
    i.push(c), n = n.slice(a.length);
  }
  return i.map((a, o) => ({ name: `${e20}.${o}`, value: a }));
}
__name(Nn, "Nn");
async function jn(e20, t) {
  let r = await t(e20);
  if (r) return r;
  let s = [];
  for (let n = 0; ; n++) {
    let i = `${e20}.${n}`, a = await t(i);
    if (!a) break;
    s.push(a);
  }
  return s.length > 0 ? s.join("") : null;
}
__name(jn, "jn");
var Es = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");
var qa = ` 	
\r=`.split("");
var vm = (() => {
  let e20 = new Array(128);
  for (let t = 0; t < e20.length; t += 1) e20[t] = -1;
  for (let t = 0; t < qa.length; t += 1) e20[qa[t].charCodeAt(0)] = -2;
  for (let t = 0; t < Es.length; t += 1) e20[Es[t].charCodeAt(0)] = t;
  return e20;
})();
function Un(e20) {
  let t = [], r = 0, s = 0;
  if (bm(e20, (i) => {
    for (r = r << 8 | i, s += 8; s >= 6; ) {
      let a = r >> s - 6 & 63;
      t.push(Es[a]), s -= 6;
    }
  }), s > 0) for (r = r << 6 - s, s = 6; s >= 6; ) {
    let i = r >> s - 6 & 63;
    t.push(Es[i]), s -= 6;
  }
  return t.join("");
}
__name(Un, "Un");
function Dn(e20) {
  let t = [], r = /* @__PURE__ */ __name((a) => {
    t.push(String.fromCodePoint(a));
  }, "r"), s = { utf8seq: 0, codepoint: 0 }, n = 0, i = 0;
  for (let a = 0; a < e20.length; a += 1) {
    let o = e20.charCodeAt(a), c = vm[o];
    if (c > -1) for (n = n << 6 | c, i += 6; i >= 8; ) xm(n >> i - 8 & 255, s, r), i -= 8;
    else {
      if (c === -2) continue;
      throw new Error(`Invalid Base64-URL character "${e20.at(a)}" at position ${a}`);
    }
  }
  return t.join("");
}
__name(Dn, "Dn");
function _m(e20, t) {
  if (e20 <= 127) {
    t(e20);
    return;
  } else if (e20 <= 2047) {
    t(192 | e20 >> 6), t(128 | e20 & 63);
    return;
  } else if (e20 <= 65535) {
    t(224 | e20 >> 12), t(128 | e20 >> 6 & 63), t(128 | e20 & 63);
    return;
  } else if (e20 <= 1114111) {
    t(240 | e20 >> 18), t(128 | e20 >> 12 & 63), t(128 | e20 >> 6 & 63), t(128 | e20 & 63);
    return;
  }
  throw new Error(`Unrecognized Unicode codepoint: ${e20.toString(16)}`);
}
__name(_m, "_m");
function bm(e20, t) {
  for (let r = 0; r < e20.length; r += 1) {
    let s = e20.charCodeAt(r);
    if (s > 55295 && s <= 56319) {
      let n = (s - 55296) * 1024 & 65535;
      s = (e20.charCodeAt(r + 1) - 56320 & 65535 | n) + 65536, r += 1;
    }
    _m(s, t);
  }
}
__name(bm, "bm");
function xm(e20, t, r) {
  if (t.utf8seq === 0) {
    if (e20 <= 127) {
      r(e20);
      return;
    }
    for (let s = 1; s < 6; s += 1) if ((e20 >> 7 - s & 1) === 0) {
      t.utf8seq = s;
      break;
    }
    if (t.utf8seq === 2) t.codepoint = e20 & 31;
    else if (t.utf8seq === 3) t.codepoint = e20 & 15;
    else if (t.utf8seq === 4) t.codepoint = e20 & 7;
    else throw new Error("Invalid UTF-8 sequence");
    t.utf8seq -= 1;
  } else if (t.utf8seq > 0) {
    if (e20 <= 127) throw new Error("Invalid UTF-8 sequence");
    t.codepoint = t.codepoint << 6 | e20 & 63, t.utf8seq -= 1, t.utf8seq === 0 && r(t.codepoint);
  }
}
__name(xm, "xm");
var ks = Gs(Ln());
var Zt = "base64-";
function $n(e20, t) {
  let r = e20.cookies ?? null, s = e20.cookieEncoding, n = {}, i = {}, a, o;
  if (r) if ("get" in r) {
    let c = /* @__PURE__ */ __name(async (l) => {
      let u = l.flatMap((f) => [f, ...Array.from({ length: 5 }).map((p, g) => `${f}.${g}`)]), d = [];
      for (let f = 0; f < u.length; f += 1) {
        let p = await r.get(u[f]);
        !p && typeof p != "string" || d.push({ name: u[f], value: p });
      }
      return d;
    }, "c");
    if (a = /* @__PURE__ */ __name(async (l) => await c(l), "a"), "set" in r && "remove" in r) o = /* @__PURE__ */ __name(async (l) => {
      for (let u = 0; u < l.length; u += 1) {
        let { name: d, value: f, options: p } = l[u];
        f ? await r.set(d, f, p) : await r.remove(d, p);
      }
    }, "o");
    else if (t) o = /* @__PURE__ */ __name(async () => {
      console.warn("@supabase/ssr: createServerClient was configured without set and remove cookie methods, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness. Consider switching to the getAll and setAll cookie methods instead of get, set and remove which are deprecated and can be difficult to use correctly.");
    }, "o");
    else throw new Error("@supabase/ssr: createBrowserClient requires configuring a getAll and setAll cookie method (deprecated: alternatively both get, set and remove can be used)");
  } else if ("getAll" in r) if (a = /* @__PURE__ */ __name(async () => await r.getAll(), "a"), "setAll" in r) o = r.setAll;
  else if (t) o = /* @__PURE__ */ __name(async () => {
    console.warn("@supabase/ssr: createServerClient was configured without the setAll cookie method, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness.");
  }, "o");
  else throw new Error("@supabase/ssr: createBrowserClient requires configuring both getAll and setAll cookie methods (deprecated: alternatively both get, set and remove can be used)");
  else throw new Error(`@supabase/ssr: ${t ? "createServerClient" : "createBrowserClient"} requires configuring getAll and setAll cookie methods (deprecated: alternatively use get, set and remove).${Ss() ? " As this is called in a browser runtime, consider removing the cookies option object to use the document.cookie API automatically." : ""}`);
  else if (!t && Ss()) {
    let c = /* @__PURE__ */ __name(() => {
      let l = (0, ks.parse)(document.cookie);
      return Object.keys(l).map((u) => ({ name: u, value: l[u] ?? "" }));
    }, "c");
    a = /* @__PURE__ */ __name(() => c(), "a"), o = /* @__PURE__ */ __name((l) => {
      l.forEach(({ name: u, value: d, options: f }) => {
        document.cookie = (0, ks.serialize)(u, d, f);
      });
    }, "o");
  } else {
    if (t) throw new Error("@supabase/ssr: createServerClient must be initialized with cookie options that specify getAll and setAll functions (deprecated, not recommended: alternatively use get, set and remove)");
    a = /* @__PURE__ */ __name(() => [], "a"), o = /* @__PURE__ */ __name(() => {
      throw new Error("@supabase/ssr: createBrowserClient in non-browser runtimes (including Next.js pre-rendering mode) was not initialized cookie options that specify getAll and setAll functions (deprecated: alternatively use get, set and remove), but they were needed");
    }, "o");
  }
  return t ? { getAll: a, setAll: o, setItems: n, removedItems: i, storage: { isServer: true, getItem: /* @__PURE__ */ __name(async (c) => {
    if (typeof n[c] == "string") return n[c];
    if (i[c]) return null;
    let l = await a([c]), u = await jn(c, async (f) => {
      let p = l?.find(({ name: g }) => g === f) || null;
      return p ? p.value : null;
    });
    if (!u) return null;
    let d = u;
    return typeof u == "string" && u.startsWith(Zt) && (d = Dn(u.substring(Zt.length))), d;
  }, "getItem"), setItem: /* @__PURE__ */ __name(async (c, l) => {
    c.endsWith("-code-verifier") && await Bn({ getAll: a, setAll: o, setItems: { [c]: l }, removedItems: {} }, { cookieOptions: e20?.cookieOptions ?? null, cookieEncoding: s }), n[c] = l, delete i[c];
  }, "setItem"), removeItem: /* @__PURE__ */ __name(async (c) => {
    delete n[c], i[c] = true;
  }, "removeItem") } } : { getAll: a, setAll: o, setItems: n, removedItems: i, storage: { isServer: false, getItem: /* @__PURE__ */ __name(async (c) => {
    let l = await a([c]), u = await jn(c, async (f) => {
      let p = l?.find(({ name: g }) => g === f) || null;
      return p ? p.value : null;
    });
    if (!u) return null;
    let d = u;
    return u.startsWith(Zt) && (d = Dn(u.substring(Zt.length))), d;
  }, "getItem"), setItem: /* @__PURE__ */ __name(async (c, l) => {
    let d = (await a([c]))?.map(({ name: b }) => b) || [], f = new Set(d.filter((b) => jr(b, c))), p = l;
    s === "base64url" && (p = Zt + Un(l));
    let g = Nn(c, p);
    g.forEach(({ name: b }) => {
      f.delete(b);
    });
    let y = { ...Je, ...e20?.cookieOptions, maxAge: 0 }, E = { ...Je, ...e20?.cookieOptions, maxAge: Je.maxAge };
    delete y.name, delete E.name;
    let v = [...[...f].map((b) => ({ name: b, value: "", options: y })), ...g.map(({ name: b, value: _ }) => ({ name: b, value: _, options: E }))];
    v.length > 0 && await o(v, {});
  }, "setItem"), removeItem: /* @__PURE__ */ __name(async (c) => {
    let d = ((await a([c]))?.map(({ name: p }) => p) || []).filter((p) => jr(p, c)), f = { ...Je, ...e20?.cookieOptions, maxAge: 0 };
    delete f.name, d.length > 0 && await o(d.map((p) => ({ name: p, value: "", options: f })), {});
  }, "removeItem") } };
}
__name($n, "$n");
async function Bn({ getAll: e20, setAll: t, setItems: r, removedItems: s }, n) {
  let i = n.cookieEncoding, a = n.cookieOptions ?? null, c = (await e20([...r ? Object.keys(r) : [], ...s ? Object.keys(s) : []]))?.map(({ name: p }) => p) || [], l = Object.keys(s).flatMap((p) => c.filter((g) => jr(g, p))), u = Object.keys(r).flatMap((p) => {
    let g = new Set(c.filter((v) => jr(v, p))), y = r[p];
    i === "base64url" && (y = Zt + Un(y));
    let E = Nn(p, y);
    return E.forEach((v) => {
      g.delete(v.name);
    }), l.push(...g), E;
  }), d = { ...Je, ...a, maxAge: 0 }, f = { ...Je, ...a, maxAge: Je.maxAge };
  delete d.name, delete f.name, await t([...l.map((p) => ({ name: p, value: "", options: d })), ...u.map(({ name: p, value: g }) => ({ name: p, value: g, options: f }))], { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" });
}
__name(Bn, "Bn");
function za(e20, t, r) {
  if (!e20 || !t) throw new Error(`Your project's URL and Key are required to create a Supabase client!

Check your Supabase project's API settings to find these values

https://supabase.com/dashboard/project/_/settings/api`);
  let { storage: s, getAll: n, setAll: i, setItems: a, removedItems: o } = $n({ ...r, cookieEncoding: r?.cookieEncoding ?? "base64url" }, true), c = Ce(e20, t, { ...r, global: { ...r?.global, headers: { ...r?.global?.headers, "X-Client-Info": `supabase-ssr/${On} createServerClient` } }, auth: { ...r?.cookieOptions?.name ? { storageKey: r.cookieOptions.name } : null, ...r?.auth, flowType: "pkce", autoRefreshToken: false, detectSessionInUrl: false, persistSession: true, skipAutoInitialize: true, storage: s, ...r?.cookies && "encode" in r.cookies && r.cookies.encode === "tokens-only" ? { userStorage: r?.auth?.userStorage ?? Fa() } : null } });
  return c.auth.onAuthStateChange(async (l) => {
    (Object.keys(a).length > 0 || Object.keys(o).length > 0) && (l === "SIGNED_IN" || l === "TOKEN_REFRESHED" || l === "USER_UPDATED" || l === "PASSWORD_RECOVERY" || l === "SIGNED_OUT" || l === "MFA_CHALLENGE_VERIFIED") && await Bn({ getAll: n, setAll: i, setItems: a, removedItems: o }, { cookieOptions: r?.cookieOptions ?? null, cookieEncoding: r?.cookieEncoding ?? "base64url" });
  }), c;
}
__name(za, "za");
if (typeof process < "u" && process.env?.npm_package_name) {
  let e20 = process.env.npm_package_name;
  ["@supabase/auth-helpers-nextjs", "@supabase/auth-helpers-react", "@supabase/auth-helpers-remix", "@supabase/auth-helpers-sveltekit"].includes(e20) && console.warn(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551 \u26A0\uFE0F  IMPORTANT: Package Consolidation Notice                                \u2551
\u2551                                                                            \u2551
\u2551 The ${e20.padEnd(35)} package name is deprecated.  \u2551
\u2551                                                                            \u2551
\u2551 You are now using @supabase/ssr - a unified solution for all frameworks.  \u2551
\u2551                                                                            \u2551
\u2551 The auth-helpers packages have been consolidated into @supabase/ssr       \u2551
\u2551 to provide better maintenance and consistent APIs across frameworks.      \u2551
\u2551                                                                            \u2551
\u2551 Please update your package.json to use @supabase/ssr directly:            \u2551
\u2551   npm uninstall ${e20.padEnd(42)} \u2551
\u2551   npm install @supabase/ssr                                               \u2551
\u2551                                                                            \u2551
\u2551 For more information, visit:                                              \u2551
\u2551 https://supabase.com/docs/guides/auth/server-side                         \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
    `);
}
var ee = /* @__PURE__ */ __name((e20) => h.preprocess((t) => t === "" ? void 0 : t, e20.optional()), "ee");
var Va = h.object({ NEXT_PUBLIC_SUPABASE_URL: h.string().url(), NEXT_PUBLIC_SUPABASE_ANON_KEY: h.string().min(1), NEXT_PUBLIC_APP_URL: h.string().url().default("http://localhost:3000"), NEXT_PUBLIC_MAPTILER_API_KEY: ee(h.string()), NEXT_PUBLIC_SENTRY_DSN: ee(h.string()), NEXT_PUBLIC_TURNSTILE_SITE_KEY: ee(h.string()) });
var Sm = Va.extend({ SUPABASE_SERVICE_ROLE_KEY: ee(h.string().min(1)), RESEND_API_KEY: ee(h.string().min(1)), RESEND_FROM_EMAIL: ee(h.string().email()), CRON_SECRET: ee(h.string().min(16)), LOG_LEVEL: h.enum(["debug", "info", "warn", "error", "fatal"]).default("info"), SENTRY_DSN: ee(h.string()), UPSTASH_REDIS_REST_URL: ee(h.string().url()), UPSTASH_REDIS_REST_TOKEN: ee(h.string().min(1)), QSTASH_TOKEN: ee(h.string().min(1)), QSTASH_CURRENT_SIGNING_KEY: ee(h.string().min(1)), QSTASH_NEXT_SIGNING_KEY: ee(h.string().min(1)), TURNSTILE_SECRET_KEY: ee(h.string().min(1)) });
function Ha(e20, t) {
  let r = e20.safeParse(t);
  if (!r.success) {
    let s = r.error.issues.map((n) => n.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${s}`);
  }
  return r.data;
}
__name(Ha, "Ha");
function Em() {
  return Ha(Va, { NEXT_PUBLIC_SUPABASE_URL: "https://qleeedwnnfvmfjjymoco.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZWVlZHdubmZ2bWZqanltb2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDg5MjQsImV4cCI6MjA5MzQyNDkyNH0.4LGGJvB7paU3L5sPRVCjQVZOgwLAR9OJDEt4N9Qqxj8", NEXT_PUBLIC_APP_URL: "https://roomza.pinpoint-roomza.workers.dev", NEXT_PUBLIC_MAPTILER_API_KEY: "WinZmYohLSVCeA1HpChl", NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAADwU5gY7M0L2jyFF" });
}
__name(Em, "Em");
function km() {
  return Ha(Sm, { NEXT_PUBLIC_SUPABASE_URL: "https://qleeedwnnfvmfjjymoco.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZWVlZHdubmZ2bWZqanltb2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDg5MjQsImV4cCI6MjA5MzQyNDkyNH0.4LGGJvB7paU3L5sPRVCjQVZOgwLAR9OJDEt4N9Qqxj8", NEXT_PUBLIC_APP_URL: "https://roomza.pinpoint-roomza.workers.dev", NEXT_PUBLIC_MAPTILER_API_KEY: "WinZmYohLSVCeA1HpChl", NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAADwU5gY7M0L2jyFF", SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL, CRON_SECRET: process.env.CRON_SECRET, LOG_LEVEL: process.env.LOG_LEVEL, SENTRY_DSN: process.env.SENTRY_DSN, UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN, QSTASH_TOKEN: process.env.QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY, TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY });
}
__name(km, "km");
function Xe() {
  let e20 = Em();
  return { supabaseUrl: e20.NEXT_PUBLIC_SUPABASE_URL, supabaseAnonKey: e20.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}
__name(Xe, "Xe");
function Mn(e20) {
  let t = km()[e20];
  if (!t) throw new Error(`Missing required server environment value: ${String(e20)}`);
  return t;
}
__name(Mn, "Mn");
var Ka = new Tm();
function Fn() {
  let e20 = Ka.getStore();
  if (!e20) throw new Error("Discovery API requires a request context.");
  return e20;
}
__name(Fn, "Fn");
function Wa(e20, t) {
  let r = { request: e20, cookies: new Map(Ba(e20.headers.get("cookie") ?? "").map(({ name: s, value: n }) => [s, n ?? ""])), outgoingCookies: /* @__PURE__ */ new Map(), client: null };
  return Ka.run(r, async () => {
    let s = await t(), n = new Headers(s.headers);
    for (let i of r.outgoingCookies.values()) n.append("set-cookie", i);
    return r.outgoingCookies.size && n.set("cache-control", "private, no-store"), n.set("x-roomza-api", "discovery-worker"), new Response(s.body, { status: s.status, headers: n });
  });
}
__name(Wa, "Wa");
function Ga(e20) {
  let t = Fn();
  for (let { name: r, value: s, options: n } of e20) t.cookies.set(r, s), t.outgoingCookies.set(r, Ma(r, s, { path: "/", ...n }));
}
__name(Ga, "Ga");
async function ye() {
  let e20 = Fn();
  if (!e20.client) {
    let { supabaseUrl: t, supabaseAnonKey: r } = Xe();
    e20.client = za(t, r, { cookies: { getAll: /* @__PURE__ */ __name(() => [...e20.cookies].map(([s, n]) => ({ name: s, value: n })), "getAll"), setAll: Ga } });
  }
  return e20.client;
}
__name(ye, "ye");
function Ts() {
  return Ce(Mn("NEXT_PUBLIC_SUPABASE_URL"), Mn("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } });
}
__name(Ts, "Ts");
function qn(e20) {
  let t = e20.medianFirstResponseSeconds;
  return e20.presence === "available" ? Math.max(60, Math.min(t ?? 300, 300)) : e20.presence === "busy" ? Math.max(60, Math.min(t ?? 1200, 1200)) : t !== null && Number.isFinite(t) && t >= 0 ? t : null;
}
__name(qn, "qn");
function Ur(e20) {
  return (e20 ?? "").replace(/\s+/g, " ").trim().slice(0, 120).trimEnd();
}
__name(Ur, "Ur");
var Am = 4;
var Ja = 90;
var Xa = 180;
var Rm = 250;
function Cm(e20) {
  return e20 === "available" || e20 === "busy" ? e20 : "offline";
}
__name(Cm, "Cm");
async function Om(e20) {
  let t = [...new Set(e20.map((o) => o.landlord_id).filter((o) => !!o))];
  if (!t.length) return e20;
  let r = Ts(), [{ data: s }, { data: n }] = await Promise.all([r.from("public_profiles").select("profile_id,display_name,avatar_url,profile_audience").in("profile_id", t), r.from("profiles").select("id,phone_verified,email_verified_at,presence_status").in("id", t)]), i = new Map((s ?? []).map((o) => [o.profile_id, o])), a = new Map((n ?? []).map((o) => [o.id, o]));
  return e20.map((o) => {
    let c = o.landlord_id ? i.get(o.landlord_id) : null, l = o.landlord_id ? a.get(o.landlord_id) : null;
    return !c || c.profile_audience !== "everyone" ? { ...o, landlord: null } : { ...o, landlord: { id: o.landlord_id, full_name: c.display_name, avatar_url: c.avatar_url, phone_verified: !!l?.phone_verified, email_verified_at: l?.email_verified_at ?? null, presence_status: l?.presence_status ?? null } };
  });
}
__name(Om, "Om");
function zn(e20) {
  return e20 === "buy" ? "sale" : "rent";
}
__name(zn, "zn");
function Ya(e20) {
  return e20.listing_type === "sale" ? e20.sale_price ?? e20.price : e20.price;
}
__name(Ya, "Ya");
function Im(e20) {
  return [...e20.listing_images ?? []].sort((t, r) => t.sort_order - r.sort_order)[0]?.public_url ?? null;
}
__name(Im, "Im");
function Za(e20) {
  let t = "image_urls" in e20 && e20.image_urls ? e20.image_urls : "thumbnail_url" in e20 && e20.thumbnail_url ? [e20.thumbnail_url] : "listing_images" in e20 ? [Im(e20)].filter((l) => !!l) : [], r = "landlord" in e20 && e20.landlord ? e20.landlord : null, s = "nsfas_approved" in e20 ? !!e20.nsfas_approved : "listing_accreditations" in e20 ? !!e20.listing_accreditations?.some((l) => l.nsfas_approved) : false, n = "furnished" in e20 ? !!e20.furnished : "metadata" in e20 ? !!e20.metadata?.amenities?.essentials?.includes("furnished") : false, i = "landlord_median_first_response_seconds" in e20 ? { medianFirstResponseSeconds: e20.landlord_median_first_response_seconds ?? null, predictedResponseSeconds: e20.landlord_predicted_response_seconds ?? null, phoneVerified: !!e20.landlord_phone_verified, emailVerified: !!e20.landlord_email_verified } : r ? { medianFirstResponseSeconds: null, phoneVerified: r.phone_verified, emailVerified: !!r.email_verified_at } : null, a = "landlord_presence_status" in e20 ? e20.landlord_presence_status : r?.presence_status, o = Cm(a), c = { viewedToday: "viewed_today" in e20 ? Number(e20.viewed_today ?? 0) : 0, viewingNow: "viewing_now" in e20 ? Number(e20.viewing_now ?? 0) : 0, lastScheduledAt: "last_scheduled_at" in e20 ? e20.last_scheduled_at ?? null : null, lastRentedAt: "last_rented_at" in e20 ? e20.last_rented_at ?? null : null };
  return { id: e20.id, title: e20.title, publicContact: "metadata" in e20 ? ki(e20.metadata) : null, area: e20.address, price: e20.price, salePrice: "sale_price" in e20 ? e20.sale_price ?? null : null, displayPrice: Ya(e20), listingType: "listing_type" in e20 ? e20.listing_type ?? "rent" : "rent", latitude: Number(e20.latitude), longitude: Number(e20.longitude), bedrooms: Number(e20.bedrooms), bathrooms: Number(e20.bathrooms), parkingCount: "parking_count" in e20 ? Number(e20.parking_count ?? 0) : 0, imageUrls: t, availabilityDate: "availability_date" in e20 ? e20.availability_date ?? null : null, propertyType: "property_type" in e20 ? e20.property_type ?? null : null, created_at: e20.created_at ?? null, nsfasApproved: s, listingReviewedAt: "listing_reviewed_at" in e20 ? e20.listing_reviewed_at ?? null : null, furnished: n, landlordTrust: i, landlordPresence: o, liveTourId: "live_tour_id" in e20 ? e20.live_tour_id ?? null : null, hasInstantViewing: "has_instant_viewing" in e20 ? !!e20.has_instant_viewing : false, liveActivity: c, agent: "landlord_name" in e20 && e20.landlord_id ? { id: e20.landlord_id, name: e20.landlord_name || "Landlord", avatarUrl: e20.landlord_avatar_url || void 0, isVerified: e20.landlord_phone_verified } : r ? { id: r.id, name: r.full_name || "Landlord", avatarUrl: r.avatar_url || void 0, isVerified: r.phone_verified } : null };
}
__name(Za, "Za");
async function Pm(e20, t) {
  let r = [...new Set(t.map((i) => i.agent?.id).filter((i) => !!i))];
  if (!r.length) return t;
  let { data: s } = await e20.from("landlord_trust_metrics").select("landlord_id, median_first_response_seconds").in("landlord_id", r), n = new Map((s ?? []).map((i) => [i.landlord_id, i.median_first_response_seconds]));
  return t.map((i) => {
    let a = i.agent?.id;
    return !a || !i.landlordTrust ? i : { ...i, landlordTrust: { ...i.landlordTrust, medianFirstResponseSeconds: n.get(a) ?? null, predictedResponseSeconds: i.landlordPresence ? qn({ medianFirstResponseSeconds: n.get(a) ?? null, presence: i.landlordPresence }) : i.landlordTrust.predictedResponseSeconds } };
  });
}
__name(Pm, "Pm");
async function Lm(e20, t) {
  if (!t.length) return t.map((n) => ({ ...n, listingReviewedAt: null }));
  let { data: r } = await e20.rpc("get_public_listing_trust_signals", { target_listing_ids: t.map((n) => n.id) }), s = new Map((r ?? []).map((n) => [n.listing_id, n.verified_at]));
  return t.map((n) => ({ ...n, listingReviewedAt: s.get(n.id) ?? null }));
}
__name(Lm, "Lm");
function Qa(e20) {
  if (!e20) return { error: "Missing bbox query parameter." };
  let t = e20.split(",").map((a) => Number(a.trim()));
  if (t.length !== Am || t.some((a) => !Number.isFinite(a))) return { error: "bbox must be four comma-separated numbers: west,south,east,north." };
  let [r, s, n, i] = t;
  return r === void 0 || s === void 0 || n === void 0 || i === void 0 ? { error: "bbox must be four comma-separated numbers: west,south,east,north." } : Math.abs(r) > Xa || Math.abs(n) > Xa ? { error: "bbox longitude values must be between -180 and 180." } : Math.abs(s) > Ja || Math.abs(i) > Ja ? { error: "bbox latitude values must be between -90 and 90." } : { bbox: { west: r, south: s, east: n, north: i } };
}
__name(Qa, "Qa");
function Ye(e20) {
  return e20 !== void 0 && !Number.isNaN(e20) ? e20 : void 0;
}
__name(Ye, "Ye");
function Nm(e20) {
  let t = [e20.code, e20.message, e20.details, e20.hint].filter(Boolean).join(" ");
  return /listings_location_gix|missing[_ -]?spatial[_ -]?index|spatial index/i.test(t);
}
__name(Nm, "Nm");
function jm(e20, t) {
  let r = Ye(t.minPrice), s = Ye(t.maxPrice), n = Ye(t.beds), i = Ye(t.baths), a = Ya(e20), o = Ur(t.q).toLocaleLowerCase("en-ZA"), c = `${e20.title} ${e20.address}`.toLocaleLowerCase("en-ZA");
  return (e20.listing_type ?? "rent") === zn(t.mode) && (!o || c.includes(o)) && (r === void 0 || a >= r) && (s === void 0 || a <= s) && (n === void 0 || Number(e20.bedrooms) >= n) && (i === void 0 || Number(e20.bathrooms) >= i) && (!t.type || e20.property_type === t.type);
}
__name(jm, "jm");
async function Um(e20, t, r) {
  let { data: s, error: n } = await e20.from("listings").select(`
      id,
      title,
      address,
      price,
      sale_price,
      listing_type,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      parking_count,
      created_at,
      availability_date,
      property_type,
      metadata,
      landlord_id,
      listing_accreditations (nsfas_approved),
      listing_images (public_url, sort_order)
    `).eq("status", "published").eq("listing_type", zn(r.mode)).gte("longitude", Math.min(t.west, t.east)).lte("longitude", Math.max(t.west, t.east)).gte("latitude", Math.min(t.south, t.north)).lte("latitude", Math.max(t.south, t.north)).order("created_at", { ascending: false });
  if (n) return { error: n };
  let a = (await Om(s ?? [])).filter((l) => jm(l, r)).slice(0, Rm).map(Za), o = await Lm(e20, a);
  return { listings: (await Pm(e20, o)).filter((l) => {
    let u = l.landlordTrust ? qn({ medianFirstResponseSeconds: l.landlordTrust.medianFirstResponseSeconds, presence: l.landlordPresence }) : null;
    return (!r.availableNow || l.landlordPresence === "available") && (!r.liveTours || !!l.liveTourId) && (!r.instantViewings || l.hasInstantViewing) && (!r.repliesUnder5 || u !== null && u <= 300);
  }), missingSpatialIndex: true };
}
__name(Um, "Um");
async function eo(e20, t) {
  let r = await ye(), s = Ur(t.q), { data: n, error: i } = await r.rpc("get_published_listings_in_bbox_with_query", { ...e20, search_query: s || void 0, min_price: Ye(t.minPrice), max_price: Ye(t.maxPrice), min_beds: Ye(t.beds), min_baths: Ye(t.baths), property_type_filter: t.type, listing_type_filter: zn(t.mode), available_now_filter: !!t.availableNow, live_tours_filter: !!t.liveTours, instant_viewings_filter: !!t.instantViewings, replies_under_5_filter: !!t.repliesUnder5 });
  if (i) return Nm(i) ? Um(r, e20, { ...t, q: s || void 0 }) : { error: i };
  let a = n.map(Za), { data: o, error: c } = a.length ? await r.rpc("pinpoint_property_contacts", { listing_ids: a.map((d) => d.id) }) : { data: null, error: null };
  if (c) return { error: c };
  let l = o && typeof o == "object" && !Array.isArray(o) ? o : {};
  return { listings: a.map((d) => {
    let f = je.safeParse(l[d.id]);
    return { ...d, publicContact: f.success ? f.data : null };
  }) };
}
__name(eo, "eo");
var to = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
var Dm = /(password|token|secret|api[_-]?key|authorization|cookie|session|service[_-]?role)/i;
function $m() {
  let e20 = process.env.LOG_LEVEL;
  return e20 === "debug" || e20 === "info" || e20 === "warn" || e20 === "error" || e20 === "fatal" ? e20 : "info";
}
__name($m, "$m");
function Bm(e20) {
  return e20.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}
__name(Bm, "Bm");
function Vn(e20) {
  return e20 instanceof Error ? { name: e20.name, message: e20.message, stack: void 0 } : Array.isArray(e20) ? e20.map(Vn) : e20 && typeof e20 == "object" ? Object.fromEntries(Object.entries(e20).map(([t, r]) => [t, Dm.test(t) ? "[REDACTED]" : Vn(r)])) : typeof e20 == "string" && e20.includes("@") ? Bm(e20) : e20;
}
__name(Vn, "Vn");
function Mm(e20) {
  return to[e20] >= to[$m()];
}
__name(Mm, "Mm");
function Dr(e20, t, r = {}) {
  if (!Mm(e20)) return;
  let s = Vn(r), n = { timestamp: (/* @__PURE__ */ new Date()).toISOString(), level: e20, service: "roomza-web", message: t, ...s }, i = JSON.stringify(n);
  if (e20 === "error" || e20 === "fatal") {
    console.error(i);
    return;
  }
  if (e20 === "warn") {
    console.warn(i);
    return;
  }
  console.info(i);
}
__name(Dr, "Dr");
var As = { debug: /* @__PURE__ */ __name((e20, t) => Dr("debug", e20, t), "debug"), info: /* @__PURE__ */ __name((e20, t) => Dr("info", e20, t), "info"), warn: /* @__PURE__ */ __name((e20, t) => Dr("warn", e20, t), "warn"), error: /* @__PURE__ */ __name((e20, t) => Dr("error", e20, t), "error"), fatal: /* @__PURE__ */ __name((e20, t) => Dr("fatal", e20, t), "fatal") };
var ri = Gs(_o());
var Rg = globalThis.crypto;
var Os = Rg.subtle;
var Cg = Object.defineProperty;
var Og = /* @__PURE__ */ __name((e20, t) => {
  for (var r in t) Cg(e20, r, { get: t[r], enumerable: true });
}, "Og");
var Ao = {};
Og(Ao, { UpstashError: /* @__PURE__ */ __name(() => er, "UpstashError"), UpstashJSONParseError: /* @__PURE__ */ __name(() => Xn, "UpstashJSONParseError"), UrlError: /* @__PURE__ */ __name(() => Ro, "UrlError") });
var er = class extends Error {
  static {
    __name(this, "er");
  }
  constructor(e20, t) {
    super(e20, t), this.name = "UpstashError";
  }
};
var Ro = class extends Error {
  static {
    __name(this, "Ro");
  }
  constructor(e20) {
    super(`Upstash Redis client was passed an invalid URL. You should pass a URL starting with https. Received: "${e20}". `), this.name = "UrlError";
  }
};
var Xn = class extends er {
  static {
    __name(this, "Xn");
  }
  constructor(e20, t) {
    let r = e20.length > 200 ? e20.slice(0, 200) + "..." : e20;
    super(`Unable to parse response body: ${r}`, t), this.name = "UpstashJSONParseError";
  }
};
function Co(e20) {
  let t = Array.isArray(e20) ? e20.map((r) => {
    try {
      return Co(r);
    } catch {
      return r;
    }
  }) : JSON.parse(e20);
  return typeof t == "number" && t.toString() !== e20 ? e20 : t;
}
__name(Co, "Co");
function Oo(e20) {
  try {
    return Co(e20);
  } catch {
    return e20;
  }
}
__name(Oo, "Oo");
function Ls(e20) {
  return [e20[0], ...Oo(e20.slice(1))];
}
__name(Ls, "Ls");
function Ig(e20) {
  let [t, r] = e20, s = [];
  for (let n = 0; n < r.length; n += 2) s.push({ key: r[n], type: r[n + 1] });
  return [t, s];
}
__name(Ig, "Ig");
function Pg(...e20) {
  let t = {};
  for (let r of e20) if (r) for (let [s, n] of Object.entries(r)) n != null && (t[s] = n);
  return t;
}
__name(Pg, "Pg");
function Br(e20) {
  if (typeof e20 == "object" && e20 !== null && !Array.isArray(e20)) return e20;
  if (!Array.isArray(e20)) return {};
  let t = {};
  for (let r = 0; r < e20.length; r += 2) typeof e20[r] == "string" && (t[e20[r]] = e20[r + 1]);
  return t;
}
__name(Br, "Br");
var Lg = 1024 * 1024;
var Io = class {
  static {
    __name(this, "Io");
  }
  baseUrl;
  headers;
  options;
  readYourWrites;
  upstashSyncToken = "";
  hasCredentials;
  retry;
  constructor(e20) {
    this.options = { backend: e20.options?.backend, agent: e20.agent, responseEncoding: e20.responseEncoding ?? "base64", cache: e20.cache, signal: e20.signal, keepAlive: e20.keepAlive ?? true }, this.upstashSyncToken = "", this.readYourWrites = e20.readYourWrites ?? true, this.baseUrl = (e20.baseUrl || "").replace(/\/$/, "");
    let t = /^https?:\/\/[^\s#$./?].\S*$/;
    if (this.baseUrl && !t.test(this.baseUrl)) throw new Ro(this.baseUrl);
    this.headers = { "Content-Type": "application/json", ...e20.headers }, this.hasCredentials = !!(this.baseUrl && this.headers.authorization.split(" ")[1]), this.options.responseEncoding === "base64" && (this.headers["Upstash-Encoding"] = "base64"), this.retry = typeof e20.retry == "boolean" && !e20.retry ? { attempts: 1, backoff: /* @__PURE__ */ __name(() => 0, "backoff") } : { attempts: e20.retry?.retries ?? 5, backoff: e20.retry?.backoff ?? ((r) => Math.exp(r) * 50) };
  }
  mergeTelemetry(e20) {
    this.headers = Jn(this.headers, "Upstash-Telemetry-Runtime", e20.runtime), this.headers = Jn(this.headers, "Upstash-Telemetry-Platform", e20.platform), this.headers = Jn(this.headers, "Upstash-Telemetry-Sdk", e20.sdk);
  }
  async request(e20) {
    let t = Pg(this.headers, e20.headers ?? {}), r = [this.baseUrl, ...e20.path ?? []].join("/"), s = t.Accept === "text/event-stream", n = e20.signal ?? this.options.signal, i = typeof n == "function", a = { cache: this.options.cache, method: "POST", headers: t, body: JSON.stringify(e20.body), keepalive: this.options.keepAlive, agent: this.options.agent, signal: i ? n() : n, backend: this.options.backend };
    if (this.hasCredentials || console.warn("[Upstash Redis] Redis client was initialized without url or token. Failed to execute command."), this.readYourWrites) {
      let d = this.upstashSyncToken;
      this.headers["upstash-sync-token"] = d;
    }
    let o = null, c = null;
    for (let d = 0; d <= this.retry.attempts; d++) try {
      o = await fetch(r, a);
      break;
    } catch (f) {
      if (a.signal?.aborted && i) throw f;
      if (a.signal?.aborted) {
        let p = new Blob([JSON.stringify({ result: a.signal.reason ?? "Aborted" })]), g = { status: 200, statusText: a.signal.reason ?? "Aborted" };
        o = new Response(p, g);
        break;
      }
      c = f, d < this.retry.attempts && await new Promise((p) => setTimeout(p, this.retry.backoff(d)));
    }
    if (!o) throw c ?? new Error("Exhausted all retries");
    if (!o.ok) {
      let d, f = await o.text();
      try {
        d = JSON.parse(f);
      } catch (p) {
        throw new Xn(f, { cause: p });
      }
      throw new er(`${d.error}, command was: ${JSON.stringify(e20.body)}`);
    }
    if (this.readYourWrites) {
      let d = o.headers;
      this.upstashSyncToken = d.get("upstash-sync-token") ?? "";
    }
    if (s && e20 && e20.onMessage && o.body) {
      let d = o.body.getReader(), f = new TextDecoder();
      return (async () => {
        try {
          let p = "";
          for (; ; ) {
            let { value: g, done: y } = await d.read();
            if (y) break;
            p += f.decode(g, { stream: true });
            let E = p.split(`
`);
            if (p = E.pop() || "", p.length > Lg) throw new Error("Buffer size exceeded (1MB)");
            for (let v of E) if (v.startsWith("data: ")) {
              let b = v.slice(6);
              e20.onMessage?.(b);
            }
          }
        } catch (p) {
          p instanceof Error && p.name === "AbortError" || console.error("Stream reading error:", p);
        } finally {
          try {
            await d.cancel();
          } catch {
          }
        }
      })(), { result: 1 };
    }
    let l, u = await o.text();
    try {
      l = JSON.parse(u);
    } catch (d) {
      throw new Xn(u, { cause: d });
    }
    if (this.readYourWrites) {
      let d = o.headers;
      this.upstashSyncToken = d.get("upstash-sync-token") ?? "";
    }
    return this.options.responseEncoding === "base64" ? Array.isArray(l) ? l.map(({ result: f, error: p }) => ({ result: Yn(f), error: p })) : { result: Yn(l.result), error: l.error } : l;
  }
};
function bo(e20) {
  let t = "";
  try {
    let r = atob(e20), s = r.length, n = new Uint8Array(s);
    for (let i = 0; i < s; i++) n[i] = r.charCodeAt(i);
    t = new TextDecoder().decode(n);
  } catch {
    t = e20;
  }
  return t;
}
__name(bo, "bo");
function Yn(e20) {
  let t;
  switch (typeof e20) {
    case "undefined":
      return e20;
    case "number": {
      t = e20;
      break;
    }
    case "object": {
      Array.isArray(e20) ? t = e20.map((r) => typeof r == "string" ? bo(r) : Array.isArray(r) ? r.map((s) => Yn(s)) : r) : t = null;
      break;
    }
    case "string": {
      t = e20 === "OK" ? "OK" : bo(e20);
      break;
    }
    default:
      break;
  }
  return t;
}
__name(Yn, "Yn");
function Jn(e20, t, r) {
  return r && (e20[t] = e20[t] ? [e20[t], r].join(",") : r), e20;
}
__name(Jn, "Jn");
var Ng = /* @__PURE__ */ __name((e20) => {
  switch (typeof e20) {
    case "string":
    case "number":
    case "boolean":
      return e20;
    default:
      return JSON.stringify(e20);
  }
}, "Ng");
var m = class {
  static {
    __name(this, "m");
  }
  command;
  serialize;
  deserialize;
  headers;
  path;
  onMessage;
  isStreaming;
  signal;
  constructor(e20, t) {
    if (this.serialize = Ng, this.deserialize = t?.automaticDeserialization === void 0 || t.automaticDeserialization ? t?.deserialize ?? Oo : (r) => r, this.command = e20.map((r) => this.serialize(r)), this.headers = t?.headers, this.path = t?.path, this.onMessage = t?.streamOptions?.onMessage, this.isStreaming = t?.streamOptions?.isStreaming ?? false, this.signal = t?.streamOptions?.signal, t?.latencyLogging) {
      let r = this.exec.bind(this);
      this.exec = async (s) => {
        let n = performance.now(), i = await r(s), o = (performance.now() - n).toFixed(2);
        return console.log(`Latency for \x1B[38;2;19;185;39m${this.command[0].toString().toUpperCase()}\x1B[0m: \x1B[38;2;0;255;255m${o} ms\x1B[0m`), i;
      };
    }
  }
  async exec(e20) {
    let { result: t, error: r } = await e20.request({ body: this.command, path: this.path, upstashSyncToken: e20.upstashSyncToken, headers: this.headers, onMessage: this.onMessage, isStreaming: this.isStreaming, signal: this.signal });
    if (r) throw new er(r);
    if (t === void 0) throw new TypeError("Request did not return a result");
    return this.deserialize(t);
  }
};
var ue = class extends m {
  static {
    __name(this, "ue");
  }
  constructor(e20, t) {
    let r = e20.map((s) => typeof s == "string" ? s : String(s));
    super(r, t);
  }
};
var jg = ["TEXT", "U64", "I64", "F64", "BOOL", "DATE", "KEYWORD", "FACET"];
function Po(e20) {
  return typeof e20 == "string" && jg.includes(e20);
}
__name(Po, "Po");
function Lo(e20) {
  return typeof e20 == "object" && e20 !== null && "type" in e20 && Po(e20.type);
}
__name(Lo, "Lo");
function Ug(e20) {
  return typeof e20 == "object" && e20 !== null && !Lo(e20);
}
__name(Ug, "Ug");
function No(e20, t = []) {
  let r = [];
  for (let [s, n] of Object.entries(e20)) {
    let i = [...t, s], a = i.join(".");
    if (Po(n)) r.push({ path: a, type: n });
    else if (Lo(n)) r.push({ path: a, type: n.type, fast: "fast" in n ? n.fast : void 0, noTokenize: "noTokenize" in n ? n.noTokenize : void 0, noStem: "noStem" in n ? n.noStem : void 0, from: "from" in n ? n.from : void 0 });
    else if (Ug(n)) {
      let o = No(n, i);
      r.push(...o);
    }
  }
  return r;
}
__name(No, "No");
function Dg(e20) {
  return e20.map((t) => {
    let r = t, s = r[0], n = Number(r[1]), i = r[2];
    if (i === void 0) return { key: s, score: n };
    if (!Array.isArray(i) || i.length === 0) return { key: s, score: n, data: {} };
    let a = {};
    for (let o of i) {
      let c = o[0], l = o[1], u = c.split(".");
      if (u.length === 1) a[c] = l;
      else {
        let d = a;
        for (let f = 0; f < u.length - 1; f++) {
          let p = u[f];
          p in d || (d[p] = {}), d = d[p];
        }
        d[u.at(-1)] = l;
      }
    }
    return "$" in a && (a = a.$), { key: s, score: n, data: a };
  });
}
__name(Dg, "Dg");
function $g(e20) {
  let t = {};
  for (let r = 0; r < e20.length; r += 2) switch (e20[r]) {
    case "name": {
      t.name = e20[r + 1];
      break;
    }
    case "type": {
      t.dataType = e20[r + 1].toLowerCase();
      break;
    }
    case "prefixes": {
      t.prefixes = e20[r + 1];
      break;
    }
    case "language": {
      t.language = e20[r + 1];
      break;
    }
    case "schema": {
      let n = {};
      for (let i of e20[r + 1]) {
        let a = i[0], o = { type: i[1] };
        if (i.length > 2) for (let c = 2; c < i.length; c++) switch (i[c]) {
          case "NOSTEM": {
            o.noStem = true;
            break;
          }
          case "NOTOKENIZE": {
            o.noTokenize = true;
            break;
          }
          case "FAST": {
            o.fast = true;
            break;
          }
          case "FROM": {
            o.from = i[++c];
            break;
          }
        }
        n[a] = o;
      }
      t.schema = n;
      break;
    }
  }
  return t;
}
__name($g, "$g");
function Bg(e20) {
  return typeof e20 == "number" ? e20 : Number.parseInt(e20, 10);
}
__name(Bg, "Bg");
function Mg(e20) {
  return jo(e20);
}
__name(Mg, "Mg");
function jo(e20) {
  let t = {};
  for (let r = 0; r < e20.length; r += 2) {
    let s = e20[r], n = e20[r + 1];
    Array.isArray(n) ? n.length > 0 && typeof n[0] == "string" ? t[s] = n[0] === "buckets" ? qg(n) : Is(n) : t[s] = jo(n) : t[s] = n;
  }
  return t;
}
__name(jo, "jo");
function Fg(e20) {
  return typeof e20 == "string" && e20 !== "" && !Number.isNaN(Number(e20)) ? Number(e20) : e20;
}
__name(Fg, "Fg");
function Is(e20) {
  let t = {};
  for (let r = 0; r < e20.length; r += 2) {
    let s = e20[r], n = e20[r + 1];
    Array.isArray(n) && n.length > 0 ? typeof n[0] == "string" ? t[s] = Is(n) : Array.isArray(n[0]) && typeof n[0][0] == "string" ? t[s] = n.map((i) => Is(i)) : t[s] = n : t[s] = Fg(n);
  }
  return t;
}
__name(Is, "Is");
function qg(e20) {
  if (e20[0] === "buckets" && Array.isArray(e20[1])) {
    let t = { buckets: e20[1].map((r) => {
      let s = {};
      for (let n = 0; n < r.length; n += 2) {
        let i = r[n], a = r[n + 1];
        s[i] = Array.isArray(a) && a.length > 0 && typeof a[0] == "string" ? Is(a) : a;
      }
      return s;
    }) };
    for (let r = 2; r < e20.length; r += 2) t[e20[r]] = e20[r + 1];
    return t;
  }
  return e20;
}
__name(qg, "qg");
function xo(e20, t, r) {
  let s = JSON.stringify(r?.filter ?? {}), n = [e20, t, s];
  if (r?.limit !== void 0 && n.push("LIMIT", r.limit.toString()), r?.offset !== void 0 && n.push("OFFSET", r.offset.toString()), r?.select && Object.keys(r.select).length === 0 && n.push("NOCONTENT"), r) if ("orderBy" in r && r.orderBy) {
    n.push("ORDERBY");
    for (let [i, a] of Object.entries(r.orderBy)) n.push(i, a);
  } else "scoreFunc" in r && r.scoreFunc && n.push("SCOREFUNC", ...zg(r.scoreFunc));
  return r?.highlight && (n.push("HIGHLIGHT", "FIELDS", r.highlight.fields.length.toString(), ...r.highlight.fields), r.highlight.preTag && r.highlight.postTag && n.push("TAGS", r.highlight.preTag, r.highlight.postTag)), r?.select && Object.keys(r.select).length > 0 && n.push("SELECT", Object.keys(r.select).length.toString(), ...Object.keys(r.select)), n;
}
__name(xo, "xo");
function zg(e20) {
  let t = [];
  if (typeof e20 == "string") t.push("FIELDVALUE", e20);
  else if ("fields" in e20) {
    e20.combineMode && t.push("COMBINEMODE", e20.combineMode.toUpperCase()), e20.scoreMode && t.push("SCOREMODE", e20.scoreMode.toUpperCase());
    for (let r of e20.fields) t.push(...So(r));
  } else t.push(...So(e20));
  return t;
}
__name(zg, "zg");
function So(e20) {
  let t = [];
  return typeof e20 == "string" ? t.push("FIELDVALUE", e20) : (e20.scoreMode && t.push("SCOREMODE", e20.scoreMode.toUpperCase()), t.push("FIELDVALUE", e20.field), e20.modifier && t.push("MODIFIER", e20.modifier.toUpperCase()), e20.factor !== void 0 && t.push("FACTOR", e20.factor.toString()), e20.missing !== void 0 && t.push("MISSING", e20.missing.toString())), t;
}
__name(So, "So");
function Vg(e20) {
  let { name: t, schema: r, dataType: s, prefix: n, language: i, skipInitialScan: a, existsOk: o } = e20, c = Array.isArray(n) ? n : [n], l = [t, ...a ? ["SKIPINITIALSCAN"] : [], ...o ? ["EXISTSOK"] : [], "ON", s.toUpperCase(), "PREFIX", c.length.toString(), ...c, ...i ? ["LANGUAGE", i] : [], "SCHEMA"], u = No(r);
  for (let d of u) l.push(d.path, d.type), d.fast && l.push("FAST"), d.noTokenize && l.push("NOTOKENIZE"), d.noStem && l.push("NOSTEM"), d.from && l.push("FROM", d.from);
  return ["SEARCH.CREATE", ...l];
}
__name(Vg, "Vg");
function Hg(e20, t) {
  let r = JSON.stringify(t?.filter ?? {}), s = JSON.stringify(t.aggregations);
  return ["SEARCH.AGGREGATE", e20, r, s];
}
__name(Hg, "Hg");
var Uo = class {
  static {
    __name(this, "Uo");
  }
  name;
  schema;
  client;
  constructor({ name: e20, schema: t, client: r }) {
    this.name = e20, this.schema = t, this.client = r;
  }
  async waitIndexing() {
    let e20 = ["SEARCH.WAITINDEXING", this.name];
    return await new ue(e20).exec(this.client);
  }
  async describe() {
    let e20 = ["SEARCH.DESCRIBE", this.name], t = await new ue(e20).exec(this.client);
    return t ? $g(t) : null;
  }
  async query(e20) {
    let t = xo("SEARCH.QUERY", this.name, e20), r = await new ue(t).exec(this.client);
    return r && Dg(r);
  }
  async aggregate(e20) {
    let t = Hg(this.name, e20), r = await new ue(t).exec(this.client);
    return Mg(r);
  }
  async count({ filter: e20 }) {
    let t = xo("SEARCH.COUNT", this.name, { filter: e20 }), r = await new ue(t).exec(this.client);
    return { count: Bg(r) };
  }
  async drop() {
    let e20 = ["SEARCH.DROP", this.name];
    return await new ue(e20).exec(this.client);
  }
  async addAlias({ alias: e20 }) {
    let t = ["SEARCH.ALIASADD", e20, this.name];
    return await new ue(t).exec(this.client);
  }
};
async function Kg(e20, t) {
  let { name: r, schema: s } = t, n = Vg(t);
  return await new ue(n).exec(e20), Do(e20, { name: r, schema: s });
}
__name(Kg, "Kg");
function Do(e20, t) {
  let { name: r, schema: s } = t;
  return new Uo({ name: r, schema: s, client: e20 });
}
__name(Do, "Do");
async function Wg(e20) {
  let t = ["SEARCH.LISTALIASES"], r = await new ue(t).exec(e20);
  if (r === 0 || Array.isArray(r) && r.length === 0) return {};
  if (!Array.isArray(r)) return {};
  let s = {};
  for (let n of r) if (Array.isArray(n) && n.length === 2) {
    let [i, a] = n;
    s[i] = a;
  }
  return s;
}
__name(Wg, "Wg");
async function Gg(e20, { indexName: t, alias: r }) {
  let s = ["SEARCH.ALIASADD", r, t];
  return await new ue(s).exec(e20);
}
__name(Gg, "Gg");
async function Jg(e20, { alias: t }) {
  let r = ["SEARCH.ALIASDEL", t];
  return await new ue(r).exec(e20);
}
__name(Jg, "Jg");
function Xg(e20) {
  if (e20.length === 0) return null;
  let t = {};
  for (let r = 0; r < e20.length; r += 2) {
    let s = e20[r], n = e20[r + 1];
    try {
      t[s] = JSON.parse(n);
    } catch {
      t[s] = n;
    }
  }
  return t;
}
__name(Xg, "Xg");
var $o = class extends m {
  static {
    __name(this, "$o");
  }
  constructor(e20, t) {
    let r = ["hrandfield", e20[0]];
    typeof e20[1] == "number" && r.push(e20[1]), e20[2] && r.push("WITHVALUES"), super(r, { deserialize: e20[2] ? (s) => Xg(s) : t?.deserialize, ...t });
  }
};
var Bo = class extends m {
  static {
    __name(this, "Bo");
  }
  constructor(e20, t) {
    super(["append", ...e20], t);
  }
};
var Mo = class extends m {
  static {
    __name(this, "Mo");
  }
  constructor([e20, t, r], s) {
    let n = ["bitcount", e20];
    typeof t == "number" && n.push(t), typeof r == "number" && n.push(r), super(n, s);
  }
};
var Fo = class {
  static {
    __name(this, "Fo");
  }
  constructor(e20, t, r, s = (n) => n.exec(this.client)) {
    this.client = t, this.opts = r, this.execOperation = s, this.command = ["bitfield", ...e20];
  }
  command;
  chain(...e20) {
    return this.command.push(...e20), this;
  }
  get(...e20) {
    return this.chain("get", ...e20);
  }
  set(...e20) {
    return this.chain("set", ...e20);
  }
  incrby(...e20) {
    return this.chain("incrby", ...e20);
  }
  overflow(e20) {
    return this.chain("overflow", e20);
  }
  exec() {
    let e20 = new m(this.command, this.opts);
    return this.execOperation(e20);
  }
};
var qo = class extends m {
  static {
    __name(this, "qo");
  }
  constructor(e20, t) {
    super(["bitop", ...e20], t);
  }
};
var zo = class extends m {
  static {
    __name(this, "zo");
  }
  constructor(e20, t) {
    super(["bitpos", ...e20], t);
  }
};
var Vo = class extends m {
  static {
    __name(this, "Vo");
  }
  constructor([e20, t], r) {
    super(["CLIENT", "SETINFO", e20.toUpperCase(), t], r);
  }
};
var Ho = class extends m {
  static {
    __name(this, "Ho");
  }
  constructor([e20, t, r], s) {
    super(["COPY", e20, t, ...r?.replace ? ["REPLACE"] : []], { ...s, deserialize(n) {
      return n > 0 ? "COPIED" : "NOT_COPIED";
    } });
  }
};
var Ko = class extends m {
  static {
    __name(this, "Ko");
  }
  constructor(e20) {
    super(["dbsize"], e20);
  }
};
var Wo = class extends m {
  static {
    __name(this, "Wo");
  }
  constructor(e20, t) {
    super(["decr", ...e20], t);
  }
};
var Go = class extends m {
  static {
    __name(this, "Go");
  }
  constructor(e20, t) {
    super(["decrby", ...e20], t);
  }
};
var Jo = class extends m {
  static {
    __name(this, "Jo");
  }
  constructor(e20, t) {
    super(["del", ...e20], t);
  }
};
var Xo = class extends m {
  static {
    __name(this, "Xo");
  }
  constructor(e20, t) {
    super(["echo", ...e20], t);
  }
};
var Yo = class extends m {
  static {
    __name(this, "Yo");
  }
  constructor([e20, t, r], s) {
    super(["eval_ro", e20, t.length, ...t, ...r ?? []], s);
  }
};
var Zo = class extends m {
  static {
    __name(this, "Zo");
  }
  constructor([e20, t, r], s) {
    super(["eval", e20, t.length, ...t, ...r ?? []], s);
  }
};
var Qo = class extends m {
  static {
    __name(this, "Qo");
  }
  constructor([e20, t, r], s) {
    super(["evalsha_ro", e20, t.length, ...t, ...r ?? []], s);
  }
};
var ec = class extends m {
  static {
    __name(this, "ec");
  }
  constructor([e20, t, r], s) {
    super(["evalsha", e20, t.length, ...t, ...r ?? []], s);
  }
};
var tc = class extends m {
  static {
    __name(this, "tc");
  }
  constructor(e20, t) {
    super(["exists", ...e20], t);
  }
};
var rc = class extends m {
  static {
    __name(this, "rc");
  }
  constructor(e20, t) {
    super(["expire", ...e20.filter(Boolean)], t);
  }
};
var sc = class extends m {
  static {
    __name(this, "sc");
  }
  constructor(e20, t) {
    super(["expireat", ...e20], t);
  }
};
var nc = class extends m {
  static {
    __name(this, "nc");
  }
  constructor([e20, t, r], s) {
    super(["fcall", e20, ...t ? [t.length, ...t] : [0], ...r ?? []], s);
  }
};
var ic = class extends m {
  static {
    __name(this, "ic");
  }
  constructor([e20, t, r], s) {
    super(["fcall_ro", e20, ...t ? [t.length, ...t] : [0], ...r ?? []], s);
  }
};
var ac = class extends m {
  static {
    __name(this, "ac");
  }
  constructor(e20, t) {
    let r = ["flushall"];
    e20 && e20.length > 0 && e20[0].async && r.push("async"), super(r, t);
  }
};
var oc = class extends m {
  static {
    __name(this, "oc");
  }
  constructor([e20], t) {
    let r = ["flushdb"];
    e20?.async && r.push("async"), super(r, t);
  }
};
var cc = class extends m {
  static {
    __name(this, "cc");
  }
  constructor([e20], t) {
    super(["function", "delete", e20], t);
  }
};
var lc = class extends m {
  static {
    __name(this, "lc");
  }
  constructor(e20) {
    super(["function", "flush"], e20);
  }
};
var uc = class extends m {
  static {
    __name(this, "uc");
  }
  constructor([e20], t) {
    let r = ["function", "list"];
    e20?.libraryName && r.push("libraryname", e20.libraryName), e20?.withCode && r.push("withcode"), super(r, { deserialize: Yg, ...t });
  }
};
function Yg(e20) {
  return Array.isArray(e20) ? e20.map((t) => {
    let r = Br(t), s = r.functions.map((n) => Br(n));
    return { libraryName: r.library_name, engine: r.engine, functions: s.map((n) => ({ name: n.name, description: n.description ?? void 0, flags: n.flags })), libraryCode: r.library_code };
  }) : [];
}
__name(Yg, "Yg");
var dc = class extends m {
  static {
    __name(this, "dc");
  }
  constructor([e20], t) {
    super(["function", "load", ...e20.replace ? ["replace"] : [], e20.code], t);
  }
};
var hc = class extends m {
  static {
    __name(this, "hc");
  }
  constructor(e20) {
    super(["function", "stats"], { deserialize: Zg, ...e20 });
  }
};
function Zg(e20) {
  let t = Br(Br(e20).engines), r = Object.fromEntries(Object.entries(t).map(([n, i]) => [n, Br(i)]));
  return { engines: Object.fromEntries(Object.entries(r).map(([n, i]) => [n, { librariesCount: i.libraries_count, functionsCount: i.functions_count }])) };
}
__name(Zg, "Zg");
var pc = class extends m {
  static {
    __name(this, "pc");
  }
  constructor([e20, t, ...r], s) {
    let n = ["geoadd", e20];
    "nx" in t && t.nx ? n.push("nx") : "xx" in t && t.xx && n.push("xx"), "ch" in t && t.ch && n.push("ch"), "latitude" in t && t.latitude && n.push(t.longitude, t.latitude, t.member), n.push(...r.flatMap(({ latitude: i, longitude: a, member: o }) => [a, i, o])), super(n, s);
  }
};
var fc = class extends m {
  static {
    __name(this, "fc");
  }
  constructor([e20, t, r, s = "M"], n) {
    super(["GEODIST", e20, t, r, s], n);
  }
};
var mc = class extends m {
  static {
    __name(this, "mc");
  }
  constructor(e20, t) {
    let [r] = e20, s = Array.isArray(e20[1]) ? e20[1] : e20.slice(1);
    super(["GEOHASH", r, ...s], t);
  }
};
var gc = class extends m {
  static {
    __name(this, "gc");
  }
  constructor(e20, t) {
    let [r] = e20, s = Array.isArray(e20[1]) ? e20[1] : e20.slice(1);
    super(["GEOPOS", r, ...s], { deserialize: /* @__PURE__ */ __name((n) => Qg(n), "deserialize"), ...t });
  }
};
function Qg(e20) {
  let t = [];
  for (let r of e20) !r?.[0] || !r?.[1] || t.push({ lng: Number.parseFloat(r[0]), lat: Number.parseFloat(r[1]) });
  return t;
}
__name(Qg, "Qg");
var yc = class extends m {
  static {
    __name(this, "yc");
  }
  constructor([e20, t, r, s, n], i) {
    let a = ["GEOSEARCH", e20];
    (t.type === "FROMMEMBER" || t.type === "frommember") && a.push(t.type, t.member), (t.type === "FROMLONLAT" || t.type === "fromlonlat") && a.push(t.type, t.coordinate.lon, t.coordinate.lat), (r.type === "BYRADIUS" || r.type === "byradius") && a.push(r.type, r.radius, r.radiusType), (r.type === "BYBOX" || r.type === "bybox") && a.push(r.type, r.rect.width, r.rect.height, r.rectType), a.push(s), n?.count && a.push("COUNT", n.count.limit, ...n.count.any ? ["ANY"] : []);
    let o = /* @__PURE__ */ __name((c) => !n?.withCoord && !n?.withDist && !n?.withHash ? c.map((l) => {
      try {
        return { member: JSON.parse(l) };
      } catch {
        return { member: l };
      }
    }) : c.map((l) => {
      let u = 1, d = {};
      try {
        d.member = JSON.parse(l[0]);
      } catch {
        d.member = l[0];
      }
      return n.withDist && (d.dist = Number.parseFloat(l[u++])), n.withHash && (d.hash = l[u++].toString()), n.withCoord && (d.coord = { long: Number.parseFloat(l[u][0]), lat: Number.parseFloat(l[u][1]) }), d;
    }), "o");
    super([...a, ...n?.withCoord ? ["WITHCOORD"] : [], ...n?.withDist ? ["WITHDIST"] : [], ...n?.withHash ? ["WITHHASH"] : []], { deserialize: o, ...i });
  }
};
var wc = class extends m {
  static {
    __name(this, "wc");
  }
  constructor([e20, t, r, s, n, i], a) {
    let o = ["GEOSEARCHSTORE", e20, t];
    (r.type === "FROMMEMBER" || r.type === "frommember") && o.push(r.type, r.member), (r.type === "FROMLONLAT" || r.type === "fromlonlat") && o.push(r.type, r.coordinate.lon, r.coordinate.lat), (s.type === "BYRADIUS" || s.type === "byradius") && o.push(s.type, s.radius, s.radiusType), (s.type === "BYBOX" || s.type === "bybox") && o.push(s.type, s.rect.width, s.rect.height, s.rectType), o.push(n), i?.count && o.push("COUNT", i.count.limit, ...i.count.any ? ["ANY"] : []), super([...o, ...i?.storeDist ? ["STOREDIST"] : []], a);
  }
};
var vc = class extends m {
  static {
    __name(this, "vc");
  }
  constructor(e20, t) {
    super(["get", ...e20], t);
  }
};
var _c = class extends m {
  static {
    __name(this, "_c");
  }
  constructor(e20, t) {
    super(["getbit", ...e20], t);
  }
};
var bc = class extends m {
  static {
    __name(this, "bc");
  }
  constructor(e20, t) {
    super(["getdel", ...e20], t);
  }
};
var xc = class extends m {
  static {
    __name(this, "xc");
  }
  constructor([e20, t], r) {
    let s = ["getex", e20];
    t && ("ex" in t && typeof t.ex == "number" ? s.push("ex", t.ex) : "px" in t && typeof t.px == "number" ? s.push("px", t.px) : "exat" in t && typeof t.exat == "number" ? s.push("exat", t.exat) : "pxat" in t && typeof t.pxat == "number" ? s.push("pxat", t.pxat) : "persist" in t && t.persist && s.push("persist")), super(s, r);
  }
};
var Sc = class extends m {
  static {
    __name(this, "Sc");
  }
  constructor(e20, t) {
    super(["getrange", ...e20], t);
  }
};
var Ec = class extends m {
  static {
    __name(this, "Ec");
  }
  constructor(e20, t) {
    super(["getset", ...e20], t);
  }
};
var kc = class extends m {
  static {
    __name(this, "kc");
  }
  constructor(e20, t) {
    super(["hdel", ...e20], t);
  }
};
var Tc = class extends m {
  static {
    __name(this, "Tc");
  }
  constructor(e20, t) {
    super(["hexists", ...e20], t);
  }
};
var Ac = class extends m {
  static {
    __name(this, "Ac");
  }
  constructor(e20, t) {
    let [r, s, n, i] = e20, a = Array.isArray(s) ? s : [s];
    super(["hexpire", r, n, ...i ? [i] : [], "FIELDS", a.length, ...a], t);
  }
};
var Rc = class extends m {
  static {
    __name(this, "Rc");
  }
  constructor(e20, t) {
    let [r, s, n, i] = e20, a = Array.isArray(s) ? s : [s];
    super(["hexpireat", r, n, ...i ? [i] : [], "FIELDS", a.length, ...a], t);
  }
};
var Cc = class extends m {
  static {
    __name(this, "Cc");
  }
  constructor(e20, t) {
    let [r, s] = e20, n = Array.isArray(s) ? s : [s];
    super(["hexpiretime", r, "FIELDS", n.length, ...n], t);
  }
};
var Oc = class extends m {
  static {
    __name(this, "Oc");
  }
  constructor(e20, t) {
    let [r, s] = e20, n = Array.isArray(s) ? s : [s];
    super(["hpersist", r, "FIELDS", n.length, ...n], t);
  }
};
var Ic = class extends m {
  static {
    __name(this, "Ic");
  }
  constructor(e20, t) {
    let [r, s, n, i] = e20, a = Array.isArray(s) ? s : [s];
    super(["hpexpire", r, n, ...i ? [i] : [], "FIELDS", a.length, ...a], t);
  }
};
var Pc = class extends m {
  static {
    __name(this, "Pc");
  }
  constructor(e20, t) {
    let [r, s, n, i] = e20, a = Array.isArray(s) ? s : [s];
    super(["hpexpireat", r, n, ...i ? [i] : [], "FIELDS", a.length, ...a], t);
  }
};
var Lc = class extends m {
  static {
    __name(this, "Lc");
  }
  constructor(e20, t) {
    let [r, s] = e20, n = Array.isArray(s) ? s : [s];
    super(["hpexpiretime", r, "FIELDS", n.length, ...n], t);
  }
};
var Nc = class extends m {
  static {
    __name(this, "Nc");
  }
  constructor(e20, t) {
    let [r, s] = e20, n = Array.isArray(s) ? s : [s];
    super(["hpttl", r, "FIELDS", n.length, ...n], t);
  }
};
var jc = class extends m {
  static {
    __name(this, "jc");
  }
  constructor(e20, t) {
    super(["hget", ...e20], t);
  }
};
function ey(e20) {
  if (e20.length === 0) return null;
  let t = {};
  for (let r = 0; r < e20.length; r += 2) {
    let s = e20[r], n = e20[r + 1];
    try {
      let i = !Number.isNaN(Number(n)) && !Number.isSafeInteger(Number(n));
      t[s] = i ? n : JSON.parse(n);
    } catch {
      t[s] = n;
    }
  }
  return t;
}
__name(ey, "ey");
var Uc = class extends m {
  static {
    __name(this, "Uc");
  }
  constructor(e20, t) {
    super(["hgetall", ...e20], { deserialize: /* @__PURE__ */ __name((r) => ey(r), "deserialize"), ...t });
  }
};
function Qn(e20, t) {
  if (t.every((s) => s === null)) return null;
  let r = {};
  for (let [s, n] of e20.entries()) try {
    r[n] = JSON.parse(t[s]);
  } catch {
    r[n] = t[s];
  }
  return r;
}
__name(Qn, "Qn");
var Dc = class extends m {
  static {
    __name(this, "Dc");
  }
  constructor([e20, ...t], r) {
    super(["hmget", e20, ...t], { deserialize: /* @__PURE__ */ __name((s) => Qn(t, s), "deserialize"), ...r });
  }
};
var $c = class extends m {
  static {
    __name(this, "$c");
  }
  constructor([e20, ...t], r) {
    super(["hgetdel", e20, "FIELDS", t.length, ...t], { deserialize: /* @__PURE__ */ __name((s) => Qn(t.map(String), s), "deserialize"), ...r });
  }
};
var Bc = class extends m {
  static {
    __name(this, "Bc");
  }
  constructor([e20, t, ...r], s) {
    let n = ["hgetex", e20];
    "ex" in t && typeof t.ex == "number" ? n.push("EX", t.ex) : "px" in t && typeof t.px == "number" ? n.push("PX", t.px) : "exat" in t && typeof t.exat == "number" ? n.push("EXAT", t.exat) : "pxat" in t && typeof t.pxat == "number" ? n.push("PXAT", t.pxat) : "persist" in t && t.persist && n.push("PERSIST"), n.push("FIELDS", r.length, ...r), super(n, { deserialize: /* @__PURE__ */ __name((i) => Qn(r.map(String), i), "deserialize"), ...s });
  }
};
var Mc = class extends m {
  static {
    __name(this, "Mc");
  }
  constructor(e20, t) {
    super(["hincrby", ...e20], t);
  }
};
var Fc = class extends m {
  static {
    __name(this, "Fc");
  }
  constructor(e20, t) {
    super(["hincrbyfloat", ...e20], t);
  }
};
var qc = class extends m {
  static {
    __name(this, "qc");
  }
  constructor([e20], t) {
    super(["hkeys", e20], t);
  }
};
var zc = class extends m {
  static {
    __name(this, "zc");
  }
  constructor(e20, t) {
    super(["hlen", ...e20], t);
  }
};
var Vc = class extends m {
  static {
    __name(this, "Vc");
  }
  constructor([e20, t], r) {
    super(["hmset", e20, ...Object.entries(t).flatMap(([s, n]) => [s, n])], r);
  }
};
var Hc = class extends m {
  static {
    __name(this, "Hc");
  }
  constructor([e20, t, r], s) {
    let n = ["hscan", e20, t];
    r?.match && n.push("match", r.match), typeof r?.count == "number" && n.push("count", r.count), super(n, { deserialize: Ls, ...s });
  }
};
var Kc = class extends m {
  static {
    __name(this, "Kc");
  }
  constructor([e20, t], r) {
    super(["hset", e20, ...Object.entries(t).flatMap(([s, n]) => [s, n])], r);
  }
};
var Wc = class extends m {
  static {
    __name(this, "Wc");
  }
  constructor([e20, t, r], s) {
    let n = ["hsetex", e20];
    t.conditional && n.push(t.conditional.toUpperCase()), t.expiration && ("ex" in t.expiration && typeof t.expiration.ex == "number" ? n.push("EX", t.expiration.ex) : "px" in t.expiration && typeof t.expiration.px == "number" ? n.push("PX", t.expiration.px) : "exat" in t.expiration && typeof t.expiration.exat == "number" ? n.push("EXAT", t.expiration.exat) : "pxat" in t.expiration && typeof t.expiration.pxat == "number" ? n.push("PXAT", t.expiration.pxat) : "keepttl" in t.expiration && t.expiration.keepttl && n.push("KEEPTTL"));
    let i = Object.entries(r);
    n.push("FIELDS", i.length);
    for (let [a, o] of i) n.push(a, o);
    super(n, s);
  }
};
var Gc = class extends m {
  static {
    __name(this, "Gc");
  }
  constructor(e20, t) {
    super(["hsetnx", ...e20], t);
  }
};
var Jc = class extends m {
  static {
    __name(this, "Jc");
  }
  constructor(e20, t) {
    super(["hstrlen", ...e20], t);
  }
};
var Xc = class extends m {
  static {
    __name(this, "Xc");
  }
  constructor(e20, t) {
    let [r, s] = e20, n = Array.isArray(s) ? s : [s];
    super(["httl", r, "FIELDS", n.length, ...n], t);
  }
};
var Yc = class extends m {
  static {
    __name(this, "Yc");
  }
  constructor(e20, t) {
    super(["hvals", ...e20], t);
  }
};
var Zc = class extends m {
  static {
    __name(this, "Zc");
  }
  constructor(e20, t) {
    super(["incr", ...e20], t);
  }
};
var Qc = class extends m {
  static {
    __name(this, "Qc");
  }
  constructor(e20, t) {
    super(["incrby", ...e20], t);
  }
};
var el = class extends m {
  static {
    __name(this, "el");
  }
  constructor(e20, t) {
    super(["incrbyfloat", ...e20], t);
  }
};
var tl = class extends m {
  static {
    __name(this, "tl");
  }
  constructor(e20, t) {
    super(["JSON.ARRAPPEND", ...e20], t);
  }
};
var rl = class extends m {
  static {
    __name(this, "rl");
  }
  constructor(e20, t) {
    super(["JSON.ARRINDEX", ...e20], t);
  }
};
var sl = class extends m {
  static {
    __name(this, "sl");
  }
  constructor(e20, t) {
    super(["JSON.ARRINSERT", ...e20], t);
  }
};
var nl = class extends m {
  static {
    __name(this, "nl");
  }
  constructor(e20, t) {
    super(["JSON.ARRLEN", e20[0], e20[1] ?? "$"], t);
  }
};
var il = class extends m {
  static {
    __name(this, "il");
  }
  constructor(e20, t) {
    super(["JSON.ARRPOP", ...e20], t);
  }
};
var al = class extends m {
  static {
    __name(this, "al");
  }
  constructor(e20, t) {
    let r = e20[1] ?? "$", s = e20[2] ?? 0, n = e20[3] ?? 0;
    super(["JSON.ARRTRIM", e20[0], r, s, n], t);
  }
};
var ol = class extends m {
  static {
    __name(this, "ol");
  }
  constructor(e20, t) {
    super(["JSON.CLEAR", ...e20], t);
  }
};
var cl = class extends m {
  static {
    __name(this, "cl");
  }
  constructor(e20, t) {
    super(["JSON.DEL", ...e20], t);
  }
};
var ll = class extends m {
  static {
    __name(this, "ll");
  }
  constructor(e20, t) {
    super(["JSON.FORGET", ...e20], t);
  }
};
var ul = class extends m {
  static {
    __name(this, "ul");
  }
  constructor(e20, t) {
    let r = ["JSON.GET"];
    typeof e20[1] == "string" ? r.push(...e20) : (r.push(e20[0]), e20[1] && (e20[1].indent && r.push("INDENT", e20[1].indent), e20[1].newline && r.push("NEWLINE", e20[1].newline), e20[1].space && r.push("SPACE", e20[1].space)), r.push(...e20.slice(2))), super(r, t);
  }
};
var dl = class extends m {
  static {
    __name(this, "dl");
  }
  constructor(e20, t) {
    let r = ["JSON.MERGE", ...e20];
    super(r, t);
  }
};
var hl = class extends m {
  static {
    __name(this, "hl");
  }
  constructor(e20, t) {
    super(["JSON.MGET", ...e20[0], e20[1]], t);
  }
};
var pl = class extends m {
  static {
    __name(this, "pl");
  }
  constructor(e20, t) {
    let r = ["JSON.MSET"];
    for (let s of e20) r.push(s.key, s.path, s.value);
    super(r, t);
  }
};
var fl = class extends m {
  static {
    __name(this, "fl");
  }
  constructor(e20, t) {
    super(["JSON.NUMINCRBY", ...e20], t);
  }
};
var ml = class extends m {
  static {
    __name(this, "ml");
  }
  constructor(e20, t) {
    super(["JSON.NUMMULTBY", ...e20], t);
  }
};
var gl = class extends m {
  static {
    __name(this, "gl");
  }
  constructor(e20, t) {
    super(["JSON.OBJKEYS", ...e20], t);
  }
};
var yl = class extends m {
  static {
    __name(this, "yl");
  }
  constructor(e20, t) {
    super(["JSON.OBJLEN", ...e20], t);
  }
};
var wl = class extends m {
  static {
    __name(this, "wl");
  }
  constructor(e20, t) {
    super(["JSON.RESP", ...e20], t);
  }
};
var vl = class extends m {
  static {
    __name(this, "vl");
  }
  constructor(e20, t) {
    let r = ["JSON.SET", e20[0], e20[1], e20[2]];
    e20[3] && (e20[3].nx ? r.push("NX") : e20[3].xx && r.push("XX")), super(r, t);
  }
};
var _l = class extends m {
  static {
    __name(this, "_l");
  }
  constructor(e20, t) {
    super(["JSON.STRAPPEND", ...e20], t);
  }
};
var bl = class extends m {
  static {
    __name(this, "bl");
  }
  constructor(e20, t) {
    super(["JSON.STRLEN", ...e20], t);
  }
};
var xl = class extends m {
  static {
    __name(this, "xl");
  }
  constructor(e20, t) {
    super(["JSON.TOGGLE", ...e20], t);
  }
};
var Sl = class extends m {
  static {
    __name(this, "Sl");
  }
  constructor(e20, t) {
    super(["JSON.TYPE", ...e20], t);
  }
};
var El = class extends m {
  static {
    __name(this, "El");
  }
  constructor(e20, t) {
    super(["keys", ...e20], t);
  }
};
var kl = class extends m {
  static {
    __name(this, "kl");
  }
  constructor(e20, t) {
    super(["lindex", ...e20], t);
  }
};
var Tl = class extends m {
  static {
    __name(this, "Tl");
  }
  constructor(e20, t) {
    super(["linsert", ...e20], t);
  }
};
var Al = class extends m {
  static {
    __name(this, "Al");
  }
  constructor(e20, t) {
    super(["llen", ...e20], t);
  }
};
var Rl = class extends m {
  static {
    __name(this, "Rl");
  }
  constructor(e20, t) {
    super(["lmove", ...e20], t);
  }
};
var Cl = class extends m {
  static {
    __name(this, "Cl");
  }
  constructor(e20, t) {
    let [r, s, n, i] = e20;
    super(["LMPOP", r, ...s, n, ...i ? ["COUNT", i] : []], t);
  }
};
var Ol = class extends m {
  static {
    __name(this, "Ol");
  }
  constructor(e20, t) {
    super(["lpop", ...e20], t);
  }
};
var Il = class extends m {
  static {
    __name(this, "Il");
  }
  constructor(e20, t) {
    let r = ["lpos", e20[0], e20[1]];
    typeof e20[2]?.rank == "number" && r.push("rank", e20[2].rank), typeof e20[2]?.count == "number" && r.push("count", e20[2].count), typeof e20[2]?.maxLen == "number" && r.push("maxLen", e20[2].maxLen), super(r, t);
  }
};
var Pl = class extends m {
  static {
    __name(this, "Pl");
  }
  constructor(e20, t) {
    super(["lpush", ...e20], t);
  }
};
var Ll = class extends m {
  static {
    __name(this, "Ll");
  }
  constructor(e20, t) {
    super(["lpushx", ...e20], t);
  }
};
var Nl = class extends m {
  static {
    __name(this, "Nl");
  }
  constructor(e20, t) {
    super(["lrange", ...e20], t);
  }
};
var jl = class extends m {
  static {
    __name(this, "jl");
  }
  constructor(e20, t) {
    super(["lrem", ...e20], t);
  }
};
var Ul = class extends m {
  static {
    __name(this, "Ul");
  }
  constructor(e20, t) {
    super(["lset", ...e20], t);
  }
};
var Dl = class extends m {
  static {
    __name(this, "Dl");
  }
  constructor(e20, t) {
    super(["ltrim", ...e20], t);
  }
};
var $l = class extends m {
  static {
    __name(this, "$l");
  }
  constructor(e20, t) {
    let r = Array.isArray(e20[0]) ? e20[0] : e20;
    super(["mget", ...r], t);
  }
};
var Bl = class extends m {
  static {
    __name(this, "Bl");
  }
  constructor([e20], t) {
    super(["mset", ...Object.entries(e20).flatMap(([r, s]) => [r, s])], t);
  }
};
var Ml = class extends m {
  static {
    __name(this, "Ml");
  }
  constructor([e20], t) {
    super(["msetnx", ...Object.entries(e20).flat()], t);
  }
};
var Fl = class extends m {
  static {
    __name(this, "Fl");
  }
  constructor(e20, t) {
    super(["persist", ...e20], t);
  }
};
var ql = class extends m {
  static {
    __name(this, "ql");
  }
  constructor(e20, t) {
    super(["pexpire", ...e20], t);
  }
};
var zl = class extends m {
  static {
    __name(this, "zl");
  }
  constructor(e20, t) {
    super(["pexpireat", ...e20], t);
  }
};
var Vl = class extends m {
  static {
    __name(this, "Vl");
  }
  constructor(e20, t) {
    super(["pfadd", ...e20], t);
  }
};
var Hl = class extends m {
  static {
    __name(this, "Hl");
  }
  constructor(e20, t) {
    super(["pfcount", ...e20], t);
  }
};
var Kl = class extends m {
  static {
    __name(this, "Kl");
  }
  constructor(e20, t) {
    super(["pfmerge", ...e20], t);
  }
};
var Wl = class extends m {
  static {
    __name(this, "Wl");
  }
  constructor(e20, t) {
    let r = ["ping"];
    e20?.[0] !== void 0 && r.push(e20[0]), super(r, t);
  }
};
var Gl = class extends m {
  static {
    __name(this, "Gl");
  }
  constructor(e20, t) {
    super(["psetex", ...e20], t);
  }
};
var Jl = class extends m {
  static {
    __name(this, "Jl");
  }
  constructor(e20, t) {
    super(["pttl", ...e20], t);
  }
};
var Xl = class extends m {
  static {
    __name(this, "Xl");
  }
  constructor(e20, t) {
    super(["publish", ...e20], t);
  }
};
var Yl = class extends m {
  static {
    __name(this, "Yl");
  }
  constructor(e20) {
    super(["randomkey"], e20);
  }
};
var Zl = class extends m {
  static {
    __name(this, "Zl");
  }
  constructor(e20, t) {
    super(["rename", ...e20], t);
  }
};
var Ql = class extends m {
  static {
    __name(this, "Ql");
  }
  constructor(e20, t) {
    super(["renamenx", ...e20], t);
  }
};
var eu = class extends m {
  static {
    __name(this, "eu");
  }
  constructor(e20, t) {
    super(["rpop", ...e20], t);
  }
};
var tu = class extends m {
  static {
    __name(this, "tu");
  }
  constructor(e20, t) {
    super(["rpush", ...e20], t);
  }
};
var ru = class extends m {
  static {
    __name(this, "ru");
  }
  constructor(e20, t) {
    super(["rpushx", ...e20], t);
  }
};
var su = class extends m {
  static {
    __name(this, "su");
  }
  constructor(e20, t) {
    super(["sadd", ...e20], t);
  }
};
var nu = class extends m {
  static {
    __name(this, "nu");
  }
  constructor([e20, t], r) {
    let s = ["scan", e20];
    t?.match && s.push("match", t.match), typeof t?.count == "number" && s.push("count", t.count), t && "withType" in t && t.withType === true ? s.push("withtype") : t && "type" in t && t.type && t.type.length > 0 && s.push("type", t.type), super(s, { deserialize: t?.withType ? Ig : Ls, ...r });
  }
};
var iu = class extends m {
  static {
    __name(this, "iu");
  }
  constructor(e20, t) {
    super(["scard", ...e20], t);
  }
};
var au = class extends m {
  static {
    __name(this, "au");
  }
  constructor(e20, t) {
    super(["script", "exists", ...e20], { deserialize: /* @__PURE__ */ __name((r) => r, "deserialize"), ...t });
  }
};
var ou = class extends m {
  static {
    __name(this, "ou");
  }
  constructor([e20], t) {
    let r = ["script", "flush"];
    e20?.sync ? r.push("sync") : e20?.async && r.push("async"), super(r, t);
  }
};
var cu = class extends m {
  static {
    __name(this, "cu");
  }
  constructor(e20, t) {
    super(["script", "load", ...e20], t);
  }
};
var lu = class extends m {
  static {
    __name(this, "lu");
  }
  constructor(e20, t) {
    super(["sdiff", ...e20], t);
  }
};
var uu = class extends m {
  static {
    __name(this, "uu");
  }
  constructor(e20, t) {
    super(["sdiffstore", ...e20], t);
  }
};
var du = class extends m {
  static {
    __name(this, "du");
  }
  constructor([e20, t, r], s) {
    let n = ["set", e20, t];
    r && ("nx" in r && r.nx ? n.push("nx") : "xx" in r && r.xx && n.push("xx"), "get" in r && r.get && n.push("get"), "ex" in r && typeof r.ex == "number" ? n.push("ex", r.ex) : "px" in r && typeof r.px == "number" ? n.push("px", r.px) : "exat" in r && typeof r.exat == "number" ? n.push("exat", r.exat) : "pxat" in r && typeof r.pxat == "number" ? n.push("pxat", r.pxat) : "keepTtl" in r && r.keepTtl && n.push("keepTtl")), super(n, s);
  }
};
var hu = class extends m {
  static {
    __name(this, "hu");
  }
  constructor(e20, t) {
    super(["setbit", ...e20], t);
  }
};
var pu = class extends m {
  static {
    __name(this, "pu");
  }
  constructor(e20, t) {
    super(["setex", ...e20], t);
  }
};
var fu = class extends m {
  static {
    __name(this, "fu");
  }
  constructor(e20, t) {
    super(["setnx", ...e20], t);
  }
};
var mu = class extends m {
  static {
    __name(this, "mu");
  }
  constructor(e20, t) {
    super(["setrange", ...e20], t);
  }
};
var gu = class extends m {
  static {
    __name(this, "gu");
  }
  constructor(e20, t) {
    super(["sinter", ...e20], t);
  }
};
var yu = class extends m {
  static {
    __name(this, "yu");
  }
  constructor(e20, t) {
    let [r, s] = e20, n = ["sintercard", r.length, ...r];
    s?.limit !== void 0 && n.push("LIMIT", s.limit), super(n, t);
  }
};
var wu = class extends m {
  static {
    __name(this, "wu");
  }
  constructor(e20, t) {
    super(["sinterstore", ...e20], t);
  }
};
var vu = class extends m {
  static {
    __name(this, "vu");
  }
  constructor(e20, t) {
    super(["sismember", ...e20], t);
  }
};
var _u = class extends m {
  static {
    __name(this, "_u");
  }
  constructor(e20, t) {
    super(["smembers", ...e20], t);
  }
};
var bu = class extends m {
  static {
    __name(this, "bu");
  }
  constructor(e20, t) {
    super(["smismember", e20[0], ...e20[1]], t);
  }
};
var xu = class extends m {
  static {
    __name(this, "xu");
  }
  constructor(e20, t) {
    super(["smove", ...e20], t);
  }
};
var Su = class extends m {
  static {
    __name(this, "Su");
  }
  constructor([e20, t], r) {
    let s = ["spop", e20];
    typeof t == "number" && s.push(t), super(s, r);
  }
};
var Eu = class extends m {
  static {
    __name(this, "Eu");
  }
  constructor([e20, t], r) {
    let s = ["srandmember", e20];
    typeof t == "number" && s.push(t), super(s, r);
  }
};
var ku = class extends m {
  static {
    __name(this, "ku");
  }
  constructor(e20, t) {
    super(["srem", ...e20], t);
  }
};
var Tu = class extends m {
  static {
    __name(this, "Tu");
  }
  constructor([e20, t, r], s) {
    let n = ["sscan", e20, t];
    r?.match && n.push("match", r.match), typeof r?.count == "number" && n.push("count", r.count), super(n, { deserialize: Ls, ...s });
  }
};
var Au = class extends m {
  static {
    __name(this, "Au");
  }
  constructor(e20, t) {
    super(["strlen", ...e20], t);
  }
};
var Ru = class extends m {
  static {
    __name(this, "Ru");
  }
  constructor(e20, t) {
    super(["sunion", ...e20], t);
  }
};
var Cu = class extends m {
  static {
    __name(this, "Cu");
  }
  constructor(e20, t) {
    super(["sunionstore", ...e20], t);
  }
};
var Ou = class extends m {
  static {
    __name(this, "Ou");
  }
  constructor(e20) {
    super(["time"], e20);
  }
};
var Iu = class extends m {
  static {
    __name(this, "Iu");
  }
  constructor(e20, t) {
    super(["touch", ...e20], t);
  }
};
var Pu = class extends m {
  static {
    __name(this, "Pu");
  }
  constructor(e20, t) {
    super(["ttl", ...e20], t);
  }
};
var Lu = class extends m {
  static {
    __name(this, "Lu");
  }
  constructor(e20, t) {
    super(["type", ...e20], t);
  }
};
var Nu = class extends m {
  static {
    __name(this, "Nu");
  }
  constructor(e20, t) {
    super(["unlink", ...e20], t);
  }
};
var ju = class extends m {
  static {
    __name(this, "ju");
  }
  constructor([e20, t, r], s) {
    let n = Array.isArray(r) ? [...r] : [r];
    super(["XACK", e20, t, ...n], s);
  }
};
var Uu = class extends m {
  static {
    __name(this, "Uu");
  }
  constructor([e20, t, r, ...s], n) {
    let i = ["XACKDEL", e20, t];
    i.push(r.toUpperCase(), "IDS", s.length, ...s), super(i, n);
  }
};
var Du = class extends m {
  static {
    __name(this, "Du");
  }
  constructor([e20, t, r, s], n) {
    let i = ["XADD", e20];
    s && (s.nomkStream && i.push("NOMKSTREAM"), s.trim && (i.push(s.trim.type, s.trim.comparison, s.trim.threshold), s.trim.limit !== void 0 && i.push("LIMIT", s.trim.limit))), i.push(t);
    for (let [a, o] of Object.entries(r)) i.push(a, o);
    super(i, n);
  }
};
var $u = class extends m {
  static {
    __name(this, "$u");
  }
  constructor([e20, t, r, s, n, i], a) {
    let o = [];
    i?.count && o.push("COUNT", i.count), i?.justId && o.push("JUSTID"), super(["XAUTOCLAIM", e20, t, r, s, n, ...o], a);
  }
};
var Bu = class extends m {
  static {
    __name(this, "Bu");
  }
  constructor([e20, t, r, s, n, i], a) {
    let o = Array.isArray(n) ? [...n] : [n], c = [];
    i?.idleMS && c.push("IDLE", i.idleMS), i?.idleMS && c.push("TIME", i.timeMS), i?.retryCount && c.push("RETRYCOUNT", i.retryCount), i?.force && c.push("FORCE"), i?.justId && c.push("JUSTID"), i?.lastId && c.push("LASTID", i.lastId), super(["XCLAIM", e20, t, r, s, ...o, ...c], a);
  }
};
var Mu = class extends m {
  static {
    __name(this, "Mu");
  }
  constructor([e20, t], r) {
    let s = Array.isArray(t) ? [...t] : [t];
    super(["XDEL", e20, ...s], r);
  }
};
var Fu = class extends m {
  static {
    __name(this, "Fu");
  }
  constructor([e20, t, ...r], s) {
    let n = ["XDELEX", e20];
    t && n.push(t.toUpperCase()), n.push("IDS", r.length, ...r), super(n, s);
  }
};
var qu = class extends m {
  static {
    __name(this, "qu");
  }
  constructor([e20, t], r) {
    let s = ["XGROUP"];
    switch (t.type) {
      case "CREATE": {
        s.push("CREATE", e20, t.group, t.id), t.options && (t.options.MKSTREAM && s.push("MKSTREAM"), t.options.ENTRIESREAD !== void 0 && s.push("ENTRIESREAD", t.options.ENTRIESREAD.toString()));
        break;
      }
      case "CREATECONSUMER": {
        s.push("CREATECONSUMER", e20, t.group, t.consumer);
        break;
      }
      case "DELCONSUMER": {
        s.push("DELCONSUMER", e20, t.group, t.consumer);
        break;
      }
      case "DESTROY": {
        s.push("DESTROY", e20, t.group);
        break;
      }
      case "SETID": {
        s.push("SETID", e20, t.group, t.id), t.options?.ENTRIESREAD !== void 0 && s.push("ENTRIESREAD", t.options.ENTRIESREAD.toString());
        break;
      }
      default:
        throw new Error("Invalid XGROUP");
    }
    super(s, r);
  }
};
var zu = class extends m {
  static {
    __name(this, "zu");
  }
  constructor([e20, t], r) {
    let s = [];
    t.type === "CONSUMERS" ? s.push("CONSUMERS", e20, t.group) : s.push("GROUPS", e20), super(["XINFO", ...s], r);
  }
};
var Vu = class extends m {
  static {
    __name(this, "Vu");
  }
  constructor(e20, t) {
    super(["XLEN", ...e20], t);
  }
};
var Hu = class extends m {
  static {
    __name(this, "Hu");
  }
  constructor([e20, t, r, s, n, i], a) {
    let o = i?.consumer === void 0 ? [] : Array.isArray(i.consumer) ? [...i.consumer] : [i.consumer];
    super(["XPENDING", e20, t, ...i?.idleTime ? ["IDLE", i.idleTime] : [], r, s, n, ...o], a);
  }
};
function ty(e20) {
  let t = {};
  for (let r of e20) for (let s = 0; s < r.length; s += 2) {
    let n = r[s], i = r[s + 1];
    n in t || (t[n] = {});
    for (let a = 0; a < i.length; a += 2) {
      let o = i[a], c = i[a + 1];
      try {
        t[n][o] = JSON.parse(c);
      } catch {
        t[n][o] = c;
      }
    }
  }
  return t;
}
__name(ty, "ty");
var Ku = class extends m {
  static {
    __name(this, "Ku");
  }
  constructor([e20, t, r, s], n) {
    let i = ["XRANGE", e20, t, r];
    typeof s == "number" && i.push("COUNT", s), super(i, { deserialize: /* @__PURE__ */ __name((a) => ty(a), "deserialize"), ...n });
  }
};
var ry = "ERR Unbalanced XREAD list of streams: for each stream key an ID or '$' must be specified";
var Wu = class extends m {
  static {
    __name(this, "Wu");
  }
  constructor([e20, t, r], s) {
    if (Array.isArray(e20) && Array.isArray(t) && e20.length !== t.length) throw new Error(ry);
    let n = [];
    typeof r?.count == "number" && n.push("COUNT", r.count), typeof r?.blockMS == "number" && n.push("BLOCK", r.blockMS), n.push("STREAMS", ...Array.isArray(e20) ? [...e20] : [e20], ...Array.isArray(t) ? [...t] : [t]), super(["XREAD", ...n], s);
  }
};
var sy = "ERR Unbalanced XREADGROUP list of streams: for each stream key an ID or '$' must be specified";
var Gu = class extends m {
  static {
    __name(this, "Gu");
  }
  constructor([e20, t, r, s, n], i) {
    if (Array.isArray(r) && Array.isArray(s) && r.length !== s.length) throw new Error(sy);
    let a = [];
    typeof n?.count == "number" && a.push("COUNT", n.count), typeof n?.blockMS == "number" && a.push("BLOCK", n.blockMS), typeof n?.NOACK == "boolean" && n.NOACK && a.push("NOACK"), a.push("STREAMS", ...Array.isArray(r) ? [...r] : [r], ...Array.isArray(s) ? [...s] : [s]), super(["XREADGROUP", "GROUP", e20, t, ...a], i);
  }
};
var Ju = class extends m {
  static {
    __name(this, "Ju");
  }
  constructor([e20, t, r, s], n) {
    let i = ["XREVRANGE", e20, t, r];
    typeof s == "number" && i.push("COUNT", s), super(i, { deserialize: /* @__PURE__ */ __name((a) => ny(a), "deserialize"), ...n });
  }
};
function ny(e20) {
  let t = {};
  for (let r of e20) for (let s = 0; s < r.length; s += 2) {
    let n = r[s], i = r[s + 1];
    n in t || (t[n] = {});
    for (let a = 0; a < i.length; a += 2) {
      let o = i[a], c = i[a + 1];
      try {
        t[n][o] = JSON.parse(c);
      } catch {
        t[n][o] = c;
      }
    }
  }
  return t;
}
__name(ny, "ny");
var Xu = class extends m {
  static {
    __name(this, "Xu");
  }
  constructor([e20, t], r) {
    let { limit: s, strategy: n, threshold: i, exactness: a = "~" } = t;
    super(["XTRIM", e20, n, a, i, ...s ? ["LIMIT", s] : []], r);
  }
};
var Ps = class extends m {
  static {
    __name(this, "Ps");
  }
  constructor([e20, t, ...r], s) {
    let n = ["zadd", e20];
    "nx" in t && t.nx ? n.push("nx") : "xx" in t && t.xx && n.push("xx"), "ch" in t && t.ch && n.push("ch"), "incr" in t && t.incr && n.push("incr"), "lt" in t && t.lt ? n.push("lt") : "gt" in t && t.gt && n.push("gt"), "score" in t && "member" in t && n.push(t.score, t.member), n.push(...r.flatMap(({ score: i, member: a }) => [i, a])), super(n, s);
  }
};
var Yu = class extends m {
  static {
    __name(this, "Yu");
  }
  constructor(e20, t) {
    super(["zcard", ...e20], t);
  }
};
var Zu = class extends m {
  static {
    __name(this, "Zu");
  }
  constructor(e20, t) {
    super(["zcount", ...e20], t);
  }
};
var Qu = class extends m {
  static {
    __name(this, "Qu");
  }
  constructor(e20, t) {
    super(["zincrby", ...e20], t);
  }
};
var ed = class extends m {
  static {
    __name(this, "ed");
  }
  constructor([e20, t, r, s], n) {
    let i = ["zinterstore", e20, t];
    Array.isArray(r) ? i.push(...r) : i.push(r), s && ("weights" in s && s.weights ? i.push("weights", ...s.weights) : "weight" in s && typeof s.weight == "number" && i.push("weights", s.weight), "aggregate" in s && i.push("aggregate", s.aggregate)), super(i, n);
  }
};
var td = class extends m {
  static {
    __name(this, "td");
  }
  constructor(e20, t) {
    super(["zlexcount", ...e20], t);
  }
};
var rd = class extends m {
  static {
    __name(this, "rd");
  }
  constructor([e20, t], r) {
    let s = ["zpopmax", e20];
    typeof t == "number" && s.push(t), super(s, r);
  }
};
var sd = class extends m {
  static {
    __name(this, "sd");
  }
  constructor([e20, t], r) {
    let s = ["zpopmin", e20];
    typeof t == "number" && s.push(t), super(s, r);
  }
};
var nd = class extends m {
  static {
    __name(this, "nd");
  }
  constructor([e20, t, r, s], n) {
    let i = ["zrange", e20, t, r];
    s?.byScore && i.push("byscore"), s?.byLex && i.push("bylex"), s?.rev && i.push("rev"), s?.count !== void 0 && s.offset !== void 0 && i.push("limit", s.offset, s.count), s?.withScores && i.push("withscores"), super(i, n);
  }
};
var id = class extends m {
  static {
    __name(this, "id");
  }
  constructor(e20, t) {
    super(["zrank", ...e20], t);
  }
};
var ad = class extends m {
  static {
    __name(this, "ad");
  }
  constructor(e20, t) {
    super(["zrem", ...e20], t);
  }
};
var od = class extends m {
  static {
    __name(this, "od");
  }
  constructor(e20, t) {
    super(["zremrangebylex", ...e20], t);
  }
};
var cd = class extends m {
  static {
    __name(this, "cd");
  }
  constructor(e20, t) {
    super(["zremrangebyrank", ...e20], t);
  }
};
var ld = class extends m {
  static {
    __name(this, "ld");
  }
  constructor(e20, t) {
    super(["zremrangebyscore", ...e20], t);
  }
};
var ud = class extends m {
  static {
    __name(this, "ud");
  }
  constructor(e20, t) {
    super(["zrevrank", ...e20], t);
  }
};
var dd = class extends m {
  static {
    __name(this, "dd");
  }
  constructor([e20, t, r], s) {
    let n = ["zscan", e20, t];
    r?.match && n.push("match", r.match), typeof r?.count == "number" && n.push("count", r.count), super(n, { deserialize: Ls, ...s });
  }
};
var hd = class extends m {
  static {
    __name(this, "hd");
  }
  constructor(e20, t) {
    super(["zscore", ...e20], t);
  }
};
var pd = class extends m {
  static {
    __name(this, "pd");
  }
  constructor([e20, t, r], s) {
    let n = ["zunion", e20];
    Array.isArray(t) ? n.push(...t) : n.push(t), r && ("weights" in r && r.weights ? n.push("weights", ...r.weights) : "weight" in r && typeof r.weight == "number" && n.push("weights", r.weight), "aggregate" in r && n.push("aggregate", r.aggregate), r.withScores && n.push("withscores")), super(n, s);
  }
};
var fd = class extends m {
  static {
    __name(this, "fd");
  }
  constructor([e20, t, r, s], n) {
    let i = ["zunionstore", e20, t];
    Array.isArray(r) ? i.push(...r) : i.push(r), s && ("weights" in s && s.weights ? i.push("weights", ...s.weights) : "weight" in s && typeof s.weight == "number" && i.push("weights", s.weight), "aggregate" in s && i.push("aggregate", s.aggregate)), super(i, n);
  }
};
var md = class extends m {
  static {
    __name(this, "md");
  }
  constructor(e20, t) {
    super(["zdiffstore", ...e20], t);
  }
};
var gd = class extends m {
  static {
    __name(this, "gd");
  }
  constructor(e20, t) {
    let [r, s] = e20;
    super(["zmscore", r, ...s], t);
  }
};
var Eo = class {
  static {
    __name(this, "Eo");
  }
  client;
  commands;
  commandOptions;
  multiExec;
  constructor(e20) {
    if (this.client = e20.client, this.commands = [], this.commandOptions = e20.commandOptions, this.multiExec = e20.multiExec ?? false, this.commandOptions?.latencyLogging) {
      let t = this.exec.bind(this);
      this.exec = async (r) => {
        let s = performance.now(), n = await (r ? t(r) : t()), a = (performance.now() - s).toFixed(2);
        return console.log(`Latency for \x1B[38;2;19;185;39m${this.multiExec ? ["MULTI-EXEC"] : ["PIPELINE"].toString().toUpperCase()}\x1B[0m: \x1B[38;2;0;255;255m${a} ms\x1B[0m`), n;
      };
    }
  }
  exec = /* @__PURE__ */ __name(async (e20) => {
    if (this.commands.length === 0) throw new Error("Pipeline is empty");
    let t = this.multiExec ? ["multi-exec"] : ["pipeline"], r = await this.client.request({ path: t, body: Object.values(this.commands).map((s) => s.command) });
    return e20?.keepErrors ? r.map(({ error: s, result: n }, i) => ({ error: s, result: this.commands[i].deserialize(n) })) : r.map(({ error: s, result: n }, i) => {
      if (s) throw new er(`Command ${i + 1} [ ${this.commands[i].command[0]} ] failed: ${s}`);
      return this.commands[i].deserialize(n);
    });
  }, "exec");
  length() {
    return this.commands.length;
  }
  chain(e20) {
    return this.commands.push(e20), this;
  }
  append = /* @__PURE__ */ __name((...e20) => this.chain(new Bo(e20, this.commandOptions)), "append");
  bitcount = /* @__PURE__ */ __name((...e20) => this.chain(new Mo(e20, this.commandOptions)), "bitcount");
  bitfield = /* @__PURE__ */ __name((...e20) => new Fo(e20, this.client, this.commandOptions, this.chain.bind(this)), "bitfield");
  bitop = /* @__PURE__ */ __name((e20, t, r, ...s) => this.chain(new qo([e20, t, r, ...s], this.commandOptions)), "bitop");
  bitpos = /* @__PURE__ */ __name((...e20) => this.chain(new zo(e20, this.commandOptions)), "bitpos");
  clientSetinfo = /* @__PURE__ */ __name((...e20) => this.chain(new Vo(e20, this.commandOptions)), "clientSetinfo");
  copy = /* @__PURE__ */ __name((...e20) => this.chain(new Ho(e20, this.commandOptions)), "copy");
  zdiffstore = /* @__PURE__ */ __name((...e20) => this.chain(new md(e20, this.commandOptions)), "zdiffstore");
  dbsize = /* @__PURE__ */ __name(() => this.chain(new Ko(this.commandOptions)), "dbsize");
  decr = /* @__PURE__ */ __name((...e20) => this.chain(new Wo(e20, this.commandOptions)), "decr");
  decrby = /* @__PURE__ */ __name((...e20) => this.chain(new Go(e20, this.commandOptions)), "decrby");
  del = /* @__PURE__ */ __name((...e20) => this.chain(new Jo(e20, this.commandOptions)), "del");
  echo = /* @__PURE__ */ __name((...e20) => this.chain(new Xo(e20, this.commandOptions)), "echo");
  evalRo = /* @__PURE__ */ __name((...e20) => this.chain(new Yo(e20, this.commandOptions)), "evalRo");
  eval = /* @__PURE__ */ __name((...e20) => this.chain(new Zo(e20, this.commandOptions)), "eval");
  evalshaRo = /* @__PURE__ */ __name((...e20) => this.chain(new Qo(e20, this.commandOptions)), "evalshaRo");
  evalsha = /* @__PURE__ */ __name((...e20) => this.chain(new ec(e20, this.commandOptions)), "evalsha");
  exists = /* @__PURE__ */ __name((...e20) => this.chain(new tc(e20, this.commandOptions)), "exists");
  expire = /* @__PURE__ */ __name((...e20) => this.chain(new rc(e20, this.commandOptions)), "expire");
  expireat = /* @__PURE__ */ __name((...e20) => this.chain(new sc(e20, this.commandOptions)), "expireat");
  flushall = /* @__PURE__ */ __name((e20) => this.chain(new ac(e20, this.commandOptions)), "flushall");
  flushdb = /* @__PURE__ */ __name((...e20) => this.chain(new oc(e20, this.commandOptions)), "flushdb");
  geoadd = /* @__PURE__ */ __name((...e20) => this.chain(new pc(e20, this.commandOptions)), "geoadd");
  geodist = /* @__PURE__ */ __name((...e20) => this.chain(new fc(e20, this.commandOptions)), "geodist");
  geopos = /* @__PURE__ */ __name((...e20) => this.chain(new gc(e20, this.commandOptions)), "geopos");
  geohash = /* @__PURE__ */ __name((...e20) => this.chain(new mc(e20, this.commandOptions)), "geohash");
  geosearch = /* @__PURE__ */ __name((...e20) => this.chain(new yc(e20, this.commandOptions)), "geosearch");
  geosearchstore = /* @__PURE__ */ __name((...e20) => this.chain(new wc(e20, this.commandOptions)), "geosearchstore");
  get = /* @__PURE__ */ __name((...e20) => this.chain(new vc(e20, this.commandOptions)), "get");
  getbit = /* @__PURE__ */ __name((...e20) => this.chain(new _c(e20, this.commandOptions)), "getbit");
  getdel = /* @__PURE__ */ __name((...e20) => this.chain(new bc(e20, this.commandOptions)), "getdel");
  getex = /* @__PURE__ */ __name((...e20) => this.chain(new xc(e20, this.commandOptions)), "getex");
  getrange = /* @__PURE__ */ __name((...e20) => this.chain(new Sc(e20, this.commandOptions)), "getrange");
  getset = /* @__PURE__ */ __name((e20, t) => this.chain(new Ec([e20, t], this.commandOptions)), "getset");
  hdel = /* @__PURE__ */ __name((...e20) => this.chain(new kc(e20, this.commandOptions)), "hdel");
  hexists = /* @__PURE__ */ __name((...e20) => this.chain(new Tc(e20, this.commandOptions)), "hexists");
  hexpire = /* @__PURE__ */ __name((...e20) => this.chain(new Ac(e20, this.commandOptions)), "hexpire");
  hexpireat = /* @__PURE__ */ __name((...e20) => this.chain(new Rc(e20, this.commandOptions)), "hexpireat");
  hexpiretime = /* @__PURE__ */ __name((...e20) => this.chain(new Cc(e20, this.commandOptions)), "hexpiretime");
  httl = /* @__PURE__ */ __name((...e20) => this.chain(new Xc(e20, this.commandOptions)), "httl");
  hpexpire = /* @__PURE__ */ __name((...e20) => this.chain(new Ic(e20, this.commandOptions)), "hpexpire");
  hpexpireat = /* @__PURE__ */ __name((...e20) => this.chain(new Pc(e20, this.commandOptions)), "hpexpireat");
  hpexpiretime = /* @__PURE__ */ __name((...e20) => this.chain(new Lc(e20, this.commandOptions)), "hpexpiretime");
  hpttl = /* @__PURE__ */ __name((...e20) => this.chain(new Nc(e20, this.commandOptions)), "hpttl");
  hpersist = /* @__PURE__ */ __name((...e20) => this.chain(new Oc(e20, this.commandOptions)), "hpersist");
  hget = /* @__PURE__ */ __name((...e20) => this.chain(new jc(e20, this.commandOptions)), "hget");
  hgetall = /* @__PURE__ */ __name((...e20) => this.chain(new Uc(e20, this.commandOptions)), "hgetall");
  hgetdel = /* @__PURE__ */ __name((...e20) => this.chain(new $c(e20, this.commandOptions)), "hgetdel");
  hgetex = /* @__PURE__ */ __name((...e20) => this.chain(new Bc(e20, this.commandOptions)), "hgetex");
  hincrby = /* @__PURE__ */ __name((...e20) => this.chain(new Mc(e20, this.commandOptions)), "hincrby");
  hincrbyfloat = /* @__PURE__ */ __name((...e20) => this.chain(new Fc(e20, this.commandOptions)), "hincrbyfloat");
  hkeys = /* @__PURE__ */ __name((...e20) => this.chain(new qc(e20, this.commandOptions)), "hkeys");
  hlen = /* @__PURE__ */ __name((...e20) => this.chain(new zc(e20, this.commandOptions)), "hlen");
  hmget = /* @__PURE__ */ __name((...e20) => this.chain(new Dc(e20, this.commandOptions)), "hmget");
  hmset = /* @__PURE__ */ __name((e20, t) => this.chain(new Vc([e20, t], this.commandOptions)), "hmset");
  hrandfield = /* @__PURE__ */ __name((e20, t, r) => this.chain(new $o([e20, t, r], this.commandOptions)), "hrandfield");
  hscan = /* @__PURE__ */ __name((...e20) => this.chain(new Hc(e20, this.commandOptions)), "hscan");
  hset = /* @__PURE__ */ __name((e20, t) => this.chain(new Kc([e20, t], this.commandOptions)), "hset");
  hsetex = /* @__PURE__ */ __name((...e20) => this.chain(new Wc(e20, this.commandOptions)), "hsetex");
  hsetnx = /* @__PURE__ */ __name((e20, t, r) => this.chain(new Gc([e20, t, r], this.commandOptions)), "hsetnx");
  hstrlen = /* @__PURE__ */ __name((...e20) => this.chain(new Jc(e20, this.commandOptions)), "hstrlen");
  hvals = /* @__PURE__ */ __name((...e20) => this.chain(new Yc(e20, this.commandOptions)), "hvals");
  incr = /* @__PURE__ */ __name((...e20) => this.chain(new Zc(e20, this.commandOptions)), "incr");
  incrby = /* @__PURE__ */ __name((...e20) => this.chain(new Qc(e20, this.commandOptions)), "incrby");
  incrbyfloat = /* @__PURE__ */ __name((...e20) => this.chain(new el(e20, this.commandOptions)), "incrbyfloat");
  keys = /* @__PURE__ */ __name((...e20) => this.chain(new El(e20, this.commandOptions)), "keys");
  lindex = /* @__PURE__ */ __name((...e20) => this.chain(new kl(e20, this.commandOptions)), "lindex");
  linsert = /* @__PURE__ */ __name((e20, t, r, s) => this.chain(new Tl([e20, t, r, s], this.commandOptions)), "linsert");
  llen = /* @__PURE__ */ __name((...e20) => this.chain(new Al(e20, this.commandOptions)), "llen");
  lmove = /* @__PURE__ */ __name((...e20) => this.chain(new Rl(e20, this.commandOptions)), "lmove");
  lpop = /* @__PURE__ */ __name((...e20) => this.chain(new Ol(e20, this.commandOptions)), "lpop");
  lmpop = /* @__PURE__ */ __name((...e20) => this.chain(new Cl(e20, this.commandOptions)), "lmpop");
  lpos = /* @__PURE__ */ __name((...e20) => this.chain(new Il(e20, this.commandOptions)), "lpos");
  lpush = /* @__PURE__ */ __name((e20, ...t) => this.chain(new Pl([e20, ...t], this.commandOptions)), "lpush");
  lpushx = /* @__PURE__ */ __name((e20, ...t) => this.chain(new Ll([e20, ...t], this.commandOptions)), "lpushx");
  lrange = /* @__PURE__ */ __name((...e20) => this.chain(new Nl(e20, this.commandOptions)), "lrange");
  lrem = /* @__PURE__ */ __name((e20, t, r) => this.chain(new jl([e20, t, r], this.commandOptions)), "lrem");
  lset = /* @__PURE__ */ __name((e20, t, r) => this.chain(new Ul([e20, t, r], this.commandOptions)), "lset");
  ltrim = /* @__PURE__ */ __name((...e20) => this.chain(new Dl(e20, this.commandOptions)), "ltrim");
  mget = /* @__PURE__ */ __name((...e20) => this.chain(new $l(e20, this.commandOptions)), "mget");
  mset = /* @__PURE__ */ __name((e20) => this.chain(new Bl([e20], this.commandOptions)), "mset");
  msetnx = /* @__PURE__ */ __name((e20) => this.chain(new Ml([e20], this.commandOptions)), "msetnx");
  persist = /* @__PURE__ */ __name((...e20) => this.chain(new Fl(e20, this.commandOptions)), "persist");
  pexpire = /* @__PURE__ */ __name((...e20) => this.chain(new ql(e20, this.commandOptions)), "pexpire");
  pexpireat = /* @__PURE__ */ __name((...e20) => this.chain(new zl(e20, this.commandOptions)), "pexpireat");
  pfadd = /* @__PURE__ */ __name((...e20) => this.chain(new Vl(e20, this.commandOptions)), "pfadd");
  pfcount = /* @__PURE__ */ __name((...e20) => this.chain(new Hl(e20, this.commandOptions)), "pfcount");
  pfmerge = /* @__PURE__ */ __name((...e20) => this.chain(new Kl(e20, this.commandOptions)), "pfmerge");
  ping = /* @__PURE__ */ __name((e20) => this.chain(new Wl(e20, this.commandOptions)), "ping");
  psetex = /* @__PURE__ */ __name((e20, t, r) => this.chain(new Gl([e20, t, r], this.commandOptions)), "psetex");
  pttl = /* @__PURE__ */ __name((...e20) => this.chain(new Jl(e20, this.commandOptions)), "pttl");
  publish = /* @__PURE__ */ __name((...e20) => this.chain(new Xl(e20, this.commandOptions)), "publish");
  randomkey = /* @__PURE__ */ __name(() => this.chain(new Yl(this.commandOptions)), "randomkey");
  rename = /* @__PURE__ */ __name((...e20) => this.chain(new Zl(e20, this.commandOptions)), "rename");
  renamenx = /* @__PURE__ */ __name((...e20) => this.chain(new Ql(e20, this.commandOptions)), "renamenx");
  rpop = /* @__PURE__ */ __name((...e20) => this.chain(new eu(e20, this.commandOptions)), "rpop");
  rpush = /* @__PURE__ */ __name((e20, ...t) => this.chain(new tu([e20, ...t], this.commandOptions)), "rpush");
  rpushx = /* @__PURE__ */ __name((e20, ...t) => this.chain(new ru([e20, ...t], this.commandOptions)), "rpushx");
  sadd = /* @__PURE__ */ __name((e20, t, ...r) => this.chain(new su([e20, t, ...r], this.commandOptions)), "sadd");
  scan = /* @__PURE__ */ __name((...e20) => this.chain(new nu(e20, this.commandOptions)), "scan");
  scard = /* @__PURE__ */ __name((...e20) => this.chain(new iu(e20, this.commandOptions)), "scard");
  scriptExists = /* @__PURE__ */ __name((...e20) => this.chain(new au(e20, this.commandOptions)), "scriptExists");
  scriptFlush = /* @__PURE__ */ __name((...e20) => this.chain(new ou(e20, this.commandOptions)), "scriptFlush");
  scriptLoad = /* @__PURE__ */ __name((...e20) => this.chain(new cu(e20, this.commandOptions)), "scriptLoad");
  sdiff = /* @__PURE__ */ __name((...e20) => this.chain(new lu(e20, this.commandOptions)), "sdiff");
  sdiffstore = /* @__PURE__ */ __name((...e20) => this.chain(new uu(e20, this.commandOptions)), "sdiffstore");
  set = /* @__PURE__ */ __name((e20, t, r) => this.chain(new du([e20, t, r], this.commandOptions)), "set");
  setbit = /* @__PURE__ */ __name((...e20) => this.chain(new hu(e20, this.commandOptions)), "setbit");
  setex = /* @__PURE__ */ __name((e20, t, r) => this.chain(new pu([e20, t, r], this.commandOptions)), "setex");
  setnx = /* @__PURE__ */ __name((e20, t) => this.chain(new fu([e20, t], this.commandOptions)), "setnx");
  setrange = /* @__PURE__ */ __name((...e20) => this.chain(new mu(e20, this.commandOptions)), "setrange");
  sinter = /* @__PURE__ */ __name((...e20) => this.chain(new gu(e20, this.commandOptions)), "sinter");
  sintercard = /* @__PURE__ */ __name((...e20) => this.chain(new yu(e20, this.commandOptions)), "sintercard");
  sinterstore = /* @__PURE__ */ __name((...e20) => this.chain(new wu(e20, this.commandOptions)), "sinterstore");
  sismember = /* @__PURE__ */ __name((e20, t) => this.chain(new vu([e20, t], this.commandOptions)), "sismember");
  smembers = /* @__PURE__ */ __name((...e20) => this.chain(new _u(e20, this.commandOptions)), "smembers");
  smismember = /* @__PURE__ */ __name((e20, t) => this.chain(new bu([e20, t], this.commandOptions)), "smismember");
  smove = /* @__PURE__ */ __name((e20, t, r) => this.chain(new xu([e20, t, r], this.commandOptions)), "smove");
  spop = /* @__PURE__ */ __name((...e20) => this.chain(new Su(e20, this.commandOptions)), "spop");
  srandmember = /* @__PURE__ */ __name((...e20) => this.chain(new Eu(e20, this.commandOptions)), "srandmember");
  srem = /* @__PURE__ */ __name((e20, ...t) => this.chain(new ku([e20, ...t], this.commandOptions)), "srem");
  sscan = /* @__PURE__ */ __name((...e20) => this.chain(new Tu(e20, this.commandOptions)), "sscan");
  strlen = /* @__PURE__ */ __name((...e20) => this.chain(new Au(e20, this.commandOptions)), "strlen");
  sunion = /* @__PURE__ */ __name((...e20) => this.chain(new Ru(e20, this.commandOptions)), "sunion");
  sunionstore = /* @__PURE__ */ __name((...e20) => this.chain(new Cu(e20, this.commandOptions)), "sunionstore");
  time = /* @__PURE__ */ __name(() => this.chain(new Ou(this.commandOptions)), "time");
  touch = /* @__PURE__ */ __name((...e20) => this.chain(new Iu(e20, this.commandOptions)), "touch");
  ttl = /* @__PURE__ */ __name((...e20) => this.chain(new Pu(e20, this.commandOptions)), "ttl");
  type = /* @__PURE__ */ __name((...e20) => this.chain(new Lu(e20, this.commandOptions)), "type");
  unlink = /* @__PURE__ */ __name((...e20) => this.chain(new Nu(e20, this.commandOptions)), "unlink");
  zadd = /* @__PURE__ */ __name((...e20) => "score" in e20[1] ? this.chain(new Ps([e20[0], e20[1], ...e20.slice(2)], this.commandOptions)) : this.chain(new Ps([e20[0], e20[1], ...e20.slice(2)], this.commandOptions)), "zadd");
  xadd = /* @__PURE__ */ __name((...e20) => this.chain(new Du(e20, this.commandOptions)), "xadd");
  xack = /* @__PURE__ */ __name((...e20) => this.chain(new ju(e20, this.commandOptions)), "xack");
  xackdel = /* @__PURE__ */ __name((...e20) => this.chain(new Uu(e20, this.commandOptions)), "xackdel");
  xdel = /* @__PURE__ */ __name((...e20) => this.chain(new Mu(e20, this.commandOptions)), "xdel");
  xdelex = /* @__PURE__ */ __name((...e20) => this.chain(new Fu(e20, this.commandOptions)), "xdelex");
  xgroup = /* @__PURE__ */ __name((...e20) => this.chain(new qu(e20, this.commandOptions)), "xgroup");
  xread = /* @__PURE__ */ __name((...e20) => this.chain(new Wu(e20, this.commandOptions)), "xread");
  xreadgroup = /* @__PURE__ */ __name((...e20) => this.chain(new Gu(e20, this.commandOptions)), "xreadgroup");
  xinfo = /* @__PURE__ */ __name((...e20) => this.chain(new zu(e20, this.commandOptions)), "xinfo");
  xlen = /* @__PURE__ */ __name((...e20) => this.chain(new Vu(e20, this.commandOptions)), "xlen");
  xpending = /* @__PURE__ */ __name((...e20) => this.chain(new Hu(e20, this.commandOptions)), "xpending");
  xclaim = /* @__PURE__ */ __name((...e20) => this.chain(new Bu(e20, this.commandOptions)), "xclaim");
  xautoclaim = /* @__PURE__ */ __name((...e20) => this.chain(new $u(e20, this.commandOptions)), "xautoclaim");
  xtrim = /* @__PURE__ */ __name((...e20) => this.chain(new Xu(e20, this.commandOptions)), "xtrim");
  xrange = /* @__PURE__ */ __name((...e20) => this.chain(new Ku(e20, this.commandOptions)), "xrange");
  xrevrange = /* @__PURE__ */ __name((...e20) => this.chain(new Ju(e20, this.commandOptions)), "xrevrange");
  zcard = /* @__PURE__ */ __name((...e20) => this.chain(new Yu(e20, this.commandOptions)), "zcard");
  zcount = /* @__PURE__ */ __name((...e20) => this.chain(new Zu(e20, this.commandOptions)), "zcount");
  zincrby = /* @__PURE__ */ __name((e20, t, r) => this.chain(new Qu([e20, t, r], this.commandOptions)), "zincrby");
  zinterstore = /* @__PURE__ */ __name((...e20) => this.chain(new ed(e20, this.commandOptions)), "zinterstore");
  zlexcount = /* @__PURE__ */ __name((...e20) => this.chain(new td(e20, this.commandOptions)), "zlexcount");
  zmscore = /* @__PURE__ */ __name((...e20) => this.chain(new gd(e20, this.commandOptions)), "zmscore");
  zpopmax = /* @__PURE__ */ __name((...e20) => this.chain(new rd(e20, this.commandOptions)), "zpopmax");
  zpopmin = /* @__PURE__ */ __name((...e20) => this.chain(new sd(e20, this.commandOptions)), "zpopmin");
  zrange = /* @__PURE__ */ __name((...e20) => this.chain(new nd(e20, this.commandOptions)), "zrange");
  zrank = /* @__PURE__ */ __name((e20, t) => this.chain(new id([e20, t], this.commandOptions)), "zrank");
  zrem = /* @__PURE__ */ __name((e20, ...t) => this.chain(new ad([e20, ...t], this.commandOptions)), "zrem");
  zremrangebylex = /* @__PURE__ */ __name((...e20) => this.chain(new od(e20, this.commandOptions)), "zremrangebylex");
  zremrangebyrank = /* @__PURE__ */ __name((...e20) => this.chain(new cd(e20, this.commandOptions)), "zremrangebyrank");
  zremrangebyscore = /* @__PURE__ */ __name((...e20) => this.chain(new ld(e20, this.commandOptions)), "zremrangebyscore");
  zrevrank = /* @__PURE__ */ __name((e20, t) => this.chain(new ud([e20, t], this.commandOptions)), "zrevrank");
  zscan = /* @__PURE__ */ __name((...e20) => this.chain(new dd(e20, this.commandOptions)), "zscan");
  zscore = /* @__PURE__ */ __name((e20, t) => this.chain(new hd([e20, t], this.commandOptions)), "zscore");
  zunionstore = /* @__PURE__ */ __name((...e20) => this.chain(new fd(e20, this.commandOptions)), "zunionstore");
  zunion = /* @__PURE__ */ __name((...e20) => this.chain(new pd(e20, this.commandOptions)), "zunion");
  get json() {
    return { arrappend: /* @__PURE__ */ __name((...e20) => this.chain(new tl(e20, this.commandOptions)), "arrappend"), arrindex: /* @__PURE__ */ __name((...e20) => this.chain(new rl(e20, this.commandOptions)), "arrindex"), arrinsert: /* @__PURE__ */ __name((...e20) => this.chain(new sl(e20, this.commandOptions)), "arrinsert"), arrlen: /* @__PURE__ */ __name((...e20) => this.chain(new nl(e20, this.commandOptions)), "arrlen"), arrpop: /* @__PURE__ */ __name((...e20) => this.chain(new il(e20, this.commandOptions)), "arrpop"), arrtrim: /* @__PURE__ */ __name((...e20) => this.chain(new al(e20, this.commandOptions)), "arrtrim"), clear: /* @__PURE__ */ __name((...e20) => this.chain(new ol(e20, this.commandOptions)), "clear"), del: /* @__PURE__ */ __name((...e20) => this.chain(new cl(e20, this.commandOptions)), "del"), forget: /* @__PURE__ */ __name((...e20) => this.chain(new ll(e20, this.commandOptions)), "forget"), get: /* @__PURE__ */ __name((...e20) => this.chain(new ul(e20, this.commandOptions)), "get"), merge: /* @__PURE__ */ __name((...e20) => this.chain(new dl(e20, this.commandOptions)), "merge"), mget: /* @__PURE__ */ __name((...e20) => this.chain(new hl(e20, this.commandOptions)), "mget"), mset: /* @__PURE__ */ __name((...e20) => this.chain(new pl(e20, this.commandOptions)), "mset"), numincrby: /* @__PURE__ */ __name((...e20) => this.chain(new fl(e20, this.commandOptions)), "numincrby"), nummultby: /* @__PURE__ */ __name((...e20) => this.chain(new ml(e20, this.commandOptions)), "nummultby"), objkeys: /* @__PURE__ */ __name((...e20) => this.chain(new gl(e20, this.commandOptions)), "objkeys"), objlen: /* @__PURE__ */ __name((...e20) => this.chain(new yl(e20, this.commandOptions)), "objlen"), resp: /* @__PURE__ */ __name((...e20) => this.chain(new wl(e20, this.commandOptions)), "resp"), set: /* @__PURE__ */ __name((...e20) => this.chain(new vl(e20, this.commandOptions)), "set"), strappend: /* @__PURE__ */ __name((...e20) => this.chain(new _l(e20, this.commandOptions)), "strappend"), strlen: /* @__PURE__ */ __name((...e20) => this.chain(new bl(e20, this.commandOptions)), "strlen"), toggle: /* @__PURE__ */ __name((...e20) => this.chain(new xl(e20, this.commandOptions)), "toggle"), type: /* @__PURE__ */ __name((...e20) => this.chain(new Sl(e20, this.commandOptions)), "type") };
  }
  get functions() {
    return { load: /* @__PURE__ */ __name((...e20) => this.chain(new dc(e20, this.commandOptions)), "load"), list: /* @__PURE__ */ __name((...e20) => this.chain(new uc(e20, this.commandOptions)), "list"), delete: /* @__PURE__ */ __name((...e20) => this.chain(new cc(e20, this.commandOptions)), "delete"), flush: /* @__PURE__ */ __name(() => this.chain(new lc(this.commandOptions)), "flush"), stats: /* @__PURE__ */ __name(() => this.chain(new hc(this.commandOptions)), "stats"), call: /* @__PURE__ */ __name((...e20) => this.chain(new nc(e20, this.commandOptions)), "call"), callRo: /* @__PURE__ */ __name((...e20) => this.chain(new ic(e20, this.commandOptions)), "callRo") };
  }
};
var ko = 1e3;
var iy = /* @__PURE__ */ new Set(["get", "getrange", "mget", "strlen", "bitcount", "bitpos", "getbit", "hexists", "hget", "hgetall", "hkeys", "hlen", "hmget", "hrandfield", "hscan", "hstrlen", "httl", "hvals", "hexpiretime", "hpexpiretime", "hpttl", "lindex", "llen", "lpos", "lrange", "scard", "sdiff", "sinter", "sintercard", "sismember", "smembers", "smismember", "srandmember", "sscan", "sunion", "zcard", "zcount", "zlexcount", "zmscore", "zrange", "zrank", "zrevrank", "zscan", "zscore", "zunion", "exists", "type", "ttl", "pttl", "randomkey", "touch", "pfcount", "xinfo", "xlen", "xpending", "xrange", "xread", "xrevrange", "geodist", "geohash", "geopos", "geosearch", "scriptExists", "evalRo", "evalshaRo", "dbsize", "echo", "ping", "time", "scan", "keys", "arrindex", "arrlen", "objkeys", "objlen", "resp", "list", "stats", "callRo"]);
var ay = /* @__PURE__ */ new Set(["scan", "keys", "flushdb", "flushall", "dbsize", "hscan", "hgetall", "hkeys", "lrange", "sscan", "smembers", "xrange", "xrevrange", "zscan", "zrange", "exec"]);
function Zn(e20, t = "root") {
  let r = e20;
  return r.autoPipelineExecutor || (r.autoPipelineExecutor = new oy(r)), new Proxy(r, { get: /* @__PURE__ */ __name((s, n) => {
    if (n === "pipelineCounter") return s.autoPipelineExecutor.pipelineCounter;
    if (t === "root" && n === "json") return Zn(s, "json");
    if (t === "root" && n === "functions") return Zn(s, "functions");
    if (t === "root") {
      let c = n in s && !(n in s.autoPipelineExecutor.pipeline), l = ay.has(n);
      if (c || l) return s[n];
    }
    let i = s.autoPipelineExecutor.pipeline, a = t === "json" ? i.json[n] : t === "functions" ? i.functions[n] : i[n];
    return typeof a == "function" ? (...c) => {
      let l = iy.has(n) ? "read" : "write";
      return s.autoPipelineExecutor.withAutoPipeline(l, (u) => {
        (t === "json" ? u.json[n] : t === "functions" ? u.functions[n] : u[n])(...c);
      });
    } : a;
  }, "get") });
}
__name(Zn, "Zn");
var oy = class {
  static {
    __name(this, "oy");
  }
  pipelinePromises = /* @__PURE__ */ new WeakMap();
  activeReadPipeline = null;
  activeWritePipeline = null;
  readIndex = 0;
  writeIndex = 0;
  redis;
  pipeline;
  pipelineCounter = 0;
  constructor(e20) {
    this.redis = e20, this.pipeline = e20.pipeline();
  }
  async withAutoPipeline(e20, t) {
    let r = e20 === "read", s = r ? this.activeReadPipeline : this.activeWritePipeline, n = s ?? this.redis.pipeline();
    s || (r ? (this.activeReadPipeline = n, this.readIndex = 0) : (this.activeWritePipeline = n, this.writeIndex = 0));
    let i = r ? this.readIndex++ : this.writeIndex++;
    t(n), r && this.readIndex >= ko ? this.activeReadPipeline = null : !r && this.writeIndex >= ko && (this.activeWritePipeline = null);
    let c = (await this.deferExecution().then(() => {
      if (!this.pipelinePromises.has(n)) {
        let l = n.exec({ keepErrors: true });
        this.pipelineCounter += 1, this.pipelinePromises.set(n, l), this.activeReadPipeline === n && (this.activeReadPipeline = null), this.activeWritePipeline === n && (this.activeWritePipeline = null);
      }
      return this.pipelinePromises.get(n);
    }))[i];
    if (c.error) throw new er(`Command failed: ${c.error}`);
    return c.result;
  }
  async deferExecution() {
    await Promise.resolve(), await Promise.resolve();
  }
};
var cy = class extends m {
  static {
    __name(this, "cy");
  }
  constructor(e20, t) {
    let r = { Accept: "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" };
    super([], { ...t, headers: r, path: ["psubscribe", ...e20], streamOptions: { isStreaming: true, onMessage: t?.streamOptions?.onMessage, signal: t?.streamOptions?.signal } });
  }
};
var To = class extends EventTarget {
  static {
    __name(this, "To");
  }
  subscriptions;
  client;
  listeners;
  opts;
  constructor(e20, t, r = false, s) {
    super(), this.client = e20, this.subscriptions = /* @__PURE__ */ new Map(), this.listeners = /* @__PURE__ */ new Map(), this.opts = s;
    for (let n of t) r ? this.subscribeToPattern(n) : this.subscribeToChannel(n);
  }
  subscribeToChannel(e20) {
    let t = new AbortController(), r = new ly([e20], { streamOptions: { signal: t.signal, onMessage: /* @__PURE__ */ __name((s) => this.handleMessage(s, false), "onMessage") } });
    r.exec(this.client).catch((s) => {
      s.name !== "AbortError" && this.dispatchToListeners("error", s);
    }), this.subscriptions.set(e20, { command: r, controller: t, isPattern: false });
  }
  subscribeToPattern(e20) {
    let t = new AbortController(), r = new cy([e20], { streamOptions: { signal: t.signal, onMessage: /* @__PURE__ */ __name((s) => this.handleMessage(s, true), "onMessage") } });
    r.exec(this.client).catch((s) => {
      s.name !== "AbortError" && this.dispatchToListeners("error", s);
    }), this.subscriptions.set(e20, { command: r, controller: t, isPattern: true });
  }
  handleMessage(e20, t) {
    let r = e20.replace(/^data:\s*/, ""), s = r.indexOf(","), n = r.indexOf(",", s + 1), i = t ? r.indexOf(",", n + 1) : -1;
    if (s !== -1 && n !== -1) {
      let a = r.slice(0, s);
      if (t && a === "pmessage" && i !== -1) {
        let o = r.slice(s + 1, n), c = r.slice(n + 1, i), l = r.slice(i + 1);
        try {
          let u = this.opts?.automaticDeserialization === false ? l : JSON.parse(l);
          this.dispatchToListeners("pmessage", { pattern: o, channel: c, message: u }), this.dispatchToListeners(`pmessage:${o}`, { pattern: o, channel: c, message: u });
        } catch (u) {
          this.dispatchToListeners("error", new Error(`Failed to parse message: ${u}`));
        }
      } else {
        let o = r.slice(s + 1, n), c = r.slice(n + 1);
        try {
          if (a === "subscribe" || a === "psubscribe" || a === "unsubscribe" || a === "punsubscribe") {
            let l = Number.parseInt(c);
            this.dispatchToListeners(a, l);
          } else {
            let l = this.opts?.automaticDeserialization === false ? c : uy(c);
            this.dispatchToListeners(a, { channel: o, message: l }), this.dispatchToListeners(`${a}:${o}`, { channel: o, message: l });
          }
        } catch (l) {
          this.dispatchToListeners("error", new Error(`Failed to parse message: ${l}`));
        }
      }
    }
  }
  dispatchToListeners(e20, t) {
    let r = this.listeners.get(e20);
    if (r) for (let s of r) s(t);
  }
  on(e20, t) {
    this.listeners.has(e20) || this.listeners.set(e20, /* @__PURE__ */ new Set()), this.listeners.get(e20)?.add(t);
  }
  removeAllListeners() {
    this.listeners.clear();
  }
  async unsubscribe(e20) {
    if (e20) for (let t of e20) {
      let r = this.subscriptions.get(t);
      if (r) {
        try {
          r.controller.abort();
        } catch {
        }
        this.subscriptions.delete(t);
      }
    }
    else {
      for (let t of this.subscriptions.values()) try {
        t.controller.abort();
      } catch {
      }
      this.subscriptions.clear(), this.removeAllListeners();
    }
  }
  getSubscribedChannels() {
    return [...this.subscriptions.keys()];
  }
};
var ly = class extends m {
  static {
    __name(this, "ly");
  }
  constructor(e20, t) {
    let r = { Accept: "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" };
    super([], { ...t, headers: r, path: ["subscribe", ...e20], streamOptions: { isStreaming: true, onMessage: t?.streamOptions?.onMessage, signal: t?.streamOptions?.signal } });
  }
};
var uy = /* @__PURE__ */ __name((e20) => {
  try {
    return JSON.parse(e20);
  } catch {
    return e20;
  }
}, "uy");
var dy = class {
  static {
    __name(this, "dy");
  }
  script;
  sha1;
  initPromise;
  redis;
  constructor(e20, t) {
    this.redis = e20, this.script = t, this.sha1 = "", this.init(t);
  }
  init(e20) {
    return this.initPromise || (this.initPromise = this.digest(e20).then((t) => {
      this.sha1 = t;
    })), this.initPromise;
  }
  async eval(e20, t) {
    return await this.init(this.script), await this.redis.eval(this.script, e20, t);
  }
  async evalsha(e20, t) {
    return await this.init(this.script), await this.redis.evalsha(this.sha1, e20, t);
  }
  async exec(e20, t) {
    return await this.init(this.script), await this.redis.evalsha(this.sha1, e20, t).catch(async (s) => {
      if (s instanceof Error && s.message.toLowerCase().includes("noscript")) return await this.redis.eval(this.script, e20, t);
      throw s;
    });
  }
  async digest(e20) {
    let t = new TextEncoder().encode(e20), r = await Os.digest("SHA-1", t);
    return [...new Uint8Array(r)].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
};
var hy = class {
  static {
    __name(this, "hy");
  }
  script;
  sha1;
  initPromise;
  redis;
  constructor(e20, t) {
    this.redis = e20, this.sha1 = "", this.script = t, this.init(t);
  }
  init(e20) {
    return this.initPromise || (this.initPromise = this.digest(e20).then((t) => {
      this.sha1 = t;
    })), this.initPromise;
  }
  async evalRo(e20, t) {
    return await this.init(this.script), await this.redis.evalRo(this.script, e20, t);
  }
  async evalshaRo(e20, t) {
    return await this.init(this.script), await this.redis.evalshaRo(this.sha1, e20, t);
  }
  async exec(e20, t) {
    return await this.init(this.script), await this.redis.evalshaRo(this.sha1, e20, t).catch(async (s) => {
      if (s instanceof Error && s.message.toLowerCase().includes("noscript")) return await this.redis.evalRo(this.script, e20, t);
      throw s;
    });
  }
  async digest(e20) {
    let t = new TextEncoder().encode(e20), r = await Os.digest("SHA-1", t);
    return [...new Uint8Array(r)].map((n) => n.toString(16).padStart(2, "0")).join("");
  }
};
var yd = class {
  static {
    __name(this, "yd");
  }
  client;
  opts;
  enableTelemetry;
  enableAutoPipelining;
  constructor(e20, t) {
    this.client = e20, this.opts = t, this.enableTelemetry = t?.enableTelemetry ?? true, t?.readYourWrites === false && (this.client.readYourWrites = false), this.enableAutoPipelining = t?.enableAutoPipelining ?? true;
  }
  get readYourWritesSyncToken() {
    return this.client.upstashSyncToken;
  }
  set readYourWritesSyncToken(e20) {
    this.client.upstashSyncToken = e20;
  }
  get json() {
    return { arrappend: /* @__PURE__ */ __name((...e20) => new tl(e20, this.opts).exec(this.client), "arrappend"), arrindex: /* @__PURE__ */ __name((...e20) => new rl(e20, this.opts).exec(this.client), "arrindex"), arrinsert: /* @__PURE__ */ __name((...e20) => new sl(e20, this.opts).exec(this.client), "arrinsert"), arrlen: /* @__PURE__ */ __name((...e20) => new nl(e20, this.opts).exec(this.client), "arrlen"), arrpop: /* @__PURE__ */ __name((...e20) => new il(e20, this.opts).exec(this.client), "arrpop"), arrtrim: /* @__PURE__ */ __name((...e20) => new al(e20, this.opts).exec(this.client), "arrtrim"), clear: /* @__PURE__ */ __name((...e20) => new ol(e20, this.opts).exec(this.client), "clear"), del: /* @__PURE__ */ __name((...e20) => new cl(e20, this.opts).exec(this.client), "del"), forget: /* @__PURE__ */ __name((...e20) => new ll(e20, this.opts).exec(this.client), "forget"), get: /* @__PURE__ */ __name((...e20) => new ul(e20, this.opts).exec(this.client), "get"), merge: /* @__PURE__ */ __name((...e20) => new dl(e20, this.opts).exec(this.client), "merge"), mget: /* @__PURE__ */ __name((...e20) => new hl(e20, this.opts).exec(this.client), "mget"), mset: /* @__PURE__ */ __name((...e20) => new pl(e20, this.opts).exec(this.client), "mset"), numincrby: /* @__PURE__ */ __name((...e20) => new fl(e20, this.opts).exec(this.client), "numincrby"), nummultby: /* @__PURE__ */ __name((...e20) => new ml(e20, this.opts).exec(this.client), "nummultby"), objkeys: /* @__PURE__ */ __name((...e20) => new gl(e20, this.opts).exec(this.client), "objkeys"), objlen: /* @__PURE__ */ __name((...e20) => new yl(e20, this.opts).exec(this.client), "objlen"), resp: /* @__PURE__ */ __name((...e20) => new wl(e20, this.opts).exec(this.client), "resp"), set: /* @__PURE__ */ __name((...e20) => new vl(e20, this.opts).exec(this.client), "set"), strappend: /* @__PURE__ */ __name((...e20) => new _l(e20, this.opts).exec(this.client), "strappend"), strlen: /* @__PURE__ */ __name((...e20) => new bl(e20, this.opts).exec(this.client), "strlen"), toggle: /* @__PURE__ */ __name((...e20) => new xl(e20, this.opts).exec(this.client), "toggle"), type: /* @__PURE__ */ __name((...e20) => new Sl(e20, this.opts).exec(this.client), "type") };
  }
  get functions() {
    return { load: /* @__PURE__ */ __name((...e20) => new dc(e20, this.opts).exec(this.client), "load"), list: /* @__PURE__ */ __name((...e20) => new uc(e20, this.opts).exec(this.client), "list"), delete: /* @__PURE__ */ __name((...e20) => new cc(e20, this.opts).exec(this.client), "delete"), flush: /* @__PURE__ */ __name(() => new lc(this.opts).exec(this.client), "flush"), stats: /* @__PURE__ */ __name(() => new hc(this.opts).exec(this.client), "stats"), call: /* @__PURE__ */ __name((...e20) => new nc(e20, this.opts).exec(this.client), "call"), callRo: /* @__PURE__ */ __name((...e20) => new ic(e20, this.opts).exec(this.client), "callRo") };
  }
  use = /* @__PURE__ */ __name((e20) => {
    let t = this.client.request.bind(this.client);
    this.client.request = (r) => e20(r, t);
  }, "use");
  addTelemetry = /* @__PURE__ */ __name((e20) => {
    if (this.enableTelemetry) try {
      this.client.mergeTelemetry(e20);
    } catch {
    }
  }, "addTelemetry");
  createScript(e20, t) {
    return t?.readonly ? new hy(this, e20) : new dy(this, e20);
  }
  get search() {
    return { createIndex: /* @__PURE__ */ __name((e20) => Kg(this.client, e20), "createIndex"), index: /* @__PURE__ */ __name((e20) => Do(this.client, e20), "index"), alias: { list: /* @__PURE__ */ __name(() => Wg(this.client), "list"), add: /* @__PURE__ */ __name(({ indexName: e20, alias: t }) => Gg(this.client, { indexName: e20, alias: t }), "add"), delete: /* @__PURE__ */ __name(({ alias: e20 }) => Jg(this.client, { alias: e20 }), "delete") } };
  }
  pipeline = /* @__PURE__ */ __name(() => new Eo({ client: this.client, commandOptions: this.opts, multiExec: false }), "pipeline");
  autoPipeline = /* @__PURE__ */ __name(() => Zn(this), "autoPipeline");
  multi = /* @__PURE__ */ __name(() => new Eo({ client: this.client, commandOptions: this.opts, multiExec: true }), "multi");
  bitfield = /* @__PURE__ */ __name((...e20) => new Fo(e20, this.client, this.opts), "bitfield");
  append = /* @__PURE__ */ __name((...e20) => new Bo(e20, this.opts).exec(this.client), "append");
  bitcount = /* @__PURE__ */ __name((...e20) => new Mo(e20, this.opts).exec(this.client), "bitcount");
  bitop = /* @__PURE__ */ __name((e20, t, r, ...s) => new qo([e20, t, r, ...s], this.opts).exec(this.client), "bitop");
  bitpos = /* @__PURE__ */ __name((...e20) => new zo(e20, this.opts).exec(this.client), "bitpos");
  clientSetinfo = /* @__PURE__ */ __name((...e20) => new Vo(e20, this.opts).exec(this.client), "clientSetinfo");
  copy = /* @__PURE__ */ __name((...e20) => new Ho(e20, this.opts).exec(this.client), "copy");
  dbsize = /* @__PURE__ */ __name(() => new Ko(this.opts).exec(this.client), "dbsize");
  decr = /* @__PURE__ */ __name((...e20) => new Wo(e20, this.opts).exec(this.client), "decr");
  decrby = /* @__PURE__ */ __name((...e20) => new Go(e20, this.opts).exec(this.client), "decrby");
  del = /* @__PURE__ */ __name((...e20) => new Jo(e20, this.opts).exec(this.client), "del");
  echo = /* @__PURE__ */ __name((...e20) => new Xo(e20, this.opts).exec(this.client), "echo");
  evalRo = /* @__PURE__ */ __name((...e20) => new Yo(e20, this.opts).exec(this.client), "evalRo");
  eval = /* @__PURE__ */ __name((...e20) => new Zo(e20, this.opts).exec(this.client), "eval");
  evalshaRo = /* @__PURE__ */ __name((...e20) => new Qo(e20, this.opts).exec(this.client), "evalshaRo");
  evalsha = /* @__PURE__ */ __name((...e20) => new ec(e20, this.opts).exec(this.client), "evalsha");
  exec = /* @__PURE__ */ __name((e20) => new ue(e20, this.opts).exec(this.client), "exec");
  exists = /* @__PURE__ */ __name((...e20) => new tc(e20, this.opts).exec(this.client), "exists");
  expire = /* @__PURE__ */ __name((...e20) => new rc(e20, this.opts).exec(this.client), "expire");
  expireat = /* @__PURE__ */ __name((...e20) => new sc(e20, this.opts).exec(this.client), "expireat");
  flushall = /* @__PURE__ */ __name((e20) => new ac(e20, this.opts).exec(this.client), "flushall");
  flushdb = /* @__PURE__ */ __name((...e20) => new oc(e20, this.opts).exec(this.client), "flushdb");
  geoadd = /* @__PURE__ */ __name((...e20) => new pc(e20, this.opts).exec(this.client), "geoadd");
  geopos = /* @__PURE__ */ __name((...e20) => new gc(e20, this.opts).exec(this.client), "geopos");
  geodist = /* @__PURE__ */ __name((...e20) => new fc(e20, this.opts).exec(this.client), "geodist");
  geohash = /* @__PURE__ */ __name((...e20) => new mc(e20, this.opts).exec(this.client), "geohash");
  geosearch = /* @__PURE__ */ __name((...e20) => new yc(e20, this.opts).exec(this.client), "geosearch");
  geosearchstore = /* @__PURE__ */ __name((...e20) => new wc(e20, this.opts).exec(this.client), "geosearchstore");
  get = /* @__PURE__ */ __name((...e20) => new vc(e20, this.opts).exec(this.client), "get");
  getbit = /* @__PURE__ */ __name((...e20) => new _c(e20, this.opts).exec(this.client), "getbit");
  getdel = /* @__PURE__ */ __name((...e20) => new bc(e20, this.opts).exec(this.client), "getdel");
  getex = /* @__PURE__ */ __name((...e20) => new xc(e20, this.opts).exec(this.client), "getex");
  getrange = /* @__PURE__ */ __name((...e20) => new Sc(e20, this.opts).exec(this.client), "getrange");
  getset = /* @__PURE__ */ __name((e20, t) => new Ec([e20, t], this.opts).exec(this.client), "getset");
  hdel = /* @__PURE__ */ __name((...e20) => new kc(e20, this.opts).exec(this.client), "hdel");
  hexists = /* @__PURE__ */ __name((...e20) => new Tc(e20, this.opts).exec(this.client), "hexists");
  hexpire = /* @__PURE__ */ __name((...e20) => new Ac(e20, this.opts).exec(this.client), "hexpire");
  hexpireat = /* @__PURE__ */ __name((...e20) => new Rc(e20, this.opts).exec(this.client), "hexpireat");
  hexpiretime = /* @__PURE__ */ __name((...e20) => new Cc(e20, this.opts).exec(this.client), "hexpiretime");
  httl = /* @__PURE__ */ __name((...e20) => new Xc(e20, this.opts).exec(this.client), "httl");
  hpexpire = /* @__PURE__ */ __name((...e20) => new Ic(e20, this.opts).exec(this.client), "hpexpire");
  hpexpireat = /* @__PURE__ */ __name((...e20) => new Pc(e20, this.opts).exec(this.client), "hpexpireat");
  hpexpiretime = /* @__PURE__ */ __name((...e20) => new Lc(e20, this.opts).exec(this.client), "hpexpiretime");
  hpttl = /* @__PURE__ */ __name((...e20) => new Nc(e20, this.opts).exec(this.client), "hpttl");
  hpersist = /* @__PURE__ */ __name((...e20) => new Oc(e20, this.opts).exec(this.client), "hpersist");
  hget = /* @__PURE__ */ __name((...e20) => new jc(e20, this.opts).exec(this.client), "hget");
  hgetall = /* @__PURE__ */ __name((...e20) => new Uc(e20, this.opts).exec(this.client), "hgetall");
  hgetdel = /* @__PURE__ */ __name((...e20) => new $c(e20, this.opts).exec(this.client), "hgetdel");
  hgetex = /* @__PURE__ */ __name((...e20) => new Bc(e20, this.opts).exec(this.client), "hgetex");
  hincrby = /* @__PURE__ */ __name((...e20) => new Mc(e20, this.opts).exec(this.client), "hincrby");
  hincrbyfloat = /* @__PURE__ */ __name((...e20) => new Fc(e20, this.opts).exec(this.client), "hincrbyfloat");
  hkeys = /* @__PURE__ */ __name((...e20) => new qc(e20, this.opts).exec(this.client), "hkeys");
  hlen = /* @__PURE__ */ __name((...e20) => new zc(e20, this.opts).exec(this.client), "hlen");
  hmget = /* @__PURE__ */ __name((...e20) => new Dc(e20, this.opts).exec(this.client), "hmget");
  hmset = /* @__PURE__ */ __name((e20, t) => new Vc([e20, t], this.opts).exec(this.client), "hmset");
  hrandfield = /* @__PURE__ */ __name((e20, t, r) => new $o([e20, t, r], this.opts).exec(this.client), "hrandfield");
  hscan = /* @__PURE__ */ __name((...e20) => new Hc(e20, this.opts).exec(this.client), "hscan");
  hset = /* @__PURE__ */ __name((e20, t) => new Kc([e20, t], this.opts).exec(this.client), "hset");
  hsetex = /* @__PURE__ */ __name((...e20) => new Wc(e20, this.opts).exec(this.client), "hsetex");
  hsetnx = /* @__PURE__ */ __name((e20, t, r) => new Gc([e20, t, r], this.opts).exec(this.client), "hsetnx");
  hstrlen = /* @__PURE__ */ __name((...e20) => new Jc(e20, this.opts).exec(this.client), "hstrlen");
  hvals = /* @__PURE__ */ __name((...e20) => new Yc(e20, this.opts).exec(this.client), "hvals");
  incr = /* @__PURE__ */ __name((...e20) => new Zc(e20, this.opts).exec(this.client), "incr");
  incrby = /* @__PURE__ */ __name((...e20) => new Qc(e20, this.opts).exec(this.client), "incrby");
  incrbyfloat = /* @__PURE__ */ __name((...e20) => new el(e20, this.opts).exec(this.client), "incrbyfloat");
  keys = /* @__PURE__ */ __name((...e20) => new El(e20, this.opts).exec(this.client), "keys");
  lindex = /* @__PURE__ */ __name((...e20) => new kl(e20, this.opts).exec(this.client), "lindex");
  linsert = /* @__PURE__ */ __name((e20, t, r, s) => new Tl([e20, t, r, s], this.opts).exec(this.client), "linsert");
  llen = /* @__PURE__ */ __name((...e20) => new Al(e20, this.opts).exec(this.client), "llen");
  lmove = /* @__PURE__ */ __name((...e20) => new Rl(e20, this.opts).exec(this.client), "lmove");
  lpop = /* @__PURE__ */ __name((...e20) => new Ol(e20, this.opts).exec(this.client), "lpop");
  lmpop = /* @__PURE__ */ __name((...e20) => new Cl(e20, this.opts).exec(this.client), "lmpop");
  lpos = /* @__PURE__ */ __name((...e20) => new Il(e20, this.opts).exec(this.client), "lpos");
  lpush = /* @__PURE__ */ __name((e20, ...t) => new Pl([e20, ...t], this.opts).exec(this.client), "lpush");
  lpushx = /* @__PURE__ */ __name((e20, ...t) => new Ll([e20, ...t], this.opts).exec(this.client), "lpushx");
  lrange = /* @__PURE__ */ __name((...e20) => new Nl(e20, this.opts).exec(this.client), "lrange");
  lrem = /* @__PURE__ */ __name((e20, t, r) => new jl([e20, t, r], this.opts).exec(this.client), "lrem");
  lset = /* @__PURE__ */ __name((e20, t, r) => new Ul([e20, t, r], this.opts).exec(this.client), "lset");
  ltrim = /* @__PURE__ */ __name((...e20) => new Dl(e20, this.opts).exec(this.client), "ltrim");
  mget = /* @__PURE__ */ __name((...e20) => new $l(e20, this.opts).exec(this.client), "mget");
  mset = /* @__PURE__ */ __name((e20) => new Bl([e20], this.opts).exec(this.client), "mset");
  msetnx = /* @__PURE__ */ __name((e20) => new Ml([e20], this.opts).exec(this.client), "msetnx");
  persist = /* @__PURE__ */ __name((...e20) => new Fl(e20, this.opts).exec(this.client), "persist");
  pexpire = /* @__PURE__ */ __name((...e20) => new ql(e20, this.opts).exec(this.client), "pexpire");
  pexpireat = /* @__PURE__ */ __name((...e20) => new zl(e20, this.opts).exec(this.client), "pexpireat");
  pfadd = /* @__PURE__ */ __name((...e20) => new Vl(e20, this.opts).exec(this.client), "pfadd");
  pfcount = /* @__PURE__ */ __name((...e20) => new Hl(e20, this.opts).exec(this.client), "pfcount");
  pfmerge = /* @__PURE__ */ __name((...e20) => new Kl(e20, this.opts).exec(this.client), "pfmerge");
  ping = /* @__PURE__ */ __name((e20) => new Wl(e20, this.opts).exec(this.client), "ping");
  psetex = /* @__PURE__ */ __name((e20, t, r) => new Gl([e20, t, r], this.opts).exec(this.client), "psetex");
  psubscribe = /* @__PURE__ */ __name((e20) => {
    let t = Array.isArray(e20) ? e20 : [e20];
    return new To(this.client, t, true, this.opts);
  }, "psubscribe");
  pttl = /* @__PURE__ */ __name((...e20) => new Jl(e20, this.opts).exec(this.client), "pttl");
  publish = /* @__PURE__ */ __name((...e20) => new Xl(e20, this.opts).exec(this.client), "publish");
  randomkey = /* @__PURE__ */ __name(() => new Yl().exec(this.client), "randomkey");
  rename = /* @__PURE__ */ __name((...e20) => new Zl(e20, this.opts).exec(this.client), "rename");
  renamenx = /* @__PURE__ */ __name((...e20) => new Ql(e20, this.opts).exec(this.client), "renamenx");
  rpop = /* @__PURE__ */ __name((...e20) => new eu(e20, this.opts).exec(this.client), "rpop");
  rpush = /* @__PURE__ */ __name((e20, ...t) => new tu([e20, ...t], this.opts).exec(this.client), "rpush");
  rpushx = /* @__PURE__ */ __name((e20, ...t) => new ru([e20, ...t], this.opts).exec(this.client), "rpushx");
  sadd = /* @__PURE__ */ __name((e20, t, ...r) => new su([e20, t, ...r], this.opts).exec(this.client), "sadd");
  scan(e20, t) {
    return new nu([e20, t], this.opts).exec(this.client);
  }
  scard = /* @__PURE__ */ __name((...e20) => new iu(e20, this.opts).exec(this.client), "scard");
  scriptExists = /* @__PURE__ */ __name((...e20) => new au(e20, this.opts).exec(this.client), "scriptExists");
  scriptFlush = /* @__PURE__ */ __name((...e20) => new ou(e20, this.opts).exec(this.client), "scriptFlush");
  scriptLoad = /* @__PURE__ */ __name((...e20) => new cu(e20, this.opts).exec(this.client), "scriptLoad");
  sdiff = /* @__PURE__ */ __name((...e20) => new lu(e20, this.opts).exec(this.client), "sdiff");
  sdiffstore = /* @__PURE__ */ __name((...e20) => new uu(e20, this.opts).exec(this.client), "sdiffstore");
  set = /* @__PURE__ */ __name((e20, t, r) => new du([e20, t, r], this.opts).exec(this.client), "set");
  setbit = /* @__PURE__ */ __name((...e20) => new hu(e20, this.opts).exec(this.client), "setbit");
  setex = /* @__PURE__ */ __name((e20, t, r) => new pu([e20, t, r], this.opts).exec(this.client), "setex");
  setnx = /* @__PURE__ */ __name((e20, t) => new fu([e20, t], this.opts).exec(this.client), "setnx");
  setrange = /* @__PURE__ */ __name((...e20) => new mu(e20, this.opts).exec(this.client), "setrange");
  sinter = /* @__PURE__ */ __name((...e20) => new gu(e20, this.opts).exec(this.client), "sinter");
  sintercard = /* @__PURE__ */ __name((...e20) => new yu(e20, this.opts).exec(this.client), "sintercard");
  sinterstore = /* @__PURE__ */ __name((...e20) => new wu(e20, this.opts).exec(this.client), "sinterstore");
  sismember = /* @__PURE__ */ __name((e20, t) => new vu([e20, t], this.opts).exec(this.client), "sismember");
  smismember = /* @__PURE__ */ __name((e20, t) => new bu([e20, t], this.opts).exec(this.client), "smismember");
  smembers = /* @__PURE__ */ __name((...e20) => new _u(e20, this.opts).exec(this.client), "smembers");
  smove = /* @__PURE__ */ __name((e20, t, r) => new xu([e20, t, r], this.opts).exec(this.client), "smove");
  spop = /* @__PURE__ */ __name((...e20) => new Su(e20, this.opts).exec(this.client), "spop");
  srandmember = /* @__PURE__ */ __name((...e20) => new Eu(e20, this.opts).exec(this.client), "srandmember");
  srem = /* @__PURE__ */ __name((e20, ...t) => new ku([e20, ...t], this.opts).exec(this.client), "srem");
  sscan = /* @__PURE__ */ __name((...e20) => new Tu(e20, this.opts).exec(this.client), "sscan");
  strlen = /* @__PURE__ */ __name((...e20) => new Au(e20, this.opts).exec(this.client), "strlen");
  subscribe = /* @__PURE__ */ __name((e20) => {
    let t = Array.isArray(e20) ? e20 : [e20];
    return new To(this.client, t, false, this.opts);
  }, "subscribe");
  sunion = /* @__PURE__ */ __name((...e20) => new Ru(e20, this.opts).exec(this.client), "sunion");
  sunionstore = /* @__PURE__ */ __name((...e20) => new Cu(e20, this.opts).exec(this.client), "sunionstore");
  time = /* @__PURE__ */ __name(() => new Ou().exec(this.client), "time");
  touch = /* @__PURE__ */ __name((...e20) => new Iu(e20, this.opts).exec(this.client), "touch");
  ttl = /* @__PURE__ */ __name((...e20) => new Pu(e20, this.opts).exec(this.client), "ttl");
  type = /* @__PURE__ */ __name((...e20) => new Lu(e20, this.opts).exec(this.client), "type");
  unlink = /* @__PURE__ */ __name((...e20) => new Nu(e20, this.opts).exec(this.client), "unlink");
  xadd = /* @__PURE__ */ __name((...e20) => new Du(e20, this.opts).exec(this.client), "xadd");
  xack = /* @__PURE__ */ __name((...e20) => new ju(e20, this.opts).exec(this.client), "xack");
  xackdel = /* @__PURE__ */ __name((...e20) => new Uu(e20, this.opts).exec(this.client), "xackdel");
  xdel = /* @__PURE__ */ __name((...e20) => new Mu(e20, this.opts).exec(this.client), "xdel");
  xdelex = /* @__PURE__ */ __name((...e20) => new Fu(e20, this.opts).exec(this.client), "xdelex");
  xgroup = /* @__PURE__ */ __name((...e20) => new qu(e20, this.opts).exec(this.client), "xgroup");
  xread = /* @__PURE__ */ __name((...e20) => new Wu(e20, this.opts).exec(this.client), "xread");
  xreadgroup = /* @__PURE__ */ __name((...e20) => new Gu(e20, this.opts).exec(this.client), "xreadgroup");
  xinfo = /* @__PURE__ */ __name((...e20) => new zu(e20, this.opts).exec(this.client), "xinfo");
  xlen = /* @__PURE__ */ __name((...e20) => new Vu(e20, this.opts).exec(this.client), "xlen");
  xpending = /* @__PURE__ */ __name((...e20) => new Hu(e20, this.opts).exec(this.client), "xpending");
  xclaim = /* @__PURE__ */ __name((...e20) => new Bu(e20, this.opts).exec(this.client), "xclaim");
  xautoclaim = /* @__PURE__ */ __name((...e20) => new $u(e20, this.opts).exec(this.client), "xautoclaim");
  xtrim = /* @__PURE__ */ __name((...e20) => new Xu(e20, this.opts).exec(this.client), "xtrim");
  xrange = /* @__PURE__ */ __name((...e20) => new Ku(e20, this.opts).exec(this.client), "xrange");
  xrevrange = /* @__PURE__ */ __name((...e20) => new Ju(e20, this.opts).exec(this.client), "xrevrange");
  zadd = /* @__PURE__ */ __name((...e20) => "score" in e20[1] ? new Ps([e20[0], e20[1], ...e20.slice(2)], this.opts).exec(this.client) : new Ps([e20[0], e20[1], ...e20.slice(2)], this.opts).exec(this.client), "zadd");
  zcard = /* @__PURE__ */ __name((...e20) => new Yu(e20, this.opts).exec(this.client), "zcard");
  zcount = /* @__PURE__ */ __name((...e20) => new Zu(e20, this.opts).exec(this.client), "zcount");
  zdiffstore = /* @__PURE__ */ __name((...e20) => new md(e20, this.opts).exec(this.client), "zdiffstore");
  zincrby = /* @__PURE__ */ __name((e20, t, r) => new Qu([e20, t, r], this.opts).exec(this.client), "zincrby");
  zinterstore = /* @__PURE__ */ __name((...e20) => new ed(e20, this.opts).exec(this.client), "zinterstore");
  zlexcount = /* @__PURE__ */ __name((...e20) => new td(e20, this.opts).exec(this.client), "zlexcount");
  zmscore = /* @__PURE__ */ __name((...e20) => new gd(e20, this.opts).exec(this.client), "zmscore");
  zpopmax = /* @__PURE__ */ __name((...e20) => new rd(e20, this.opts).exec(this.client), "zpopmax");
  zpopmin = /* @__PURE__ */ __name((...e20) => new sd(e20, this.opts).exec(this.client), "zpopmin");
  zrange = /* @__PURE__ */ __name((...e20) => new nd(e20, this.opts).exec(this.client), "zrange");
  zrank = /* @__PURE__ */ __name((e20, t) => new id([e20, t], this.opts).exec(this.client), "zrank");
  zrem = /* @__PURE__ */ __name((e20, ...t) => new ad([e20, ...t], this.opts).exec(this.client), "zrem");
  zremrangebylex = /* @__PURE__ */ __name((...e20) => new od(e20, this.opts).exec(this.client), "zremrangebylex");
  zremrangebyrank = /* @__PURE__ */ __name((...e20) => new cd(e20, this.opts).exec(this.client), "zremrangebyrank");
  zremrangebyscore = /* @__PURE__ */ __name((...e20) => new ld(e20, this.opts).exec(this.client), "zremrangebyscore");
  zrevrank = /* @__PURE__ */ __name((e20, t) => new ud([e20, t], this.opts).exec(this.client), "zrevrank");
  zscan = /* @__PURE__ */ __name((...e20) => new dd(e20, this.opts).exec(this.client), "zscan");
  zscore = /* @__PURE__ */ __name((e20, t) => new hd([e20, t], this.opts).exec(this.client), "zscore");
  zunion = /* @__PURE__ */ __name((...e20) => new pd(e20, this.opts).exec(this.client), "zunion");
  zunionstore = /* @__PURE__ */ __name((...e20) => new fd(e20, this.opts).exec(this.client), "zunionstore");
};
var wd = "v1.38.0";
var tr = /* @__PURE__ */ Symbol("build");
var pk = class Ns {
  static {
    __name(this, "Ns");
  }
  _noTokenize;
  _noStem;
  _from;
  constructor(t = { noTokenize: false }, r = { noStem: false }, s = { from: null }) {
    this._noTokenize = t, this._noStem = r, this._from = s;
  }
  noTokenize() {
    return new Ns({ noTokenize: true }, this._noStem, this._from);
  }
  noStem() {
    return new Ns(this._noTokenize, { noStem: true }, this._from);
  }
  from(t) {
    return new Ns(this._noTokenize, this._noStem, { from: t });
  }
  [tr]() {
    return { type: "TEXT", ...this._noTokenize.noTokenize ? { noTokenize: true } : {}, ...this._noStem.noStem ? { noStem: true } : {}, ...this._from.from ? { from: this._from.from } : {} };
  }
};
var fk = class vd {
  static {
    __name(this, "vd");
  }
  type;
  _from;
  constructor(t, r = { from: null }) {
    this.type = t, this._from = r;
  }
  from(t) {
    return new vd(this.type, { from: t });
  }
  [tr]() {
    return this._from.from ? { type: this.type, fast: true, from: this._from.from } : { type: this.type, fast: true };
  }
};
var mk = class ei {
  static {
    __name(this, "ei");
  }
  _fast;
  _from;
  constructor(t = { fast: false }, r = { from: null }) {
    this._fast = t, this._from = r;
  }
  fast() {
    return new ei({ fast: true }, this._from);
  }
  from(t) {
    return new ei(this._fast, { from: t });
  }
  [tr]() {
    let t = this._fast.fast, r = !!this._from.from;
    return t && r ? { type: "BOOL", fast: true, from: this._from.from } : t ? { type: "BOOL", fast: true } : r ? { type: "BOOL", from: this._from.from } : { type: "BOOL" };
  }
};
var gk = class ti {
  static {
    __name(this, "ti");
  }
  _fast;
  _from;
  constructor(t = { fast: false }, r = { from: null }) {
    this._fast = t, this._from = r;
  }
  fast() {
    return new ti({ fast: true }, this._from);
  }
  from(t) {
    return new ti(this._fast, { from: t });
  }
  [tr]() {
    let t = this._fast.fast, r = !!this._from.from;
    return t && r ? { type: "DATE", fast: true, from: this._from.from } : t ? { type: "DATE", fast: true } : r ? { type: "DATE", from: this._from.from } : { type: "DATE" };
  }
};
var yk = class {
  static {
    __name(this, "yk");
  }
  [tr]() {
    return { type: "KEYWORD" };
  }
};
var wk = class {
  static {
    __name(this, "wk");
  }
  [tr]() {
    return { type: "FACET" };
  }
};
typeof atob > "u" && (global.atob = (e20) => Buffer.from(e20, "base64").toString("utf8"));
var _d = class bd extends yd {
  static {
    __name(this, "bd");
  }
  constructor(t) {
    if ("request" in t) {
      super(t);
      return;
    }
    t.url ? (t.url.startsWith(" ") || t.url.endsWith(" ") || /\r|\n/.test(t.url)) && console.warn("[Upstash Redis] The redis url contains whitespace or newline, which can cause errors!") : console.warn("[Upstash Redis] The 'url' property is missing or undefined in your Redis config."), t.token ? (t.token.startsWith(" ") || t.token.endsWith(" ") || /\r|\n/.test(t.token)) && console.warn("[Upstash Redis] The redis token contains whitespace or newline, which can cause errors!") : console.warn("[Upstash Redis] The 'token' property is missing or undefined in your Redis config.");
    let r = new Io({ baseUrl: t.url, retry: t.retry, headers: { authorization: `Bearer ${t.token}` }, agent: t.agent, responseEncoding: t.responseEncoding, cache: t.cache ?? "no-store", signal: t.signal, keepAlive: t.keepAlive, readYourWrites: t.readYourWrites }), s = typeof process == "object" && process && typeof process.env == "object" && process.env ? process.env : {};
    super(r, { automaticDeserialization: t.automaticDeserialization, enableTelemetry: t.enableTelemetry ?? !s.UPSTASH_DISABLE_TELEMETRY, latencyLogging: t.latencyLogging, enableAutoPipelining: t.enableAutoPipelining });
    let n = typeof process == "object" && process ? process.version : void 0;
    if (this.addTelemetry({ runtime: typeof EdgeRuntime == "string" ? "edge-light" : n ? `node@${n}` : "unknown", platform: s.UPSTASH_CONSOLE ? "console" : s.VERCEL ? "vercel" : s.AWS_REGION ? "aws" : "unknown", sdk: `@upstash/redis@${wd}` }), this.enableAutoPipelining) return this.autoPipeline();
  }
  static fromEnv(t) {
    if (typeof process != "object" || !process || typeof process.env != "object" || !process.env) throw new TypeError('[Upstash Redis] Unable to get environment variables, `process.env` is undefined. If you are deploying to cloudflare, please import from "@upstash/redis/cloudflare" instead');
    let r = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    r || console.warn("[Upstash Redis] Unable to find environment variable: `UPSTASH_REDIS_REST_URL`");
    let s = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    return s || console.warn("[Upstash Redis] Unable to find environment variable: `UPSTASH_REDIS_REST_TOKEN`"), new bd({ ...t, url: r, token: s });
  }
};
var Qe;
function xd() {
  return true;
}
__name(xd, "xd");
function py() {
  let e20 = process.env.UPSTASH_REDIS_REST_URL, t = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Qe && Qe.url === e20 && Qe.token === t ? Qe.client : !e20 || !t ? (Qe = { url: e20, token: t, client: null }, Qe.client) : (Qe = { url: e20, token: t, client: new _d({ url: e20, token: t }) }, Qe.client);
}
__name(py, "py");
function Sd(e20) {
  let [t, r] = e20.split(" ");
  return Number(t) * (r === "s" ? 1e3 : r === "m" ? 6e4 : r === "h" ? 36e5 : 864e5);
}
__name(Sd, "Sd");
function fy(e20) {
  return e20.get("cf-connecting-ip") ?? e20.get("x-real-ip") ?? e20.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}
__name(fy, "fy");
function Ed(e20) {
  return fy(e20.headers);
}
__name(Ed, "Ed");
async function kd({ key: e20, requests: t, window: r }) {
  let s = py();
  if (!s) {
    let i = !xd();
    return { success: i, limit: t, remaining: i ? t : 0, reset: Date.now() + Sd(r), pending: Promise.resolve(), reason: "not_configured" };
  }
  let n = new ri.Ratelimit({ redis: s, limiter: ri.Ratelimit.slidingWindow(t, r), analytics: true, prefix: "roomza" });
  try {
    return await n.limit(e20);
  } catch {
    let i = !xd();
    return { success: i, limit: t, remaining: i ? t : 0, reset: Date.now() + Sd(r), pending: Promise.resolve(), reason: "provider_error" };
  }
}
__name(kd, "kd");
function Td(e20) {
  return { id: e20.id, providerId: e20.provider_id, label: e20.name, secondaryLabel: e20.region, fullAddress: e20.full_address, center: { lat: e20.center_lat, lng: e20.center_lng }, bounds: { west: e20.west, south: e20.south, east: e20.east, north: e20.north }, ...e20.extent_kind ? { extentKind: e20.extent_kind } : {} };
}
__name(Td, "Td");
var Rd = 5;
var my = h.array(h.string().uuid()).max(Rd);
var Ad = h.object({ id: h.string().uuid(), providerId: h.string().max(200), label: h.string().min(1).max(300), secondaryLabel: h.string().max(500), fullAddress: h.string().max(1e3), extentKind: h.enum(["source", "viewport"]).optional(), center: h.object({ lat: h.number().finite().min(-90).max(90), lng: h.number().finite().min(-180).max(180) }), bounds: h.object({ west: h.number().finite().min(-180).max(180), east: h.number().finite().min(-180).max(180), south: h.number().finite().min(-90).max(90), north: h.number().finite().min(-90).max(90) }) }).refine(({ center: e20, bounds: t }) => t.west < t.east && t.south < t.north && e20.lng >= t.west && e20.lng <= t.east && e20.lat >= t.south && e20.lat <= t.north);
var Cd = h.object({ data: h.object({ places: h.array(Ad).max(6), recentPlaces: h.array(Ad).max(Rd).default([]) }) });
function gy() {
  let { supabaseUrl: e20, supabaseAnonKey: t } = Xe();
  return Ce(e20, t, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: /* @__PURE__ */ __name((r, s) => fetch(r, { ...s, cache: "no-store", signal: s?.signal ? AbortSignal.any([s.signal, AbortSignal.timeout(4e3)]) : AbortSignal.timeout(4e3) }), "fetch") } });
}
__name(gy, "gy");
async function Od(e20) {
  if (!e20.length) return [];
  if (e20.length > 6) throw new Error("Read at most six locations");
  let { data: t, error: r } = await gy().rpc("read_discovery_places", { place_ids: e20 }, { get: true });
  if (r) throw r;
  return Cd.parse({ data: { places: (t ?? []).map(Td) } }).data.places;
}
__name(Od, "Od");
async function Id(e20) {
  return (await Od([e20]))[0] ?? null;
}
__name(Id, "Id");
var yy = h.object({ bbox: h.string().min(1, "Invalid bbox.").optional(), areaId: h.string().uuid().optional(), q: h.preprocess((e20) => typeof e20 != "string" ? e20 : Ur(e20) || void 0, h.string().max(120).optional()), minPrice: h.coerce.number().int().min(0).optional(), maxPrice: h.coerce.number().int().min(0).optional(), beds: h.coerce.number().int().min(0).optional(), baths: h.coerce.number().min(0).optional(), type: h.string().trim().min(1).max(50).optional(), mode: h.enum(["rent", "buy"]).default("rent"), availableNow: h.enum(["1", "true"]).optional().transform(Boolean), liveTours: h.enum(["1", "true"]).optional().transform(Boolean), instantViewings: h.enum(["1", "true"]).optional().transform(Boolean), repliesUnder5: h.enum(["1", "true"]).optional().transform(Boolean) });
async function Pd(e20) {
  let t = Wr(e20), r = Ed(e20), s = await kd({ key: `listings:${r}`, requests: 120, window: "1 m" });
  if (!s.success) return xe({ code: "rate_limited", message: "Too many listing requests. Try again later." }, 429, { requestId: t, headers: { "Retry-After": `${Math.max(1, Math.ceil((s.reset - Date.now()) / 1e3))}`, "X-RateLimit-Limit": `${s.limit}`, "X-RateLimit-Remaining": `${s.remaining}` } });
  let { searchParams: n } = new URL(e20.url), i = yy.safeParse({ bbox: n.get("bbox") || void 0, areaId: n.get("areaId") || void 0, q: n.get("q") || void 0, minPrice: n.get("minPrice") || void 0, maxPrice: n.get("maxPrice") || void 0, beds: n.get("beds") || void 0, baths: n.get("baths") || void 0, type: n.get("type") || void 0, mode: n.get("mode") || void 0, availableNow: n.get("availableNow") || void 0, liveTours: n.get("liveTours") || void 0, instantViewings: n.get("instantViewings") || void 0, repliesUnder5: n.get("repliesUnder5") || void 0 });
  if (!i.success) return xe({ code: "validation_failed", message: "Invalid listing query.", details: i.error.flatten() }, 400, { requestId: t });
  let { bbox: a, areaId: o, q: c, minPrice: l, maxPrice: u, beds: d, baths: f, type: p, mode: g, availableNow: y, liveTours: E, instantViewings: v, repliesUnder5: b } = i.data;
  if (!a && !o) return xe({ code: "validation_failed", message: "Choose a place or provide map bounds." }, 400, { requestId: t });
  let _ = a;
  if (!_ && o) try {
    let N = await Id(o);
    if (!N) return xe({ code: "not_found", message: "Place not found." }, 404, { requestId: t });
    let { west: $, south: Be, east: B, north: H } = N.bounds;
    _ = [$, Be, B, H].join(",");
  } catch (N) {
    return As.error("Listing place lookup failed", { requestId: t, error: N }), xe({ code: "server_error", message: "Unable to load place." }, 500, { requestId: t });
  }
  let O = Qa(_ ?? null);
  if ("error" in O) return xe({ code: "validation_failed", message: O.error ?? "Invalid bbox." }, 400, { requestId: t });
  let U = await eo(O.bbox, { q: c, minPrice: l, maxPrice: u, beds: d, baths: f, type: p, mode: g, availableNow: y, liveTours: E, instantViewings: v, repliesUnder5: b });
  return "error" in U ? (As.error("Listing viewport query failed", { requestId: t, error: U.error }), xe({ code: "server_error", message: "Unable to load listings." }, 500, { requestId: t })) : ("missingSpatialIndex" in U && U.missingSpatialIndex && As.warn("Listing viewport query used missing spatial index fallback", { requestId: t, missingIndex: "listings_location_gix" }), or({ listings: U.listings }, { requestId: t, headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } }));
}
__name(Pd, "Pd");
var wy = h.array(h.object({ id: h.string().uuid(), category: h.enum(["shopping", "tourism", "event", "service"]), savedCount: h.number().int().nonnegative(), media: h.array(h.object({ id: h.string().uuid(), path: h.string() })) }));
async function Mr(e20, t) {
  if (!e20.length) return e20;
  if (e20.length > 250) {
    let d = [];
    for (let f = 0; f < e20.length; f += 250) d.push(...await Mr(e20.slice(f, f + 250), t));
    return d;
  }
  let { supabaseUrl: r, supabaseAnonKey: s } = Xe(), n = Ce(r, s, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: /* @__PURE__ */ __name((d, f) => fetch(d, { ...f, cache: "no-store", signal: AbortSignal.timeout(1e4) }), "fetch") } }), i = e20.map((d) => ({ id: d.offerId ?? d.entryId ?? d.id, category: d.offerId ? "shopping" : d.category ?? t })), { data: a, error: o } = await n.rpc("discovery_card_presentation", { targets: i });
  if (o) throw o;
  let c = wy.parse(a), l = [...new Set(c.flatMap((d) => d.media.map((f) => f.path)))], u = /* @__PURE__ */ new Map();
  if (l.length) {
    let d = await n.storage.from("discovery-media").createSignedUrls(l, 3600);
    if (d.error) throw d.error;
    for (let f of d.data ?? []) f.path && f.signedUrl && u.set(f.path, f.signedUrl);
  }
  return e20.map((d, f) => {
    let p = c.find((g) => g.id === i[f].id && g.category === i[f].category);
    return p ? { ...d, savedCount: p.savedCount, media: p.media.flatMap((g) => u.has(g.path) ? [{ id: g.id, url: u.get(g.path) }] : []) } : d;
  });
}
__name(Mr, "Mr");
var js = { mediaIds: h.array(h.string().uuid()).max(20).refine((e20) => new Set(e20).size === e20.length, "Duplicate photos").optional(), mediaRightsConfirmed: h.boolean().optional() };
var vy = 10;
var Us = { ...js, mediaIds: js.mediaIds.unwrap().refine((e20) => e20.length <= vy, "Use up to ten photos.").optional() };
var Ds = { priceCents: h.number().int().min(0).max(2147483647).optional(), originalPriceCents: h.number().int().min(1).max(2147483647).optional() };
function rr(e20, t) {
  e20.originalPriceCents !== void 0 && (e20.priceCents === void 0 || e20.originalPriceCents <= e20.priceCents) && t.addIssue({ code: "custom", path: ["originalPriceCents"], message: "Original price must be higher than the special price." });
}
__name(rr, "rr");
var si = h.array(h.object({ id: h.string().uuid(), url: h.string().url() }).strict()).max(20);
var $s = { media: si.optional(), savedCount: h.number().int().nonnegative().optional() };
var Ld = h.string().trim().max(2048).url().refine((e20) => {
  try {
    let t = new URL(e20);
    return /^https:\/\//i.test(e20) && t.protocol === "https:" && !!t.hostname && !t.username && !t.password && !/[\s\\]/.test(e20);
  } catch {
    return false;
  }
}, "Use an absolute HTTPS link without embedded credentials.");
var Bs = { visitUrl: Ld.optional(), bookingUrl: Ld.optional() };
var Nd = h.object({ ...Us, ...Ds, ...Bs, publicContact: je.optional(), contactConsent: h.boolean().optional(), title: h.string().trim().min(1).max(160), benefit: h.string().trim().min(1).max(500), terms: h.string().trim().min(1).max(4e3), shopName: h.string().trim().min(1).max(160), areaId: h.string().uuid(), address: h.string().trim().min(1).max(500), latitude: h.number().finite().min(-90).max(90), longitude: h.number().finite().min(-180).max(180), startsAt: h.string().datetime({ offset: true }), endsAt: h.string().datetime({ offset: true }) }).strict();
var jd = Nd.superRefine(rr);
var aT = Nd.partial().superRefine(rr);
var et = h.string().uuid();
var de = h.string().datetime({ offset: true });
var xy = h.object({ id: et, name: h.string(), region: h.string(), fullAddress: h.string() }).strict();
var Sy = h.object({ username: h.string(), displayName: h.string() }).strict().nullable();
var Ud = { offerId: et, revisionId: et, confirmedAt: de, startsAt: de, endsAt: de, areaId: et };
var sr = h.object({ ...$s, ...Ud, status: h.literal("live"), content: jd, place: xy, poster: Sy }).strict();
var Ey = h.object({ ...Ud, status: h.enum(["scheduled", "expired"]), content: h.null(), place: h.null(), poster: h.null() }).strict();
var dT = h.union([sr.extend({ serverNow: de }), Ey.extend({ serverNow: de }), h.object({ status: h.literal("unavailable"), serverNow: de }).strict()]);
var ky = h.object({ confirmedAt: de, offerId: et }).strict();
var Ty = h.object({ serverNow: de, areaId: et, totalCount: h.number().int().nonnegative(), items: h.array(sr).max(20), nextCursor: ky.nullable() }).strict();
var hT = Ty.pick({ areaId: true, serverNow: true, totalCount: true });
var pT = h.object({ offerId: et, revisionId: et, serverNow: de, endsAt: de, shopName: h.string(), address: h.string(), latitude: h.number().finite().min(-90).max(90), longitude: h.number().finite().min(-180).max(180) }).strict().nullable();
var fT = h.object({ destination: h.string().url().refine((e20) => {
  let t = new URL(e20);
  return t.origin === "https://www.google.com" && t.pathname === "/maps/dir/" && t.searchParams.get("api") === "1" && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(t.searchParams.get("destination") ?? "") && [...t.searchParams.keys()].length === 2 && !t.hash && !t.username && !t.password;
}), serverNow: de, endsAt: de }).strict();
var ni = h.enum(["tourism", "event"]);
var Dd = h.object({ ...Us, ...Ds, ...Bs, publicContact: je.optional(), contactConsent: h.boolean().optional(), title: h.string().trim().min(1).max(160), description: h.string().trim().min(1).max(4e3), venueName: h.string().trim().min(1).max(160), areaId: h.string().uuid(), address: h.string().trim().min(1).max(500), latitude: h.number().finite().min(-90).max(90), longitude: h.number().finite().min(-180).max(180), startsAt: h.string().datetime({ offset: true }), endsAt: h.string().datetime({ offset: true }) }).strict();
var $d = Dd.superRefine(rr);
var _T = Dd.partial().superRefine(rr);
var Ot = h.object({ ...$s, entryId: h.string().uuid(), category: ni, content: $d, approvedAt: h.string().datetime({ offset: true }), state: h.enum(["upcoming", "live"]) }).strict();
var kT = h.object({ category: ni, areaId: h.string().uuid(), page: h.number().int().positive(), totalCount: h.number().int().nonnegative(), items: h.array(Ot).max(20), hasNext: h.boolean(), serverNow: h.string().datetime({ offset: true }) }).strict().superRefine((e20, t) => {
  e20.items.some((r) => r.category !== e20.category || r.content.areaId !== e20.areaId) && t.addIssue({ code: "custom", message: "Entry feed scope mismatch" });
});
var TT = h.object({ item: Ot.nullable(), serverNow: h.string().datetime({ offset: true }) }).strict();
var AT = h.object({ url: h.string().url(), endsAt: h.string().datetime({ offset: true }), serverNow: h.string().datetime({ offset: true }) }).strict().superRefine((e20, t) => {
  try {
    let r = new URL(e20.url);
    (r.origin !== "https://www.google.com" || r.pathname !== "/maps/dir/" || r.searchParams.get("api") !== "1" || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(r.searchParams.get("destination") ?? "") || [...r.searchParams.keys()].length !== 2 || r.hash || r.username || r.password) && t.addIssue({ code: "custom", message: "Invalid venue directions" });
  } catch {
    t.addIssue({ code: "custom", message: "Invalid venue directions" });
  }
});
var ii = ["Plumbing", "Electrical", "Cleaning", "Gardening", "Handyman", "Other"];
var ai = h.object({ ...js, publicContact: je.optional(), contactConsent: h.boolean().optional(), title: h.string().trim().min(1).max(160), providerName: h.string().trim().min(1).max(160), serviceType: h.enum(ii), description: h.string().trim().min(1).max(4e3), areaId: h.string().uuid(), address: h.string().trim().min(1).max(500), latitude: h.number().finite().min(-90).max(90), longitude: h.number().finite().min(-180).max(180), phone: h.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/) }).strict();
var Ay = ai.partial();
var PT = h.object({ guest_contact_exempt: h.boolean().optional(), id: h.string().uuid(), version: h.number().int().positive(), status: h.enum(["draft", "submitted", "approved", "rejected", "withdrawn"]), draft: Ay, submitted: ai.nullable(), updated_at: h.string() });
var Ms = h.object({ media: si.optional(), id: h.string().uuid(), area_id: h.string().uuid(), content: ai, approved_at: h.string() });
var LT = h.object({ item: Ms.nullable() });
var NT = h.object({ areaId: h.string().uuid(), totalCount: h.number().int().nonnegative(), page: h.number().int().positive(), items: h.array(Ms).max(20), hasNext: h.boolean() });
var Ry = h.enum(["shopping", "tourism", "event", "service"]);
var oi = h.object({ west: h.number().finite().min(-180).max(180), south: h.number().finite().min(-85).max(85), east: h.number().finite().min(-180).max(180), north: h.number().finite().min(-85).max(85) }).strict().refine((e20) => e20.west < e20.east && e20.south < e20.north, "Invalid map bounds");
function Bd(e20) {
  if (!e20 || !/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(e20)) return null;
  let [t, r, s, n] = e20.split(",").map(Number), i = oi.safeParse({ west: t, south: r, east: s, north: n });
  return i.success ? i.data : null;
}
__name(Bd, "Bd");
var qs = h.object({ category: Ry, bounds: oi, q: h.string().trim().max(120).default(""), sort: h.enum(["Ending soon", "Latest", "Nearest"]), serviceType: h.enum(["All services", ...ii]).default("All services") }).strict().refine((e20) => e20.category !== "service" || e20.sort !== "Ending soon", "Invalid service sort").refine((e20) => e20.category === "service" || e20.serviceType === "All services", "Invalid category filter");
var Fs = { bounds: oi, serverNow: h.string().datetime({ offset: true }), totalCount: h.number().int().nonnegative() };
var ci = h.discriminatedUnion("category", [h.object({ ...Fs, category: h.literal("shopping"), items: h.array(sr).max(250) }).strict(), h.object({ ...Fs, category: h.literal("tourism"), items: h.array(Ot).max(250) }).strict(), h.object({ ...Fs, category: h.literal("event"), items: h.array(Ot).max(250) }).strict(), h.object({ ...Fs, category: h.literal("service"), items: h.array(Ms).max(250) }).strict()]).superRefine((e20, t) => {
  e20.totalCount < e20.items.length && t.addIssue({ code: "custom", message: "Invalid count" });
  for (let r of e20.items) {
    let s = r.content, n = e20.bounds;
    (s.longitude < n.west || s.longitude > n.east || s.latitude < n.south || s.latitude > n.north || "category" in r && r.category !== e20.category) && t.addIssue({ code: "custom", message: "Viewport scope mismatch" });
  }
});
async function Md(e20, t) {
  let r = qs.parse(e20), { supabaseUrl: s, supabaseAnonKey: n } = Xe(), i = Ce(s, n, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: /* @__PURE__ */ __name((l, u) => fetch(l, { ...u, cache: "no-store", signal: AbortSignal.any([...t ? [t] : [], AbortSignal.timeout(1e4)]) }), "fetch") } }), { data: a, error: o } = await i.rpc("pinpoint_discovery_viewport", { category: r.category, ...r.bounds, search_query: r.q, sort_order: r.sort, service_type: r.serviceType });
  if (o) throw o;
  let c = ci.parse(a);
  if (c.category !== r.category || Object.keys(r.bounds).some((l) => c.bounds[l] !== r.bounds[l])) throw new Error("Wrong viewport");
  return ci.parse({ ...c, items: await Mr(c.items, r.category) });
}
__name(Md, "Md");
var zs = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
async function Fd(e20) {
  let t = new URL(e20.url).searchParams, r = ["category", "bbox", "q", "sort", "serviceType"];
  if ([...t.keys()].some((n) => !r.includes(n) || t.getAll(n).length !== 1)) return Response.json({ error: "Invalid map query." }, { status: 400, headers: zs });
  let s = qs.safeParse({ category: t.get("category"), bounds: Bd(t.get("bbox")), q: t.get("q") ?? "", sort: t.get("sort") ?? (t.get("category") === "service" ? "Latest" : "Ending soon"), serviceType: t.get("serviceType") ?? "All services" });
  if (!s.success) return Response.json({ error: "Invalid map query." }, { status: 400, headers: zs });
  try {
    return Response.json(await Md(s.data, e20.signal), { headers: zs });
  } catch {
    return Response.json({ error: "Visible listings could not be loaded. Try again." }, { status: 503, headers: zs });
  }
}
__name(Fd, "Fd");
var li = h.object({ category: h.enum(["shopping", "tourism", "event"]), id: h.string().uuid() }).strict();
var Cy = h.object({ authenticated: h.boolean(), serverNow: h.string(), targets: h.array(li), items: h.array(li.extend({ item: h.union([sr, Ot]).nullable() })) });
var Fr = /* @__PURE__ */ __name((e20, t = 200) => Response.json(e20, { status: t, headers: { "Cache-Control": "private, no-store" } }), "Fr");
async function Oy(e20 = false) {
  let t = await ye(), { data: r, error: s } = await t.rpc("saved_specials_read", { state_only: e20 });
  if (s) throw s;
  let n = Cy.parse(r);
  if (!e20) {
    let i = n.items.flatMap((c) => c.item ? [c.item] : []), a = await Mr(i), o = new Map(a.map((c) => ["offerId" in c ? "shopping:" + c.offerId : c.category + ":" + c.entryId, c]));
    n.items = n.items.map((c) => ({ ...c, item: c.item ? o.get(c.category + ":" + c.id) ?? c.item : null }));
  }
  return n;
}
__name(Oy, "Oy");
async function qd(e20) {
  try {
    if (e20.method === "GET") return Fr(await Oy(new URL(e20.url).searchParams.get("stateOnly") === "1"));
    if (e20.headers.get("origin") !== new URL(e20.url).origin) return Fr({ error: "Same-origin request required." }, 403);
    let t = li.parse(await e20.json()), r = await ye(), { data: { user: s } } = await r.auth.getUser();
    if (!s || s.is_anonymous) return Fr({ error: "Sign in to save Specials." }, 401);
    let { data: n, error: i } = await r.rpc("saved_specials_write", { category: t.category, target: t.id, save: e20.method === "POST" });
    if (i) throw i;
    return Fr(h.object({ saved: h.boolean(), savedCount: h.number().int().nonnegative() }).parse(n));
  } catch (t) {
    return Fr({ error: t instanceof h.ZodError ? "Invalid Special." : "Saved Specials could not be updated." }, t instanceof h.ZodError ? 422 : 503);
  }
}
__name(qd, "qd");
var zd = qd;
var Vd = ["property_saved", "viewing_scheduled", "viewing_completed", "contacted_seller", "negotiating", "sale_agreed", "purchase_complete"];
var fA = h.enum(Vd);
var bA = h.object({ listingId: h.string().uuid(), listingType: h.enum(["rent", "sale"]).optional() });
async function Hd(e20) {
  let t = Wr(e20), r = await ye(), { data: { user: s } } = await r.auth.getUser();
  if (!s) return or({ authenticated: false, favorites: [] }, { requestId: t, headers: { "cache-control": "private, no-store" } });
  let { data: n, error: i } = await r.from("user_favorites").select("listing_id").eq("user_id", s.id);
  return i ? xe({ code: "server_error", message: "Saved homes could not be loaded." }, 500, { requestId: t }) : or({ authenticated: true, favorites: (n ?? []).map((a) => a.listing_id) }, { requestId: t, headers: { "cache-control": "private, no-store" } });
}
__name(Hd, "Hd");
function Kd(e20) {
  return Hd(e20);
}
__name(Kd, "Kd");
var RA = h.object({ before: h.string().datetime({ offset: true }).optional(), beforeId: h.string().uuid().optional() }).strict().refine((e20) => !!e20.before == !!e20.beforeId, "Invalid notification page");
var Iy = { new_message: "New message", incoming_call: "Call update", new_application: "New application", application_status_changed: "Application update", viewing_proposed: "Viewing times proposed", viewing_booked: "Viewing booked", showing_request: "Showing requested", showing_accepted: "Showing accepted", showing_declined: "Showing declined", live_tour_started: "Live tour started", live_tour_scheduled: "Live tour scheduled", live_tour_reminder: "Live tour reminder", profile_document_expiry: "Document expiry", admin_alert: "Operations alert", moderation_update: "Moderation update", interaction_update: "Activity update", automatic_reminder: "Reminder", saved_item_update: "Saved item update", search_match: "Saved search match" };
var ae = /* @__PURE__ */ __name((e20) => h.string().uuid().safeParse(e20).success, "ae");
function Wd(e20) {
  let t = e20.payload && typeof e20.payload == "object" && !Array.isArray(e20.payload) ? e20.payload : {}, r = null;
  ae(t.conversationId) ? r = "/messages/" + t.conversationId : ae(t.listingId) ? r = "/listing/" + t.listingId : ae(t.serviceId) ? r = "/post/services" : ae(t.offerId) ? r = "/offers?detailId=" + t.offerId : ae(t.entryId) && ["tourism", "event"].includes(String(t.entryCategory)) ? r = "/offers?category=" + t.entryCategory + "&detailId=" + t.entryId : ae(t.applicationId) ? r = "/applications" : ae(t.documentId) ? r = "/profile/documents" : ["offer_posters", "entry_posters"].includes(String(t.sourceKind)) ? r = "/post/listings" : t.sourceKind === "profile_reviews" ? r = "/profile/reviews" : t.sourceKind === "account_security_events" ? r = "/settings/security" : t.sourceKind === "verification_checks" ? r = "/profile/verification" : t.sourceKind === "organization_invitations" || t.sourceKind === "organization_memberships" ? r = "/dashboard/organization" : t.sourceKind === "moderation_cases" ? r = "/profile/notifications" : ae(t.profileId) && (r = "/profile"), t.title === "Listing update" && (ae(t.serviceId) ? r = "/post/services" : ae(t.offerId) ? r = "/post/offers/" + t.offerId : ae(t.entryId) && ["tourism", "event"].includes(String(t.entryCategory)) && (r = "/post/entries/" + t.entryCategory + "/" + t.entryId)), t.sourceKind === "profile_contact_requests" && (r = typeof t.senderUsername == "string" && /^[a-z0-9_]{3,40}$/.test(t.senderUsername) ? "/u/" + t.senderUsername : "/profile/notifications"), e20.type === "admin_alert" && ae(t.caseId) && (r = "/admin/reports/" + t.caseId);
  let s = typeof t.senderName == "string" && t.senderName.trim() ? e20.type === "new_message" ? "Message from " + t.senderName : e20.type === "new_application" ? "Application from " + t.senderName : e20.type === "incoming_call" ? "Call with " + t.senderName : null : null;
  return { id: e20.id, title: s?.slice(0, 100) ?? (typeof t.title == "string" ? t.title.slice(0, 100) : Iy[e20.type] ?? "Account update"), message: typeof t.message == "string" && t.message.trim() ? t.message.slice(0, t.sourceKind === "profile_contact_requests" ? 1e3 : 600) : "You have a new account update.", createdAt: e20.created_at, unread: e20.read_at === null, href: r, ...e20.category ? { category: e20.category } : {}, ...t.sourceKind === "profile_contact_requests" && ae(t.requestId) ? { contactRequestId: t.requestId } : {} };
}
__name(Wd, "Wd");
var Py = ["messages", "applications", "viewings", "offers", "saved_searches", "security", "account_updates", "reviews", "verification"];
var Ly = h.enum(Py);
var Gd = h.object({ before: h.string().datetime({ offset: true }).optional(), beforeId: h.string().uuid().optional(), limit: h.coerce.number().int().min(1).max(50).default(30), unread: h.enum(["true", "false"]).optional(), category: Ly.optional() }).strict().refine((e20) => !!e20.before == !!e20.beforeId, "A complete cursor is required");
var Jd = h.discriminatedUnion("action", [h.object({ action: h.literal("read"), id: h.string().uuid() }).strict(), h.object({ action: h.literal("archive"), id: h.string().uuid() }).strict(), h.object({ action: h.literal("read_all"), through: h.string().datetime({ offset: true }) }).strict()]);
var Xd = h.object({ previews: h.boolean(), quietEnabled: h.boolean(), quietStart: h.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), quietEnd: h.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: h.string().max(80).refine((e20) => {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: e20 }), true;
  } catch {
    return false;
  }
}, "Invalid timezone") }).strict().refine((e20) => !e20.quietEnabled || e20.quietStart !== e20.quietEnd, "Quiet hours must differ");
var Yd = { previews: true, quietEnabled: false, quietStart: "21:00", quietEnd: "08:00", timezone: "Africa/Johannesburg" };
function Ny(e20) {
  try {
    let t = new URL(e20);
    return t.protocol === "https:" && !t.username && !t.password && !t.port && !t.hash && (t.hostname === "fcm.googleapis.com" || t.hostname === "updates.push.services.mozilla.com" || t.hostname === "web.push.apple.com" || t.hostname.endsWith(".push.apple.com") || t.hostname === "notify.windows.com" || t.hostname.endsWith(".notify.windows.com"));
  } catch {
    return false;
  }
}
__name(Ny, "Ny");
var Zd = h.object({ endpoint: h.string().max(2048).refine(Ny, "Unsupported push service"), keys: h.object({ p256dh: h.string().regex(/^[A-Za-z0-9_-]{87}$/), auth: h.string().regex(/^[A-Za-z0-9_-]{22}$/) }).strict(), label: h.string().trim().min(1).max(80) }).strict();
var jy = { "Cache-Control": "private, no-store", Vary: "Cookie" };
var te = /* @__PURE__ */ __name((e20, t = 200) => Response.json(e20, { status: t, headers: jy }), "te");
async function Uy() {
  let e20 = await ye(), { data: { user: t }, error: r } = await e20.auth.getUser();
  if (r || !t || t.is_anonymous) return null;
  let s = await e20.rpc("notification_access");
  return s.error || s.data !== true ? null : { client: e20, user: t };
}
__name(Uy, "Uy");
async function Qd(e20, t = "inbox") {
  try {
    if (e20.method !== "GET" && e20.headers.get("origin") !== new URL(e20.url).origin) return te({ error: "Same-origin request required." }, 403);
    let r = await Uy();
    if (!r) return te({ error: "Sign in with an active account to view notifications." }, 401);
    let { client: s, user: n } = r;
    if (t === "inbox") {
      if (e20.method === "GET") {
        let l = Gd.parse(Object.fromEntries(new URL(e20.url).searchParams)), { data: u, error: d } = await s.rpc("notification_client_flags");
        if (d) throw d;
        if (!u.inbox) return te({ userId: n.id, enabled: false, items: [], unreadCount: 0, next: null, serverNow: (/* @__PURE__ */ new Date()).toISOString() });
        let f = s.from("notification_events").select("id,type,category,payload,read_at,created_at").eq("recipient_id", n.id).eq("in_app_visible", true).is("archived_at", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(l.limit + 1);
        l.before && (f = f.or("created_at.lt." + l.before + ",and(created_at.eq." + l.before + ",id.lt." + l.beforeId + ")")), l.unread === "true" && (f = f.is("read_at", null)), l.category && (f = f.eq("category", l.category));
        let [p, g, y] = await Promise.all([f, s.from("notification_events").select("id", { count: "exact", head: true }).eq("recipient_id", n.id).eq("in_app_visible", true).is("archived_at", null).is("read_at", null), s.from("notification_options").select("timezone").eq("user_id", n.id).maybeSingle()]);
        if (p.error || g.error || y.error) throw p.error || g.error || y.error;
        let E = (p.data ?? []).slice(0, l.limit), v = E.at(-1), b = E.map(Wd), _ = b.flatMap((O) => O.contactRequestId ? [O.contactRequestId] : []);
        if (_.length) {
          let O = await s.rpc("notification_contact_states", { request_ids: _ });
          if (O.error) throw O.error;
          let U = new Map(O.data.map((N) => [N.id, N.handled]));
          b = b.map((N) => ({ ...N, contactHandled: N.contactRequestId ? U.get(N.contactRequestId) ?? false : void 0 }));
        }
        return te({ userId: n.id, enabled: true, timezone: y.data?.timezone ?? "Africa/Johannesburg", items: b, unreadCount: g.count ?? 0, next: (p.data ?? []).length > l.limit && v ? { before: v.created_at, beforeId: v.id } : null, serverNow: (/* @__PURE__ */ new Date()).toISOString() });
      }
      if (e20.method !== "PATCH") return te({ error: "Unsupported method." }, 405);
      let o = Jd.parse(await e20.json()), c = await s.rpc("notification_update_state", { action: o.action, target: "id" in o ? o.id : null, through: "through" in o ? o.through : null });
      if (c.error) throw c.error;
      return te({ changed: c.data });
    }
    if (t === "devices") {
      if (e20.method === "GET") {
        let l = await s.rpc("notification_device_manage", { command: "list" });
        if (l.error) throw l.error;
        return te({ devices: l.data });
      }
      if (e20.method === "DELETE") {
        let l = h.object({ id: h.string().uuid() }).strict().parse(await e20.json()), u = await s.rpc("notification_device_manage", { command: "remove", device: l.id });
        if (u.error) throw u.error;
        return te(u.data);
      }
      if (e20.method !== "POST") return te({ error: "Unsupported method." }, 405);
      let o = Zd.parse(await e20.json()), c = await s.rpc("notification_device_manage", { command: "register", subscription: o });
      if (c.error) throw c.error;
      return te(c.data);
    }
    if (e20.method === "GET") {
      let [o, c, l, u] = await Promise.all([s.from("notification_options").select("previews,quiet_enabled,quiet_start,quiet_end,timezone").eq("user_id", n.id).maybeSingle(), s.rpc("notification_device_manage", { command: "list" }), s.rpc("notification_client_flags"), s.from("notification_subscriptions").select("category,channel,enabled,frequency").eq("user_id", n.id)]);
      if (o.error || c.error || l.error || u.error) throw new Error("Settings unavailable");
      let d = o.data;
      return te({ options: d ? { previews: d.previews, quietEnabled: d.quiet_enabled, quietStart: d.quiet_start.slice(0, 5), quietEnd: d.quiet_end.slice(0, 5), timezone: d.timezone } : Yd, devices: c.data, flags: l.data, subscriptions: u.data, publicKey: "BP5R7gmlVQwKG4VSPGvtF-m72-5WitM7T9YlUIx4nw3DpjX6KHqvl3NHT6xvc9L4HjLxRxXRUEQS2lKscWY51O8" });
    }
    if (e20.method !== "PATCH") return te({ error: "Unsupported method." }, 405);
    let i = Xd.parse(await e20.json()), a = await s.from("notification_options").upsert({ user_id: n.id, previews: i.previews, quiet_enabled: i.quietEnabled, quiet_start: i.quietStart, quiet_end: i.quietEnd, timezone: i.timezone }, { onConflict: "user_id" });
    if (a.error) throw a.error;
    return te({ saved: true });
  } catch (r) {
    return te({ error: r instanceof h.ZodError ? "Invalid notification request." : "Notifications could not be updated. Please retry." }, r instanceof h.ZodError ? 422 : 503);
  }
}
__name(Qd, "Qd");
var eh = /* @__PURE__ */ __name((e20) => Qd(e20), "eh");
var Dy = /* @__PURE__ */ new Set(["/api/listings", "/api/discovery/viewport", "/api/saved-specials", "/api/favorites", "/api/notifications"]);
function th(e20) {
  return e20.method === "GET" && !e20.headers.has("next-action") && Dy.has(new URL(e20.url).pathname);
}
__name(th, "th");
var $y = { "/api/listings": Pd, "/api/discovery/viewport": Fd, "/api/saved-specials": zd, "/api/favorites": Kd, "/api/notifications": eh };
async function By(e20) {
  let t = await ye(), r;
  try {
    r = (await t.auth.getUser()).data.user;
  } catch {
    return null;
  }
  if (r) {
    let { data: s } = await t.rpc("is_current_account_active");
    if (s === false) return Response.json({ ok: false, error: { code: "account_suspended", message: "Account access is suspended." }, requestId: e20.headers.get("x-request-id") }, { status: 403, headers: { "cache-control": "private, no-store" } });
  }
  return null;
}
__name(By, "By");
var JA = { async fetch(e20) {
  if (!th(e20)) return new Response("Not found", { status: 404 });
  let t = new Headers(e20.headers);
  t.set("x-request-id", t.get("x-request-id") ?? crypto.randomUUID());
  let r = new Request(e20, { headers: t });
  return Wa(r, async () => {
    try {
      let s = await By(r) ?? await $y[new URL(r.url).pathname](r);
      return s.headers.set("x-request-id", t.get("x-request-id")), s;
    } catch {
      return Response.json({ ok: false, error: { code: "service_unavailable", message: "Unable to load results. Try again." } }, { status: 503, headers: { "cache-control": "private, no-store", "x-request-id": t.get("x-request-id") } });
    }
  });
} };
export {
  By as accountGuard,
  JA as default
};
//# sourceMappingURL=worker.js.map
