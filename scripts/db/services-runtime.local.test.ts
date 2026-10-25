/** Real clone Auth/REST/SQL. No hosted publication, browser or Storage-byte claim. */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runCloneAdvisors } from "./clone-advisors.local.mjs";
// Only the Next cookie/session adapter is supplied by the harness. Every read
// still uses a real signed-in SDK client and actual clone Auth, REST and RLS.
vi.mock("@/lib/auth",()=>({requireUser:async()=>({user:accounts[reader]})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>actors[reader]}));
vi.mock("@/features/admin/auth",()=>({requireAdmin:async()=>{throw Error("Admin page adapter is not provided by this owner-read harness");}}));
vi.mock("@/lib/env",()=>({getSupabaseEnv:()=>({supabaseUrl:cfg.supabaseUrl,supabaseAnonKey:cfg.anonKey})}));

const cfg=process.env.PINPOINT_MESSAGING_RUNTIME?JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME):null;
const run=cfg?describe:describe.skip,originalFetch=globalThis.fetch;
const tag=`contained-services-${randomUUID()}`,password=`Fixture-${randomUUID()}aA1!`;
const accounts:Array<{id:string;email:string}>=[],actors:SupabaseClient[]=[],serviceIds:string[]=[];
let admin:SupabaseClient,guest:SupabaseClient,place:{id:string;name:string;center_lat:number;center_lng:number};
let reader=0;
let mfaSecret="";
function sql(query:string){
  assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec=JSON.parse(execFileSync("docker",["inspect",cfg.dbName],{encoding:"utf8"}))[0];assert.equal(spec.Config.Labels["pinpoint.release.run"],cfg.dbName.slice(0,-3));
  try{return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}catch(error){const diagnostic=String((error as {stderr?:unknown}).stderr??"").split(/\r?\n/).find(line=>/^ERROR:/.test(line))??"SQL failed";throw Error(`Guarded service fixture SQL failed: ${diagnostic.replaceAll(cfg.dbPassword,"[withheld]").slice(0,240)}; connection arguments withheld`);}
}
function otp(secret:string){
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const character of secret.toUpperCase().replace(/=+$/, "")){const index=alphabet.indexOf(character);assert.ok(index>=0);bits+=index.toString(2).padStart(5,"0");}
  const bytes=[];for(let offset=0;offset+8<=bits.length;offset+=8)bytes.push(Number.parseInt(bits.slice(offset,offset+8),2));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac("sha1",Buffer.from(bytes)).update(counter).digest(),offset=digest[digest.length-1]!&15;
  return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0");
}
async function signIn(index:number){expect((await actors[index]!.auth.signInWithPassword({email:accounts[index]!.email,password})).error?.code??null).toBeNull();}
const write=(index:number,id:string,command:string,version:number,payload:Record<string,unknown>={},permission=false)=>actors[index]!.rpc("pinpoint_service_write",{command,target:id,expected_version:version,payload,permission_confirmed:permission});
async function create(index=0){const id=randomUUID();serviceIds.push(id);const result=await write(index,id,"create",0);expect(result.error).toBeNull();expect(result.data).toMatchObject({id,version:1,status:"draft"});return id;}
async function uploadPhoto(target:string,index=0){
  assert.equal(cfg.storageEnabled,true);const bytes=readFileSync(`${cfg.sourceRoot}/public/icon.png`);
  const reserved=await actors[index]!.rpc("discovery_media_manage",{command:"reserve",category:"service",target,expected_version:1,mime:"image/png",bytes:bytes.length});expect(reserved.error).toBeNull();
  const media=reserved.data as {id:string;path:string};assert.ok(media.path.startsWith(`${accounts[index]!.id}/${target}/`));
  expect((await actors[index]!.storage.from("discovery-media").upload(media.path,bytes,{contentType:"image/png",upsert:false})).error).toBeNull();
  expect((await actors[index]!.rpc("discovery_media_manage",{command:"complete",category:"service",target,media:media.id})).error).toBeNull();return{...media,bytes};
}
async function photoBytes(index:number,path:string){const downloaded=await actors[index]!.storage.from("discovery-media").download(path);expect(downloaded.error).toBeNull();return Buffer.from(await downloaded.data!.arrayBuffer());}
const content=(extra:Record<string,unknown>={})=>({title:tag,providerName:"Contained service provider",description:"Synthetic service workflow fixture",serviceType:"Plumbing",areaId:place.id,address:`Contained fixture near ${place.name}`,latitude:Number(place.center_lat),longitude:Number(place.center_lng),phone:"+27000000000",publicContact:{email:accounts[0]!.email},contactConsent:true,...extra});
async function row(id:string){const result=await admin.from("service_submissions").select("*").eq("id",id).single();expect(result.error).toBeNull();return result.data!;}
async function publicRow(id:string){const result=await guest.from("approved_services").select("*").eq("id",id);expect(result.error).toBeNull();return result.data!;}
async function submitted(){const id=await create();expect((await write(0,id,"save",1,content())).error).toBeNull();expect((await write(0,id,"submit",2,{},true)).error).toBeNull();return id;}
const decide=(id:string,version:number,decision="approve",index=2)=>actors[index]!.rpc("pinpoint_service_decide",{target:id,expected_version:version,decision,authority_notes:"Contained publishing-permission review",location_notes:"Verified fixture coordinates against the stored discovery place"});
async function approved(){const id=await submitted();expect((await decide(id,3)).error).toBeNull();return id;}

