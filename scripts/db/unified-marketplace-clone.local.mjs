/** Opt-in isolated release CLI rehearsal on a disposable clone. Shared database is read-only. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCloneCrashDiagnostics } from "./clone-crash-diagnostics.local.mjs";

if (process.env.PINPOINT_RELEASE_CLONE_LOCAL !== "1") throw new Error("Set PINPOINT_RELEASE_CLONE_LOCAL=1 to run the disposable clone rehearsal");
const local = parseEnv(readFileSync(".env.local", "utf8"));
assert.equal(local.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
for (const [key, role] of [[local.NEXT_PUBLIC_SUPABASE_ANON_KEY, "anon"], [local.SUPABASE_SERVICE_ROLE_KEY, "service_role"]]) {
  const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
  assert.equal(claims.iss, "supabase-demo"); assert.equal(claims.role, role); assert.equal(claims.ref, undefined);
}
for (const key of ["RESEND_API_KEY", "QSTASH_TOKEN", "QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "CRON_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"]) delete process.env[key];
const tag = `pinpoint-release-${randomUUID()}`;
const label = `pinpoint.release.run=${tag}`;
const names = { db: `${tag}-db`, auth: `${tag}-auth`, rest: `${tag}-rest`, realtime: `${tag}-realtime`, storage: `${tag}-storage`, imgproxy: `${tag}-imgproxy`, storageVolume: `${tag}-storage-volume`, restore: `${tag}-restore`, network: `${tag}-network`, volume: `${tag}-volume` };
const physicalClone = process.env.PINPOINT_CLONE_PHYSICAL === "1";
const nativeBootstrap = process.env.PINPOINT_CLONE_NATIVE_BOOTSTRAP === "1";
const disableStatementTracking = process.env.PINPOINT_CLONE_DISABLE_STATEMENT_TRACKING === "1";
const flowCheck = process.env.PINPOINT_FLOW_CHECK ?? "unified";
const runtimeCase = process.env.PINPOINT_FLOW_CASE ?? "all";
const imageTransformationEnabled = ["imports-lifecycle-publication-browser","imports-lifecycle-recovery-browser","imports-lifecycle-recovery-partial-browser","imports-lifecycle-recovery-legacy-browser","imports-lifecycle-recovery-completion-browser","imports-lifecycle-recovery-final-browser","imports-lifecycle-recovery-tenant-browser","imports-lifecycle-listing-controls-readiness-browser","imports-lifecycle-owner-buyer-browser","imports-lifecycle-recovery-extended-browser"].includes(runtimeCase);
const browserSdkCandidate = process.env.PINPOINT_BROWSER_SDK_CANDIDATE;
if (browserSdkCandidate) {
  assert.equal(flowCheck, "messaging");
  assert.equal(runtimeCase, "sdk-auth-browser");
  assert.equal(path.resolve(browserSdkCandidate), path.resolve(".cache/supabase-sdk-evaluation-20261017-2.112.4"));
  assert.equal(JSON.parse(readFileSync(path.join(browserSdkCandidate, "node_modules/@supabase/supabase-js/package.json"), "utf8")).version, "2.112.4");
}
assert.ok(["all","imports-lifecycle-safety","imports-lifecycle-recovery","imports-lifecycle-recovery-advanced","imports-lifecycle-recovery-diagnostics","imports-lifecycle-recovery-acknowledgement","imports-lifecycle-recovery-legacy-repair","imports-lifecycle-recovery-rollback-repair","imports-lifecycle-recovery-photos-repair","imports-lifecycle-recovery-photo-policy","imports-lifecycle-recovery-application-boundary","imports-lifecycle-recovery-audit","imports-lifecycle-recovery-buyer-boundary","imports-lifecycle-owner-buyer-boundary","imports-lifecycle-owner-controls-safety","imports-lifecycle-publication","imports-lifecycle-publication-browser","imports-lifecycle-recovery-browser","imports-lifecycle-recovery-partial-browser","imports-lifecycle-recovery-legacy-browser","imports-lifecycle-recovery-completion-browser","imports-lifecycle-recovery-final-browser","imports-lifecycle-recovery-tenant-browser","imports-lifecycle-listing-controls-readiness-browser","imports-lifecycle-owner-buyer-browser","imports-lifecycle-recovery-extended-browser","imports-lifecycle-assets","imports-lifecycle-assets-review","imports-lifecycle-image-pages","imports-lifecycle-image-pages-browser","imports-lifecycle-image-pages-browser-retry","imports-lifecycle-image-transport-browser","imports-lifecycle-duplicates","imports-lifecycle-duplicate-choice-browser","imports-lifecycle-browser","imports-review-browser","imports-browser","imports-safety","entries-boundaries-browser","entries-safety","entries-browser","entries-public-browser","specials-safety","specials-browser","specials-boundaries-browser","specials-owner-status-browser","services-safety","services-browser","services-media-safety","services-media-full","services-media-browser","live-tour-safety","live-tour-browser","live-tour-pip-browser","instant-connect-browser","instant-connect-safety","rental-recovery","messaging-safety","rental-viewing-safety","rental-viewing-contract","rental-viewing-boundaries","buyer-viewing-regression","viewing-browser","sdk-safety","messaging-safety-browser","relationship-browser","relationship-diagnostic-browser","relationship-reload-browser","sdk-auth-browser","sdk-auth-production-browser","journey-recovery-browser","profile-layout-browser","messaging-browser","auth-return","calls","call-access","call-all","call-notification-failure","calls-browser","call-timer-browser","call-recovery-browser"].includes(runtimeCase),"Unknown runtime case selection");
const flowChecks = { unified: "scripts/db/verify-unified-marketplace.mjs", property: "scripts/db/property-phase4-check.local.mjs", "property-browser": "scripts/db/property-phase4-check.local.mjs", messaging: "scripts/db/messaging-check.local.mjs" };
assert.ok(Object.hasOwn(flowChecks, flowCheck), "Unknown isolated flow check");
const storageEnabled = flowCheck.startsWith("property") || ["imports-lifecycle-safety","imports-lifecycle-recovery","imports-lifecycle-recovery-advanced","imports-lifecycle-recovery-diagnostics","imports-lifecycle-recovery-acknowledgement","imports-lifecycle-recovery-legacy-repair","imports-lifecycle-recovery-rollback-repair","imports-lifecycle-recovery-photos-repair","imports-lifecycle-recovery-photo-policy","imports-lifecycle-recovery-application-boundary","imports-lifecycle-recovery-audit","imports-lifecycle-recovery-buyer-boundary","imports-lifecycle-owner-buyer-boundary","imports-lifecycle-owner-controls-safety","imports-lifecycle-publication","imports-lifecycle-publication-browser","imports-lifecycle-recovery-browser","imports-lifecycle-recovery-partial-browser","imports-lifecycle-recovery-legacy-browser","imports-lifecycle-recovery-completion-browser","imports-lifecycle-recovery-final-browser","imports-lifecycle-recovery-tenant-browser","imports-lifecycle-listing-controls-readiness-browser","imports-lifecycle-owner-buyer-browser","imports-lifecycle-recovery-extended-browser","imports-lifecycle-assets","imports-lifecycle-assets-review","imports-lifecycle-image-pages","imports-lifecycle-image-pages-browser","imports-lifecycle-image-pages-browser-retry","imports-lifecycle-image-transport-browser","imports-lifecycle-duplicates","imports-lifecycle-duplicate-choice-browser","imports-lifecycle-browser","imports-review-browser","imports-browser","imports-safety","entries-boundaries-browser","entries-safety","entries-browser","entries-public-browser","specials-safety","specials-browser","specials-boundaries-browser","specials-owner-status-browser","services-browser","services-media-safety","services-media-full","services-media-browser"].includes(runtimeCase);
const messagingBrowserScripts = { "imports-lifecycle-image-transport-browser": "playwright-test-roomza-imports-image-transport.cjs", "imports-lifecycle-image-pages-browser-retry": "playwright-test-roomza-imports-image-pages-retry.cjs", "imports-lifecycle-image-pages-browser": "playwright-test-roomza-imports-image-pages.cjs", "imports-lifecycle-owner-buyer-browser": "playwright-test-roomza-property-sale-buyer.cjs", "imports-lifecycle-recovery-tenant-browser": "playwright-test-roomza-imports-recovery-tenant.cjs", "imports-lifecycle-recovery-final-browser": "playwright-test-roomza-imports-recovery-final.cjs", "imports-lifecycle-recovery-legacy-browser": "playwright-test-roomza-imports-recovery-legacy.cjs", "imports-lifecycle-recovery-completion-browser": "playwright-test-roomza-imports-recovery-completion.cjs", "imports-lifecycle-listing-controls-readiness-browser": "playwright-test-roomza-listing-controls-readiness.cjs", "imports-lifecycle-recovery-partial-browser": "playwright-test-roomza-imports-recovery-partial.cjs", "imports-lifecycle-recovery-extended-browser": "playwright-test-roomza-imports-recovery-layout.cjs", "imports-lifecycle-recovery-browser": "playwright-test-roomza-imports-recovery.cjs", "imports-lifecycle-publication-browser": "playwright-test-roomza-imports-publication.cjs", "imports-lifecycle-duplicate-choice-browser": "playwright-test-roomza-imports-duplicate-choice.cjs", "imports-review-browser": "playwright-test-roomza-imports-review.cjs", "imports-lifecycle-browser": "playwright-test-roomza-imports-review.cjs", "imports-browser": "playwright-test-roomza-imports.cjs", "entries-boundaries-browser": "playwright-test-roomza-entries-boundaries.cjs", "entries-public-browser": "playwright-test-roomza-entries-public.cjs", "entries-browser": "playwright-test-roomza-entries.cjs", "specials-owner-status-browser": "playwright-test-roomza-specials-owner-status.cjs", "specials-boundaries-browser": "playwright-test-roomza-specials-boundaries.cjs", "specials-browser": "playwright-test-roomza-specials.cjs", "services-media-browser": "playwright-test-roomza-services-media.cjs", "services-browser": "playwright-test-roomza-services.cjs", "live-tour-pip-browser": "playwright-test-roomza-live-tour-pip.cjs", "live-tour-browser": "playwright-test-roomza-live-tour.cjs", "instant-connect-browser": "playwright-test-roomza-instant-connect.cjs", "viewing-browser": "playwright-test-roomza-viewings.cjs", "messaging-safety-browser": "playwright-test-roomza-messaging-safety.cjs", "relationship-browser": "playwright-test-roomza-relationships.cjs", "relationship-diagnostic-browser": "playwright-test-roomza-relationship-retry-diagnostic.cjs", "relationship-reload-browser": "playwright-test-roomza-relationship-reload-cause.cjs", "sdk-auth-browser": "playwright-test-roomza-sdk-auth.cjs", "sdk-auth-production-browser": "playwright-test-roomza-sdk-auth-production.cjs", "journey-recovery-browser": "playwright-test-roomza-journey-recovery.cjs", "profile-layout-browser": "playwright-test-roomza-profile-layout.cjs", "messaging-browser": "playwright-test-roomza-messaging.cjs", "auth-return": "playwright-test-roomza-auth-return.cjs", "calls-browser": "playwright-test-roomza-calls.cjs", "call-timer-browser": "playwright-test-roomza-call-timer.cjs", "call-recovery-browser": "playwright-test-roomza-call-recovery.cjs" };
const realtimeEnabled = flowCheck === "property-browser" || (flowCheck === "messaging" && Object.hasOwn(messagingBrowserScripts, runtimeCase));
const browserScript = flowCheck === "property-browser" ? path.join(tmpdir(),"playwright-test-roomza-property.cjs") : flowCheck === "messaging" && Object.hasOwn(messagingBrowserScripts, runtimeCase) ? path.join(tmpdir(), messagingBrowserScripts[runtimeCase]) : null;
if (browserScript) assert.ok(readFileSync(browserScript).length > 0);
const patchedImage = "public.ecr.aws/supabase/postgres:17.6.1.113";
const created = [];
let networkCreated = false, volumeCreated = false, storageVolumeCreated = false;
const checks = [];
const taskPath = path.join(tmpdir(), tag+"-task.mjs");
writeFileSync(taskPath, "await import("+JSON.stringify(pathToFileURL(path.resolve(flowChecks[flowCheck])).href)+");\n");
assert.ok(taskPath && path.isAbsolute(taskPath) && /^pinpoint-release-[a-z0-9-]+\.mjs$/.test(path.basename(taskPath)));
assert.ok(path.resolve(taskPath).toLowerCase().startsWith(path.resolve(tmpdir()).toLowerCase()+path.sep));
const taskEvidencePath = path.join(tmpdir(), `${tag}-task.json`);
let gateway, passed = false, fixtureBaseline, cloneCatalogBaseline;
const realtimeSockets = new Set(), realtimeBridges = new Set();
const evidence = { environment: "disposable patched local clone; PostgreSQL, Auth, REST; browser coverage depends on selected check; no deployment", tag, flowCheck, checks };
const hash = (value) => createHash("sha256").update(value).digest("hex");
function docker(args, input, binary = false) {
  try { return execFileSync("docker", args, { input, encoding: binary ? undefined : "utf8", maxBuffer: (binary ? 512 : 64) * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }); }
  catch (error) {
    const diagnostic = String(error.stderr ?? "").match(/ERROR:[^\r\n]*/g)?.slice(0,2).join("; ") ?? "no SQL diagnostic";
    const safeLines=String(error.stderr ?? "").split("\n").filter(line=>/^(pg_basebackup:|pg_restore:|psql:|Error response from daemon:|OCI runtime)/.test(line)).slice(-8);
    throw new Error(`Docker ${args[0]} failed (exit ${error.status}): ${diagnostic}; ${safeLines.join("; ")}; container arguments withheld`);
  }
}
const inspect = (name) => JSON.parse(docker(["inspect", name]))[0];
async function cloneCrashLogCheck(name) {
  const markers = new Set();
  const diagnostic = createCloneCrashDiagnostics({ requestId: tag, container: name });
  let bytes = 0;
  const child = spawn("docker", ["logs", name], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  for (const [streamName, stream] of [["stdout", child.stdout], ["stderr", child.stderr]]) {
    let tail = "";
    stream.on("data", chunk => {
      bytes += chunk.length;
      diagnostic.feed(streamName, chunk);
      const text = tail + chunk.toString();
      for (const marker of text.match(/signal 11|Segmentation fault|database system was interrupted|automatic recovery in progress/g) ?? []) markers.add(marker);
      tail = text.slice(-128);
    });
  }
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error("Owned clone crash-log scan failed")));
  });
  return { markers: [...markers], bytes, fullLogScanned: true, boundedMemory: true, diagnostic: diagnostic.finish() };
}
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
  return JSON.parse(sql(container, `select json_object_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',json_build_object('body',p.prosrc,'owner',pg_get_userbyid(p.proowner),'acl',(select coalesce(json_agg(a::text order by a::text),'[]') from unnest(coalesce(p.proacl,acldefault('f',p.proowner))) a),'definer',p.prosecdef,'settings',p.proconfig) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (p.proname like 'pinpoint_%' or p.proname in ('start_call_session','end_call_session','get_active_call_session','call_session_access','expire_call_sessions','call_terminal_transcript','notification_enqueue','enqueue_profile_document_expiry_reminders')) and n.nspname in ('public','private')`));
}
function tableSecurity(container) {
  return {
    tables: JSON.parse(sql(container,"select json_agg(json_build_object('name',relname,'rls',relrowsecurity,'forceRls',relforcerowsecurity,'acl',relacl) order by relname) from pg_class where oid in ('public.offer_posters'::regclass,'public.shopping_offers'::regclass,'public.shopping_offer_revisions'::regclass,'public.shopping_offer_events'::regclass,'public.call_sessions'::regclass)")),
    policies: JSON.parse(sql(container,"select json_agg(row_to_json(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('offer_posters','shopping_offers','shopping_offer_revisions','shopping_offer_events','call_sessions')")),
  };
}
function clusterRoleSecurity(container) {
  return {
    roles: JSON.parse(sql(container, "select json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createrole',rolcreaterole,'createdb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassrls',rolbypassrls,'connectionLimit',rolconnlimit,'validUntil',rolvaliduntil,'configurationHash',md5(coalesce(rolconfig::text,''))) order by rolname) from pg_roles")),
    memberships: JSON.parse(sql(container, "select coalesce(json_agg(json_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) order by r.rolname,m.rolname),'[]') from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member")),
  };
}
const sourceDb = inspect("supabase_db_roomza"), sourceAuth = inspect("supabase_auth_roomza"), sourceRest = inspect("supabase_rest_roomza");
assert.equal(sourceDb.Config.Image, "public.ecr.aws/supabase/postgres:17.6.1.111");
assert.equal(sourceAuth.Config.Image, "public.ecr.aws/supabase/gotrue:v2.189.0");
assert.equal(sourceRest.Config.Image, "public.ecr.aws/supabase/postgrest:v14.5");
const envObject = (spec) => Object.fromEntries(spec.Config.Env.map((value) => { const at = value.indexOf("="); return [value.slice(0, at), value.slice(at + 1)]; }));
const dbEnv = envObject(sourceDb), authEnv = envObject(sourceAuth), restEnv = envObject(sourceRest);
const sourceStorage = storageEnabled ? inspect("supabase_storage_roomza") : null;
const storageEnv = sourceStorage ? envObject(sourceStorage) : null;
const sourceRealtime = realtimeEnabled ? inspect("supabase_realtime_roomza") : null;
const realtimeEnv = sourceRealtime ? envObject(sourceRealtime) : null;
if(sourceRealtime) assert.equal(sourceRealtime.Config.Image,"public.ecr.aws/supabase/realtime:v2.112.1");
if (sourceStorage) {
  assert.equal(sourceStorage.Config.Image, "public.ecr.aws/supabase/storage-api:v1.60.10");
  assert.equal(storageEnv.STORAGE_BACKEND, "file");
}
const sourceConfigurationHash = hash(JSON.stringify([sourceDb.Config, sourceDb.Mounts, sourceAuth.Config, sourceRest.Config, sourceStorage?.Config, sourceStorage?.Mounts, sourceRealtime?.Config, sourceRealtime?.Mounts]));
evidence.sharedBefore = snapshot(sourceDb.Name.slice(1));
evidence.sourceCatalogHash = hash(JSON.stringify(catalog(sourceDb.Name.slice(1))));
evidence.sourceTableSecurity = tableSecurity(sourceDb.Name.slice(1));
evidence.sourceClusterRoleSecurity = clusterRoleSecurity(sourceDb.Name.slice(1));
evidence.runtime = { sharedImages: [sourceDb.Config.Image, sourceAuth.Config.Image, sourceRest.Config.Image], cloneImages: [patchedImage, sourceAuth.Config.Image, sourceRest.Config.Image], sharedTotpEnabled: authEnv.GOTRUE_MFA_TOTP_ENROLL_ENABLED === "true", cloneTotpEnabled: true };
function createContainer(name, image, env, ports = [], entrypoint, args = []) {
  const command = ["create", "--pull=never", "--name", name, "--label", label, "--network", names.network];
  if (name === names.db) command.push("--network-alias", "db", "-v", `${names.volume}:/var/lib/postgresql/data`);
  if (name === names.storage) command.push("-v", `${names.storageVolume}:/var/lib/storage`);
  if (name === names.imgproxy) command.push("-v", `${names.storageVolume}:/var/lib/storage:ro`);
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
  else if (storageEnabled && url.pathname.startsWith("/storage/v1/")) { url.hostname = names.storage; url.port = "5000"; url.pathname = url.pathname.slice(11); }
  else throw new Error("Blocked unexpected API path");
  const method = init?.method ?? (input instanceof Request?input.method:"GET");
  const args = ["exec","-i",names.db,"curl","--silent","--show-error","--compressed","--max-time","10", ...(method === "HEAD" ? ["--head"] : ["--request",method])];
  const headers = new Headers(init?.headers ?? (input instanceof Request?input.headers:undefined));
  for (const [key,value] of headers) if(key!=="accept-encoding") args.push("--header",`${key}: ${value}`);
  const body = init?.body ?? (input instanceof Request?Buffer.from(await input.arrayBuffer()):undefined);
  assert.ok(body===undefined || body===null || typeof body==="string" || Buffer.isBuffer(body));
  if (body) args.push("--data-binary","@-");
  args.push("--include", "--write-out","\n%{http_code}",url.href);
  // API traffic must not block the gateway's event loop. Concurrent auth and
  // notification requests otherwise wait behind every synchronous Docker call.
  const output = await new Promise((resolve,reject) => {
    const child=spawn("docker",args,{stdio:["pipe","pipe","pipe"],windowsHide:true});
    const chunks=[];let size=0;
    child.stdout.on("data",chunk=>{size+=chunk.length;if(size>64*1024*1024){child.kill();reject(new Error("Contained API response exceeded limit"));}else chunks.push(chunk);});
    child.stderr.resume();
    child.stdin.on("error",()=>reject(new Error("Contained API request could not be written")));
    child.once("error",()=>reject(new Error("Contained API transport could not start")));
    child.once("exit",code=>code===0?resolve(Buffer.concat(chunks)):reject(new Error(`Contained API transport exited ${code}`)));
    child.stdin.end(body ?? undefined);
  });
  const split = output.lastIndexOf(10), status = Number(output.subarray(split+1).toString());
  let payload = output.subarray(0,split), responseHeaders;
  // curl can emit an interim 100 response before the final headers.
  while (payload.subarray(0,5).toString() === "HTTP/") {
    const headerEnd = payload.indexOf(Buffer.from("\r\n\r\n"));
    assert.ok(headerEnd >= 0, "Missing contained HTTP headers");
    responseHeaders = new Headers();
    for (const line of payload.subarray(0,headerEnd).toString().split("\r\n").slice(1)) {
      const colon = line.indexOf(":");
      if (colon > 0) responseHeaders.append(line.slice(0,colon),line.slice(colon+1).trim());
    }
    payload = payload.subarray(headerEnd+4);
  }
  return new Response([204,205,304].includes(status)?null:payload,{status,headers:responseHeaders});
}
try {
  const image = JSON.parse(docker(["image", "inspect", patchedImage]))[0];
  assert.equal(image.Architecture,"amd64");
  assert.ok(image.RepoDigests.includes("public.ecr.aws/supabase/postgres@sha256:4c39816ce8d9303a3aba1161c842929c73a40c7109a9ef1b644582478e31832e"));
  evidence.runtime.patchedImageId = image.Id; evidence.runtime.patchedDigests = image.RepoDigests;
  docker(["network","create","--internal","--label",label,names.network]); networkCreated = true;
  if (storageEnabled) { docker(["volume","create","--label",label,names.storageVolume]); storageVolumeCreated = true; }
  docker(["volume","create","--label",label,names.volume]); volumeCreated = true;
  assert.equal(sourceDb.Config.Entrypoint[0],"sh"); assert.equal(sourceDb.Config.Entrypoint[1],"-c");
  let startup = sourceDb.Config.Entrypoint[2].replace("docker-entrypoint.sh postgres -D /etc/postgresql", "docker-entrypoint.sh postgres -D /etc/postgresql -c cron.launch_active_jobs=off");
  assert.notEqual(startup,sourceDb.Config.Entrypoint[2]);
  if (nativeBootstrap) {
    // Keep the copied database's vault key while using the installed image's
    // own initialization scripts instead of older CLI bootstrap SQL.
    const rootKey = sourceDb.Config.Entrypoint[2].match(/\nEOF\r?\n([a-f0-9]{64})\r?\nEOF\r?\n/i)?.[1];
    assert.ok(rootKey, "Could not identify the local database vault key");
    startup = `mkdir -p /etc/postgresql-custom && printf '%s\\n' '${rootKey}' > /etc/postgresql-custom/pgsodium_root.key && exec docker-entrypoint.sh postgres -D /etc/postgresql -c cron.launch_active_jobs=off`;
    evidence.runtime.nativeImageBootstrap = true;
  }
  if(disableStatementTracking) {
    startup += " -c pg_stat_statements.track=none";
    evidence.runtime.statementTrackingDisabledInClone = true;
  }
  if (physicalClone) {
    assert.equal(sql(sourceDb.Name.slice(1), "select count(*) from pg_tablespace where spcname not in ('pg_default','pg_global')"), "0", "Physical stdout backup requires only built-in tablespaces");
    console.info("Taking a read-only physical backup into memory for the disposable clone");
    const backup = docker(["exec", "-e", `PGPASSWORD=${dbEnv.POSTGRES_PASSWORD}`, sourceDb.Name.slice(1), "pg_basebackup",
      "-h", "127.0.0.1", "-U", "supabase_admin", "--no-password", "--pgdata=-", "--format=tar", "--gzip", "--wal-method=fetch", "--checkpoint=fast", `--label=${tag}`], undefined, true);
    evidence.physicalBackup = { bytes: backup.length, sha256: hash(backup), storedOnHost: false, persistentReplicationSlot: false };
    assert.equal(JSON.parse(docker(["volume", "inspect", names.volume]))[0].Labels["pinpoint.release.run"], tag);
    docker(["create", "-i", "--pull=never", "--name", names.restore, "--label", label, "--network", names.network,
      "-v", `${names.volume}:/var/lib/postgresql/data`, "--entrypoint", "tar", patchedImage, "-xzf", "-", "-C", "/var/lib/postgresql/data"]);
    created.push(names.restore);
    docker(["start", "-ai", names.restore], backup);
    assert.equal(inspect(names.restore).State.ExitCode, 0, "Physical backup extraction failed");
  }
  createContainer(names.db,patchedImage,dbEnv,[],"sh",["-c",startup]);
  await waitFor(() => sql(names.db,"select 1") === "1","clone database");
  if (!physicalClone) {
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
  docker(["exec","-i","-e",`PGPASSWORD=${dbEnv.POSTGRES_PASSWORD}`,names.db,"pg_restore","-h","127.0.0.1","-U","supabase_admin","-d","postgres","--exit-on-error","--verbose"],dump);
  }
  assert.equal(sql(names.db,"show cron.launch_active_jobs"),"off");
  assert.deepEqual(snapshot(names.db),evidence.sharedBefore);
  assert.deepEqual(catalog(names.db),catalog(sourceDb.Name.slice(1)));
  assert.deepEqual(tableSecurity(names.db),evidence.sourceTableSecurity);
  const migration = readFileSync("supabase/migrations/20260930164313_pinpoint_offer_intake.sql","utf8");
  const stored = catalog(names.db);
  for (const match of migration.matchAll(/create function ([\w.]+)[\s\S]*?\bas \$\$([\s\S]*?)\$\$;/g)) assert.ok(Object.entries(stored).some(([key,value])=>key.startsWith(match[1]+"(") && value.body.trim()===match[2].trim()), "Original intake function body was not preserved");

  sql(names.db,"select cron.alter_job(job_id := jobid,active := false) from cron.job");
  assert.equal(sql(names.db,"select count(*) from cron.job where active"),"0");
  fixtureBaseline = snapshot(names.db);
  const dbUrl = (value) => { const parsed = new URL(value); assert.ok(["db","db.supabase.internal","supabase_db_roomza"].includes(parsed.hostname)); parsed.hostname = "db"; return parsed.href; };
  if (nativeBootstrap) {
    // Logical database dumps do not contain cluster-role credentials. These
    // passwords are restored only in the labelled clone, never the source.
    for (const [connection, expectedRole] of [[authEnv.GOTRUE_DB_DATABASE_URL, "supabase_auth_admin"], [restEnv.PGRST_DB_URI, "authenticator"], ...(storageEnabled ? [[storageEnv.DATABASE_URL, "supabase_storage_admin"]] : [])]) {
      const parsed = new URL(connection);
      const role = decodeURIComponent(parsed.username);
      assert.equal(role, expectedRole);
      const password = decodeURIComponent(parsed.password).replaceAll("'", "''");
      sql(names.db, `alter role ${role} password '${password}'`);
    }
    // The image's own bootstrap omits this CLI role default. Restore only in
    // the labelled clone; FROM CURRENT preserves the search-path list syntax.
    assert.match(names.db, /^pinpoint-release-[0-9a-f-]{36}-db$/);
    assert.notEqual(names.db, sourceDb.Name.slice(1));
    const settings = JSON.parse(sql(sourceDb.Name.slice(1), "select coalesce(json_agg(setting),'[]') from pg_roles r cross join lateral unnest(r.rolconfig) setting where r.rolname='supabase_functions_admin' and setting like 'search_path=%'"));
    assert.ok(settings.length <= 1);
    if (settings.length) {
      const searchPath = settings[0].slice('search_path='.length).replaceAll("'", "''");
      sql(names.db, `begin; select pg_catalog.set_config('search_path','${searchPath}',true); alter role supabase_functions_admin set search_path from current; commit;`);
    } else {
      sql(names.db, "alter role supabase_functions_admin reset search_path");
    }
    evidence.runtime.sourceRoleSearchPathRestoredInClone = true;
  }
  assert.deepEqual(clusterRoleSecurity(names.db), evidence.sourceClusterRoleSecurity, "Clone role flags, defaults and memberships must match the source");
  evidence.runtime.clusterRoleSecurityMatched = true;
  const isolatedAuth = { ...authEnv, GOTRUE_DB_DATABASE_URL: dbUrl(authEnv.GOTRUE_DB_DATABASE_URL), GOTRUE_MAILER_AUTOCONFIRM: "true", GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true", GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true", GOTRUE_SMTP_HOST: "unreachable.invalid", GOTRUE_SMTP_PORT: "1", API_EXTERNAL_URL: "http://127.0.0.1:55431/auth/v1", GOTRUE_JWT_ISSUER: "http://127.0.0.1:55431/auth/v1" };
  for (const key of Object.keys(isolatedAuth)) if (key.startsWith("GOTRUE_HOOK_")) delete isolatedAuth[key];
  createContainer(names.auth,sourceAuth.Config.Image,isolatedAuth);
  createContainer(names.rest,sourceRest.Config.Image,{ ...restEnv, PGRST_DB_URI: dbUrl(restEnv.PGRST_DB_URI) });
  if (storageEnabled) {
    const isolatedStorage = { ...storageEnv, DATABASE_URL: dbUrl(storageEnv.DATABASE_URL), POSTGREST_URL: `http://${names.rest}:3000`, FILE_STORAGE_BACKEND_PATH: "/var/lib/storage", ENABLE_IMAGE_TRANSFORMATION: imageTransformationEnabled ? "true" : "false", VECTOR_ENABLED: "false", VECTOR_STORE_MIGRATIONS_ENABLED: "false", S3_PROTOCOL_ENABLED: "false" };
    delete isolatedStorage.VECTOR_DATABASE_URL;
    if (imageTransformationEnabled) {
      const image = "public.ecr.aws/supabase/imgproxy:v3.8.0";
      docker(["image", "inspect", image]);
      createContainer(names.imgproxy, image, { IMGPROXY_BIND: ":5001", IMGPROXY_LOCAL_FILESYSTEM_ROOT: "/", IMGPROXY_USE_ETAG: "true" });
      await waitFor(() => { docker(["exec", names.imgproxy, "imgproxy", "health"]); return true; }, "clone imgproxy");
      isolatedStorage.IMGPROXY_URL = "http://" + names.imgproxy + ":5001";
      evidence.runtime.imageTransformer = { image, internalOnly: true, storageVolumeReadOnly: true, healthVerified: true };
    } else delete isolatedStorage.IMGPROXY_URL;
    createContainer(names.storage,sourceStorage.Config.Image,isolatedStorage);
    await waitFor(() => docker(["exec",names.db,"curl","--silent","--max-time","1","--output","/dev/null","--write-out","%{http_code}",`http://${names.storage}:5000/status`]) === "200", "clone Storage");
  }
  await waitFor(() => docker(["exec",names.db,"curl","--silent","--max-time","1","--output","/dev/null","--write-out","%{http_code}",`http://${names.auth}:9999/health`]) === "200","clone Auth");
  await waitFor(async () => (await localFetch("http://127.0.0.1:55431/rest/v1/",{headers:{Authorization:`Bearer ${local.NEXT_PUBLIC_SUPABASE_ANON_KEY}`}})).ok,"clone PostgREST");
  if(realtimeEnabled) {
    assert.ok(["supabase_admin","supabase_realtime_admin"].includes(realtimeEnv.DB_USER));
    sql(names.db,`alter role ${realtimeEnv.DB_USER} password '${realtimeEnv.DB_PASSWORD.replaceAll("'","''")}'`);
    // v2.112.1 seeds replace the cloned self-host tenant with these DB settings.
    // The original tenant, role credentials and Realtime container stay untouched.
    createContainer(names.realtime,sourceRealtime.Config.Image,{...realtimeEnv,DB_HOST:"db",DB_PORT:"5432",DNS_NODES:"",SEED_SELF_HOST:"true",SELF_HOST_TENANT_NAME:"realtime-dev",RUN_JANITOR:"false"});
    await waitFor(() => docker(["exec",names.db,"curl","--silent","--max-time","1","--header",`Authorization: Bearer ${local.SUPABASE_SERVICE_ROLE_KEY}`,"--output","/dev/null","--write-out","%{http_code}",`http://${names.realtime}:4000/api/tenants/realtime-dev/health`]) === "200", "clone Realtime");
    evidence.runtime.realtimeImage=sourceRealtime.Config.Image;
  }
  assert.equal(inspect(names.network).Internal,true);
  for (const name of created) assert.deepEqual(Object.keys(inspect(name).NetworkSettings.Networks),[names.network]);
  evidence.runtime.transport = "SDK requests sent by curl from clone DB to clone Auth/PostgREST over the internal-only Docker network; no published ports";
  evidence.runtime.postgresVersion = sql(names.db,"select version()");
  evidence.runtime.reservedRoles = sql(names.db,"show supautils.reserved_roles");
  evidence.runtime.hintRoles = sql(names.db,"show supautils.hint_roles");

  const installed=JSON.parse(sql(names.db,"select coalesce(json_agg(version),'[]') from supabase_migrations.schema_migrations"));
  for(const file of readdirSync('supabase/migrations').filter(f=>/^\d+_.+\.sql$/.test(f)).sort()){
    const version=file.split('_')[0];if(installed.includes(version))continue;
    // The user deferred this unfinished work. Independent messaging or buyer viewing checks
    // rehearse the preceding schema and record the exclusion explicitly.
    if((flowCheck === "messaging" || runtimeCase === "buyer-viewing-regression") && file === "20261015054000_application_document_reference_scope.sql") {
      (evidence.deferredMigrations ??= []).push(file);
      continue;
    }
    const migrationPath='supabase/migrations/'+file;
    const migrationSql=readFileSync(migrationPath,'utf8');
    console.info('Clone migration',file);
    // The restored source has mixed postgres/supabase_admin application owners.
    // Preserve them and record the actual migration connection role explicitly.
    evidence.migrationRole=sql(names.db,"select current_user");
    try { sql(names.db,migrationSql); } catch(error) { console.error("Migration failed:",file,error.message); throw error; }
    (evidence.appliedMigrations ??= []).push({path:migrationPath,sha256:hash(migrationSql)});
    sql(names.db,"insert into supabase_migrations.schema_migrations(version,name,statements) values ('"+version+"','"+file.slice(version.length+1,-4)+"',array[]::text[]); notify pgrst,'reload schema';");
  }
  fixtureBaseline = snapshot(names.db);
  // Newly added schedules are contained too; startup already disables launches.
  sql(names.db,"select cron.alter_job(job_id := jobid,active := false) from cron.job");
  assert.equal(sql(names.db,"select count(*) from cron.job where active"),"0");
  fixtureBaseline = snapshot(names.db);
  evidence.cloneMigrationBaseline = fixtureBaseline;
  const cloneCatalog = catalog(names.db);
  cloneCatalogBaseline = cloneCatalog;
  evidence.cloneTableSecurity=tableSecurity(names.db);
  evidence.cloneCatalogHash = hash(JSON.stringify(cloneCatalog));

  gateway=createServer(async(req,res)=>{
    const importTus = ["imports-browser", "imports-review-browser", "imports-lifecycle-image-transport-browser"].includes(runtimeCase) && req.url?.startsWith("/storage/v1/upload/resumable");
    res.setHeader("Access-Control-Allow-Origin","http://localhost:3112");
    res.setHeader("Access-Control-Allow-Headers",importTus ? "authorization,apikey,x-client-info,content-type,x-supabase-api-version,tus-resumable,upload-length,upload-offset,upload-metadata,upload-concat,x-upsert,x-http-method-override" : "authorization,apikey,x-client-info,content-type,x-supabase-api-version");
    res.setHeader("Access-Control-Allow-Methods",importTus ? "GET,POST,PATCH,DELETE,OPTIONS,HEAD" : "GET,POST,PATCH,DELETE,OPTIONS");
    if(importTus) res.setHeader("Access-Control-Expose-Headers","location,tus-resumable,tus-version,tus-extension,tus-max-size,upload-length,upload-offset,upload-expires,upload-concat");
    if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
    try {
      const chunks=[];let size=0;const limit=req.url?.startsWith("/storage/v1/")?50*1024*1024:50000;
      for await(const chunk of req){size+=chunk.length;assert.ok(size<=limit);chunks.push(chunk);}
      const response=await localFetch(`http://127.0.0.1:55431${req.url}`,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});
      for (const name of ["content-range", "preference-applied", "cache-control"]) {
        const value = response.headers.get(name); if (value) res.setHeader(name,value);
      }
      if(importTus){
        for(const name of ["location","tus-resumable","tus-version","tus-extension","tus-max-size","upload-length","upload-offset","upload-expires","upload-concat"]){
          let value=response.headers.get(name);if(!value)continue;
          if(name === "location"){const original=new URL(value,"http://127.0.0.1:55431");assert.equal(original.protocol,"http:");assert.ok(["127.0.0.1","localhost",names.storage].includes(original.hostname));const path=original.pathname.startsWith("/storage/v1/")?original.pathname.slice(11):original.pathname;assert.ok(path.startsWith("/upload/resumable/"));value="http://127.0.0.1:55431/storage/v1"+path+original.search;(evidence.tusLocationRebases??=[]).push({originalOrigin:original.origin,cloneOrigin:"http://127.0.0.1:55431",pathPrefixChecked:true});}
          res.setHeader(name,value);
        }
        const bytes=Buffer.from(await response.arrayBuffer());(evidence.tusTransport??=[]).push({method:req.method,status:response.status,bodyUnchanged:true,bodySha256:hash(bytes)});res.setHeader("Content-Type",response.headers.get("content-type")??"application/json");res.writeHead(response.status);res.end(bytes);
      }else{
        res.setHeader("Content-Type",response.headers.get("content-type") ?? "application/json");res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));
      }
    } catch {res.writeHead(502);res.end('{"error":"Contained gateway rejected request"}');}
  });
  gateway.on("upgrade",(req,socket,head)=>{
    try {
      const url=new URL(req.url,"http://127.0.0.1:55431");
      assert.ok(realtimeEnabled && req.method==="GET" && url.pathname==="/realtime/v1/websocket" && url.search.length<10000);
      assert.equal(String(req.headers.upgrade).toLowerCase(),"websocket");
      assert.equal(inspect(names.auth).Config.Labels["pinpoint.release.run"],tag);
      assert.equal(inspect(names.realtime).Config.Labels["pinpoint.release.run"],tag);
      // Preserve binary frames in both directions through an internal-only TCP
      // bridge; no container ports or external network routes are published.
      const child=spawn("docker",["exec","-i",names.auth,"nc",names.realtime,"4000"],{stdio:["pipe","pipe","pipe"],windowsHide:true});
      realtimeSockets.add(socket);realtimeBridges.add(child);
      socket.on("error",()=>socket.destroy());
      socket.once("close",()=>{realtimeSockets.delete(socket);child.kill();});
      child.once("error",()=>socket.destroy());
      child.once("exit",()=>{realtimeBridges.delete(child);socket.destroy();});
      child.stdin.on("error",()=>socket.destroy());child.stderr.resume();
      const headers={...req.headers,host:"realtime-dev.localhost"};
      const headerLines=Object.entries(headers).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}: ${Array.isArray(value)?value.join(", "):value}`);
      child.stdin.write(`GET /socket/websocket${url.search} HTTP/1.1\r\n${headerLines.join("\r\n")}\r\n\r\n`);
      if(head.length)child.stdin.write(head);
      socket.pipe(child.stdin);child.stdout.pipe(socket);
    } catch {socket.destroy();}
  });
  await new Promise((resolve,reject)=>{gateway.once("error",reject);gateway.listen(55431,"127.0.0.1",resolve)});
  console.info("Release clone restored and schedules contained; starting isolated CLI snapshot");
  const config={supabaseUrl:"http://127.0.0.1:55431",storageEnabled,realtimeEnabled,imageTransformationEnabled,runtimeCase,browserScript,anonKey:local.NEXT_PUBLIC_SUPABASE_ANON_KEY,serviceKey:local.SUPABASE_SERVICE_ROLE_KEY,resultPath:taskEvidencePath,sourceRoot:process.cwd(),dbName:names.db,dbPassword:dbEnv.POSTGRES_PASSWORD};
  const taskEnv=Object.fromEntries(["PATH","SystemRoot","SystemDrive","WINDIR","ComSpec","PATHEXT","TEMP","TMP","USERPROFILE","APPDATA","LOCALAPPDATA","ProgramFiles","ProgramFiles(x86)","ProgramData"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  taskEnv.PINPOINT_CLONE_CONFIG=JSON.stringify(config);
  if (browserSdkCandidate) taskEnv.PINPOINT_BROWSER_SDK_CANDIDATE=path.resolve(browserSdkCandidate);
  const child=spawn(process.execPath,[taskPath],{env:taskEnv,stdio:"inherit",windowsHide:true});
  const status=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve)});
  evidence.task=JSON.parse(readFileSync(taskEvidencePath,"utf8"));checks.push(...evidence.task.checks);
  assert.equal(status,0,"Isolated release CLI did not pass");
  // Fixture writes are contained in this disposable clone.
  passed=true;
} catch(error) { console.error("Rehearsal failed:",error.message); throw error; } finally {
  for(const socket of realtimeSockets)socket.destroy();
  for(const child of realtimeBridges)child.kill();
  if(gateway)await new Promise(resolve=>gateway.close(resolve));
  try {
    if(fixtureBaseline && evidence.cloneTableSecurity){
      evidence.cloneAfterTask=snapshot(names.db);
      // Source database preservation is verified separately below.
      assert.deepEqual(tableSecurity(names.db),evidence.cloneTableSecurity);
      const afterCatalog=catalog(names.db);
      evidence.cloneCatalogChanges=[...new Set([...Object.keys(afterCatalog),...Object.keys(cloneCatalogBaseline)])].filter(key=>JSON.stringify(afterCatalog[key])!==JSON.stringify(cloneCatalogBaseline[key]));
      assert.equal(hash(JSON.stringify(afterCatalog)),evidence.cloneCatalogHash);
      evidence.originalFunctionsPreserved=true;
    }
  } finally {
    const auxiliaryContainersRemoved = [];
    for(const name of created.toReversed()){
      assert.equal(inspect(name).Config.Labels["pinpoint.release.run"],tag);
      if(name===names.db){
        try { evidence.cloneCrashLogCheck = await cloneCrashLogCheck(name); }
        catch { passed = false; evidence.cloneCrashLogCheck = { markers: ["log_scan_failed"], fullLogScanned: false }; }
      }
      docker(["rm","--force",name]);
    }
    for (const id of docker(["ps", "-aq", "--filter", "label=" + label]).trim().split(/\s+/).filter(Boolean)) {
      const owned = inspect(id);
      const name = owned.Name.slice(1);
      assert.equal(owned.Config.Labels["pinpoint.release.run"], tag);
      assert.ok([tag + "-redis", tag + "-rhttp"].includes(name), "Unexpected owned auxiliary container");
      docker(["rm", "--force", "--volumes", name]);
      auxiliaryContainersRemoved.push(name);
    }
    if(storageVolumeCreated){assert.equal(JSON.parse(docker(["volume","inspect",names.storageVolume]))[0].Labels["pinpoint.release.run"],tag);docker(["volume","rm",names.storageVolume]);}
    if(volumeCreated){assert.equal(JSON.parse(docker(["volume","inspect",names.volume]))[0].Labels["pinpoint.release.run"],tag);docker(["volume","rm",names.volume]);}
    if(networkCreated){assert.equal(inspect(names.network).Labels["pinpoint.release.run"],tag);docker(["network","rm",names.network]);}
    try{unlinkSync(taskEvidencePath)}catch{}
    try{unlinkSync(taskPath)}catch{}
    evidence.sharedAfter=snapshot(sourceDb.Name.slice(1));assert.deepEqual(evidence.sharedAfter,evidence.sharedBefore);
    const afterDb=inspect(sourceDb.Name.slice(1)),afterAuth=inspect(sourceAuth.Name.slice(1)),afterRest=inspect(sourceRest.Name.slice(1));
    const afterStorage = sourceStorage ? inspect(sourceStorage.Name.slice(1)) : null;
    const afterRealtime = sourceRealtime ? inspect(sourceRealtime.Name.slice(1)) : null;
    assert.equal(hash(JSON.stringify([afterDb.Config,afterDb.Mounts,afterAuth.Config,afterRest.Config,afterStorage?.Config,afterStorage?.Mounts,afterRealtime?.Config,afterRealtime?.Mounts])),sourceConfigurationHash);
    if(sourceRealtime)assert.equal(afterRealtime.Id,sourceRealtime.Id);
    if (sourceStorage) assert.equal(afterStorage.Id,sourceStorage.Id);
    assert.equal(afterDb.Id,sourceDb.Id);assert.equal(afterAuth.Id,sourceAuth.Id);assert.equal(afterRest.Id,sourceRest.Id);
    assert.equal(hash(JSON.stringify(catalog(sourceDb.Name.slice(1)))),evidence.sourceCatalogHash);
    assert.deepEqual(tableSecurity(sourceDb.Name.slice(1)),evidence.sourceTableSecurity);
    assert.deepEqual(clusterRoleSecurity(sourceDb.Name.slice(1)),evidence.sourceClusterRoleSecurity);
    evidence.cleanup={cloneContainersRemoved:created,auxiliaryContainersRemoved,volumeRemoved:volumeCreated,storageVolumeRemoved:storageVolumeCreated,networkRemoved:networkCreated,sharedContainersUnchanged:true,sharedConfigUnchanged:true,dumpStoredOnHost:false};
    console.info("Release clone removed; shared data, permissions and configuration unchanged");
    for (const migration of evidence.appliedMigrations ?? []) assert.equal(hash(readFileSync(migration.path)),migration.sha256,'Applied migration source changed during release snapshot');
    evidence.recordedAt=new Date().toISOString();
    if(browserScript)evidence.browserScriptHash=hash(readFileSync(browserScript));
    evidence.passed=passed;
    evidence.sourceHashes=Object.fromEntries(["scripts/db/unified-marketplace-clone.local.mjs","scripts/db/verify-unified-marketplace.mjs","supabase/migrations/20261012011144_unified_marketplace_accounts.sql","src/features/auth/marketplace-account.ts","src/features/marketplace/category-links.tsx","src/app/post/page.tsx","src/app/post/listings/page.tsx","src/features/offers/schema.ts","src/features/offers/lifecycle.ts","src/features/offers/intake.ts","supabase/migrations/20260930164313_pinpoint_offer_intake.sql","supabase/migrations/20261001220000_pinpoint_offer_review_queue.sql","supabase/migrations/20261002010000_pinpoint_offer_permission.sql","supabase/migrations/20261002023000_pinpoint_offer_permission_review.sql","supabase/migrations/20261002040000_pinpoint_offer_location_review.sql","supabase/migrations/20261002060000_pinpoint_offer_decisions.sql","supabase/migrations/20261002070000_pinpoint_offer_public_reads.sql","supabase/migrations/20261002080000_pinpoint_offer_owned_status.sql","supabase/migrations/20261002070109_pinpoint_offer_confirmed_queue.sql","supabase/migrations/20261002083512_pinpoint_offer_moderation_targets.sql","supabase/migrations/20261002120900_notification_read_state.sql","src/features/notifications/inbox-contract.ts","src/features/notifications/inbox-data.ts","src/features/notifications/inbox-actions.ts","src/features/notifications/mark-read-button.tsx","src/app/profile/notifications/page.tsx","src/features/profile/data.ts","src/app/profile/page.tsx","src/lib/supabase/types.ts","src/features/listings/actions.ts","src/features/listings/listing-form.tsx","src/app/dashboard/listings/[id]/edit/page.tsx","supabase/migrations/20261002162631_pinpoint_property_save.sql"].map(p=>[p,hash(readFileSync(p))]));
    evidence.limitations=["Isolated source snapshot and patched clone, not shared/staging/production release proof","Production environment file excluded; only loopback demo credentials","No deployment, public publication or external delivery"];
    for(const file of [flowChecks[flowCheck],...(flowCheck === "property" ? ["scripts/db/property-phase4-runtime.local.test.ts","src/features/purchase/data.ts","src/features/purchase/actions.ts","src/features/profile/viewing-count.ts","src/features/viewings/actions/live-viewing.ts","src/features/notifications/jobs.ts","supabase/migrations/20261014021444_notification_read_only_session_access.sql"] : [])]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(flowCheck === "messaging") for(const file of ["scripts/db/messaging-runtime.local.test.ts","scripts/db/messaging-safety-runtime.local.test.ts","src/features/admin/actions.ts","src/features/admin/components/report-panel.tsx","src/features/chat/actions.ts","src/features/chat/chat-box.tsx","src/features/chat/chat-header.tsx","src/features/chat/call-actions.ts","src/features/profile/actions.ts","src/features/profile/components/public-profile-actions.tsx","src/features/profile/components/settings-section.tsx","src/features/profile/components/use-profile-relationship.ts"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("instant-connect-")) for(const file of ["scripts/db/instant-connect-runtime.local.test.ts","scripts/db/clone-advisors.local.mjs","src/features/showings/use-showing-request.ts","src/features/showings/actions.ts","src/features/showings/connect-now-sheet.tsx","src/features/showings/showing-request-banner.tsx","src/features/notifications/outbox.ts","src/features/listings/api.ts","src/features/listings/actions.ts","src/app/listing/[id]/page.tsx","src/features/map-discovery/hooks/use-favorites.ts","src/features/map-discovery/listing-detail-panel.tsx","src/features/presence/availability-toggle.tsx","src/features/presence/actions.ts"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("rental-viewing-") || runtimeCase === "viewing-browser") for(const file of ["scripts/db/rental-viewing-runtime.local.test.ts","scripts/db/clone-advisors.local.mjs","src/features/viewings/actions/propose-viewing-slots.ts","src/features/viewings/actions/book-viewing-slot.ts","src/features/viewings/components/propose-viewing-modal.tsx","src/features/viewings/components/select-viewing-slot.tsx","src/features/viewings/notifications.ts","src/features/notifications/outbox.ts"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(["entries-public-browser","entries-boundaries-browser"].includes(runtimeCase)) for(const file of ["src/features/entries/entry-review-editor.tsx","src/features/entries/entry-draft-editor.tsx","src/features/entries/entry-permission-confirmation.tsx","src/features/entries/publication-api.ts","src/features/discovery/special-detail-content.tsx","src/features/discovery/use-special-detail.ts","src/features/discovery/special-detail-data.ts","src/features/discovery/saved-specials-grid.tsx","src/features/discovery/media-carousel.tsx","src/features/discovery/presentation-data.ts","src/app/admin/entries/page.tsx","src/app/auth/mfa/page.tsx","src/features/trust/components/user-mfa-challenge.tsx"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("imports-")) for(const file of ["src/features/listing-imports/access.ts","src/features/listing-imports/adapters/archive-safety.ts","src/features/listing-imports/adapters/csv.ts","src/features/listing-imports/adapters/generic-adapters.test.ts","src/features/listing-imports/adapters/index.ts","src/features/listing-imports/adapters/json.ts","src/features/listing-imports/adapters/pinpoint-v1.ts","src/features/listing-imports/adapters/shared.ts","src/features/listing-imports/adapters/vendor-contracts/README.md","src/features/listing-imports/adapters/xlsx.ts","src/features/listing-imports/adapters/xml.ts","src/features/listing-imports/asset-safety.test.ts","src/features/listing-imports/assets.ts","src/features/listing-imports/field-registry.ts","src/features/listing-imports/generated-imports.test.ts","src/features/listing-imports/geocoding.ts","src/features/listing-imports/image-matching.ts","src/features/listing-imports/import-preview-map.tsx","src/features/listing-imports/import-rows-table.tsx","src/features/listing-imports/import-workspace.tsx","src/features/listing-imports/limits.ts","src/features/listing-imports/new-import-form.tsx","src/features/listing-imports/normalization.test.ts","src/features/listing-imports/normalization.ts","src/features/listing-imports/processor.ts","src/features/listing-imports/queue.ts","src/features/listing-imports/repository.ts","src/features/listing-imports/rollback.ts","src/features/listing-imports/safe-image-url.ts","src/features/listing-imports/selection.ts","src/features/listing-imports/schemas.test.ts","src/features/listing-imports/schemas.ts","src/features/listing-imports/types.ts","src/features/listing-imports/upload.ts","src/features/organizations/accept-invitation.tsx","src/features/organizations/actions.ts","src/features/organizations/data.ts","src/features/organizations/organization-management.tsx","src/features/organizations/organization-selector.tsx","src/features/organizations/types.ts","src/app/api/imports/route.ts","src/app/api/imports/[jobId]/assets/route.ts","src/app/api/imports/[jobId]/report/route.ts","src/app/api/imports/[jobId]/route.ts","src/app/api/imports/[jobId]/rows/route.ts","src/app/api/imports/[jobId]/upload/route.ts","src/lib/auth.ts","src/lib/qstash.ts","scripts/db/imports-runtime.local.test.ts","scripts/db/clone-advisors.local.mjs"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase === "imports-review-browser" || runtimeCase.startsWith("imports-lifecycle-")) for(const file of ["scripts/db/imports-lifecycle-runtime.local.test.ts","src/app/api/imports/[jobId]/rows/route.ts","src/app/api/imports/[jobId]/report/route.ts","src/features/listing-imports/rollback.ts","src/features/listing-imports/normalization.ts"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("entries-")) for(const file of ["scripts/db/entries-runtime.local.test.ts","scripts/db/clone-advisors.local.mjs","scripts/db/messaging-check.local.mjs","public/data/south-africa-places.json.gz","public/icon.png","src/features/entries/schema.ts","src/features/entries/intake-contract.ts","src/features/entries/intake.ts","src/features/entries/workspace-request.ts","src/features/entries/workspace-request.test.ts","src/features/entries/entry-draft-editor.http.test.tsx","src/features/entries/workspace-api.ts","src/features/entries/workspace-data.ts","src/features/entries/publication-data.ts","src/features/entries/publication-contract.ts","src/features/entries/public-contract.ts","src/features/entries/public-data.ts","src/features/entries/publication-request.ts","src/features/discovery/media-fields.tsx","src/features/discovery/saved-specials-api.ts"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("specials-")) for(const file of ["scripts/db/specials-runtime.local.test.ts","scripts/db/clone-advisors.local.mjs","scripts/db/messaging-check.local.mjs","public/data/south-africa-places.json.gz","public/icon.png","src/features/offers/schema.ts","src/features/offers/intake.ts","src/features/offers/permission-data.ts","src/features/offers/permission-review-data.ts","src/features/offers/location-review-data.ts","src/features/offers/decision-data.ts","src/features/offers/public-data.ts","src/features/offers/public-contract.ts","src/features/offers/workspace-request.ts","src/features/discovery/media-fields.tsx"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase === "specials-owner-status-browser") for(const file of ["src/features/discovery/use-special-detail.ts","src/features/discovery/special-detail-content.tsx","src/features/discovery/saved-specials-client.tsx","src/features/discovery/saved-specials-api.ts","src/features/offers/public-api.ts","src/features/offers/owned-status-contract.ts","src/features/offers/workspace-data.ts","src/features/offers/offer-permission-evidence-editor.tsx","src/features/offers/offer-location-evidence-editor.tsx","src/features/offers/offer-decision-editor.tsx","src/app/saved/page.tsx"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase === "specials-boundaries-browser") for(const file of ["src/features/discovery/use-special-detail.ts","src/features/discovery/special-detail-content.tsx","src/features/discovery/saved-specials-client.tsx","src/features/discovery/saved-specials-api.ts","src/features/offers/public-api.ts","src/features/offers/offer-permission-evidence-editor.tsx","src/features/offers/offer-location-evidence-editor.tsx","src/features/offers/offer-decision-editor.tsx","src/app/saved/page.tsx"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("services-")) for(const file of ["scripts/db/services-runtime.local.test.ts","public/data/south-africa-places.json.gz","public/icon.png","src/features/services/service-media-recovery.test.tsx","src/features/discovery/media-fields.tsx","scripts/db/clone-advisors.local.mjs","src/features/services/data.ts","src/features/services/schema.ts","src/features/services/service-workspace.tsx","src/features/services/service-request.ts","src/features/services/service-recovery.test.tsx","src/features/services/service-review-decision.tsx","src/app/api/private/services/route.test.ts","src/app/api/private/services/route.ts","src/app/admin/services/page.tsx"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    if(runtimeCase.startsWith("live-tour-")) for(const file of ["scripts/db/live-tour-runtime.local.test.ts","scripts/db/clone-advisors.local.mjs","src/features/live-tours/actions.ts","src/features/live-tours/notifications.ts","src/features/live-tours/feature-flags.ts","src/features/live-tours/recording-policy.ts","src/features/live-tours/go-live-button.tsx","src/features/live-tours/live-tour-room.tsx","src/features/live-tours/live-tour-terminal.tsx","src/app/live-tours/[id]/page.tsx","src/features/live-tours/live-tour-video.tsx","src/features/live-tours/picture-in-picture.ts","src/features/live-tours/use-tour-action.ts","src/features/notifications/outbox.ts"]) evidence.sourceHashes[file]=hash(readFileSync(file));
    writeFileSync(`.cache/${flowCheck === "unified" ? "unified-marketplace" : "user-flow-"+flowCheck}-clone-evidence.json`,JSON.stringify(evidence,null,2)+"\n");
  }
}
assert.ok(passed);assert.deepEqual(evidence.cloneCrashLogCheck.markers,[]);


