/**
 * Opt-in local B1 verification. Requires local Docker/Supabase and the new policy
 * migration already applied. Never reads .env.production.local. Run:
 * $env:PINPOINT_B1_LOCAL='1'; node node_modules/vitest/vitest.mjs run scripts/db/notification-b1.local.test.ts
 * Uses real server actions/RPCs/outbox and committed disposable data, with SQL
 * assertions plus fresh authenticated API reads. This is not browser evidence.
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/types";

const isolation = vi.hoisted(() => ({
  actor: null as SupabaseClient<Database> | null,
  publish: vi.fn(async () => { throw new Error("B1 isolated queue failure"); }),
  email: vi.fn(async () => ({ error: "B1 isolated email failure" })),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => isolation.actor }));
vi.mock("@/lib/qstash", () => ({ publishJsonJob: isolation.publish }));
vi.mock("@/features/notifications/send", () => ({ sendEmail: isolation.email }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import { startCall, declineCall, endCall, getActiveCall } from "@/features/chat/call-actions";
import { requestShowing, acceptShowing, declineShowing, cancelShowing } from "@/features/showings/actions";
import { recordAndEnqueueNotifications } from "@/features/notifications/outbox";
import { processNotificationJob } from "@/features/notifications/jobs";

function sql(query: string) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_roomza", "psql", "-X", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
    { input: query, encoding: "utf8" }).trim();
}
function counts(): Record<string, number> {
  const tables: string[] = JSON.parse(sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public'"));
  const queries = tables.map((table) => {
    if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected table name");
    return `select '${table}' as name, count(*) as total from public.${table}`;
  });
  queries.push("select 'auth_users', count(*) from auth.users");
  return JSON.parse(sql(`select json_object_agg(name,total) from (${queries.join(" union all ")}) baseline`));
}

describe.skipIf(process.env.PINPOINT_B1_LOCAL !== "1")("B1 isolated local persistence and authorization", () => {
  const tag = `b1-${randomUUID()}`;
  const password = `B1!${randomUUID()}`;
  const listingId = randomUUID();
  const conversationId = randomUUID();
  const accounts: { id: string; email: string }[] = [];
  const clients: SupabaseClient<Database>[] = [];
  let admin: SupabaseClient<Database>;
  let url: string;
  let anonKey: string;
  let baseline: Record<string, number> | undefined;
  let jobs: { jobid: number; active: boolean }[] | undefined;
  let savedFetch: typeof globalThis.fetch;
  let persistedEvents: ReturnType<typeof events> | undefined;
  let restoredCounts: Record<string, number> | undefined;

  function account(index: number) {
    const value = accounts[index];
    if (!value) throw new Error("Fixture account missing");
    return value;
  }

  async function login(index: number) {
    const client = createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email: account(index).email, password });
    expect(error).toBeNull();
    clients.push(client);
    isolation.actor = client;
    return client;
  }
  function events() {
    return JSON.parse(sql(`select coalesce(json_agg(row_to_json(e) order by created_at,id),'[]') from
      (select id,recipient_id,type,payload,idempotency_key,sent_at,digest_at,attempt_count,next_attempt_at,locked_at,last_error,created_at
       from public.notification_events where payload->>'listingId'='${listingId}') e`)) as
      { id: string; recipient_id: string; type: string; payload: Database["public"]["Tables"]["notification_events"]["Row"]["payload"];
        idempotency_key: string; sent_at: string | null; digest_at: string | null; attempt_count: number; locked_at: string | null;
        next_attempt_at: string; last_error: string | null }[];
  }

  beforeAll(async () => {
    const local = parseEnv(readFileSync(".env.local", "utf8"));
    if (!local.NEXT_PUBLIC_SUPABASE_URL || !local.NEXT_PUBLIC_SUPABASE_ANON_KEY || !local.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Local Supabase configuration missing");
    }
    url = local.NEXT_PUBLIC_SUPABASE_URL;
    anonKey = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(url).toBe("http://127.0.0.1:54321");
    // Only the default local Supabase JWT is accepted; never send a hosted key.
    const jwtPayload = local.SUPABASE_SERVICE_ROLE_KEY.split(".")[1];
    if (!jwtPayload) throw new Error("Default local JWT required");
    const claims = JSON.parse(Buffer.from(jwtPayload, "base64url").toString());
    expect(claims.iss).toBe("supabase-demo");
    expect(claims.role).toBe("service_role");
    expect(claims.ref).toBeUndefined();
    for (const key of ["RESEND_API_KEY", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "CRON_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) {
      delete process.env[key];
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = local.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3100";
    savedFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const target = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (target.origin !== url) throw new Error("B1 test blocked non-local network request");
      return savedFetch(input, init);
    };
    expect(sql("select has_table_privilege('authenticated','public.notification_events','INSERT')")).toBe("f");
    jobs = JSON.parse(sql("select coalesce(json_agg(json_build_object('jobid',jobid,'active',active)),'[]') from cron.job"));
    sql("select cron.alter_job(job_id := jobid, active := false) from cron.job");
    expect(sql("select count(*) from cron.job where active")).toBe("0");
    baseline = counts();
    admin = createClient<Database>(url, local.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const role of ["renter", "landlord", "renter"] as const) {
      const email = `${tag}-${accounts.length}@pinpoint.invalid`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(error).toBeNull();
      if (!data.user) throw new Error("Fixture user missing");
      accounts.push({ id: data.user.id, email });
      expect((await admin.from("profiles").update({ role }).eq("id", data.user.id)).error).toBeNull();
      expect((await admin.from("notification_subscriptions").update({ enabled: false, frequency: "never" }).eq("user_id", data.user.id).eq("channel", "email")).error).toBeNull();
    }
    expect((await admin.from("listings").insert({
      id: listingId, landlord_id: account(1).id, title: tag, price: 1000,
      address: "B1 disposable fixture", status: "published", listing_type: "rent",
    })).error).toBeNull();
    expect((await admin.from("conversations").insert({
      id: conversationId, listing_id: listingId, renter_id: account(0).id, landlord_id: account(1).id, type: "inquiry",
    })).error).toBeNull();
    console.info("B1 fixture", JSON.stringify({ tag, listingId, conversationId, accounts: accounts.map(({ id }) => id), baseline }));
  });

  afterAll(async () => {
    try {
      for (const client of clients) await client.auth.signOut();
      if (admin && accounts.length) {
        // Every deletion uses captured UUIDs AND fixture identity guards.
        const owner = accounts[1]?.id;
        if (owner && accounts[0]) {
          sql(`begin;
            delete from public.call_sessions where conversation_id='${conversationId}' and listing_id='${listingId}';
            delete from public.showing_requests where listing_id='${listingId}' and landlord_id='${owner}' and renter_id='${account(0).id}';
            delete from public.messages where conversation_id='${conversationId}' and listing_id='${listingId}';
            delete from public.conversations where id='${conversationId}' and listing_id='${listingId}' and renter_id='${account(0).id}' and landlord_id='${owner}';
            delete from public.listings where id='${listingId}' and landlord_id='${owner}' and title='${tag}';
            commit;`);
        }
        for (const account of accounts) {
          const { data, error } = await admin.auth.admin.getUserById(account.id);
          expect(error).toBeNull();
          expect(data.user?.email).toBe(account.email);
          expect((await admin.auth.admin.deleteUser(account.id)).error).toBeNull();
        }
      }
      if (baseline) {
        const after = counts();
        console.info("B1 cleanup", JSON.stringify({ baselineRestored: JSON.stringify(after) === JSON.stringify(baseline), after }));
        expect(after).toEqual(baseline);
        restoredCounts = after;
      }
    } finally {
      if (jobs) {
        sql(jobs.map((job) => `select cron.alter_job(job_id := ${job.jobid}, active := ${job.active});`).join("\n"));
        expect(JSON.parse(sql("select coalesce(json_agg(json_build_object('jobid',jobid,'active',active)),'[]') from cron.job"))).toEqual(jobs);
      }
      if (savedFetch) globalThis.fetch = savedFetch;
    }
    if (persistedEvents && restoredCounts) {
      const sources = ["src/features/chat/call-actions.ts", "src/features/showings/actions.ts", "src/features/notifications/outbox.ts", "supabase/migrations/20260930142632_notification_server_writes_only.sql"];
      writeFileSync("docs/pinpoint-b1-local-evidence.json", JSON.stringify({
        recordedAt: new Date().toISOString(), environment: "local", supabaseUrl: url,
        checkout: "uncommitted working tree", sourceSha256: Object.fromEntries(sources.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
        fixture: { tag, listingId, conversationId, accountIds: accounts.map(({ id }) => id) },
        isolation: { localKeysOnly: true, externalNetworkBlocked: true, emailStub: true, queueStub: true, cronPausedAndRestored: jobs, pushPathInvoked: false },
        checks: { authorizedActionEvents: true, deniedActionsCreateNoEvent: true, crossRecipientInsertDenied: true,
          recipientReload: "Fresh authenticated clients and SQL; no browser UI in this run",
          unrelatedRecipientSeesNoEvents: true, actionRetriesDoNotDuplicate: true,
          twoSyntheticDeliveryFailuresRetainEventAndBackoff: true, duplicateOutboxInsertPreservesRetryState: true },
        persistedEvents, beforeCounts: baseline, afterCounts: restoredCounts,
        fixtureCleanup: "Captured UUIDs and email/title guards; every public table and auth.users restored",
        staging: "not tested", production: "not accessed",
      }, null, 2) + "\n");
    }
  });

  it("persists authorized calls/showings; denies unrelated writes; reloads recipient events; preserves retries", async () => {
    await login(2);
    expect((await startCall(conversationId)).success).toBe(false);
    expect(events()).toHaveLength(0);
    await login(0);
    const started = await startCall(conversationId);
    expect(started.success).toBe(true);
    if (!started.success) throw new Error("Call start failed");
    const sessionId = started.data.session.id;
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({ recipient_id: account(1).id, type: "incoming_call", sent_at: null });
    // Recreate the authenticated client to read the authoritative stored session.
    await login(1);
    const reloaded = await getActiveCall(conversationId);
    expect(reloaded.success && reloaded.data.session?.id).toBe(sessionId);
    await login(2);
    expect((await declineCall(sessionId)).success).toBe(false);
    expect(events()).toHaveLength(1);
    await login(1);
    expect((await declineCall(sessionId)).success).toBe(true);
    expect(events()).toHaveLength(2);
    expect((await declineCall(sessionId)).success).toBe(true);
    expect(events()).toHaveLength(2);
    await login(0);
    const second = await startCall(conversationId);
    expect(second.success).toBe(true);
    if (!second.success) throw new Error("Second call failed");
    expect((await startCall(conversationId)).success).toBe(false);
    expect(events()).toHaveLength(3);
    expect((await endCall(second.data.session.id, "missed")).success).toBe(true);
    expect((await endCall(second.data.session.id, "missed")).success).toBe(true);
    expect(events()).toHaveLength(4);

    const requested = await requestShowing({ listingId, window: "now" });
    expect(requested.success).toBe(true);
    if (!requested.success) throw new Error("Showing request failed");
    expect((await requestShowing({ listingId, window: "now" })).success).toBe(false);
    expect(events()).toHaveLength(5);
    await login(2);
    expect((await acceptShowing(requested.data.request.id)).success).toBe(false);
    expect(events()).toHaveLength(5);
    await login(1);
    expect((await requestShowing({ listingId, window: "now" })).success).toBe(false);
    expect((await acceptShowing(requested.data.request.id)).success).toBe(true);
    expect((await acceptShowing(requested.data.request.id)).success).toBe(false);
    expect(events()).toHaveLength(6);
    expect((await cancelShowing(requested.data.request.id)).success).toBe(true);
    await login(0);
    const another = await requestShowing({ listingId, window: "within_15" });
    expect(another.success).toBe(true);
    if (!another.success) throw new Error("Second showing failed");
    await login(1);
    expect((await declineShowing(another.data.request.id)).success).toBe(true);
    expect((await declineShowing(another.data.request.id)).success).toBe(true);
    expect(events()).toHaveLength(8);

    for (const index of [0, 1, 2]) {
      const reader = await login(index);
      const { data, error } = await reader.from("notification_events").select("id").contains("payload", { listingId });
      expect(error).toBeNull();
      expect(data?.map((row) => row.id).sort()).toEqual(events().filter((event) => event.recipient_id === account(index).id).map((event) => event.id).sort());
      const denied = await reader.from("notification_events").insert({ recipient_id: account((index + 1) % 3).id, type: "incoming_call", payload: { listingId } });
      expect(denied.error?.code).toBe("42501");
    }
    expect(events()).toHaveLength(8);
    expect(isolation.publish).toHaveBeenCalledTimes(8);
    const event = events()[0];
    if (!event) throw new Error("Persisted event missing");
    expect((await admin.from("notification_subscriptions").update({ enabled: true, frequency: "instant" })
      .eq("user_id", event.recipient_id).eq("category", "messages").eq("channel", "email")).error).toBeNull();
    for (const attempt of [1, 2]) {
      expect(await processNotificationJob(event.id, tag)).toMatchObject({ sent: false, code: "server_error" });
      const stored = events().find((row) => row.id === event.id);
      expect(stored).toMatchObject({ attempt_count: attempt, sent_at: null, locked_at: null, last_error: "B1 isolated email failure" });
      expect(new Date(stored!.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    }
    expect(isolation.email).toHaveBeenCalledTimes(2);
    expect((await admin.from("notification_subscriptions").update({ enabled: false, frequency: "never" }).eq("user_id", event.recipient_id).eq("channel", "email")).error).toBeNull();
    const beforeRetry = events();
    await recordAndEnqueueNotifications({ recipient_id: event.recipient_id, type: "incoming_call", payload: event.payload, idempotency_key: event.idempotency_key });
    expect(events()).toEqual(beforeRetry);
    expect(isolation.publish).toHaveBeenCalledTimes(8);
    expect(events().every((row) => row.sent_at === null && row.digest_at === null)).toBe(true);
    persistedEvents = events();
    console.info("B1 persisted events", JSON.stringify(events()));
  });
});
