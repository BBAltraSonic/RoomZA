/** Real disposable Auth/REST/SQL/Storage; synthetic venues, not hosted/device proof. */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCloneAdvisors } from "./clone-advisors.local.mjs";
import { publicEntryDetailSchema, publicEntryFeedSchema } from "../../src/features/entries/public-contract";

const cfg = process.env.PINPOINT_MESSAGING_RUNTIME ? JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME) : null;
const run = cfg ? describe : describe.skip, originalFetch = globalThis.fetch;
const tag = `contained-entries-${randomUUID()}`, password = `Fixture-${randomUUID()}aA1!`;
const accounts: Array<{ id: string; email: string }> = [], actors: SupabaseClient[] = [];
let admin: SupabaseClient, guest: SupabaseClient, reviewerAal1: SupabaseClient, mfaSecret = "";
let place: Record<string, unknown> & { id: string; name: string; center_lat: number; center_lng: number };
type Category = "tourism" | "event";
type Fixture = { id: string; category: Category; version: number; revision: string; content: Record<string, unknown>; media?: { id: string; path: string; bytes: Buffer } };

function sql(query: string) {
  assert.match(cfg.dbName, /^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec = JSON.parse(execFileSync("docker", ["inspect", cfg.dbName], { encoding: "utf8" }))[0];
  assert.equal(spec.Config.Labels["pinpoint.release.run"], cfg.dbName.slice(0, -3));
  try {
    return execFileSync("docker", ["exec", "-i", "-e", `PGPASSWORD=${cfg.dbPassword}`, cfg.dbName, "psql", "-X", "-q", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (error) {
    const diagnostic = String((error as { stderr?: unknown }).stderr ?? "").split(/\r?\n/).find(line => /^ERROR:/.test(line)) ?? "SQL failed";
    throw Error(`Guarded entries fixture SQL failed: ${diagnostic.replaceAll(cfg.dbPassword, "[withheld]").slice(0, 240)}; connection arguments withheld`);
  }
}
function otp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")].map(c => { const n = alphabet.indexOf(c); assert.ok(n >= 0); return n.toString(2).padStart(5, "0"); }).join("");
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map(value => parseInt(value, 2))), counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", bytes).update(counter).digest();
  return ((digest.readUInt32BE(digest[digest.length - 1]! & 15) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
const make = () => createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(index: number) { expect((await actors[index]!.auth.signInWithPassword({ email: accounts[index]!.email, password })).error?.code ?? null).toBeNull(); }
const write = (actor: SupabaseClient, f: Fixture, command: string, payload: Record<string, unknown> = {}, revision?: string) => actor.rpc("pinpoint_entry_write", {
  category: f.category, target: f.id, command, expected_version: f.version, payload, ...(revision ? { revision } : {}),
});
async function change(f: Fixture, command: string, payload: Record<string, unknown> = {}, revision?: string) {
  const result = await write(actors[0]!, f, command, payload, revision); expect(result.error).toBeNull();
  expect(result.data).toMatchObject({ entryId: f.id, category: f.category });
  f.version = result.data.version; if (revision) f.revision = revision; return result.data;
}
async function create(category: Category): Promise<Fixture> {
  const f: Fixture = { id: randomUUID(), category, version: 0, revision: randomUUID(), content: {} };
  await change(f, "create"); expect(f.version).toBe(1); return f;
}
const draft = (extra: Record<string, unknown> = {}) => ({ title: tag, description: "Synthetic venue and dates for contained QA only.", venueName: "Contained fixture venue",
  areaId: place.id, address: `Contained fixture near ${place.name}`, latitude: Number(place.center_lat), longitude: Number(place.center_lng),
  startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(),
  publicContact: { email: accounts[0]!.email }, contactConsent: true, priceCents: 10000, originalPriceCents: 12000,
  visitUrl: "https://contained.pinpoint.invalid/visit", bookingUrl: "https://contained.pinpoint.invalid/book", ...extra });
async function upload(f: Fixture) {
  const bytes = readFileSync(`${cfg.sourceRoot}/public/icon.png`);
  const reserved = await actors[0]!.rpc("discovery_media_manage", { command: "reserve", category: f.category, target: f.id, expected_version: f.version, mime: "image/png", bytes: bytes.length });
  expect(reserved.error).toBeNull(); const media = reserved.data as { id: string; path: string };
  assert.ok(media.path.startsWith(`${accounts[0]!.id}/${f.id}/`));
  expect((await actors[0]!.storage.from("discovery-media").upload(media.path, bytes, { contentType: "image/png", upsert: false })).error).toBeNull();
  expect((await actors[0]!.rpc("discovery_media_manage", { command: "complete", category: f.category, target: f.id, media: media.id })).error).toBeNull();
  f.media = { ...media, bytes }; return f.media;
}
async function submitted(category: Category, extra: Record<string, unknown> = {}) {
  const f = await create(category), media = await upload(f); f.content = draft({ mediaIds: [media.id], mediaRightsConfirmed: true, ...extra });
  await change(f, "save", f.content); await change(f, "submit", {}, f.revision); return f;
}
const permission = (actor: SupabaseClient, f: Fixture) => actor.rpc("pinpoint_entry_confirm_permission", { category: f.category, target: f.id, revision: f.revision, expected_version: f.version });
const approve = (actor: SupabaseClient, f: Fixture) => actor.rpc("pinpoint_entry_approve", { category: f.category, target: f.id, revision: f.revision, expected_version: f.version,
  authority_notes: "Synthetic fixture authority and photo rights checked; no real venue claim.", location_notes: "Actual packaged catalogue row matched to synthetic point, address and dates.", media_state: "reviewed" });
async function published(category: Category, extra: Record<string, unknown> = {}) {
  const f = await submitted(category, extra); expect((await permission(actors[0]!, f)).error).toBeNull();
  const result = await approve(actors[2]!, f); expect(result.error).toBeNull(); f.version = result.data.version; return f;
}
async function detail(f: Fixture) { const result = await guest.rpc("pinpoint_entry_public_detail", { target: f.id }); expect(result.error).toBeNull(); return publicEntryDetailSchema.parse(result.data); }
async function row(f: Fixture) { const result = await admin.from("pinpoint_entries").select("*").eq("id", f.id).single(); expect(result.error).toBeNull(); return result.data!; }
const save = (f: Fixture, value = true) => actors[1]!.rpc("saved_specials_write", { category: f.category, target: f.id, save: value });

run("Contained Places and Events lifecycle", () => {
  beforeAll(async () => {
    assert.equal(cfg.supabaseUrl, "http://127.0.0.1:55431"); assert.equal(cfg.storageEnabled, true);
    for (const key of ["RESEND_API_KEY", "QSTASH_TOKEN", "VAPID_PRIVATE_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) expect(process.env[key]).toBeUndefined();
    globalThis.fetch = (input, init) => { const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); assert.equal(url.origin, cfg.supabaseUrl, "Blocked non-clone entries request"); return originalFetch(input, init); };
    admin = createClient(cfg.supabaseUrl, cfg.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }); guest = make();
    for (let index = 0; index < 4; index++) {
      const email = `${tag}-${index}@pinpoint.invalid`, created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); expect(created.error?.code ?? null).toBeNull();
      const id = created.data.user!.id; assert.match(id, /^[0-9a-f-]{36}$/); accounts.push({ id, email }); actors.push(make()); await signIn(index);
      sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);
    }
    const catalogue = JSON.parse(gunzipSync(readFileSync(`${cfg.sourceRoot}/public/data/south-africa-places.json.gz`)).toString("utf8"));
    const sourced = catalogue.records.find((item: { provider_id: string }) => item.provider_id === "geonames:993800"); assert.equal(sourced?.name, "Johannesburg"); assert.ok(sourced.sources.length > 0);
    expect((await admin.rpc("import_discovery_place_batch", { records: [sourced] })).error).toBeNull();
    const stored = await guest.from("discovery_places").select("*").eq("provider_id", sourced.provider_id).single(); expect(stored.error).toBeNull(); place = stored.data!;
    for (const index of [0, 3]) for (const category of ["tourism", "event"]) expect((await actors[index]!.rpc("pinpoint_entry_enroll", { category })).error).toBeNull();
    sql(`insert into public.admin_memberships(user_id,level) values('${accounts[2]!.id}','admin')`);
    reviewerAal1 = make(); expect((await reviewerAal1.auth.signInWithPassword({ email: accounts[2]!.email, password })).error?.code ?? null).toBeNull();
    expect((await actors[2]!.rpc("pinpoint_entry_review_queue", {})).error?.code).toBe("42501");
    const factor = await actors[2]!.auth.mfa.enroll({ factorType: "totp", friendlyName: tag }); expect(factor.error?.code ?? null).toBeNull(); assert.equal(factor.data!.type, "totp"); mfaSecret = factor.data!.totp.secret;
    expect((await actors[2]!.auth.mfa.challengeAndVerify({ factorId: factor.data!.id, code: otp(mfaSecret) })).error?.code ?? null).toBeNull();
    expect((await actors[2]!.auth.getClaims()).data?.claims.aal).toBe("aal2");
  }, 60000);
  afterAll(async () => { try { for (const actor of [...actors, reviewerAal1].filter(Boolean)) await actor.auth.signOut({ scope: "local" }); } finally { globalThis.fetch = originalFetch; } });

  describe.each(["tourism", "event"] as const)("%s", category => {
    it("keeps drafts private and denies guest, foreign-owner and direct writes", async () => {
      const f = await create(category); await change(f, "save", { title: tag }); expect((await row(f)).draft.title).toBe(tag); expect((await detail(f)).item).toBeNull();
      expect((await guest.from("pinpoint_entries").select("id").eq("id", f.id)).error).not.toBeNull();
      expect((await actors[3]!.from("pinpoint_entries").select("id").eq("id", f.id)).data).toEqual([]);
      expect((await actors[0]!.from("pinpoint_entries").update({ draft: { title: "Forbidden raw write" } }).eq("id", f.id)).error).not.toBeNull();
      expect((await write(actors[3]!, f, "save", { title: "Foreign attempt" })).error?.code).toBe("42501");
      expect((await row(f)).version).toBe(2);
    });
    it("requires real photos, publishing rights and valid future dates", async () => {
      const f = await create(category); await change(f, "save", draft()); expect((await write(actors[0]!, f, "submit", {}, f.revision)).error).not.toBeNull();
      const media = await upload(f); await change(f, "save", draft({ mediaIds: [media.id], mediaRightsConfirmed: false }));
      expect((await write(actors[0]!, f, "submit", {}, f.revision)).error).not.toBeNull();
      await change(f, "save", draft({ mediaIds: [media.id], mediaRightsConfirmed: true, endsAt: new Date(Date.now() - 120000).toISOString() }));
      expect((await write(actors[0]!, f, "submit", {}, f.revision)).error).not.toBeNull(); expect((await row(f)).pending_revision_id).toBeNull();
    });
    it("requires separate exact-revision permission and genuine AAL2 review", async () => {
      const f = await submitted(category); expect((await detail(f)).item).toBeNull();
      expect((await approve(actors[2]!, f)).error).not.toBeNull();
      expect((await permission(actors[3]!, f)).error?.code).toBe("42501");
      expect((await permission(actors[0]!, { ...f, revision: randomUUID() })).error).not.toBeNull();
      expect((await permission(actors[0]!, f)).data).toMatchObject({ entryId: f.id, category, revisionId: f.revision, version: f.version, confirmed: true });
      for (const actor of [actors[0]!, reviewerAal1]) expect((await approve(actor, f)).error?.code).toBe("42501");
      const result = await approve(actors[2]!, f); expect(result.error).toBeNull(); expect(result.data).toMatchObject({ version: f.version + 1, pendingRevisionId: null });
      expect((await detail(f)).item).toMatchObject({ entryId: f.id, category, state: "live", content: { title: f.content.title, areaId: place.id, priceCents: 10000 } });
    });
    it("stores actual private photo bytes and protects foreign media access", async () => {
      const f = await submitted(category); const media = f.media!;
      const signed = await actors[0]!.storage.from("discovery-media").createSignedUrl(media.path, 60); expect(signed.error).toBeNull();
      const downloaded = await fetch(signed.data!.signedUrl); expect(downloaded.status).toBe(200); expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(media.bytes);
      expect((await actors[3]!.storage.from("discovery-media").createSignedUrl(media.path, 60)).error).not.toBeNull();
      expect((await guest.storage.from("discovery-media").createSignedUrl(media.path, 60)).error).not.toBeNull();
    });
    it("allows one concurrent save and returns a real stale-version conflict", async () => {
      const f = await create(category); const results = await Promise.all([write(actors[0]!, f, "save", { title: "Concurrent first" }), write(actors[0]!, f, "save", { title: "Concurrent second" })]);
      expect(results.filter(r => !r.error)).toHaveLength(1); expect(results.find(r => r.error)?.error?.code).toBe("PT409"); expect((await row(f)).version).toBe(2);
    });
    it("preserves an approved snapshot on private save, then requires fresh review and withdrawal stays hidden", async () => {
      const f = await published(category); await change(f, "save", { ...f.content, title: "Fresh private replacement" }); expect((await detail(f)).item?.content.title).toBe(f.content.title);
      await change(f, "submit", {}, randomUUID()); expect((await detail(f)).item).toBeNull(); expect((await approve(actors[2]!, f)).error).not.toBeNull();
      const rejected = await actors[2]!.rpc("pinpoint_entry_reject", { category, target: f.id, revision: f.revision, expected_version: f.version, reason: "Synthetic correction required" }); expect(rejected.error).toBeNull(); f.version = rejected.data.version;
      expect((await detail(f)).item).toBeNull(); expect((await actors[0]!.rpc("pinpoint_entry_owner_publication", { category, target: f.id })).data.correction).toBe("Synthetic correction required");
      await change(f, "submit", {}, randomUUID()); expect((await permission(actors[0]!, f)).error).toBeNull(); const approved = await approve(actors[2]!, f); expect(approved.error).toBeNull(); f.version = approved.data.version;
      expect((await detail(f)).item?.content.title).toBe("Fresh private replacement"); await change(f, "withdraw"); expect((await detail(f)).item).toBeNull();
      expect((await approve(actors[2]!, f)).error).not.toBeNull(); expect((await detail(f)).item).toBeNull();
    });
    it("saves for an ordinary consumer without enrollment, denies wrong categories and retains private preferences", async () => {
      const f = await published(category); expect((await save(f)).error).toBeNull(); expect((await save(f)).error).toBeNull();
      expect((await actors[1]!.from("entry_posters").select("category")).data).toEqual([]);
      const stored = await actors[1]!.rpc("saved_specials_read", { state_only: false }); expect(stored.error).toBeNull(); expect(JSON.stringify(stored.data)).toContain(f.id);
      expect((await actors[1]!.rpc("saved_specials_write", { category: category === "event" ? "tourism" : "event", target: f.id, save: true })).error).not.toBeNull();
      expect((await actors[3]!.rpc("saved_specials_read", { state_only: false })).data.items).toEqual([]);
      expect((await save(f, false)).error).toBeNull(); expect((await actors[1]!.rpc("saved_specials_read", { state_only: false })).data.items.some((item: { id: string }) => item.id === f.id)).toBe(false);
    });
    it("redacts suspended or revoked posters and denies a revoked reviewer", async () => {
      const f = await published(category), pending = await submitted(category); expect((await permission(actors[0]!, pending)).error).toBeNull();
      try {
        sql(`update public.entry_posters set revoked_at=clock_timestamp() where user_id='${accounts[0]!.id}' and category='${category}'`);
        expect((await detail(f)).item).toBeNull(); expect((await write(actors[0]!, f, "save", f.content)).error?.code).toBe("42501");
      } finally { sql(`update public.entry_posters set revoked_at=null where user_id='${accounts[0]!.id}' and category='${category}'`); }
      expect((await detail(f)).item).not.toBeNull();
      try {
        sql(`insert into public.account_suspensions(user_id,reason) values('${accounts[0]!.id}','${tag}')`); expect((await detail(f)).item).toBeNull(); expect((await write(actors[0]!, f, "save", f.content)).error?.code).toBe("42501");
      } finally { sql(`delete from public.account_suspensions where user_id='${accounts[0]!.id}' and reason='${tag}'`); }
      try {
        sql(`update public.admin_memberships set revoked_at=clock_timestamp() where user_id='${accounts[2]!.id}'`); expect((await approve(actors[2]!, pending)).error?.code).toBe("42501"); expect((await detail(pending)).item).toBeNull();
      } finally { sql(`update public.admin_memberships set revoked_at=null where user_id='${accounts[2]!.id}'`); }
    });
    it("denies private writes after session revocation or deadline and restores a fresh eligible login", async () => {
      const f = await create(category);
      for (const mode of ["revoked", "deadline"]) {
        const session = (await actors[0]!.auth.getSession()).data.session!; const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1]!, "base64url").toString()); assert.match(claims.session_id, /^[0-9a-f-]{36}$/);
        sql(mode === "revoked" ? `delete from auth.sessions where id='${claims.session_id}' and user_id='${accounts[0]!.id}'` : `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${claims.session_id}' and user_id='${accounts[0]!.id}'`);
        expect((await write(actors[0]!, f, "save", { title: "Denied stale session" })).error?.code).toBe("42501"); expect((await actors[0]!.from("pinpoint_entries").select("id").eq("id", f.id)).data).toEqual([]);
        await signIn(0); await change(f, "save", { title: "Recovered eligible session" });
      }
    });
  });
  it("distinguishes future Places from Upcoming Events using the actual server clock", async () => {
    const startsAt = new Date(Date.now() + 3600000).toISOString(), endsAt = new Date(Date.now() + 7200000).toISOString();
    const tourism = await published("tourism", { startsAt, endsAt }), event = await published("event", { startsAt, endsAt });
    expect((await detail(tourism)).item).toBeNull(); expect((await detail(event)).item).toMatchObject({ category: "event", state: "upcoming" });
    const result = await guest.rpc("pinpoint_entry_public_feed", { category: "event", area: place.id, page: 1 }); expect(result.error).toBeNull();
    const feed = publicEntryFeedSchema.parse(result.data); expect(feed.items.some(item => item.entryId === event.id)).toBe(true); expect(feed.items.every(item => item.category === "event")).toBe(true);
  });
  it("keeps caller-derived mutation wrappers unprivileged and denies anonymous private mutations", () => {
    for (const name of ["pinpoint_entry_write", "pinpoint_entry_confirm_permission", "pinpoint_entry_approve", "pinpoint_entry_unpublish"]) {
      expect(sql(`select bool_and(not prosecdef and not has_function_privilege('anon',oid,'EXECUTE') and has_function_privilege('authenticated',oid,'EXECUTE')) from pg_proc where pronamespace='public'::regnamespace and proname='${name}'`)).toBe("t");
    }
  });
  it("runs read-only database advisors on the labelled entries clone", async () => { expect((await runCloneAdvisors(cfg, `${cfg.sourceRoot}/artifacts/user-flow-entries-advisors.json`)).passed).toBe(true); });
  if (cfg?.browserScript) it("browser journey uses real cloned Places and Events accounts and MFA", () => {
    execFileSync(process.execPath, ["C:/Users/BB/.agents/skills/playwright/run.js", cfg.browserScript], { cwd: cfg.sourceRoot, env: { ...process.env, PINPOINT_MESSAGING_BROWSER_CONFIG: JSON.stringify({ ...cfg, accounts, password, place, mfaSecret, tag }) }, stdio: "inherit", windowsHide: true });
  }, 1200000);
});
