/** Opt-in review-screen rehearsal on a disposable clone. Never writes to the shared database. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { parseEnv } from "node:util";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

if (process.env.PINPOINT_REVIEW_SCREEN_LOCAL !== "1") throw new Error("Set PINPOINT_REVIEW_SCREEN_LOCAL=1 to run the disposable clone rehearsal");
const local = parseEnv(readFileSync(".env.local", "utf8"));
assert.equal(local.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
for (const [key, role] of [[local.NEXT_PUBLIC_SUPABASE_ANON_KEY, "anon"], [local.SUPABASE_SERVICE_ROLE_KEY, "service_role"]]) {
  const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
  assert.equal(claims.iss, "supabase-demo"); assert.equal(claims.role, role); assert.equal(claims.ref, undefined);
}
for (const key of ["RESEND_API_KEY", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "CRON_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) delete process.env[key];
const tag = `pinpoint-review-${randomUUID()}`;
const label = `pinpoint.review.screen.run=${tag}`;
const names = { db: `${tag}-db`, auth: `${tag}-auth`, rest: `${tag}-rest`, network: `${tag}-network`, volume: `${tag}-volume` };
const patchedImage = "public.ecr.aws/supabase/postgres:17.6.1.113";
const created = [];
let networkCreated = false, volumeCreated = false;
const clients = [], accounts = [], checks = [];
const offerId = randomUUID(), revisionId = randomUUID(), placeId = randomUUID();
const phoneOfferId = randomUUID(), phoneRevisionId = randomUUID();
const appOrigin = "http://localhost:3111";
let gateway, app, appLog;
const guardPath = path.join(tmpdir(), `${tag}-fetch.cjs`);
const browserEvidencePath = path.join(tmpdir(), `${tag}-browser.json`);
const testPath = process.env.PINPOINT_REVIEW_SCREEN_TEST;
assert.ok(testPath && path.isAbsolute(testPath) && /^playwright-test-[a-z0-9-]+\.js$/.test(path.basename(testPath)));

const password = `B7!${randomUUID()}`;
const evidence = { environment: "disposable local logical clone; real cookie browser app with loopback gateway to internal clone", tag, offerId, revisionId, placeId, checks };
const hash = (value) => createHash("sha256").update(value).digest("hex");
function docker(args, input, binary = false) {
  try { return execFileSync("docker", args, { input, encoding: binary ? undefined : "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }); }
  catch (error) {
    const diagnostic = String(error.stderr ?? "").match(/ERROR:[^\r\n]*/g)?.slice(0,2).join("; ") ?? "no SQL diagnostic";
    throw new Error(`Docker ${args[0]} failed (exit ${error.status}): ${diagnostic}; container arguments withheld`);
  }
}
const inspect = (name) => JSON.parse(docker(["inspect", name]))[0];
function sql(container, query, database = "postgres") {
  return docker(["exec", "-i", "-e", `PGPASSWORD=${dbEnv.POSTGRES_PASSWORD}`, container, "psql", "-X", "-h", "127.0.0.1", "-U", "supabase_admin", "-d", database, "-At", "-v", "ON_ERROR_STOP=1"], query).trim();
}
function snapshot(container) {
  const tables = JSON.parse(sql(container, "select json_agg(tablename order by tablename) from pg_tables where schemaname='public'"));
  const counts = tables.map((table) => {
    assert.match(table, /^[a-z_]+$/);
    return `select '${table}' as name,count(*) as total from public.${table}`;
  });
  counts.push("select 'auth_users',count(*) from auth.users", "select 'storage_objects',count(*) from storage.objects");
  const fingerprints = ["listings", "listing_images", "user_favorites", "applications", "viewings", "conversations", "messages"].map((table) =>
    `select '${table}' as name,md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),'')) as digest from public.${table} t`);
  return {
    counts: JSON.parse(sql(container, `select json_object_agg(name,total) from (${counts.join(" union all ")}) t`)),
    propertyHashes: JSON.parse(sql(container, `select json_object_agg(name,digest) from (${fingerprints.join(" union all ")}) t`)),
    jobs: JSON.parse(sql(container, "select coalesce(json_agg(json_build_object('jobid',jobid,'schedule',schedule,'command',command,'active',active) order by jobid),'[]') from cron.job")),
    triggers: JSON.parse(sql(container, "select json_agg(json_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled) order by tgname) from pg_trigger where tgname in ('shopping_offer_events_immutable','shopping_offer_revisions_immutable','admin_memberships_last_owner')")),
    versions: JSON.parse(sql(container, "select json_agg(version order by version) from supabase_migrations.schema_migrations")),
  };
}
function catalog(container) {
  return JSON.parse(sql(container, `select json_object_agg(n.nspname||'.'||p.proname,json_build_object('body',p.prosrc,'acl',p.proacl,'definer',p.prosecdef,'settings',p.proconfig))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'pinpoint_%' and n.nspname in ('public','private')`));
}
function tableSecurity(container) {
  return {
    tables: JSON.parse(sql(container,"select json_agg(json_build_object('name',relname,'rls',relrowsecurity,'forceRls',relforcerowsecurity,'acl',relacl) order by relname) from pg_class where oid in ('public.offer_posters'::regclass,'public.shopping_offers'::regclass,'public.shopping_offer_revisions'::regclass,'public.shopping_offer_events'::regclass)")),
    policies: JSON.parse(sql(container,"select json_agg(row_to_json(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('offer_posters','shopping_offers','shopping_offer_revisions','shopping_offer_events')")),
  };
}
const sourceDb = inspect("supabase_db_roomza"), sourceAuth = inspect("supabase_auth_roomza"), sourceRest = inspect("supabase_rest_roomza");
assert.equal(sourceDb.Config.Image, "public.ecr.aws/supabase/postgres:17.6.1.111");
assert.equal(sourceAuth.Config.Image, "public.ecr.aws/supabase/gotrue:v2.189.0");
assert.equal(sourceRest.Config.Image, "public.ecr.aws/supabase/postgrest:v14.5");
const envObject = (spec) => Object.fromEntries(spec.Config.Env.map((value) => { const at = value.indexOf("="); return [value.slice(0, at), value.slice(at + 1)]; }));
const dbEnv = envObject(sourceDb), authEnv = envObject(sourceAuth), restEnv = envObject(sourceRest);
assert.equal(authEnv.GOTRUE_MFA_TOTP_ENROLL_ENABLED, "false");
assert.equal(authEnv.GOTRUE_MFA_TOTP_VERIFY_ENABLED, "false");
const sourceConfigurationHash = hash(JSON.stringify([sourceDb.Config, sourceDb.Mounts, sourceAuth.Config, sourceRest.Config]));
evidence.sharedBefore = snapshot(sourceDb.Name.slice(1));
evidence.sourceCatalogHash = hash(JSON.stringify(catalog(sourceDb.Name.slice(1))));
evidence.sourceTableSecurity = tableSecurity(sourceDb.Name.slice(1));
evidence.runtime = { sharedImages: [sourceDb.Config.Image, sourceAuth.Config.Image, sourceRest.Config.Image], cloneImages: [patchedImage, sourceAuth.Config.Image, sourceRest.Config.Image], sharedTotpEnabled: false, cloneTotpEnabled: true };
function createContainer(name, image, env, ports = [], entrypoint, args = []) {
  const command = ["create", "--pull=never", "--name", name, "--label", label, "--network", names.network];
  if (name === names.db) command.push("--network-alias", "db", "-v", `${names.volume}:/var/lib/postgresql/data`);
  for (const port of ports) command.push("-p", port);
  for (const [key, value] of Object.entries(env)) command.push("-e", `${key}=${value}`);
  if (entrypoint) command.push("--entrypoint", entrypoint);
  command.push(image, ...args);
  docker(command); created.push(name); docker(["start", name]);
}
async function waitFor(check, description) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if (await check()) return; } catch { /* startup only */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (description.includes("Auth") || description.includes("PostgREST")) {
    for (const name of [names.auth,names.rest]) {
      const output = spawnSync("docker",["logs",name,"--tail","12"],{encoding:"utf8"});
      const messages = (output.stdout+output.stderr).split("\n").flatMap((line)=>{try{return [JSON.parse(line).msg];}catch{return [];}}).filter(Boolean);
      console.info("Clone startup diagnostics",{name,messages});
    }
  }
  throw new Error(`Timed out waiting for ${description}`);
}
async function localFetch(input, init) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.origin, "http://127.0.0.1:55431", "Blocked request outside the disposable API");
  if (url.pathname.startsWith("/auth/v1/")) { url.hostname = names.auth; url.port = "9999"; url.pathname = url.pathname.slice(8); }
  else if (url.pathname.startsWith("/rest/v1/")) { url.hostname = names.rest; url.port = "3000"; url.pathname = url.pathname.slice(8); }
  else throw new Error("Blocked unexpected API path");
  const args = ["exec","-i",names.db,"curl","--silent","--show-error","--max-time","10","--request",init?.method ?? (input instanceof Request?input.method:"GET")];
  const headers = new Headers(init?.headers ?? (input instanceof Request?input.headers:undefined));
  for (const [key,value] of headers) args.push("--header",`${key}: ${value}`);
  const body = init?.body ?? (input instanceof Request?await input.text():undefined);
  assert.ok(body===undefined || body===null || typeof body==="string");
  if (body) args.push("--data-binary","@-");
  args.push("--write-out","\n%{http_code}",url.href);
  const output = docker(args,body ?? undefined);
  const split = output.lastIndexOf("\n"), status = Number(output.slice(split+1));
  return new Response([204,205,304].includes(status)?null:output.slice(0,split),{status,headers:{"content-type":"application/json"}});
}
function client(key = local.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  return createClient("http://127.0.0.1:55431", key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: localFetch } });
}
let admin, passed = false, fixtureBaseline;
try {
  const image = JSON.parse(docker(["image", "inspect", patchedImage]))[0];
  assert.equal(image.Architecture,"amd64");
  assert.ok(image.RepoDigests.includes("public.ecr.aws/supabase/postgres@sha256:4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e"));
  evidence.runtime.patchedImageId = image.Id; evidence.runtime.patchedDigests = image.RepoDigests;
  docker(["network","create","--internal","--label",label,names.network]); networkCreated = true;
  docker(["volume","create","--label",label,names.volume]); volumeCreated = true;
  assert.equal(sourceDb.Config.Entrypoint[0],"sh"); assert.equal(sourceDb.Config.Entrypoint[1],"-c");
  const startup = sourceDb.Config.Entrypoint[2].replace("docker-entrypoint.sh postgres -D /etc/postgresql", "docker-entrypoint.sh postgres -D /etc/postgresql -c cron.launch_active_jobs=off");
  assert.notEqual(startup,sourceDb.Config.Entrypoint[2]);
  createContainer(names.db,patchedImage,dbEnv,[],"sh",["-c",startup]);
  await waitFor(() => sql(names.db,"select 1") === "1","clone database");
  // Logical database dumps reference roles but do not create cluster roles.
  const roles = JSON.parse(sql(sourceDb.Name.slice(1),"select json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls) order by rolname) from pg_roles"));
  const cloneRoles = JSON.parse(sql(names.db,"select json_agg(rolname) from pg_roles"));
  for (const role of roles) {
    assert.match(role.name,/^[a-z0-9_]+$/);
    if (!cloneRoles.includes(role.name)) {
      const attributes = Object.entries(role).filter(([key])=>key!=="name").map(([key,value])=>`${value?"":"no"}${key}`).join(" ");
      sql(names.db,`create role ${role.name} ${attributes};`);
    }
  }
  const memberships = JSON.parse(sql(sourceDb.Name.slice(1),"select json_agg(json_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member"));
  for (const membership of memberships) {
    assert.match(membership.role,/^[a-z0-9_]+$/); assert.match(membership.member,/^[a-z0-9_]+$/);
    sql(names.db,`grant ${membership.role} to ${membership.member}${membership.admin?" with admin option":""};`);
  }
  const dump = docker(["exec","-e",`PGPASSWORD=${dbEnv.POSTGRES_PASSWORD}`,sourceDb.Name.slice(1),"pg_dump","-h","127.0.0.1","-U","supabase_admin","-d","postgres","--format=custom"],undefined,true);
  evidence.logicalDump = { bytes: dump.length, sha256: hash(dump), storedOnHost: false };
  // Only the new labelled clone's bootstrap database is replaced; the source is read-only.
  sql(names.db,"drop database postgres with (force);", "template1");
  sql(names.db,"create database postgres owner postgres;", "template1");
  docker(["exec","-i","-e",`PGPASSWORD=${dbEnv.POSTGRES_PASSWORD}`,names.db,"pg_restore","-h","127.0.0.1","-U","supabase_admin","-d","postgres","--exit-on-error"],dump);
  assert.equal(sql(names.db,"show cron.launch_active_jobs"),"off");
  assert.deepEqual(snapshot(names.db),evidence.sharedBefore);
  assert.equal(hash(JSON.stringify(catalog(names.db))),evidence.sourceCatalogHash);
  assert.deepEqual(tableSecurity(names.db),evidence.sourceTableSecurity);
  const migration = readFileSync("supabase/migrations/20260930164313_pinpoint_offer_intake.sql","utf8");
  const stored = catalog(names.db);
  for (const match of migration.matchAll(/create function ([\w.]+)[\s\S]*?\bas \$\$([\s\S]*?)\$\$;/g)) assert.equal(stored[match[1]].body.trim(),match[2].trim());

  sql(names.db,"select cron.alter_job(job_id := jobid,active := false) from cron.job");
  assert.equal(sql(names.db,"select count(*) from cron.job where active"),"0");
  fixtureBaseline = snapshot(names.db);
  const dbUrl = (value) => { const parsed = new URL(value); assert.ok(["db","db.supabase.internal","supabase_db_roomza"].includes(parsed.hostname)); parsed.hostname = "db"; return parsed.href; };
  const isolatedAuth = { ...authEnv, GOTRUE_DB_DATABASE_URL: dbUrl(authEnv.GOTRUE_DB_DATABASE_URL), GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true", GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true", GOTRUE_SMTP_HOST: "unreachable.invalid", GOTRUE_SMTP_PORT: "1", API_EXTERNAL_URL: "http://127.0.0.1:55431/auth/v1", GOTRUE_JWT_ISSUER: "http://127.0.0.1:55431/auth/v1" };
  for (const key of Object.keys(isolatedAuth)) if (key.startsWith("GOTRUE_HOOK_")) delete isolatedAuth[key];
  createContainer(names.auth,sourceAuth.Config.Image,isolatedAuth);
  createContainer(names.rest,sourceRest.Config.Image,{ ...restEnv, PGRST_DB_URI: dbUrl(restEnv.PGRST_DB_URI) });
  await waitFor(() => docker(["exec",names.db,"curl","--silent","--max-time","1","--output","/dev/null","--write-out","%{http_code}",`http://${names.auth}:9999/health`]) === "200","clone Auth");
  await waitFor(async () => (await localFetch("http://127.0.0.1:55431/rest/v1/",{headers:{Authorization:`Bearer ${local.NEXT_PUBLIC_SUPABASE_ANON_KEY}`}})).ok,"clone PostgREST");
  assert.equal(inspect(names.network).Internal,true);
  for (const name of created) assert.deepEqual(Object.keys(inspect(name).NetworkSettings.Networks),[names.network]);
  evidence.runtime.transport = "SDK requests sent by curl from clone DB to clone Auth/PostgREST over the internal-only Docker network; no published ports";
  evidence.runtime.postgresVersion = sql(names.db,"select version()");
  evidence.runtime.reservedRoles = sql(names.db,"show supautils.reserved_roles");
  evidence.runtime.hintRoles = sql(names.db,"show supautils.hint_roles");

  const migrationPath = "supabase/migrations/20261001220000_pinpoint_offer_review_queue.sql";
  sql(names.db, `begin; ${readFileSync(migrationPath,"utf8")} insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261001220000','pinpoint_offer_review_queue',array[]::text[]); commit; notify pgrst,'reload schema';`);
  fixtureBaseline = snapshot(names.db);
  evidence.cloneMigrationBaseline = fixtureBaseline;
  const cloneCatalog = catalog(names.db);
  for (const [key,value] of Object.entries(catalog(sourceDb.Name.slice(1)))) assert.deepEqual(cloneCatalog[key],value);
  evidence.cloneCatalogHash = hash(JSON.stringify(cloneCatalog));
  const guest = client();
  const anonQueue = await guest.rpc("pinpoint_offer_review_queue", {queue_page:1});
  assert.equal(anonQueue.status,401); assert.equal(anonQueue.error?.code,"42501");
  checks.push({name:"Anonymous queue HTTP denial with revokes intact",status:401});
  admin = client(local.SUPABASE_SERVICE_ROLE_KEY);
  for (let index=0;index<4;index++) {
    const email = `${tag}-${index}@pinpoint.invalid`;
    const result = await admin.auth.admin.createUser({email,password,email_confirm:true}); assert.equal(result.error,null);
    accounts.push({id:result.data.user.id,email});
    sql(names.db,`update public.notification_subscriptions set enabled=false,frequency='never' where user_id='${result.data.user.id}' and channel='email';
      insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${result.data.user.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing;`);
    const actor=client(); clients.push(actor); assert.equal((await actor.auth.signInWithPassword({email,password})).error,null);
  }
  const [poster,reviewer,owner,ordinary]=clients;
  sql(names.db,`insert into public.discovery_places(id,provider_id,level,name,region,full_address,center_lat,center_lng,west,south,east,north)
    values('${placeId}','${tag}','locality','Synthetic review place','Fixture','Synthetic South African fixture',-33.96,18.47,18.4,-34,18.6,-33.9);
    insert into public.admin_memberships(user_id,level) values('${accounts[1].id}','admin'),('${accounts[2].id}','owner');`);
  assert.equal((await poster.rpc("pinpoint_offer_enroll",{})).error,null);
  for (const [target,revision,title] of [[offerId,revisionId,"Submitted desktop fixture"],[phoneOfferId,phoneRevisionId,"Submitted phone fixture"]]) {
    for (const [command,expected,payload,rev] of [["create",0,{},null],["save",1,{title,benefit:"Synthetic benefit",terms:"Fixture only. No redemption.",shopName:"Synthetic shop",areaId:placeId,address:"Synthetic public address",latitude:-33.96,longitude:18.47,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()},null],["submit",2,{},revision]]) {
      const response=await poster.rpc("pinpoint_offer_write",{command,target,expected_version:expected,payload,...(rev?{revision:rev}:{})}); assert.equal(response.error,null);
    }
  }
  for (const actor of [poster,reviewer,owner,ordinary]) {
    const response=await actor.rpc("pinpoint_offer_review_queue",{queue_page:1}); assert.equal(response.status,403); assert.equal(response.error?.code,"42501");
  }
  checks.push({name:"Poster, ordinary account, admin/owner aal1 denied pending queue"});
  gateway=createServer(async (req,res)=>{
    res.setHeader("Access-Control-Allow-Origin",appOrigin);
    res.setHeader("Access-Control-Allow-Headers",req.headers["access-control-request-headers"] || "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Cache-Control","no-store");
    if (req.method==="OPTIONS") {res.writeHead(204);res.end();return;}
    try {
      const chunks=[]; for await (const chunk of req) {chunks.push(chunk);assert.ok(chunks.reduce((n,c)=>n+c.length,0)<50000);}
      const response=await localFetch(`http://127.0.0.1:55431${req.url}`,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks).toString():undefined});
      res.setHeader("Content-Type","application/json");res.writeHead(response.status);res.end(await response.text());
    } catch (error) {console.info("Contained gateway diagnostic",error.message);res.writeHead(502);res.end(JSON.stringify({error:"Contained gateway rejected request"}));}
  });
  await new Promise((resolve,reject)=>{gateway.once("error",reject);gateway.listen(55431,"127.0.0.1",resolve)});
  writeFileSync(guardPath,`const real=globalThis.fetch;globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(!['http://127.0.0.1:55431','${appOrigin}'].includes(u.origin))throw new Error('Blocked external fixture fetch');return real(input,init)};`);
  const appEnv={...process.env,NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:55431",NEXT_PUBLIC_SUPABASE_ANON_KEY:local.NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_APP_URL:appOrigin,NEXT_TELEMETRY_DISABLED:"1",LOG_LEVEL:"warn",NODE_OPTIONS:`--require ${guardPath}`};
  for (const key of ["RESEND_API_KEY","QSTASH_TOKEN","QSTASH_CURRENT_SIGNING_KEY","QSTASH_NEXT_SIGNING_KEY","CRON_SECRET","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN","VAPID_PRIVATE_KEY","NEXT_PUBLIC_VAPID_PUBLIC_KEY","NEXT_PUBLIC_SENTRY_DSN","SENTRY_DSN","NEXT_PUBLIC_TURNSTILE_SITE_KEY","TURNSTILE_SECRET_KEY","NEXT_PUBLIC_MAPTILER_API_KEY"]) appEnv[key]="";
  appLog=openSync("next-offer-review-screen.local.log","w");
  app=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--webpack","--port","3111"],{env:appEnv,stdio:["ignore",appLog,appLog],windowsHide:true});
  await waitFor(async ()=>{if(app.exitCode!==null)throw new Error("App exited");try {return (await fetch(appOrigin+"/api/private/offers/reject",{method:"POST",headers:{Origin:appOrigin,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(20000)})).status===401;}catch{return false;}},"contained review app");
  await fetch(appOrigin+"/api/presence/beat",{method:"POST",headers:{"Content-Type":"application/json"},body:'{"desired":"offline"}'});
  console.info("Review clone and contained app ready; two pending fixture snapshots captured");
  const driverEnv={...process.env,PINPOINT_BROWSER_CONFIG:JSON.stringify({appOrigin,dbOrigin:"http://127.0.0.1:55431",dbName:names.db,dbPassword:dbEnv.POSTGRES_PASSWORD,accounts,password,offerId,revisionId,phoneOfferId,phoneRevisionId,tag,resultPath:browserEvidencePath})};
  const child=spawn(process.execPath,["C:/Users/BB/.agents/skills/playwright/run.js",testPath],{env:driverEnv,stdio:"inherit",windowsHide:true});
  assert.equal(await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve)}),0,"Browser verification failed");
  evidence.browser=JSON.parse(readFileSync(browserEvidencePath,"utf8"));checks.push(...evidence.browser.checks);
  assert.equal(sql(names.db,"select count(*) from public.notification_events"),String(fixtureBaseline.counts.notification_events));
  evidence.mfaFactors=JSON.parse(sql(names.db,`select json_agg(json_build_object('id',id,'userId',user_id,'type',factor_type,'status',status)) from auth.mfa_factors where user_id in ('${accounts[1].id}','${accounts[2].id}')`));
  assert.equal(evidence.mfaFactors.filter(f=>f.userId===accounts[1].id&&f.status==="verified").length,1);
  assert.equal(evidence.mfaFactors.filter(f=>f.userId===accounts[2].id&&f.status==="verified").length,2);
  passed=true;
} finally {
  if(app&&app.exitCode===null){try{execFileSync("taskkill",["/PID",String(app.pid),"/T","/F"],{stdio:"ignore"});}catch{app.kill();}}
  if(appLog!==undefined)closeSync(appLog);
  if(gateway)await new Promise(resolve=>gateway.close(resolve));
  try {
    if(fixtureBaseline&&accounts.length){
      for(const actor of clients)await actor.auth.signOut().catch(()=>{});
      for(const account of accounts){assert.match(account.id,/^[0-9a-f-]{36}$/);assert.equal(sql(names.db,`select email from auth.users where id='${account.id}'`),account.email);}
      const ids=accounts.map(a=>`'${a.id}'`).join(",");
      const offers=[offerId,phoneOfferId].map(id=>`'${id}'`).join(",");
      assert.equal(sql(names.db,`select count(*) from public.shopping_offers where id in (${offers}) and poster_id not in (${ids})`),"0");
      sql(names.db,`begin;
        alter table public.shopping_offer_events disable trigger shopping_offer_events_immutable;
        alter table public.shopping_offer_revisions disable trigger shopping_offer_revisions_immutable;
        update public.shopping_offers set pending_revision_id=null where id in (${offers}) and poster_id in (${ids});
        delete from public.shopping_offer_events where poster_id in (${ids});
        delete from public.shopping_offer_revisions where offer_id in (${offers}) and poster_id in (${ids});
        delete from public.shopping_offers where id in (${offers}) and poster_id in (${ids});
        delete from public.offer_posters where user_id in (${ids});
        alter table public.shopping_offer_events enable trigger shopping_offer_events_immutable;
        alter table public.shopping_offer_revisions enable trigger shopping_offer_revisions_immutable;
        delete from public.discovery_places where id='${placeId}' and provider_id='${tag}';
        delete from public.account_suspensions where user_id in (${ids}) and reason='${tag}';
        alter table public.admin_memberships disable trigger admin_memberships_last_owner;
        delete from public.admin_memberships where user_id in (${ids});
        alter table public.admin_memberships enable trigger admin_memberships_last_owner;commit;`);
      for(const account of accounts)assert.equal((await admin.auth.admin.deleteUser(account.id)).error,null);
      assert.deepEqual(snapshot(names.db),fixtureBaseline);
      for(const job of evidence.sharedBefore.jobs)sql(names.db,`select cron.alter_job(job_id := ${job.jobid}, active := ${job.active})`);
      evidence.cloneAfterCleanup=snapshot(names.db);assert.deepEqual(evidence.cloneAfterCleanup,{...fixtureBaseline,jobs:evidence.sharedBefore.jobs});
      assert.deepEqual(tableSecurity(names.db),evidence.sourceTableSecurity);
      const after=catalog(names.db);for(const [key,value] of Object.entries(catalog(sourceDb.Name.slice(1))))assert.deepEqual(after[key],value);
      evidence.originalFunctionsPreserved=true;
    }
  } finally {
    for(const name of created.toReversed()){
      assert.equal(inspect(name).Config.Labels["pinpoint.review.screen.run"],tag);
      if(name===names.db){const logs=spawnSync("docker",["logs",name],{encoding:"utf8",maxBuffer:64*1024*1024});assert.equal(logs.status,0);evidence.cloneCrashLogCheck={markers:(logs.stdout+logs.stderr).match(/signal 11|Segmentation fault|database system was interrupted|automatic recovery in progress/g)??[]};}
      docker(["rm","--force",name]);
    }
    if(volumeCreated){assert.equal(JSON.parse(docker(["volume","inspect",names.volume]))[0].Labels["pinpoint.review.screen.run"],tag);docker(["volume","rm",names.volume]);}
    if(networkCreated){assert.equal(inspect(names.network).Labels["pinpoint.review.screen.run"],tag);docker(["network","rm",names.network]);}
    for(const file of [guardPath,browserEvidencePath])try{unlinkSync(file)}catch{}
    evidence.sharedAfter=snapshot(sourceDb.Name.slice(1));assert.deepEqual(evidence.sharedAfter,evidence.sharedBefore);
    const afterDb=inspect(sourceDb.Name.slice(1)),afterAuth=inspect(sourceAuth.Name.slice(1)),afterRest=inspect(sourceRest.Name.slice(1));
    assert.equal(hash(JSON.stringify([afterDb.Config,afterDb.Mounts,afterAuth.Config,afterRest.Config])),sourceConfigurationHash);
    assert.equal(afterDb.Id,sourceDb.Id);assert.equal(afterAuth.Id,sourceAuth.Id);assert.equal(afterRest.Id,sourceRest.Id);
    assert.equal(hash(JSON.stringify(catalog(sourceDb.Name.slice(1)))),evidence.sourceCatalogHash);
    assert.deepEqual(tableSecurity(sourceDb.Name.slice(1)),evidence.sourceTableSecurity);
    evidence.cleanup={capturedAccounts:accounts,cloneContainersRemoved:created,volumeRemoved:volumeCreated,networkRemoved:networkCreated,sharedContainersUnchanged:true,sharedConfigUnchanged:true,dumpStoredOnHost:false};
    console.info("Review fixture/clone cleanup complete; shared counts, data, permissions and config unchanged");
  }
}
assert.ok(passed);assert.deepEqual(evidence.cloneCrashLogCheck.markers,[]);
evidence.recordedAt=new Date().toISOString();
evidence.sourceHashes=Object.fromEntries(["scripts/db/offer-review-screen.local.mjs","src/features/offers/schema.ts","src/features/offers/lifecycle.ts","src/features/offers/intake.ts","supabase/migrations/20260930164313_pinpoint_offer_intake.sql","supabase/migrations/20261001220000_pinpoint_offer_review_queue.sql","src/features/offers/review-api.ts","src/features/offers/review-data.ts","src/features/offers/offer-review-editor.tsx"].map(p=>[p,hash(readFileSync(p))]));
evidence.limitations=["Disposable patched clone and loopback gateway, not shared-runtime or staging MFA","Queue migration applied only on removed clone; not shared or deployed","Synthetic content only; no approval, publication, public journey or external delivery"];
writeFileSync("docs/pinpoint-offer-review-screen-local-evidence.json",JSON.stringify(evidence,null,2)+"\n");
console.info(`Review screen passed ${checks.length} real HTTP/browser/SQL checks`);
