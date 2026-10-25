/** Opt-in genuine Auth/REST report and relationship checks in a labelled clone. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ actor: null as SupabaseClient | null, admin: null as SupabaseClient | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.actor }));
vi.mock("@/lib/supabase/admin", () => ({ createClient: () => state.admin, createUntypedClient: () => state.admin }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// Keep requireUser, report authorization and relationship actions real. Only the
// framework's request-bound client/cache/header adapters are supplied above.
import { submitModerationReport } from "@/features/admin/actions";
import { setProfileRelationshipAction } from "@/features/profile/actions";
import { sendMessage } from "@/features/chat/actions";

const cfg = process.env.PINPOINT_MESSAGING_RUNTIME ? JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME) : null;
const run = cfg ? describe : describe.skip;
const originalFetch = globalThis.fetch;
const tag = `contained-safety-${randomUUID()}`, password = `Fixture-${randomUUID()}aA1!`;
const accounts: Array<{ id: string; email: string }> = [], actors: SupabaseClient[] = [];
const listingId = randomUUID(), conversationId = randomUUID();
const messageIds = Array.from({ length: 6 }, () => randomUUID());
const report = (messageId: string) => ({ messageId, category: "harassment" as const, details: "Contained synthetic message report for runtime verification." });
async function actor(index: number) { state.actor = actors[index]!; }
function sql(query: string) {
  assert.match(cfg.dbName, /^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec = JSON.parse(execFileSync("docker", ["inspect", cfg.dbName], { encoding: "utf8" }))[0];
  assert.equal(spec.Config.Labels["pinpoint.release.run"], cfg.dbName.slice(0, -3));
  try {
    return execFileSync("docker", ["exec", "-i", "-e", `PGPASSWORD=${cfg.dbPassword}`, cfg.dbName, "psql", "-X", "-q", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch { throw new Error("Guarded messaging safety SQL failed; connection arguments withheld"); }
}
async function cases(messageId: string) {
  const result = await state.admin!.from("moderation_cases").select("id,reporter_id,message_id,category,target_context").eq("message_id", messageId);
  expect(result.error).toBeNull(); return result.data!;
}
async function messageEvents(id: string) {
  const result = await state.admin!.from("notification_events").select("id,actor_id").eq("idempotency_key", `new_message:${id}`);
  expect(result.error).toBeNull(); return result.data!;
}

run("Contained messaging safety", () => {
  beforeAll(async () => {
    assert.equal(cfg.supabaseUrl, "http://127.0.0.1:55431");
    for (const key of ["QSTASH_TOKEN", "RESEND_API_KEY", "VAPID_PRIVATE_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) expect(process.env[key]).toBeUndefined();
    globalThis.fetch = (input, init) => {
      assert.equal(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).origin, cfg.supabaseUrl, "Blocked external delivery");
      return originalFetch(input, init);
    };
    state.admin = createClient(cfg.supabaseUrl, cfg.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (let index = 0; index < 3; index++) {
      const email = `${tag}-${index}@pinpoint.invalid`;
      const created = await state.admin.auth.admin.createUser({ email, password, email_confirm: true }); expect(created.error).toBeNull();
      accounts.push({ id: created.data.user!.id, email });
      const client = createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull(); actors.push(client);
      sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${created.data.user!.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);
    }
    expect((await state.admin.from("listings").insert({ id: listingId, landlord_id: accounts[0]!.id, title: tag, address: "Synthetic fixture", price: 2500, listing_type: "rent", status: "draft" })).error).toBeNull();
    expect((await state.admin.from("conversations").insert({ id: conversationId, listing_id: listingId, renter_id: accounts[1]!.id, landlord_id: accounts[0]!.id, type: "inquiry" })).error).toBeNull();
    for (const [index, id] of messageIds.entries()) expect((await state.admin.from("messages").insert({ id, conversation_id: conversationId, listing_id: listingId, sender_id: accounts[index === 3 ? 1 : 0]!.id, content: `Contained report target ${index}` })).error).toBeNull();
  });
  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (!state.admin) return;
    for (const client of actors) await client.auth.signOut();
    for (const account of accounts) {
      expect((await state.admin.from("account_suspensions").delete().eq("user_id", account.id)).error).toBeNull();
      expect((await state.admin.from("moderation_cases").delete().eq("reporter_id", account.id)).error).toBeNull();
      expect((await state.admin.from("profile_blocks").delete().eq("blocker_id", account.id)).error).toBeNull();
      expect((await state.admin.from("profile_mutes").delete().eq("muter_id", account.id)).error).toBeNull();
      expect((await state.admin.from("notification_events").delete().eq("recipient_id", account.id)).error).toBeNull();
    }
    expect((await state.admin.from("messages").delete().eq("conversation_id", conversationId)).error).toBeNull();
    expect((await state.admin.from("conversations").delete().eq("id", conversationId)).error).toBeNull();
    expect((await state.admin.from("listings").delete().eq("id", listingId)).error).toBeNull();
    for (const account of accounts) expect((await state.admin.auth.admin.deleteUser(account.id)).error).toBeNull();
  });
  it("persists one participant report when submissions race or repeat", async () => {
    await actor(1); const results = await Promise.all([submitModerationReport(report(messageIds[0]!)), submitModerationReport(report(messageIds[0]!))]);
    expect(results.filter(result => result.success)).toHaveLength(1);
    expect(results.filter(result => !result.success)).toEqual([expect.objectContaining({ error: "You already have an open report for this item." })]);
    const saved = await cases(messageIds[0]!); expect(saved).toEqual([expect.objectContaining({ reporter_id: accounts[1]!.id, message_id: messageIds[0], category: "harassment", target_context: { conversationId, listingId } })]);
    expect((await submitModerationReport(report(messageIds[0]!))).success).toBe(false); expect(await cases(messageIds[0]!)).toHaveLength(1);
  });
  it("rejects own-message, outsider, anonymous and forged direct REST reports", async () => {
    await actor(0); expect((await submitModerationReport(report(messageIds[1]!))).success).toBe(false);
    await actor(2); expect((await submitModerationReport(report(messageIds[1]!))).success).toBe(false);
    expect((await submitModerationReport({ ...report(messageIds[1]!), listingId })).success).toBe(false);
    const raw = await actors[2]!.from("moderation_cases").insert({ reporter_id: accounts[2]!.id, message_id: messageIds[1], category: "harassment", details: "Contained outsider direct REST report attempt." });
    expect.soft(raw.error?.code, "Raw REST must not bypass private-message ownership").toBe("42501");
    const forged = await actors[2]!.from("moderation_cases").insert({ reporter_id: accounts[1]!.id, message_id: messageIds[1], category: "harassment", details: "Contained forged reporter attempt." });
    expect.soft(forged.error?.code).toBe("42501");
    const read = await actors[2]!.from("moderation_cases").select("id").eq("message_id", messageIds[0]!);
    expect([null, "42501"]).toContain(read.error?.code ?? null); expect(read.data ?? []).toEqual([]);
    state.actor = createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await submitModerationReport(report(messageIds[1]!))).success).toBe(false);
    expect.soft(await cases(messageIds[1]!)).toHaveLength(0);
  });
  it("retains a committed report after response loss and prevents a duplicate retry", async () => {
    await actor(1); const containedFetch = globalThis.fetch; let lost = false;
    try {
      globalThis.fetch = async (input, init) => {
        const response = await containedFetch(input, init);
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        if (!lost && url.pathname === "/rest/v1/moderation_cases" && init?.method === "POST" && response.ok) {
          lost = true; await response.arrayBuffer();
          return new Response(JSON.stringify({ message: "Contained report response loss" }), { status: 503, headers: { "content-type": "application/json" } });
        }
        return response;
      };
      expect((await submitModerationReport(report(messageIds[2]!))).success).toBe(false); expect(lost).toBe(true);
    } finally { globalThis.fetch = containedFetch; }
    expect(await cases(messageIds[2]!)).toHaveLength(1);
    expect(await submitModerationReport(report(messageIds[2]!))).toMatchObject({ success: false, error: "You already have an open report for this item." });
    expect(await cases(messageIds[2]!)).toHaveLength(1);
  });
  it("denies revoked-session reporting and permits a fresh session", async () => {
    const saved = await actors[0]!.auth.getSession(); const token = saved.data.session!.access_token;
    const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    expect((await state.admin!.auth.admin.signOut(token, "global")).error).toBeNull();
    const active = await state.admin!.rpc("pinpoint_active_session", { actor_id: accounts[0]!.id, actor_session_id: claims.session_id }); expect(active.error).toBeNull(); expect(active.data).toBe(false);
    await actor(0); expect.soft((await submitModerationReport(report(messageIds[3]!))).success).toBe(false);
    expect.soft(await cases(messageIds[3]!)).toHaveLength(0);
    expect((await actors[0]!.auth.signInWithPassword({ email: accounts[0]!.email, password })).error).toBeNull();
    expect.soft((await submitModerationReport(report(messageIds[3]!))).success).toBe(true);
  });
  it("denies reports from a suspended participant and permits a restored account", async () => {
    expect((await state.admin!.from("account_suspensions").insert({ user_id: accounts[1]!.id, reason: "Contained suspension fixture", suspended_until: new Date(Date.now() + 3600_000).toISOString() })).error).toBeNull();
    try {
      await actor(1); expect.soft((await submitModerationReport(report(messageIds[4]!))).success).toBe(false);
      expect.soft(await cases(messageIds[4]!)).toHaveLength(0);
    } finally { expect((await state.admin!.from("account_suspensions").delete().eq("user_id", accounts[1]!.id)).error).toBeNull(); }
    expect((await submitModerationReport(report(messageIds[4]!))).success).toBe(true);
  });
  it("mutes alerts without blocking messages and restores alerts on unmute", async () => {
    await actor(1); expect((await setProfileRelationshipAction({ profileId: accounts[0]!.id, relationship: "mute", enabled: true })).success).toBe(true);
    try {
      await actor(0); const id = randomUUID(); expect((await sendMessage(conversationId, "Contained muted message", listingId, id)).success).toBe(true);
      const stored = await state.admin!.from("messages").select("id").eq("id", id); expect(stored.error).toBeNull(); expect(stored.data).toHaveLength(1);
      expect.soft(await messageEvents(id), "Muted actors must not produce a recipient alert").toHaveLength(0);
    } finally { await actor(1); expect((await setProfileRelationshipAction({ profileId: accounts[0]!.id, relationship: "mute", enabled: false })).success).toBe(true); }
    await actor(0); const id = randomUUID(); expect((await sendMessage(conversationId, "Contained unmuted message", listingId, id)).success).toBe(true); expect(await messageEvents(id)).toHaveLength(1);
  });
  it("blocks sends in both directions, denies foreign changes and recovers on unblock", async () => {
    await actor(1); expect((await setProfileRelationshipAction({ profileId: accounts[0]!.id, relationship: "block", enabled: true })).success).toBe(true);
    try {
      for (const index of [0, 1]) { await actor(index); const id = randomUUID(); expect((await sendMessage(conversationId, "Contained blocked send", listingId, id)).success).toBe(false); expect(await messageEvents(id)).toHaveLength(0); }
      const forged = await actors[2]!.from("profile_blocks").upsert({ blocker_id: accounts[1]!.id, blocked_id: accounts[0]!.id }); expect(forged.error).not.toBeNull();
      const removed = await actors[2]!.from("profile_blocks").delete().eq("blocker_id", accounts[1]!.id).eq("blocked_id", accounts[0]!.id); expect(removed.error).toBeNull();
      const preserved = await state.admin!.from("profile_blocks").select("blocker_id").eq("blocker_id", accounts[1]!.id).eq("blocked_id", accounts[0]!.id); expect(preserved.error).toBeNull(); expect(preserved.data).toHaveLength(1);
    } finally { await actor(1); expect((await setProfileRelationshipAction({ profileId: accounts[0]!.id, relationship: "block", enabled: false })).success).toBe(true); }
    await actor(0); expect((await sendMessage(conversationId, "Contained send after unblock", listingId, randomUUID())).success).toBe(true);
  });
});
