/** Opt-in isolated release CLI rehearsal on a disposable clone. Shared database is read-only. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { parseEnv } from "node:util";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

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
const names = { db: `${tag}-db`, auth: `${tag}-auth`, rest: `${tag}-rest`, network: `${tag}-network`, volume: `${tag}-volume` };
const patchedImage = "public.ecr.aws/supabase/postgres:17.6.1.113";
const created = [];
let networkCreated = false, volumeCreated = false;
const checks = [];
const taskPath = process.env.PINPOINT_CLONE_TASK_PATH;
assert.ok(taskPath && path.isAbsolute(taskPath) && /^pinpoint-release-[a-z0-9-]+\.mjs$/.test(path.basename(taskPath)));
assert.ok(path.resolve(taskPath).toLowerCase().startsWith(path.resolve(tmpdir()).toLowerCase()+path.sep));
const taskEvidencePath = path.join(tmpdir(), `${tag}-task.json`);
let gateway, passed = false, fixtureBaseline;
const evidence = { environment: "disposable patched local clone; isolated release CLI snapshot; no browser or deployment", tag, checks };
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

  for (const [version,name] of [["20261001220000","pinpoint_offer_review_queue"],["20261002010000","pinpoint_offer_permission"],["20261002023000","pinpoint_offer_permission_review"],["20261002040000","pinpoint_offer_location_review"],["20261002060000","pinpoint_offer_decisions"],["20261002070000","pinpoint_offer_public_reads"],["20261002070109","pinpoint_offer_confirmed_queue"],["20261002080000","pinpoint_offer_owned_status"],["20261002083512","pinpoint_offer_moderation_targets"],["20261002120900","notification_read_state"],["20261002162631","pinpoint_property_save"],["20261003025344","pinpoint_entry_intake"],["20261003032659","pinpoint_entry_corrections"]]) {
    const migrationPath = `supabase/migrations/${version}_${name}.sql`;
    const migrationSql = readFileSync(migrationPath,"utf8");
    (evidence.appliedMigrations ??= []).push({path:migrationPath,sha256:hash(migrationSql)});
    sql(names.db, `begin; ${migrationSql} insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name}',array[]::text[]); commit; notify pgrst,'reload schema';`);
  }
  fixtureBaseline = snapshot(names.db);
  evidence.cloneMigrationBaseline = fixtureBaseline;
  const cloneCatalog = catalog(names.db);
  for (const [key,value] of Object.entries(catalog(sourceDb.Name.slice(1)))) assert.deepEqual(cloneCatalog[key],value);
  evidence.cloneCatalogHash = hash(JSON.stringify(cloneCatalog));

  gateway=createServer(async(req,res)=>{
    try {
      const chunks=[];for await(const chunk of req){chunks.push(chunk);assert.ok(chunks.reduce((n,c)=>n+c.length,0)<50000);}
      const response=await localFetch(`http://127.0.0.1:55431${req.url}`,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks).toString():undefined});
      res.setHeader("Content-Type","application/json");res.writeHead(response.status);res.end(await response.text());
    } catch {res.writeHead(502);res.end('{"error":"Contained gateway rejected request"}');}
  });
  await new Promise((resolve,reject)=>{gateway.once("error",reject);gateway.listen(55431,"127.0.0.1",resolve)});
  console.info("Release clone restored and schedules contained; starting isolated CLI snapshot");
  const config={supabaseUrl:"http://127.0.0.1:55431",anonKey:local.NEXT_PUBLIC_SUPABASE_ANON_KEY,serviceKey:local.SUPABASE_SERVICE_ROLE_KEY,resultPath:taskEvidencePath,sourceRoot:process.cwd(),dbName:names.db,dbPassword:dbEnv.POSTGRES_PASSWORD};
  const taskEnv=Object.fromEntries(["PATH","SystemRoot","SystemDrive","WINDIR","ComSpec","PATHEXT","TEMP","TMP","USERPROFILE","APPDATA","LOCALAPPDATA","ProgramFiles","ProgramFiles(x86)","ProgramData"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  taskEnv.PINPOINT_CLONE_CONFIG=JSON.stringify(config);
  const child=spawn(process.execPath,[taskPath],{env:taskEnv,stdio:"inherit",windowsHide:true});
  const status=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve)});
  evidence.task=JSON.parse(readFileSync(taskEvidencePath,"utf8"));checks.push(...evidence.task.checks);
  assert.equal(status,0,"Isolated release CLI did not pass");
  assert.deepEqual(snapshot(names.db),fixtureBaseline);
  passed=true;
} finally {
  if(gateway)await new Promise(resolve=>gateway.close(resolve));
  try {
    if(fixtureBaseline){
      evidence.cloneAfterTask=snapshot(names.db);
      assert.deepEqual(evidence.cloneAfterTask,fixtureBaseline);
      assert.deepEqual(tableSecurity(names.db),evidence.sourceTableSecurity);
      const after=catalog(names.db);for(const [key,value] of Object.entries(catalog(sourceDb.Name.slice(1))))assert.deepEqual(after[key],value);
      evidence.originalFunctionsPreserved=true;
    }
  } finally {
    for(const name of created.toReversed()){
      assert.equal(inspect(name).Config.Labels["pinpoint.release.run"],tag);
      if(name===names.db){const logs=spawnSync("docker",["logs",name],{encoding:"utf8",maxBuffer:64*1024*1024});assert.equal(logs.status,0);evidence.cloneCrashLogCheck={markers:(logs.stdout+logs.stderr).match(/signal 11|Segmentation fault|database system was interrupted|automatic recovery in progress/g)??[]};}
      docker(["rm","--force",name]);
    }
    if(volumeCreated){assert.equal(JSON.parse(docker(["volume","inspect",names.volume]))[0].Labels["pinpoint.release.run"],tag);docker(["volume","rm",names.volume]);}
    if(networkCreated){assert.equal(inspect(names.network).Labels["pinpoint.release.run"],tag);docker(["network","rm",names.network]);}
    try{unlinkSync(taskEvidencePath)}catch{}
    evidence.sharedAfter=snapshot(sourceDb.Name.slice(1));assert.deepEqual(evidence.sharedAfter,evidence.sharedBefore);
    const afterDb=inspect(sourceDb.Name.slice(1)),afterAuth=inspect(sourceAuth.Name.slice(1)),afterRest=inspect(sourceRest.Name.slice(1));
    assert.equal(hash(JSON.stringify([afterDb.Config,afterDb.Mounts,afterAuth.Config,afterRest.Config])),sourceConfigurationHash);
    assert.equal(afterDb.Id,sourceDb.Id);assert.equal(afterAuth.Id,sourceAuth.Id);assert.equal(afterRest.Id,sourceRest.Id);
    assert.equal(hash(JSON.stringify(catalog(sourceDb.Name.slice(1)))),evidence.sourceCatalogHash);
    assert.deepEqual(tableSecurity(sourceDb.Name.slice(1)),evidence.sourceTableSecurity);
    evidence.cleanup={cloneContainersRemoved:created,volumeRemoved:volumeCreated,networkRemoved:networkCreated,sharedContainersUnchanged:true,sharedConfigUnchanged:true,dumpStoredOnHost:false};
    console.info("Release clone removed; shared data, permissions and configuration unchanged");
    for (const migration of evidence.appliedMigrations ?? []) assert.equal(hash(readFileSync(migration.path)),migration.sha256,'Applied migration source changed during release snapshot');
    evidence.recordedAt=new Date().toISOString();
    evidence.passed=passed;
    evidence.sourceHashes=Object.fromEntries(["scripts/db/release-clone.local.mjs","src/features/offers/schema.ts","src/features/offers/lifecycle.ts","src/features/offers/intake.ts","supabase/migrations/20260930164313_pinpoint_offer_intake.sql","supabase/migrations/20261001220000_pinpoint_offer_review_queue.sql","supabase/migrations/20261002010000_pinpoint_offer_permission.sql","supabase/migrations/20261002023000_pinpoint_offer_permission_review.sql","supabase/migrations/20261002040000_pinpoint_offer_location_review.sql","supabase/migrations/20261002060000_pinpoint_offer_decisions.sql","supabase/migrations/20261002070000_pinpoint_offer_public_reads.sql","supabase/migrations/20261002080000_pinpoint_offer_owned_status.sql","supabase/migrations/20261002070109_pinpoint_offer_confirmed_queue.sql","supabase/migrations/20261002083512_pinpoint_offer_moderation_targets.sql","supabase/migrations/20261002120900_notification_read_state.sql","src/features/notifications/inbox-contract.ts","src/features/notifications/inbox-data.ts","src/features/notifications/inbox-actions.ts","src/features/notifications/mark-read-button.tsx","src/app/profile/notifications/page.tsx","src/features/profile/data.ts","src/app/profile/page.tsx","src/lib/supabase/types.ts","src/features/listings/actions.ts","src/features/listings/listing-form.tsx","src/app/dashboard/listings/[id]/edit/page.tsx","supabase/migrations/20261002162631_pinpoint_property_save.sql"].map(p=>[p,hash(readFileSync(p))]));
    evidence.limitations=["Isolated source snapshot and patched clone, not shared/staging/production release proof","Production environment file excluded; only loopback demo credentials","No deployment, public publication or external delivery"];
    writeFileSync("docs/pinpoint-release-cli-local-evidence.json",JSON.stringify(evidence,null,2)+"\n");
  }
}
assert.ok(passed);assert.deepEqual(evidence.cloneCrashLogCheck.markers,[]);

