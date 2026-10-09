/** Opt-in, real local API/SQL access and concurrency checks. No app/browser or delivery journey. */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OfferIntakeDatabase } from "@/features/offers/intake";

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
  queries.push("select 'auth_users',count(*) from auth.users", "select 'storage_objects',count(*) from storage.objects");
  return JSON.parse(sql(`select json_object_agg(name,total) from (${queries.join(" union all ")}) baseline`));
}
describe.skipIf(process.env.PINPOINT_OFFERS_LOCAL !== "1")("Shopping Offer private intake — local signed-in API", () => {
  const tag = `offer-intake-${randomUUID()}`;
  const password = `Offer!${randomUUID()}`;
  const placeId = randomUUID();
  const offerId = randomUUID();
  const revisionId = randomUUID();
  const accounts: { id: string; email: string }[] = [];
  const clients: SupabaseClient<OfferIntakeDatabase>[] = [];
  let admin: SupabaseClient<OfferIntakeDatabase>;
  let a: SupabaseClient<OfferIntakeDatabase>;
  let b: SupabaseClient<OfferIntakeDatabase>;
  let reviewer: SupabaseClient<OfferIntakeDatabase>;
  let guest: SupabaseClient<OfferIntakeDatabase>;
  let baseline: Record<string, number> | undefined;
  let restored: Record<string, number> | undefined;
  let jobs: { jobid: number; active: boolean }[] | undefined;
  let savedFetch: typeof globalThis.fetch | undefined;
  let passed = false;
  let persisted: unknown;
  let url: string;
  let anonKey: string;
  const content = {
    title: "Synthetic local offer", benefit: "Fixture only", terms: "Not redeemable",
    shopName: "Synthetic shop", areaId: placeId, address: "Synthetic public address",
    latitude: -33.96, longitude: 18.47,
    startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const person = (index: number) => {
    const value = accounts[index];
    if (!value) throw new Error("Missing fixture identity");
    return value;
  };
  const client = () => createClient<OfferIntakeDatabase>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function login(index: number) {
    const signedIn = client();
    expect((await signedIn.auth.signInWithPassword({ email: person(index).email, password })).error).toBeNull();
    clients.push(signedIn);
    return signedIn;
  }
  async function write(actor: SupabaseClient<OfferIntakeDatabase>, command: string, expected: number, payload = {}, revision?: string) {
    return actor.rpc("pinpoint_offer_write", { command, target: offerId, expected_version: expected, payload, ...(revision ? { revision } : {}) });
  }
  function fixtureFactor() {
    // Local Auth currently disables TOTP enrollment. These rows exercise DB
    // policy with simulated MFA context, not a real enrollment/challenge.
    sql(`insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,secret,created_at,updated_at)
      values ('${randomUUID()}','${person(2).id}','${randomUUID()}','totp','verified','fixture-only',now(),now());`);
  }
  async function reviewSql(expression: string, expectedError?: string) {
    const { data } = await reviewer.auth.getSession();
    if (!data.session) throw new Error("Missing real fixture session");
    const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1]!, "base64url").toString());
    claims.aal = "aal2";
    const encoded = JSON.stringify(claims).replace(/'/g,"''");
    const body = expectedError
      ? `do $assert$ begin begin perform ${expression}; raise exception 'Expected denial missing';
          exception when sqlstate '${expectedError}' then null; end; end $assert$;`
      : `select ${expression};`;
    const output = sql(`begin; do $claims$ begin perform set_config('request.jwt.claims','${encoded}',true); end $claims$;
      set local role authenticated; ${body} rollback;`);
    // Rejection must persist; see committedReviewSql below.
    return output.split("\n").find((line)=>line.startsWith("{"));
  }
  async function committedReviewSql(expression: string) {
    const { data } = await reviewer.auth.getSession();
    if (!data.session) throw new Error("Missing real fixture session");
    const claims = JSON.parse(Buffer.from(data.session.access_token.split(".")[1]!, "base64url").toString());
    claims.aal = "aal2";
    const encoded = JSON.stringify(claims).replace(/'/g,"''");
    const output = sql(`begin; do $claims$ begin perform set_config('request.jwt.claims','${encoded}',true); end $claims$;
      set local role authenticated; select ${expression}; commit;`);
    return JSON.parse(output.split("\n").find((line)=>line.startsWith("{"))!);
  }

  beforeAll(async () => {
    const local = parseEnv(readFileSync(".env.local", "utf8"));
    if (!local.NEXT_PUBLIC_SUPABASE_URL || !local.NEXT_PUBLIC_SUPABASE_ANON_KEY || !local.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing local config");
    url = local.NEXT_PUBLIC_SUPABASE_URL;
    anonKey = local.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(url).toBe("http://127.0.0.1:54321");
    for (const [key, role] of [[anonKey, "anon"], [local.SUPABASE_SERVICE_ROLE_KEY, "service_role"]]) {
      const claims = JSON.parse(Buffer.from(key!.split(".")[1]!, "base64url").toString());
      expect(claims.iss).toBe("supabase-demo");
      expect(claims.role).toBe(role);
      expect(claims.ref).toBeUndefined();
    }
    for (const key of ["RESEND_API_KEY","QSTASH_TOKEN","QSTASH_CURRENT_SIGNING_KEY","QSTASH_NEXT_SIGNING_KEY","CRON_SECRET","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN","VAPID_PRIVATE_KEY","NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) delete process.env[key];
    savedFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const destination = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (destination.origin !== url) throw new Error("Offer fixture blocked external request");
      return savedFetch!(input, init);
    };
    expect(sql("select count(*) from pg_tables where schemaname='public' and tablename in ('offer_posters','shopping_offers','shopping_offer_revisions','shopping_offer_events')")).toBe("4");
    const migration = readFileSync("supabase/migrations/20260930164313_pinpoint_offer_intake.sql","utf8");
    const stored: Record<string,string> = JSON.parse(sql(`select json_object_agg(n.nspname||'.'||p.proname,p.prosrc)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.proname like 'pinpoint_%' and n.nspname in ('public','private')`));
    for (const match of migration.matchAll(/create function ([\w.]+)[\s\S]*?\bas \$\$([\s\S]*?)\$\$;/g)) {
      expect(stored[match[1]!]!.trim()).toBe(match[2]!.trim());
    }
    expect(sql(`select count(*) from pg_class where oid in ('public.offer_posters'::regclass,
      'public.shopping_offers'::regclass,'public.shopping_offer_revisions'::regclass,'public.shopping_offer_events'::regclass)
      and relrowsecurity`)).toBe("4");
    jobs = JSON.parse(sql("select coalesce(json_agg(json_build_object('jobid',jobid,'active',active) order by jobid),'[]') from cron.job"));
    sql("select cron.alter_job(job_id := jobid, active := false) from cron.job");
    expect(sql("select count(*) from cron.job where active")).toBe("0");
    baseline = counts();
    admin = createClient<OfferIntakeDatabase>(url, local.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    for (let index = 0; index < 4; index++) {
      const email = `${tag}-${index}@pinpoint.invalid`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(error).toBeNull();
      if (!data.user) throw new Error("Missing fixture user");
      accounts.push({ id: data.user.id, email });
      // No originating app actions, webhooks or offer notification writers exist.
      sql(`update public.notification_subscriptions set enabled=false,frequency='never' where user_id='${data.user.id}' and channel='email';
        insert into public.policy_acceptances(user_id,document_id,version_id,source)
        select '${data.user.id}',d.id,d.current_version_id,'settings' from public.trust_documents d
        where d.current_version_id is not null on conflict do nothing;`);
    }
    sql(`insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north)
      values ('${placeId}','${tag}','locality','Synthetic test place','Fixture','Synthetic South African fixture',-33.96,18.47,18.4,-34.0,18.6,-33.9);
      insert into public.admin_memberships(user_id,level) values ('${person(2).id}','admin');`);
    a = await login(0); b = await login(1); reviewer = await login(2); guest = client();
    console.info("Offer intake disposable IDs", { tag, placeId, offerId, revisionId, accountIds: accounts.map(({ id }) => id) });
  });

  afterAll(async () => {
    try {
      for (const signedIn of clients) await signedIn.auth.signOut();
      if (baseline && accounts.length) {
        // Guard captured identities before narrowly bypassing only fixture history triggers.
        for (const account of accounts) {
          expect(sql(`select email from auth.users where id='${account.id}'`)).toBe(account.email);
        }
        expect(sql(`select count(*) from public.shopping_offers where id='${offerId}' and poster_id not in (${accounts.map(({ id }) => `'${id}'`).join(",")})`)).toBe("0");
        const ids = accounts.map(({ id }) => `'${id}'`).join(",");
        sql(`begin;
          alter table public.shopping_offer_events disable trigger shopping_offer_events_immutable;
          alter table public.shopping_offer_revisions disable trigger shopping_offer_revisions_immutable;
          update public.shopping_offers set pending_revision_id=null where id='${offerId}' and poster_id in (${ids});
          delete from public.shopping_offer_events where poster_id in (${ids});
          delete from public.shopping_offer_revisions where offer_id='${offerId}' and poster_id in (${ids});
          delete from public.shopping_offers where id='${offerId}' and poster_id in (${ids});
          delete from public.offer_posters where user_id in (${ids});
          alter table public.shopping_offer_events enable trigger shopping_offer_events_immutable;
          alter table public.shopping_offer_revisions enable trigger shopping_offer_revisions_immutable;
          delete from public.discovery_places where id='${placeId}' and provider_id='${tag}';
          delete from public.account_suspensions where user_id in (${ids}) and reason='Offer intake disposable suspension';
          alter table public.admin_memberships disable trigger admin_memberships_last_owner;
          delete from public.admin_memberships where user_id in (${ids});
          alter table public.admin_memberships enable trigger admin_memberships_last_owner;
          commit;`);
        for (const account of accounts) expect((await admin.auth.admin.deleteUser(account.id)).error).toBeNull();
        restored = counts();
        expect(restored).toEqual(baseline);
      }
    } finally {
      if (jobs) {
        for (const job of jobs) sql(`select cron.alter_job(job_id := ${job.jobid}, active := ${job.active})`);
        expect(JSON.parse(sql("select coalesce(json_agg(json_build_object('jobid',jobid,'active',active) order by jobid),'[]') from cron.job"))).toEqual(jobs);
      }
      if (savedFetch) globalThis.fetch = savedFetch;
    }
    if (passed && restored) {
      const sources = ["src/features/offers/intake.ts","supabase/migrations/20260930164313_pinpoint_offer_intake.sql","scripts/db/offer-intake.local.test.ts"];
      writeFileSync("docs/pinpoint-offer-intake-local-evidence.json", JSON.stringify({
        recordedAt: new Date().toISOString(), environment: "local poster API plus SQL review with simulated MFA", tag, placeId, offerId, revisionId,
        accountIds: accounts.map(({ id }) => id), baseline, restored, restoredJobs: jobs, persisted,
        limitations: ["Anonymous HTTP RPC denial blocked by local supautils crash; inherited-anon SQL probe passed",
          "Positive review uses simulated aal2/TOTP rows; real local TOTP enrollment is disabled",
          "No approval, public/browser journey, staging or production verification"],
        sourceHashes: Object.fromEntries(sources.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
      }, null, 2) + "\n");
    }
  });

  it("enforces capability, ownership, immutable review isolation, MFA and real concurrent version conflicts", async () => {
    // This local image's supautils hook crashes on revoked-function HTTP calls
    // (supabase/postgres #2112). Keep the revoke; probe equivalent inherited anon
    // privileges with a transaction-only role outside that diagnostic path.
    // Anonymous HTTP RPC denial remains blocked on the current local image.
    sql(`begin; create role pinpoint_offer_denial_probe nologin;
      grant anon to pinpoint_offer_denial_probe; grant pinpoint_offer_denial_probe to postgres;
      set local role pinpoint_offer_denial_probe;
      do $test$ begin
        begin perform public.pinpoint_offer_enroll(); raise exception 'Anonymous enrollment allowed';
          exception when insufficient_privilege then null; end;
      end $test$; rollback;`);
    expect((await write(a, "create", 0)).error?.code).toBe("42501");
    expect((await a.rpc("pinpoint_offer_enroll", {})).error).toBeNull();
    expect((await a.rpc("pinpoint_offer_enroll", {})).error).toBeNull();
    expect(sql(`select count(*) from public.shopping_offer_events where poster_id='${person(0).id}' and action='enroll'`)).toBe("1");
    expect((await b.rpc("pinpoint_offer_enroll", {})).error).toBeNull();
    expect((await write(a, "create", 0)).data).toEqual({ offerId, version: 1, pendingRevisionId: null });
    expect((await write(b, "save", 1, { title: "Attack" })).error?.code).toBe("42501");
    expect((await a.from("shopping_offers").select("id").eq("id",offerId)).data).toHaveLength(1);
    expect((await b.from("shopping_offers").select("id").eq("id",offerId)).data).toEqual([]);
    expect((await guest.from("shopping_offers").select("id")).error?.code).toBe("42501");
    for (const table of ["offer_posters","shopping_offers","shopping_offer_revisions","shopping_offer_events"] as const) {
      expect(sql(`select has_table_privilege('authenticated','public.${table}','INSERT,UPDATE,DELETE')`)).toBe("f");
      expect((await a.from(table).insert({})).error?.code).toBe("42501");
      const column = table === "offer_posters" ? "user_id" : "id";
      const updateAttempt = table === "offer_posters"
        ? await a.from(table).update({ revoked_at: new Date().toISOString() }).not(column,"is",null)
        : table === "shopping_offers"
          ? await a.from(table).update({ draft: { title: "Direct mutation" } }).not(column,"is",null)
          : table === "shopping_offer_revisions"
            ? await a.from(table).update({ content: { title: "Direct mutation" } }).not(column,"is",null)
            : await a.from(table).update({ reason: "Direct mutation" }).not(column,"is",null);
      expect(updateAttempt.error?.code).toBe("42501");
      expect((await a.from(table).delete().not(column,"is",null)).error?.code).toBe("42501");
    }
    expect((await write(a,"save",1,{ canReviewOffers: true })).error?.code).toBe("22023");
    expect((await write(a,"submit",1,{},revisionId)).error?.code).toBe("22023");
    expect((await write(a,"save",1,content)).data).toEqual({ offerId, version: 2, pendingRevisionId: null });
    expect((await write(a,"save",1,{ title: "Stale" })).error?.code).toBe("PT409");
    expect((await write(a,"submit",2,{},revisionId)).data).toEqual({ offerId, version: 3, pendingRevisionId: revisionId });
    expect((await write(a,"submit",2,{},revisionId)).data).toEqual({ offerId, version: 3, pendingRevisionId: revisionId });
    expect((await write(a,"save",3,{ ...content,title: "Private later edit" })).error).toBeNull();
    expect((await a.from("shopping_offer_revisions").select("content").eq("id",revisionId)).data?.[0]?.content).toEqual(content);
    expect((await b.from("shopping_offer_revisions").select("id")).data).toEqual([]);
    expect((await b.from("shopping_offer_events").select("id").eq("poster_id",person(0).id)).data).toEqual([]);
    expect((await a.rpc("pinpoint_offer_reject",{target:offerId,revision:revisionId,expected_version:4,reason:"Attack"})).error?.code).toBe("42501");
    expect((await reviewer.rpc("pinpoint_offer_review_read",{target:offerId})).error?.code).toBe("42501");
    fixtureFactor();
    const reviewExpression = `public.pinpoint_offer_review_read('${offerId}')`;
    expect(JSON.parse((await reviewSql(reviewExpression))!)).toMatchObject({ offerId,version:4,revisionId,content });
    sql(`update public.admin_memberships set revoked_at=clock_timestamp() where user_id='${person(2).id}';`);
    await reviewSql(reviewExpression,"42501");
    sql(`update public.admin_memberships set revoked_at=null where user_id='${person(2).id}';`);
    // A verified factor alone still cannot bypass the real aal1 session.
    expect((await reviewer.rpc("pinpoint_offer_review_read",{target:offerId})).error?.code).toBe("42501");
    expect((await reviewer.from("shopping_offers").select("draft")).data).toEqual([]);
    sql(`update public.admin_memberships set level='owner' where user_id='${person(2).id}';`);
    await reviewSql(reviewExpression,"42501");
    fixtureFactor();
    expect(JSON.parse((await reviewSql(reviewExpression))!)).toMatchObject({ offerId });
    // Restore fixture membership without trying to remove the last active owner.
    sql(`begin; alter table public.admin_memberships disable trigger admin_memberships_last_owner;
      update public.admin_memberships set level='admin' where user_id='${person(2).id}';
      alter table public.admin_memberships enable trigger admin_memberships_last_owner; commit;`);
    expect(await committedReviewSql(`public.pinpoint_offer_reject('${offerId}','${revisionId}',4,'Correct the address')`)).toEqual({offerId,version:5,pendingRevisionId:null});
    expect(sql(`select actor_id||'|'||reason from public.shopping_offer_events where offer_id='${offerId}' and action='reject'`)).toBe(`${person(2).id}|Correct the address`);
    expect((await write(a,"submit",5,{},revisionId)).error?.code).toBe("22023");
    const nextRevision = randomUUID();
    expect((await write(a,"submit",5,{},nextRevision)).data).toEqual({offerId,version:6,pendingRevisionId:nextRevision});
    expect((await write(a,"withdraw",6)).data).toEqual({offerId,version:7,pendingRevisionId:null});
    await reviewSql(`public.pinpoint_offer_reject('${offerId}','${nextRevision}',7,'Delayed')`,"22023");
    expect((await write(a,"submit",7,{},nextRevision)).error?.code).toBe("22023");
    expect((await write(a,"submit",7,{},randomUUID())).error).toBeNull();
    const contenders = await Promise.all([write(a,"save",8,{...content,title:"Concurrent A"}),write(a,"save",8,{...content,title:"Concurrent B"})]);
    expect(contenders.filter(({error}) => !error)).toHaveLength(1);
    expect(contenders.filter(({error}) => error?.code === "PT409")).toHaveLength(1);
    expect(sql(`select version from public.shopping_offers where id='${offerId}'`)).toBe("9");
    expect(sql(`select count(*) from public.shopping_offer_events where offer_id='${offerId}'`)).toBe("9");
    sql(`do $test$ begin
      begin update public.shopping_offer_revisions set content='{}' where id='${revisionId}'; raise exception 'immutability failed';
        exception when insufficient_privilege then null; end;
      begin delete from public.shopping_offer_events where offer_id='${offerId}'; raise exception 'audit deletion allowed';
        exception when insufficient_privilege then null; end;
    end $test$;`);
    sql(`insert into public.account_suspensions(user_id,reason) values ('${person(0).id}','Offer intake disposable suspension');`);
    expect((await write(a,"save",9,content)).error?.code).toBe("42501");
    expect((await a.from("shopping_offers").select("id")).data).toEqual([]);
    sql(`delete from public.account_suspensions where user_id='${person(0).id}' and reason='Offer intake disposable suspension';
      update public.offer_posters set revoked_at=clock_timestamp() where user_id='${person(0).id}';`);
    expect((await a.rpc("pinpoint_offer_enroll",{})).error?.code).toBe("42501");
    expect((await write(a,"withdraw",9)).error?.code).toBe("42501");
    const staleSession = await login(3);
    sql(`update auth.users set email_confirmed_at=null where id='${person(3).id}';`);
    expect((await staleSession.rpc("pinpoint_offer_enroll",{})).error?.code).toBe("42501");
    sql(`update auth.users set email_confirmed_at=now(),is_anonymous=true where id='${person(3).id}';`);
    expect((await staleSession.rpc("pinpoint_offer_enroll",{})).error?.code).toBe("42501");
    sql(`update auth.users set is_anonymous=false,banned_until=now()+interval '1 day' where id='${person(3).id}';`);
    expect((await staleSession.rpc("pinpoint_offer_enroll",{})).error?.code).toBe("42501");
    sql(`update auth.users set banned_until=null where id='${person(3).id}';`);
    sql(`delete from auth.sessions where user_id='${person(3).id}';`);
    expect((await staleSession.rpc("pinpoint_offer_enroll",{})).error?.code).toBe("42501");
    expect(sql(`select count(*) from public.notification_events where recipient_id in (${accounts.map(({id})=>`'${id}'`).join(",")})`)).toBe("0");
    persisted = JSON.parse(sql(`select json_build_object(
      'offer',(select row_to_json(o) from public.shopping_offers o where id='${offerId}'),
      'revisions',(select json_agg(r order by submitted_at,id) from public.shopping_offer_revisions r where offer_id='${offerId}'),
      'events',(select json_agg(e order by version,id) from public.shopping_offer_events e where offer_id='${offerId}'))`));
    passed = true;
  });
});
