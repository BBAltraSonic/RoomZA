/** Opt-in real Auth/REST/SQL messaging checks. All writes stay in a labelled clone. */
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAnyPersona: vi.fn() }));
import { getConversation, getConversations, getMessages, markConversationRead, sendMessage } from "@/features/chat/actions";
import { declineCall, endCall, getActiveCall, joinCall, startCall } from "@/features/chat/call-actions";
const cfg = process.env.PINPOINT_MESSAGING_RUNTIME ? JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME) : null;
const run = cfg ? describe : describe.skip;
const originalFetch = globalThis.fetch;
const actors: SupabaseClient[] = [], accounts: Array<{ id: string; email: string }> = [];
const tag = `contained-message-${randomUUID()}`, password = `Fixture-${randomUUID()}aA1!`;
const listingId = randomUUID(), conversationId = randomUUID();
async function actor(index: number) { state.actor = actors[index]!; }
async function rows(id?: string) {
  const query = state.admin!.from("messages").select("id,content,sender_id,read_at").eq("conversation_id", conversationId).order("id");
  const result = id ? await query.eq("id", id) : await query;
  expect(result.error).toBeNull(); return result.data!;
}
async function events(id: string) {
  const result = await state.admin!.from("notification_events").select("id,recipient_id,idempotency_key").eq("idempotency_key", `new_message:${id}`);
  expect(result.error).toBeNull(); return result.data!;
}
run("Contained messaging runtime", () => {
  beforeAll(async () => {
    assert.equal(cfg.supabaseUrl, "http://127.0.0.1:55431");
    assert.match(cfg.dbName, /^pinpoint-release-[0-9a-f-]{36}-db$/);
    for (const key of ["QSTASH_TOKEN", "RESEND_API_KEY", "VAPID_PRIVATE_KEY"]) expect(process.env[key]).toBeUndefined();
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
    }
    expect((await state.admin.from("listings").insert({ id: listingId, landlord_id: accounts[0]!.id, title: tag, address: "Synthetic fixture", price: 2500, listing_type: "rent", status: "draft" })).error).toBeNull();
    expect((await state.admin.from("conversations").insert({ id: conversationId, listing_id: listingId, renter_id: accounts[1]!.id, landlord_id: accounts[0]!.id, type: "inquiry" })).error).toBeNull();
    if (cfg.browserScript) {
      const saved = await state.admin.from("listings").update({ metadata: { publicContact: { email: accounts[0]!.email }, contactConsent: true } }).eq("id", listingId).select("updated_at").single(); expect(saved.error).toBeNull();
      for (let n = 0; n < 3; n++) expect((await state.admin.from("listing_images").insert({ listing_id: listingId, bucket: "listing-images", path: `${accounts[0]!.id}/${listingId}/${n}.png`, public_url: "http://localhost:3112/icon.png", sort_order: n })).error).toBeNull();
      const claims = await actors[0]!.auth.getClaims(); expect(claims.error).toBeNull();
      expect((await state.admin.rpc("pinpoint_property_lifecycle", { actor_id: accounts[0]!.id, actor_session_id: String(claims.data!.claims.session_id), target: listingId, expected_updated_at: saved.data!.updated_at, command: "publish" })).error).toBeNull();
    }
  });
  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (!state.admin) return;
    for (const client of actors) await client.auth.signOut();
    for (const account of accounts) expect((await state.admin.from("notification_events").delete().eq("recipient_id", account.id)).error).toBeNull();
    expect((await state.admin.from("messages").delete().eq("conversation_id", conversationId)).error).toBeNull();
    expect((await state.admin.from("conversations").delete().eq("id", conversationId)).error).toBeNull();
    expect((await state.admin.from("listings").delete().eq("id", listingId)).error).toBeNull();
    for (const account of accounts) expect((await state.admin.auth.admin.deleteUser(account.id)).error).toBeNull();
  });
  it("persists a message, reuses its UUID on retry and records one recipient event", async () => {
    await actor(1); const id = randomUUID();
    for (let n = 0; n < 2; n++) {
      const sent = await sendMessage(conversationId, "Contained hello", listingId, id);
      expect(sent.success, JSON.stringify(sent)).toBe(true);
      if (sent.success) expect(sent.data.message.id).toBe(id);
    }
    expect(await rows(id)).toHaveLength(1);
    const notification = await events(id); expect(notification).toHaveLength(1); expect(notification[0]!.recipient_id).toBe(accounts[0]!.id);
    for (const index of [0, 1]) { await actor(index); expect((await getMessages(conversationId)).some(message => message.id === id)).toBe(true); }
  });
  it("recovers a committed insert whose REST response is lost", async () => {
    await actor(1); const id = randomUUID(); let lost = false;
    const containedFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input, init) => {
        const response = await containedFetch(input, init);
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        if (!lost && url.pathname === "/rest/v1/messages" && init?.method === "POST" && response.ok) {
          lost = true; await response.arrayBuffer();
          return new Response(JSON.stringify({ message: "Contained response loss" }), { status: 503, headers: { "content-type": "application/json" } });
        }
        return response;
      };
      const sent = await sendMessage(conversationId, "Contained response recovery", listingId, id);
      expect(lost).toBe(true); expect(sent.success, JSON.stringify(sent)).toBe(true);
    } finally { globalThis.fetch = containedFetch; }
    expect((await sendMessage(conversationId, "Contained response recovery", listingId, id)).success).toBe(true);
    expect(await rows(id)).toHaveLength(1); expect(await events(id)).toHaveLength(1);
  });
  it("serializes concurrent retries through the message primary key", async () => {
    await actor(1); const id = randomUUID();
    const results = await Promise.all([sendMessage(conversationId, "Contained simultaneous retry", listingId, id), sendMessage(conversationId, "Contained simultaneous retry", listingId, id)]);
    expect(results.every(result => result.success), JSON.stringify(results)).toBe(true);
    expect(await rows(id)).toHaveLength(1); expect(await events(id)).toHaveLength(1);
  });
  it("does not overwrite a sent message when its UUID is reused with different text", async () => {
    await actor(1); const id = randomUUID();
    expect((await sendMessage(conversationId, "Contained original", listingId, id)).success).toBe(true);
    expect((await sendMessage(conversationId, "Contained replacement", listingId, id)).success).toBe(false);
    expect((await rows(id))[0]!.content).toBe("Contained original"); expect(await events(id)).toHaveLength(1);
  });
  it("keeps outsider and anonymous reads/sends outside the conversation", async () => {
    const before = await rows();
    await actor(2);
    expect(await getConversation(conversationId)).toBeNull(); expect(await getMessages(conversationId)).toEqual([]); expect(await getConversations()).toEqual([]);
    const denied = randomUUID(); expect((await sendMessage(conversationId, "Contained outsider", listingId, denied)).success).toBe(false); expect(await events(denied)).toHaveLength(0);
    expect((await markConversationRead(conversationId)).success).toBe(false);
    const raw = await actors[2]!.from("messages").select("id").eq("conversation_id", conversationId); expect(raw.error).toBeNull(); expect(raw.data).toEqual([]);
    state.actor = createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    expect((await sendMessage(conversationId, "Contained anonymous", listingId, randomUUID())).success).toBe(false);
    expect(await rows()).toEqual(before);
  });
  it("persists recipient read receipts and leaves the recipient's own messages unread", async () => {
    await actor(0); const replyId = randomUUID(); expect((await sendMessage(conversationId, "Contained reply", listingId, replyId)).success).toBe(true);
    expect((await markConversationRead(conversationId)).success).toBe(true);
    const saved = await rows(); expect(saved.filter(message => message.sender_id === accounts[1]!.id).every(message => Boolean(message.read_at))).toBe(true);
    expect(saved.find(message => message.id === replyId)!.read_at).toBeNull();
    await actor(1); expect((await markConversationRead(conversationId)).success).toBe(true);
    expect((await rows(replyId))[0]!.read_at).toBeTruthy();
    expect((await markConversationRead(conversationId)).success).toBe(true);
  });
  it("rejects blocked sends, invalid content and mismatched listing context without new records", async () => {
    const before = await rows(); await actor(1);
    for (const content of ["   ", "x".repeat(2001)]) expect((await sendMessage(conversationId, content, listingId, randomUUID())).success).toBe(false);
    expect((await sendMessage(conversationId, "Contained wrong listing", randomUUID(), randomUUID())).success).toBe(false);
    expect((await actors[1]!.from("profile_blocks").insert({ blocker_id: accounts[1]!.id, blocked_id: accounts[0]!.id })).error).toBeNull();
    try {
      const id = randomUUID(); expect((await sendMessage(conversationId, "Contained blocked", listingId, id)).success).toBe(false); expect(await events(id)).toHaveLength(0);
    } finally { expect((await actors[1]!.from("profile_blocks").delete().eq("blocker_id", accounts[1]!.id).eq("blocked_id", accounts[0]!.id)).error).toBeNull(); }
    expect(await rows()).toEqual(before);
  });
  it("returns a recoverable failure after sign-out without adding messages or alerts", async () => {
    await actor(1); const before = await rows(), id = randomUUID();
    try {
      expect((await actors[1]!.auth.signOut()).error).toBeNull();
      expect(await sendMessage(conversationId, "Contained signed-out send", listingId, id)).toEqual({ success: false, error: "Unauthenticated" });
      expect(await rows()).toEqual(before); expect(await events(id)).toHaveLength(0);
    } finally {
      expect((await actors[1]!.auth.signInWithPassword({ email: accounts[1]!.email, password })).error).toBeNull();
    }
  });
  describe.skipIf(!["calls", "call-all"].includes(cfg?.runtimeCase))("call lifecycle", () => {
    async function start(mode: "voice" | "video" = "video") {
      await actor(0); const result = await startCall(conversationId, mode);
      expect(result.success, JSON.stringify(result)).toBe(true);
      if (!result.success) throw new Error(result.error);
      expect(result.data.session.media_mode).toBe(mode); return result.data.session;
    }
    async function transcript(id: string) {
      const result = await state.admin!.from("messages").select("id,content").eq("system_call_id", id);
      expect(result.error).toBeNull(); return result.data!;
    }
    it("serializes simultaneous starts, limits access and persists accept/end once", async () => {
      await actor(0);
      const attempts = await Promise.all([startCall(conversationId), startCall(conversationId)]);
      expect(attempts.filter(result => result.success)).toHaveLength(1);
      const call = attempts.find(result => result.success)!; if (!call.success) throw new Error("Missing call");
      const id = call.data.session.id;
      await actor(2); expect(await getActiveCall(conversationId)).toEqual({ success: true, data: { session: null } });
      for (const operation of [() => startCall(conversationId), () => joinCall(id), () => declineCall(id), () => endCall(id)]) expect((await operation()).success).toBe(false);
      const raw = await actors[2]!.from("call_sessions").select("id").eq("id", id); expect(raw.error).toBeNull(); expect(raw.data).toEqual([]);
      await actor(1); expect((await getActiveCall(conversationId)).success).toBe(true);
      expect(await joinCall(id)).toEqual({ success: true, data: { status: "active" } });
      for (const index of [0, 1]) { await actor(index); const current = await getActiveCall(conversationId); expect(current.success && current.data.session?.status).toBe("active"); }
      expect(await endCall(id)).toEqual({ success: true, data: { status: "ended" } });
      expect(await endCall(id)).toEqual({ success: true, data: { status: "ended" } });
      expect(await transcript(id)).toEqual([expect.objectContaining({ content: "Video call ended." })]);
      const incoming = await state.admin!.from("notification_events").select("id,recipient_id").eq("idempotency_key", `incoming_call:ringing:${id}`);
      expect(incoming.error).toBeNull(); expect(incoming.data).toEqual([expect.objectContaining({ recipient_id: accounts[1]!.id })]);
    });
    it("declines a voice call once and prevents a late accept from reopening it", async () => {
      const call = await start("voice"); await actor(1);
      for (let n = 0; n < 2; n++) expect(await declineCall(call.id)).toEqual({ success: true, data: { status: "declined" } });
      await joinCall(call.id); const current = await getActiveCall(conversationId); expect(current).toEqual({ success: true, data: { session: null } });
      expect(await transcript(call.id)).toHaveLength(1);
      const event = await state.admin!.from("notification_events").select("id,recipient_id").eq("idempotency_key", `incoming_call:declined:${call.id}`);
      expect(event.error).toBeNull(); expect(event.data).toEqual([expect.objectContaining({ recipient_id: accounts[0]!.id })]);
    });
    it("records missed and caller cancellation without duplicate transcript rows", async () => {
      for (const reason of ["missed", "end"] as const) {
        const call = await start();
        if (reason === "missed") expect((await state.admin!.from("call_sessions").update({ started_at: new Date(Date.now() - 31_000).toISOString() }).eq("id", call.id)).error).toBeNull();
        for (let n = 0; n < 2; n++) expect((await endCall(call.id, reason)).success).toBe(true);
        expect(await transcript(call.id)).toEqual([expect.objectContaining({ content: reason === "missed" ? "Missed video call." : "Video call cancelled." })]);
      }
    });
    it("retains one terminal transcript after a committed RPC response is lost", async () => {
      const call = await start(); await actor(1); const containedFetch = globalThis.fetch; let lost = false;
      try {
        globalThis.fetch = async (input, init) => {
          const response = await containedFetch(input, init);
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
          if (!lost && url.pathname === "/rest/v1/rpc/end_call_session" && response.ok) {
            lost = true; await response.arrayBuffer();
            return new Response(JSON.stringify({ message: "Contained terminal response loss" }), { status: 503, headers: { "content-type": "application/json" } });
          }
          return response;
        };
        expect((await declineCall(call.id)).success).toBe(false); expect(lost).toBe(true);
      } finally { globalThis.fetch = containedFetch; }
      const persisted = await state.admin!.from("call_sessions").select("status").eq("id", call.id).single(); expect(persisted.error).toBeNull(); expect(persisted.data!.status).toBe("declined");
      expect(await transcript(call.id)).toEqual([expect.objectContaining({ content: "Video call declined." })]);
      expect((await declineCall(call.id)).success).toBe(true);
      expect(await transcript(call.id)).toEqual([expect.objectContaining({ content: "Video call declined." })]);
      expect((await endCall(call.id)).success).toBe(true); expect(await transcript(call.id)).toHaveLength(1);
    });
  });
  describe.skipIf(!["call-access", "call-all", "call-notification-failure"].includes(cfg?.runtimeCase))("call session access", () => {
    function sql(query: string) {
      assert.match(cfg.dbName, /^pinpoint-release-[0-9a-f-]{36}-db$/);
      return execFileSync("docker", ["exec", "-i", "-e", `PGPASSWORD=${cfg.dbPassword}`, cfg.dbName, "psql", "-X", "-q", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    }
    async function cleanupCalls() {
      await actor(0);
      const current = await state.admin!.from("call_sessions").select("id").eq("conversation_id", conversationId).in("status", ["ringing", "active"]);
      expect(current.error).toBeNull();
      for (const row of current.data!) expect((await endCall(row.id)).success).toBe(true);
    }
    it("denies a revoked participant token for raw reads, RPCs and table writes", async () => {
      await actor(0); const started = await startCall(conversationId); expect(started.success).toBe(true);
      if (!started.success) throw new Error(started.error);
      const call = started.data.session, saved = await actors[1]!.auth.getSession(); expect(saved.error).toBeNull();
      const token = saved.data.session!.access_token;
      const claims = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
      expect((await state.admin!.auth.admin.signOut(token, "global")).error).toBeNull();
      const live = await state.admin!.rpc("pinpoint_active_session", { actor_id: accounts[1]!.id, actor_session_id: claims.session_id });
      expect(live.error).toBeNull(); expect(live.data).toBe(false);
      const headers = { apikey: cfg.anonKey, authorization: `Bearer ${token}`, "content-type": "application/json" };
      try {
        const read = await fetch(`${cfg.supabaseUrl}/rest/v1/call_sessions?id=eq.${call.id}&select=id,status`, { headers });
        const readBody = await read.json(); expect.soft(Array.isArray(readBody) ? readBody : []).toEqual([]);
        for (const [rpc, body] of [["start_call_session", { target_conversation_id: conversationId, requested_media_mode: "video" }], ["end_call_session", { target_session_id: call.id, action: "join" }]] as const) {
          const response = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${rpc}`, { method: "POST", headers, body: JSON.stringify(body) });
          const result = await response.json();
          expect.soft(response.ok && Array.isArray(result) && result.some(row => !["access_denied", "unauthenticated"].includes(row.result)), `${rpc} must deny the revoked session`).toBe(false);
        }
        const changed = await fetch(`${cfg.supabaseUrl}/rest/v1/call_sessions?id=eq.${call.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ media_mode: "voice" }) });
        const changedBody = await changed.json(); expect.soft(Array.isArray(changedBody) ? changedBody : []).toEqual([]);
        const persisted = await state.admin!.from("call_sessions").select("status,media_mode").eq("id", call.id).single(); expect(persisted.error).toBeNull();
        expect.soft(persisted.data).toMatchObject({ status: "ringing", media_mode: "video" });
      } finally { await cleanupCalls(); }
    });
    it("does not leave an unanswered call permanently blocking the conversation after clients leave", async () => {
      await actor(0); const started = await startCall(conversationId); expect(started.success).toBe(true);
      if (!started.success) throw new Error(started.error);
      const call = started.data.session;
      expect((await state.admin!.from("call_sessions").update({ started_at: new Date(Date.now() - 120_000).toISOString() }).eq("id", call.id)).error).toBeNull();
      try {
        const current = await getActiveCall(conversationId);
        const diagnostic = current.success ? null : (await actors[0]!.rpc("get_active_call_session", { target_conversation_id: conversationId })).error;
        expect.soft(current, JSON.stringify(diagnostic)).toEqual({ success: true, data: { session: null } });
        const next = await startCall(conversationId); expect.soft(next.success, "A new call must not be blocked by an abandoned ring").toBe(true);
        const previous = await state.admin!.from("call_sessions").select("status").eq("id", call.id).single(); expect(previous.error).toBeNull(); expect.soft(previous.data!.status).toBe("missed");
      } finally { await cleanupCalls(); }
    });
    it("expires an abandoned ring in the privileged batch with no browser or duplicate outcome", async () => {
      const unrelated = await state.admin!.from("call_sessions").select("id").neq("conversation_id", conversationId).in("status", ["ringing", "active"]);
      expect(unrelated.error).toBeNull(); expect(unrelated.data).toEqual([]); // Keep the batch fixture-contained.
      await actor(0); const started = await startCall(conversationId); expect(started.success).toBe(true); if (!started.success) throw new Error(started.error);
      const id = started.data.session.id;
      expect((await state.admin!.from("call_sessions").update({ started_at: new Date(Date.now() - 120_000).toISOString() }).eq("id", id)).error).toBeNull();
      try {
        expect(sql("select private.expire_call_sessions()" )).toBe("1");
        expect(sql("select private.expire_call_sessions()" )).toBe("0");
        const message = await state.admin!.from("messages").select("id,content").eq("system_call_id", id); expect(message.error).toBeNull(); expect(message.data).toEqual([expect.objectContaining({ content: "Missed video call." })]);
        const event = await state.admin!.from("notification_events").select("id").eq("idempotency_key", `incoming_call:missed:${id}`); expect(event.error).toBeNull(); expect(event.data).toHaveLength(1);
        expect(sql("select has_table_privilege('authenticated','public.call_sessions','INSERT') or has_table_privilege('authenticated','public.call_sessions','UPDATE') or has_table_privilege('authenticated','public.call_sessions','DELETE') or has_table_privilege('authenticated','public.call_sessions','TRUNCATE') or has_table_privilege('authenticated','public.call_sessions','TRIGGER')")).toBe("f");
        expect(sql("select has_function_privilege('anon','public.get_active_call_session(uuid)','EXECUTE') or has_function_privilege('authenticated','private.expire_call_sessions(uuid)','EXECUTE')")).toBe("f");
        expect(sql("select count(*) from cron.job where jobname='pinpoint-call-session-expiry' and schedule='* * * * *' and command='select private.expire_call_sessions();' and not active")).toBe("1");
      } finally { await cleanupCalls(); }
    });
    it("requires the callee's acceptance and retains fresh-session access after revocation", async () => {
      expect((await actors[1]!.auth.signInWithPassword({ email: accounts[1]!.email, password })).error).toBeNull();
      await actor(0); const started = await startCall(conversationId); expect(started.success).toBe(true); if (!started.success) throw new Error(started.error);
      const id = started.data.session.id;
      try {
        expect((await joinCall(id)).success).toBe(false);
        expect((await endCall(id, "missed")).success).toBe(false);
        await actor(1); expect(await joinCall(id)).toEqual({ success: true, data: { status: "active" } });
        expect((await getActiveCall(conversationId)).success).toBe(true);
        expect((await actors[1]!.from("call_sessions").update({ media_mode: "voice" }).eq("id", id)).error).not.toBeNull();
      } finally { await cleanupCalls(); }
    });
    it("keeps a terminal call usable during notification failure and repairs its alert on retry", async () => {
      console.info("Contained cron launch setting context:", sql("select context from pg_settings where name='cron.launch_active_jobs'"));
      await actor(0); const started = await startCall(conversationId);
      expect(started.success).toBe(true); if (!started.success) throw new Error(started.error);
      const id = started.data.session.id;
      assert.match(id, /^[0-9a-f-]{36}$/);
      sql(`create function private.contained_call_notification_failure() returns trigger language plpgsql as $$
        begin if new.idempotency_key='incoming_call:declined:${id}' then
          raise exception 'Contained call notification failure' using errcode='XX000';
        end if; return new; end; $$;
        create trigger contained_call_notification_failure before insert on public.notification_events
        for each row execute function private.contained_call_notification_failure();`);
      try {
        await actor(1); const declined = await declineCall(id);
        expect.soft(declined.success, JSON.stringify(declined)).toBe(true);
        const persisted = await state.admin!.from("call_sessions").select("status").eq("id", id).single();
        expect(persisted.error).toBeNull(); expect.soft(persisted.data!.status).toBe("declined");
        const messages = await state.admin!.from("messages").select("content").eq("system_call_id", id);
        expect(messages.error).toBeNull(); expect.soft(messages.data).toEqual([{ content: "Video call declined." }]);
        const failedEvent = await state.admin!.from("notification_events").select("id").eq("idempotency_key", `incoming_call:declined:${id}`);
        expect(failedEvent.error).toBeNull(); expect(failedEvent.data).toHaveLength(0);
      } finally {
        sql("drop trigger contained_call_notification_failure on public.notification_events; drop function private.contained_call_notification_failure();");
        await cleanupCalls();
      }
      await actor(1); expect((await declineCall(id)).success).toBe(true);
      const repairedEvent = await state.admin!.from("notification_events").select("id").eq("idempotency_key", `incoming_call:declined:${id}`);
      expect(repairedEvent.error).toBeNull(); expect(repairedEvent.data).toHaveLength(1);
    });
  });
  it.skipIf(!cfg?.browserScript)("browser journey uses real clone accounts", async () => {
    execFileSync(process.execPath, ["C:/Users/BB/.agents/skills/playwright/run.js", cfg.browserScript], {
      cwd: cfg.sourceRoot, env: { ...process.env, PINPOINT_MESSAGING_BROWSER_CONFIG: JSON.stringify({ ...cfg, accounts, password, listingId, conversationId, listingTitle: tag }) },
      stdio: "inherit", windowsHide: true,
    });
  }, 600000);
});