run("Contained Services lifecycle",()=>{
  beforeAll(async()=>{
    assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431");
    for(const key of ["RESEND_API_KEY","QSTASH_TOKEN","VAPID_PRIVATE_KEY","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"])expect(process.env[key]).toBeUndefined();
    globalThis.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,cfg.supabaseUrl,"Blocked non-clone service request");return originalFetch(input,init);};
    admin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});guest=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    for(let index=0;index<3;index++){const email=`${tag}-${index}@pinpoint.invalid`,created=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(created.error?.code??null).toBeNull();const id=created.data.user!.id;assert.match(id,/^[0-9a-f-]{36}$/);accounts.push({id,email});actors.push(createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}));await signIn(index);sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);}
    // Only the labelled disposable clone receives this authentic packaged place.
    // Retain the complete reviewed source provenance and its existing import guard.
    const catalogue=JSON.parse(gunzipSync(readFileSync(`${cfg.sourceRoot}/public/data/south-africa-places.json.gz`)).toString("utf8"));
    const sourcedPlace=catalogue.records.find((item:{provider_id:string})=>item.provider_id==="geonames:993800");
    assert.equal(sourcedPlace?.name,"Johannesburg");assert.equal(sourcedPlace.country_code,"ZA");assert.ok(sourcedPlace.sources.length>0);
    expect((await admin.rpc("import_discovery_place_batch",{records:[sourcedPlace]})).error).toBeNull();
    const location=await guest.from("discovery_places").select("id,name,center_lat,center_lng").eq("provider_id",sourcedPlace.provider_id).single();expect(location.error).toBeNull();place=location.data!;
    sql(`insert into public.admin_memberships(user_id,level) values('${accounts[2]!.id}','admin')`);
    expect((await actors[2]!.rpc("pinpoint_service_review_queue")).error?.code).toBe("42501");
    const factor=await actors[2]!.auth.mfa.enroll({factorType:"totp",friendlyName:tag});expect(factor.error?.code??null).toBeNull();assert.equal(factor.data!.type,"totp");
    mfaSecret=factor.data!.totp.secret;
    const verified=await actors[2]!.auth.mfa.challengeAndVerify({factorId:factor.data!.id,code:otp(factor.data!.totp.secret)});expect(verified.error?.code??null).toBeNull();
    expect((await actors[2]!.auth.getClaims()).data?.claims.aal).toBe("aal2");
  },60000);
  afterAll(async()=>{
    // Immutable service/admin history is retained until the labelled disposable
    // volume is removed by the parent harness; no history trigger is disabled.
    for(const actor of actors)await actor.auth.signOut({scope:"local"});
    globalThis.fetch=originalFetch;
  });
  it("creates and saves a private draft while denying guest and raw table writes",async()=>{
    const id=await create();expect((await write(0,id,"save",1,{title:tag})).error).toBeNull();expect(await row(id)).toMatchObject({version:2,status:"draft"});expect(await publicRow(id)).toEqual([]);
    expect((await guest.from("service_submissions").select("id").eq("id",id)).error).not.toBeNull();expect((await actors[0]!.from("service_submissions").update({draft:{title:"forbidden raw mutation"}}).eq("id",id)).error).not.toBeNull();expect((await actors[0]!.from("approved_services").insert({id,area_id:place.id,content:content()})).error).not.toBeNull();
  });
  it("requires complete provider/location/contact details and explicit publishing permission",async()=>{
    const id=await create();expect((await write(0,id,"submit",1,{},true)).error).not.toBeNull();expect((await write(0,id,"save",1,content({latitude:999}))).error).not.toBeNull();expect((await write(0,id,"save",1,content())).error).toBeNull();expect((await write(0,id,"submit",2)).error).not.toBeNull();expect((await row(id)).status).toBe("draft");expect(await publicRow(id)).toEqual([]);
    // Private review may contain an incomplete consent declaration; publication
    // remains forbidden even for a genuine MFA reviewer. The editor is stricter.
    const noConsent=await create();expect((await write(0,noConsent,"save",1,content({contactConsent:false}))).error).toBeNull();expect((await write(0,noConsent,"submit",2,{},true)).error).toBeNull();expect((await decide(noConsent,3)).error?.code).toBe("22023");expect((await row(noConsent)).status).toBe("submitted");expect(await publicRow(noConsent)).toEqual([]);
  });
  it("requires real MFA for a reviewer and keeps ordinary accounts outside the review queue",async()=>{
    expect((await actors[1]!.rpc("pinpoint_service_review_queue")).error?.code).toBe("42501");
    const low=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});expect((await low.auth.signInWithPassword({email:accounts[2]!.email,password})).error).toBeNull();try{expect((await low.auth.getClaims()).data?.claims.aal).toBe("aal1");expect((await low.rpc("pinpoint_service_review_queue")).error?.code).toBe("42501");}finally{await low.auth.signOut({scope:"local"});}
    expect((await actors[2]!.rpc("pinpoint_service_review_queue")).error).toBeNull();
  });
  it("locks a submitted snapshot and publishes only after a genuine authorized approval",async()=>{
    const id=await submitted();expect(await publicRow(id)).toEqual([]);expect((await write(0,id,"save",3,content({title:"Unsaved replacement"}))).error).not.toBeNull();expect((await decide(id,3,"approve",0)).error?.code).toBe("42501");
    expect((await actors[2]!.rpc("pinpoint_service_review_queue")).data.some((item:{id:string})=>item.id===id)).toBe(true);expect((await decide(id,3)).error).toBeNull();expect(await row(id)).toMatchObject({version:4,status:"approved",submitted:null});expect((await publicRow(id))[0]?.content).toMatchObject({title:tag,providerName:"Contained service provider",contactConsent:true});
  });
  it("supports rejection, correction and resubmission while denying stale decisions",async()=>{
    const id=await submitted();expect((await decide(id,3,"reject")).error).toBeNull();expect((await row(id)).status).toBe("rejected");expect(await publicRow(id)).toEqual([]);expect((await write(0,id,"save",4,content({description:"Corrected fixture"}))).error).toBeNull();expect((await write(0,id,"submit",5,{},true)).error).toBeNull();expect((await decide(id,3)).error?.code).toBe("PT409");expect((await decide(id,6)).error).toBeNull();expect((await publicRow(id))[0]?.content.description).toBe("Corrected fixture");
  });
  it("retains the approved snapshot during private edits and replaces or removes it explicitly",async()=>{
    const id=await approved();expect((await write(0,id,"save",4,content({title:"New reviewed version"}))).error).toBeNull();expect((await publicRow(id))[0]?.content.title).toBe(tag);expect((await write(0,id,"submit",5,{},true)).error).toBeNull();expect((await publicRow(id))[0]?.content.title).toBe(tag);expect((await decide(id,6)).error).toBeNull();expect((await publicRow(id))[0]?.content.title).toBe("New reviewed version");expect((await write(0,id,"withdraw",7)).error).toBeNull();expect(await publicRow(id)).toEqual([]);
  });
  it("denies other-owner reads, writes and withdrawals without altering the canonical draft",async()=>{
    const id=await create();expect((await actors[1]!.from("service_submissions").select("id").eq("id",id)).data).toEqual([]);for(const command of ["save","submit","withdraw"])expect((await write(1,id,command,1,content(),true)).error?.code).toBe("42501");expect(await row(id)).toMatchObject({version:1,status:"draft"});
  });
  it("denies private access and mutations with a revoked owner session and restores a fresh login",async()=>{
    const id=await create(),session=(await actors[0]!.auth.getSession()).data.session!;expect((await admin.auth.admin.signOut(session.access_token,"global")).error).toBeNull();try{expect((await write(0,id,"save",1,{title:tag})).error?.code).toBe("42501");expect((await actors[0]!.from("service_submissions").select("id").eq("id",id)).data).toEqual([]);}finally{await signIn(0);}expect((await write(0,id,"save",1,{title:tag})).error).toBeNull();
  });
  it("hides an approved service and denies writes while its owner is suspended",async()=>{
    const id=await approved(),suspension=randomUUID();expect((await admin.from("account_suspensions").insert({id:suspension,user_id:accounts[0]!.id,reason:"Contained Services access QA"})).error).toBeNull();try{expect(await publicRow(id)).toEqual([]);expect((await write(0,id,"withdraw",4)).error?.code).toBe("42501");}finally{expect((await admin.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}expect(await publicRow(id)).toHaveLength(1);
  });
  it("honors reviewer membership revocation despite an existing MFA token",async()=>{
    const id=await submitted();sql(`update public.admin_memberships set revoked_at=clock_timestamp() where user_id='${accounts[2]!.id}'`);try{expect((await decide(id,3)).error?.code).toBe("42501");expect((await actors[2]!.rpc("pinpoint_service_review_queue")).error?.code).toBe("42501");}finally{sql(`update public.admin_memberships set revoked_at=null where user_id='${accounts[2]!.id}'`);}expect((await decide(id,3)).error).toBeNull();
  });
  it("rejects unknown or out-of-scope photos at the database boundary",async()=>{
    const id=await create();expect((await write(0,id,"save",1,content({mediaIds:[randomUUID()],mediaRightsConfirmed:true}))).error).not.toBeNull();expect((await row(id)).version).toBe(1);expect(await publicRow(id)).toEqual([]);
  });
  it("keeps one committed save after response loss and exposes its canonical version for recovery",async()=>{
    const id=await create(),saved=globalThis.fetch;let lost=false;try{globalThis.fetch=async(input,init)=>{const response=await saved(input,init),url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!lost&&url.pathname==="/rest/v1/rpc/pinpoint_service_write"&&response.ok){lost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed service response loss"}),{status:503,headers:{"content-type":"application/json"}});}return response;};expect((await write(0,id,"save",1,{title:tag})).error).not.toBeNull();expect(lost).toBe(true);}finally{globalThis.fetch=saved;}expect(await row(id)).toMatchObject({version:2,status:"draft",draft:{title:tag}});expect((await write(0,id,"save",1,{title:tag})).error?.code).toBe("PT409");expect(sql(`select count(*) from public.service_submission_events where service_id='${id}' and action='save'`)).toBe("1");
  });
  it("checks the actual recovery HTTP adapter against owner, foreign and revoked-session RLS",async()=>{
    const {GET}=await import("../../src/app/api/private/services/route"),id=await create();
    const get=()=>GET(new Request(`http://127.0.0.1:3112/api/private/services?id=${id}`));
    reader=0;const owned=await get();expect(owned.status).toBe(200);expect(owned.headers.get("cache-control")).toBe("private, no-store");expect((await owned.json()).item).toMatchObject({id,version:1,status:"draft"});
    reader=1;try{const foreign=await get();expect(foreign.status).toBe(404);expect(await foreign.json()).toEqual({item:null});}finally{reader=0;}
    const session=(await actors[0]!.auth.getSession()).data.session!;expect((await admin.auth.admin.signOut(session.access_token,"global")).error).toBeNull();
    try{const revoked=await get();expect(revoked.status).toBe(404);expect(await revoked.json()).toEqual({item:null});}finally{await signIn(0);}
    expect((await get()).status).toBe(200);
  });
  it("uses actual anonymous feed, detail and presentation readers without exposing drafts or review notes",async()=>{
    const {readServiceFeed,readPublicService}=await import("../../src/features/services/data"),privateId=await create(),id=await approved();
    expect(await readPublicService(privateId)).toBeNull();const item=await readPublicService(id);expect(item).toMatchObject({id,area_id:place.id,content:{title:tag,contactConsent:true}});
    for(const key of ["draft","submitted","poster_id","authority_notes","location_notes","version"])expect(item).not.toHaveProperty(key);
    const feed=await readServiceFeed(place.id);expect(feed.items.some(item=>item.id===id)).toBe(true);expect(feed.items.some(item=>item.id===privateId)).toBe(false);expect(feed.totalCount).toBeGreaterThan(0);
    expect((await write(0,id,"withdraw",4)).error).toBeNull();expect(await readPublicService(id)).toBeNull();expect((await readServiceFeed(place.id)).items.some(item=>item.id===id)).toBe(false);
  });
  it("keeps caller-derived public wrappers unprivileged and private history immutable",async()=>{
    for(const signature of ["pinpoint_service_write(text,uuid,integer,jsonb,boolean)","pinpoint_service_review_queue()","pinpoint_service_decide(uuid,integer,text,text,text)","discovery_media_list(text,uuid)"])expect(sql(`select not prosecdef and not has_function_privilege('anon',oid,'EXECUTE') from pg_proc where oid='public.${signature}'::regprocedure`)).toBe("t");
    expect(sql("select tgenabled='O' from pg_trigger where tgrelid='public.service_submission_events'::regclass and tgname='service_history_immutable'")).toBe("t");
  });
  it.skipIf(!cfg?.storageEnabled)("media safety requires publishing rights before submitting uploaded bytes",async()=>{
    const id=await create(),media=await uploadPhoto(id);expect(await photoBytes(0,media.path)).toEqual(media.bytes);
    expect((await write(0,id,"save",1,content({mediaIds:[media.id],mediaRightsConfirmed:false}))).error).toBeNull();
    expect((await write(0,id,"submit",2,{},true)).error?.code).toBe("22023");expect((await row(id)).version).toBe(2);expect(await publicRow(id)).toEqual([]);
    expect((await write(0,id,"save",2,content({mediaIds:[media.id],mediaRightsConfirmed:true}))).error).toBeNull();expect((await write(0,id,"submit",3,{},true)).error).toBeNull();expect((await decide(id,4)).error).toBeNull();
    expect((await publicRow(id))[0]?.content.mediaIds).toEqual([media.id]);const signed=await guest.storage.from("discovery-media").createSignedUrl(media.path,60);expect(signed.error).toBeNull();const publicBytes=await fetch(signed.data!.signedUrl);expect(publicBytes.ok).toBe(true);expect(Buffer.from(await publicBytes.arrayBuffer())).toEqual(media.bytes);
  });
  it.skipIf(!cfg?.storageEnabled)("media safety rejects photos belonging to another owner or another service",async()=>{
    const original=await create(),first=await uploadPhoto(original),otherService=await create(),foreignService=await create(1),foreign=await uploadPhoto(foreignService,1);
    for(const [index,target,media] of [[0,otherService,first.id],[0,otherService,foreign.id],[1,foreignService,first.id]] as const){expect((await write(index,target,"save",1,content({mediaIds:[media],mediaRightsConfirmed:true}))).error?.code).toBe("22023");expect((await row(target)).version).toBe(1);expect(await publicRow(target)).toEqual([]);}
  });
  it.skipIf(!cfg?.storageEnabled)("media safety denies foreign private-photo reads, signing, management and overwrite",async()=>{
    const id=await create(),media=await uploadPhoto(id),listed=await actors[1]!.rpc("discovery_media_list",{category:"service",target:id});expect(listed.error).toBeNull();expect(listed.data).toEqual([]);
    expect((await actors[1]!.storage.from("discovery-media").createSignedUrl(media.path,60)).error).not.toBeNull();expect((await guest.storage.from("discovery-media").createSignedUrl(media.path,60)).error).not.toBeNull();
    for(const command of ["reserve","complete","delete"])expect((await actors[1]!.rpc("discovery_media_manage",{command,category:"service",target:id,expected_version:1,media:media.id,mime:"image/png",bytes:media.bytes.length})).error?.code).toBe("42501");
    expect((await actors[0]!.storage.from("discovery-media").upload(media.path,Buffer.from("Contained forbidden overwrite"),{contentType:"image/png",upsert:true})).error).not.toBeNull();expect(await photoBytes(0,media.path)).toEqual(media.bytes);
  });
  it.skipIf(!cfg?.storageEnabled)("media safety rejects stale reservations and cross-service completion or deletion",async()=>{
    const id=await create(),media=await uploadPhoto(id),other=await create();expect((await write(0,id,"save",1,{title:tag})).error).toBeNull();
    expect((await actors[0]!.rpc("discovery_media_manage",{command:"reserve",category:"service",target:id,expected_version:1,mime:"image/png",bytes:media.bytes.length})).error?.code).toBe("PT409");
    for(const command of ["complete","delete"])expect((await actors[0]!.rpc("discovery_media_manage",{command,category:"service",target:other,media:media.id})).error?.code).toBe("42501");expect(await photoBytes(0,media.path)).toEqual(media.bytes);
  });
  it.skipIf(!cfg?.storageEnabled)("media safety blocks private photo listing and signing after session revocation",async()=>{
    const id=await create(),media=await uploadPhoto(id),pending=await actors[0]!.rpc("discovery_media_manage",{command:"reserve",category:"service",target:id,expected_version:1,mime:"image/png",bytes:media.bytes.length});expect(pending.error).toBeNull();
    const session=(await actors[0]!.auth.getSession()).data.session!;expect((await admin.auth.admin.signOut(session.access_token,"global")).error).toBeNull();
    try{const listed=await actors[0]!.rpc("discovery_media_list",{category:"service",target:id}),signed=await actors[0]!.storage.from("discovery-media").createSignedUrl(media.path,60),write=await actors[0]!.rpc("discovery_media_manage",{command:"reserve",category:"service",target:id,expected_version:1,mime:"image/png",bytes:media.bytes.length}),upload=await actors[0]!.storage.from("discovery-media").upload(pending.data.path,media.bytes,{contentType:"image/png",upsert:false});expect([listed.error?.code==="42501"||Array.isArray(listed.data)&&listed.data.length===0,signed.error!==null,write.error?.code==="42501",upload.error!==null]).toEqual([true,true,true,true]);}finally{await signIn(0);}
  });
  it.skipIf(!cfg?.storageEnabled)("media safety blocks private photo listing and signing during suspension",async()=>{
    const id=await create(),media=await uploadPhoto(id),suspension=randomUUID();expect((await admin.from("account_suspensions").insert({id:suspension,user_id:accounts[0]!.id,reason:"Contained private photo access QA"})).error).toBeNull();
    try{const listed=await actors[0]!.rpc("discovery_media_list",{category:"service",target:id}),signed=await actors[0]!.storage.from("discovery-media").createSignedUrl(media.path,60),write=await actors[0]!.rpc("discovery_media_manage",{command:"reserve",category:"service",target:id,expected_version:1,mime:"image/png",bytes:media.bytes.length});expect([listed.error?.code==="42501"||Array.isArray(listed.data)&&listed.data.length===0,signed.error!==null,write.error?.code==="42501"]).toEqual([true,true,true]);}finally{expect((await admin.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}
  });
  it.skipIf(!cfg?.storageEnabled)("media safety blocks private photo listing and signing after a session deadline",async()=>{
    const id=await create(),media=await uploadPhoto(id),claims=(await actors[0]!.auth.getClaims()).data!.claims,sessionId=String(claims.session_id);assert.match(sessionId,/^[0-9a-f-]{36}$/);
    sql(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${sessionId}'`);
    try{const listed=await actors[0]!.rpc("discovery_media_list",{category:"service",target:id}),signed=await actors[0]!.storage.from("discovery-media").createSignedUrl(media.path,60);expect([listed.error?.code==="42501"||Array.isArray(listed.data)&&listed.data.length===0,signed.error!==null]).toEqual([true,true]);}finally{sql(`update auth.sessions set not_after=null where id='${sessionId}'`);}
  });
  it.skipIf(!cfg?.storageEnabled)("media safety denies new private links during an account ban and restores active access",async()=>{
    const id=await create(),media=await uploadPhoto(id);expect((await admin.auth.admin.updateUserById(accounts[0]!.id,{ban_duration:"1h"})).error).toBeNull();
    try{const listed=await actors[0]!.rpc("discovery_media_list",{category:"service",target:id}),signed=await actors[0]!.storage.from("discovery-media").createSignedUrl(media.path,60);expect([listed.error?.code==="42501"||Array.isArray(listed.data)&&listed.data.length===0,signed.error!==null]).toEqual([true,true]);}finally{expect((await admin.auth.admin.updateUserById(accounts[0]!.id,{ban_duration:"none"})).error).toBeNull();}
    expect((await actors[0]!.rpc("discovery_media_list",{category:"service",target:id})).data).toHaveLength(1);expect((await actors[0]!.storage.from("discovery-media").createSignedUrl(media.path,60)).error).toBeNull();
  });
  it("runs read-only database advisors on the labelled Services clone",async()=>{expect((await runCloneAdvisors(cfg,`${cfg.sourceRoot}/artifacts/user-flow-services${cfg.runtimeCase.startsWith("services-media-")?"-media":""}-advisors.json`)).passed).toBe(true);});
  it.skipIf(!cfg?.browserScript)("browser journey uses real clone Services accounts",async()=>{
    execFileSync(process.execPath,["C:/Users/BB/.agents/skills/playwright/run.js",cfg.browserScript],{cwd:cfg.sourceRoot,env:{...process.env,PINPOINT_MESSAGING_BROWSER_CONFIG:JSON.stringify({...cfg,accounts,password,place,mfaSecret,tag})},stdio:"inherit",windowsHide:true});
  },600000);
});
