/** Genuine local Auth/REST/RPC/SQL checks. Never runs against the shared stack. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
const cfg = JSON.parse(process.env.PINPOINT_CLONE_CONFIG);
assert.equal(cfg.supabaseUrl, "http://127.0.0.1:55431");
assert.match(cfg.dbName, /^pinpoint-release-[0-9a-f-]{36}-db$/);
const { createClient } = createRequire(path.join(cfg.sourceRoot,"package.json"))("@supabase/supabase-js");
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, init) => {
  assert.equal(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).origin, cfg.supabaseUrl);
  return fetchOriginal(input, init);
};
const admin = createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const anon = createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const tag = `phase4-${randomUUID()}`, password = `Fixture-${randomUUID()}aA1!`;
const accounts = [], clients = [], listings = [], organizations = [], suspensions = [], checks = [];
const evidence = { tag, environment:"disposable clone; genuine Auth REST RPC SQL; no browser/Storage delivery proof", checks };
function sql(query) {
  return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
}
async function check(name, fn) { await fn(); checks.push({name,passed:true}); console.info("PASS",name); }
const version = (id) => sql(`select to_json(updated_at)#>>'{}' from public.listings where id='${id}'`);
async function command(actor,target,op,expected=version(target)) {
  const session = (await clients[actor].auth.getSession()).data.session;
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1],"base64url"));
  return admin.rpc("pinpoint_property_lifecycle",{actor_id:accounts[actor].id,actor_session_id:claims.session_id,target,expected_updated_at:expected,command:op});
}
async function listing(owner, org=null) {
  const id = randomUUID(); listings.push(id);
  const result = await admin.from("listings").insert({id,landlord_id:accounts[owner].id,organization_id:org,title:tag,price:500000,sale_price:500000,listing_type:"sale",address:"Synthetic fixture",status:"draft"});
  assert.equal(result.error,null);
  for(let n=0;n<3;n++) assert.equal((await admin.from("listing_images").insert({listing_id:id,bucket:"listing-images",path:`${accounts[owner].id}/${id}/${n}.png`,public_url:`http://127.0.0.1:55431/fixture/${n}`,sort_order:n})).error,null);
  return id;
}
try {
  for(const persona of ["seller","seller","seller","seller","buyer"]) {
    const email = `${tag}-${accounts.length}@pinpoint.invalid`;
    const result = await admin.auth.admin.createUser({email,password,email_confirm:true}); assert.equal(result.error,null);
    const id=result.data.user.id; accounts.push({id,email});
    sql(`update public.profiles set role='${persona === "buyer" ? "renter" : "landlord"}',email_verified_at=clock_timestamp() where id='${id}'; insert into public.profile_personas(profile_id,persona,is_primary,is_active) values('${id}','${persona}',true,true) on conflict(profile_id,persona) do nothing; update public.notification_subscriptions set enabled=false,frequency='never' where user_id='${id}' and channel='email';`);
    const client=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    assert.equal((await client.auth.signInWithPassword({email,password})).error,null); clients.push(client);
  }
  const id=await listing(0);
  await check("Owner publishes, unpublishes, archives and restores with exact SQL visibility/version persistence",async()=>{
    for(const [op,status] of [["publish","published"],["unpublish","draft"],["archive","archived"],["restore","draft"]]) {
      const previous=version(id); const result=await command(0,id,op); assert.equal(result.error,null);
      assert.equal(sql(`select status from public.listings where id='${id}'`),status);
      assert.notEqual(version(id),previous);
      const visible=await anon.from("listings").select("id").eq("id",id);assert.equal(visible.error,null);assert.equal(visible.data.length,status==="published"?1:0);
    }
  });
  await check("Stale, foreign, buyer and direct ordinary RPC writes are denied without row changes",async()=>{
    const before=sql(`select row_to_json(l)::text from public.listings l where id='${id}'`);
    assert.equal((await command(0,id,"archive","2020-01-01T00:00:00Z")).error?.code,"PT409");
    for(const actor of [1,4])assert.equal((await command(actor,id,"archive")).error?.code,"42501");
    const args={actor_id:accounts[0].id,actor_session_id:randomUUID(),target:id,expected_updated_at:version(id),command:"delete"};
    for(const client of [anon,clients[0]])assert.equal((await client.rpc("pinpoint_property_lifecycle",args)).error?.code,"42501");
    assert.equal(sql(`select row_to_json(l)::text from public.listings l where id='${id}'`),before);
  });
  await check("Sale duplication keeps type, price and shared images; deleting source preserves duplicate image references",async()=>{
    const result=await command(0,id,"duplicate");assert.equal(result.error,null);const copy=result.data.listingId;listings.push(copy);
    assert.notEqual(copy,id);assert.equal(sql(`select status||'|'||listing_type||'|'||sale_price from public.listings where id='${copy}'`),"draft|sale|500000");
    assert.equal(sql(`select count(*) from public.listing_images where listing_id='${copy}'`),"3");
    assert.equal((await command(0,id,"delete")).error,null);
    assert.equal(sql(`select count(*) from public.listings where id='${id}'`),"0");
    assert.equal(sql(`select count(*) from public.listing_images where listing_id='${copy}'`),"3");
  });
  const org=randomUUID();organizations.push(org);
  sql(`insert into public.organizations(id,name,slug,owner_id) values('${org}','${tag}','${tag}','${accounts[0].id}'); insert into public.organization_memberships(organization_id,user_id,role) values('${org}','${accounts[0].id}','owner'),('${org}','${accounts[1].id}','admin'),('${org}','${accounts[2].id}','agent'); update public.profiles set active_organization_id='${org}' where id in ('${accounts[0].id}','${accounts[1].id}','${accounts[2].id}');`);
  const managed=await listing(0,org);
  await check("Current admin can mutate; agent and revoked admin/creator cannot",async()=>{
    assert.equal((await command(1,managed,"archive")).error,null);
    assert.equal((await command(2,managed,"restore")).error?.code,"42501");
    sql(`update public.organization_memberships set revoked_at=clock_timestamp() where organization_id='${org}' and user_id='${accounts[1].id}'`);
    assert.equal((await command(1,managed,"restore")).error?.code,"42501");
    assert.equal((await command(0,managed,"restore")).error,null);
    sql(`update public.organization_memberships set revoked_at=clock_timestamp() where organization_id='${org}' and user_id='${accounts[0].id}'`);
    assert.equal((await command(0,managed,"delete")).error?.code,"42501");
  });
  const sessionListing=await listing(3);
  await check("Missing photos, invalid transitions, active applications and suspended accounts refuse destructive/public changes",async()=>{
    const guarded=await listing(0);
    assert.equal((await command(0,guarded,"restore")).error?.code,"PT422");
    assert.equal((await admin.from("listing_images").delete().eq("listing_id",guarded)).error,null);
    assert.equal((await command(0,guarded,"publish")).error?.code,"PT422");
    const application=randomUUID();
    assert.equal((await admin.from("applications").insert({id:application,listing_id:guarded,renter_id:accounts[4].id,full_name:tag,employment_status:"employed",income:3000,move_in_date:"2026-11-01",status:"submitted"})).error,null);
    assert.equal((await command(0,guarded,"delete")).error?.code,"PT422");
    assert.equal(sql(`select count(*) from public.listings where id='${guarded}'`),"1");
    assert.equal((await admin.from("applications").delete().eq("id",application)).error,null);
    const suspension=randomUUID();suspensions.push(suspension);
    assert.equal((await admin.from("account_suspensions").insert({id:suspension,user_id:accounts[3].id,reason:tag})).error,null);
    assert.equal((await command(3,sessionListing,"delete")).error?.code,"42501");
    assert.equal((await admin.from("account_suspensions").delete().eq("id",suspension)).error,null);
  });
  await check("Logged-out session cannot mutate with its previously valid JWT session ID",async()=>{
    const token=(await clients[3].auth.getSession()).data.session.access_token;
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
    assert.equal((await clients[3].auth.signOut()).error,null);
    const result=await admin.rpc("pinpoint_property_lifecycle",{actor_id:accounts[3].id,actor_session_id:claims.session_id,target:sessionListing,expected_updated_at:version(sessionListing),command:"delete"});
    assert.equal(result.error?.code,"42501");assert.equal(sql(`select count(*) from public.listings where id='${sessionListing}'`),"1");
  });
  const saleId=await listing(0);
  assert.equal((await command(0,saleId,"publish")).error,null);
  await check("Platform actions, private Storage bytes and isolated HTTP delivery runtime",async()=>{
    execFileSync(process.execPath,[path.join(cfg.sourceRoot,"node_modules/vitest/vitest.mjs"),"run","scripts/db/property-phase4-runtime.local.test.ts"],{
      cwd:cfg.sourceRoot,env:{...process.env,PINPOINT_PHASE4_RUNTIME:JSON.stringify({...cfg,accounts,password,saleId})},stdio:"inherit",windowsHide:true,
    });
  });
  evidence.security=JSON.parse(sql(`select json_build_object('definer',prosecdef,'settings',proconfig,'acl',proacl) from pg_proc where oid='public.pinpoint_property_lifecycle(uuid,uuid,uuid,timestamptz,text)'::regprocedure`));
  evidence.passed=true;
} catch(error) { evidence.passed=false;evidence.failure={message:String(error.message).slice(0,1600)};throw error; }
finally {
  for(const client of clients)await client.auth.signOut().catch(()=>{});
  for(const id of suspensions)sql(`delete from public.account_suspensions where id='${id}' and reason='${tag}'`);
  for(const id of listings)sql(`delete from public.applications where listing_id='${id}' and full_name='${tag}'`);
  for(const id of listings)sql(`delete from public.listings where id='${id}' and landlord_id in (${accounts.map(a=>`'${a.id}'`).join(',') || 'null'})`);
  for(const org of organizations)sql(`delete from public.organizations where id='${org}' and slug='${tag}'`);
  for(const account of accounts) {
    assert.equal(sql(`select email from auth.users where id='${account.id}'`),account.email);
    assert.equal((await admin.auth.admin.deleteUser(account.id)).error,null);
  }
  evidence.fixtureIds={accounts:listings.length?accounts:[],listings,organizations};
  evidence.cleanup={capturedFixturesRemoved:true};
  writeFileSync(cfg.resultPath,JSON.stringify(evidence,null,2)+'\n');
}
