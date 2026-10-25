/** Real disposable Auth/REST/SQL/Storage. Synthetic shops; no merchant/device claim. */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCloneAdvisors } from "./clone-advisors.local.mjs";
import { publicOfferDetailSchema, publicOfferFeedSchema, publicOfferActionSchema } from "../../src/features/offers/public-contract";

const cfg=process.env.PINPOINT_MESSAGING_RUNTIME?JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME):null;
const run=cfg?describe:describe.skip,originalFetch=globalThis.fetch;
const tag=`contained-specials-${randomUUID()}`,password=`Fixture-${randomUUID()}aA1!`;
const accounts:Array<{id:string;email:string}>=[],actors:SupabaseClient[]=[];
let admin:SupabaseClient,guest:SupabaseClient,place:Record<string,unknown>&{id:string;name:string;center_lat:number;center_lng:number};
let mfaSecret="";
function sql(query:string){
  assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec=JSON.parse(execFileSync("docker",["inspect",cfg.dbName],{encoding:"utf8"}))[0];assert.equal(spec.Config.Labels["pinpoint.release.run"],cfg.dbName.slice(0,-3));
  try{return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}catch(error){const diagnostic=String((error as {stderr?:unknown}).stderr??"").split(/\r?\n/).find(line=>/^ERROR:/.test(line))??"SQL failed";throw Error(`Guarded Specials fixture SQL failed: ${diagnostic.replaceAll(cfg.dbPassword,"[withheld]").slice(0,240)}; connection arguments withheld`);}
}
function otp(secret:string){
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const character of secret.toUpperCase().replace(/=+$/,"")){const index=alphabet.indexOf(character);assert.ok(index>=0);bits+=index.toString(2).padStart(5,"0");}
  const bytes=[];for(let offset=0;offset+8<=bits.length;offset+=8)bytes.push(Number.parseInt(bits.slice(offset,offset+8),2));
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
  const digest=createHmac("sha1",Buffer.from(bytes)).update(counter).digest(),offset=digest[digest.length-1]!&15;
  return ((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,"0");
}
async function signIn(index:number){expect((await actors[index]!.auth.signInWithPassword({email:accounts[index]!.email,password})).error?.code??null).toBeNull();}
const write=(index:number,id:string,command:string,version:number,payload:Record<string,unknown>={})=>actors[index]!.rpc("pinpoint_offer_write",{command,target:id,expected_version:version,payload});
async function create(index=0){const id=randomUUID(),result=await write(index,id,"create",0);expect(result.error).toBeNull();expect(result.data).toMatchObject({offerId:id,version:1,pendingRevisionId:null});return id;}
async function uploadPhoto(target:string,index=0){
  assert.equal(cfg.storageEnabled,true);const bytes=readFileSync(`${cfg.sourceRoot}/public/icon.png`);
  const reserved=await actors[index]!.rpc("discovery_media_manage",{command:"reserve",category:"shopping",target,expected_version:1,mime:"image/png",bytes:bytes.length});expect(reserved.error).toBeNull();
  const media=reserved.data as {id:string;path:string};assert.ok(media.path.startsWith(`${accounts[index]!.id}/${target}/`));
  expect((await actors[index]!.storage.from("discovery-media").upload(media.path,bytes,{contentType:"image/png",upsert:false})).error).toBeNull();
  expect((await actors[index]!.rpc("discovery_media_manage",{command:"complete",category:"shopping",target,media:media.id})).error).toBeNull();return{...media,bytes};
}
const content=(extra:Record<string,unknown>={})=>({title:tag,benefit:"Contained test benefit",terms:"Synthetic offer for contained QA only",shopName:"Contained fixture shop",areaId:place.id,address:`Contained fixture near ${place.name}`,latitude:Number(place.center_lat),longitude:Number(place.center_lng),startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),priceCents:10000,originalPriceCents:12000,publicContact:{email:accounts[0]!.email},contactConsent:true,...extra});
type Fixture={id:string;revision:string;version:number;content:Record<string,unknown>;media:Awaited<ReturnType<typeof uploadPhoto>>};
const submit=(f:Pick<Fixture,"id"|"revision"|"version">,extra:Record<string,unknown>={})=>actors[0]!.rpc("pinpoint_offer_submit_permission",{target:f.id,revision:f.revision,expected_version:f.version,permission_confirmed:true,permission_version:"shop-authorization-v1",...extra});
async function submitted(extra:Record<string,unknown>={}):Promise<Fixture>{const id=await create(),media=await uploadPhoto(id),draft=content({mediaIds:[media.id],mediaRightsConfirmed:true,...extra});expect((await write(0,id,"save",1,draft)).error).toBeNull();const f={id,revision:randomUUID(),version:2,content:draft,media};const result=await submit(f);expect(result.error).toBeNull();expect(result.data).toMatchObject({version:3,pendingRevisionId:f.revision});return{...f,version:3};}
const identity=(f:Fixture)=>({target:f.id,revision:f.revision,expected_version:f.version});
const permissionArgs=(f:Fixture)=>({...identity(f),request_id:randomUUID(),evidence_kind:"written_authorization",source_reference:"https://contained.pinpoint.invalid/authorization",verification_note:"Synthetic authorization evidence for isolated QA",authorization_checked:true,statement_version:"admin-permission-review-v1"});
const locationArgs=(f:Fixture,permission:string)=>({...identity(f),request_id:randomUUID(),permission_review_id:permission,place_snapshot:place,provenance_reference:"Packaged GeoNames catalogue provenance",shop_reference:"Synthetic shop location fixture",verification_note:"Matched fixture coordinates against the actual stored place",provenance_checked:true,shop_checked:true,content_checked:true,dates_checked:true,statement_version:"admin-location-review-v1"});
async function reviewed(f:Fixture){const p=await actors[2]!.rpc("pinpoint_offer_permission_review_write",permissionArgs(f));expect(p.error).toBeNull();const l=await actors[2]!.rpc("pinpoint_offer_location_review_write",locationArgs(f,p.data.id));expect(l.error).toBeNull();return{permission:p.data.id as string,location:l.data.id as string};}
const approveArgs=(f:Fixture,evidence:{permission:string;location:string})=>({...identity(f),request_id:randomUUID(),permission_review_id:evidence.permission,location_review_id:evidence.location,approval_confirmed:true,statement_version:"admin-offer-approval-v1"});
async function published(extra:Record<string,unknown>={}){const f=await submitted(extra),evidence=await reviewed(f),args=approveArgs(f,evidence),result=await actors[2]!.rpc("pinpoint_offer_approve",args);expect(result.error).toBeNull();expect(result.data).toMatchObject({version:f.version+1,pendingRevisionId:null});return{...f,version:f.version+1,evidence,approvalArgs:args};}
async function detail(id:string){const result=await guest.rpc("pinpoint_offer_public_detail",{target:id});expect(result.error).toBeNull();return publicOfferDetailSchema.parse(result.data);}
async function row(id:string){const result=await admin.from("shopping_offers").select("*").eq("id",id).single();expect(result.error).toBeNull();return result.data!;}
const save=(id:string,value=true,index=1)=>actors[index]!.rpc("saved_specials_write",{category:"shopping",target:id,save:value});
async function preferences(index=1){const result=await actors[index]!.rpc("saved_specials_read",{state_only:false});expect(result.error).toBeNull();return result.data;}

run("Contained Shopping Specials lifecycle",()=>{
  beforeAll(async()=>{
    assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431");assert.equal(cfg.storageEnabled,true);
    for(const key of ["RESEND_API_KEY","QSTASH_TOKEN","VAPID_PRIVATE_KEY","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"])expect(process.env[key]).toBeUndefined();
    globalThis.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,cfg.supabaseUrl,"Blocked non-clone Specials request");return originalFetch(input,init);};
    admin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});guest=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    for(let index=0;index<4;index++){const email=`${tag}-${index}@pinpoint.invalid`,created=await admin.auth.admin.createUser({email,password,email_confirm:true});expect(created.error?.code??null).toBeNull();const id=created.data.user!.id;assert.match(id,/^[0-9a-f-]{36}$/);accounts.push({id,email});actors.push(createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}));await signIn(index);sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);}
    const catalogue=JSON.parse(gunzipSync(readFileSync(`${cfg.sourceRoot}/public/data/south-africa-places.json.gz`)).toString("utf8")),sourced=catalogue.records.find((item:{provider_id:string})=>item.provider_id==="geonames:993800");
    assert.equal(sourced?.name,"Johannesburg");assert.equal(sourced.country_code,"ZA");assert.ok(sourced.sources.length>0);expect((await admin.rpc("import_discovery_place_batch",{records:[sourced]})).error).toBeNull();
    const stored=await guest.from("discovery_places").select("*").eq("provider_id",sourced.provider_id).single();expect(stored.error).toBeNull();place=stored.data!;
    for(const index of [0,3])expect((await actors[index]!.rpc("pinpoint_offer_enroll",{})).error).toBeNull();
    sql(`insert into public.admin_memberships(user_id,level) values('${accounts[2]!.id}','admin')`);
    expect((await actors[2]!.rpc("pinpoint_offer_review_read",{target:randomUUID()})).error?.code).toBe("42501");
    const factor=await actors[2]!.auth.mfa.enroll({factorType:"totp",friendlyName:tag});expect(factor.error?.code??null).toBeNull();assert.equal(factor.data!.type,"totp");
    mfaSecret=factor.data!.totp.secret;
    expect((await actors[2]!.auth.mfa.challengeAndVerify({factorId:factor.data!.id,code:otp(mfaSecret)})).error?.code??null).toBeNull();expect((await actors[2]!.auth.getClaims()).data?.claims.aal).toBe("aal2");
  },60000);
  afterAll(async()=>{for(const actor of actors)await actor.auth.signOut({scope:"local"});globalThis.fetch=originalFetch;});
  it("creates private drafts and denies guest, foreign-owner and raw mutation access",async()=>{
    const id=await create();expect((await write(0,id,"save",1,{title:tag})).error).toBeNull();expect(await row(id)).toMatchObject({version:2,draft:{title:tag}});expect((await detail(id)).status).toBe("unavailable");
    expect((await guest.from("shopping_offers").select("id").eq("id",id)).error).not.toBeNull();expect((await actors[3]!.from("shopping_offers").select("id").eq("id",id)).data).toEqual([]);
    expect((await actors[0]!.from("shopping_offers").update({draft:{title:"Forbidden raw update"}}).eq("id",id)).error).not.toBeNull();for(const command of ["save","withdraw"])expect((await write(3,id,command,2,{title:tag})).error?.code).toBe("42501");expect((await row(id)).version).toBe(2);
  });
  it("requires photos, media rights, valid dates and the exact publishing permission",async()=>{
    const id=await create(),revision=randomUUID();expect((await write(0,id,"save",1,content())).error).toBeNull();expect((await submit({id,revision,version:2})).error?.code).toBe("22023");
    expect((await write(0,id,"save",2,content({priceCents:12000,originalPriceCents:10000}))).error).not.toBeNull();expect((await row(id)).version).toBe(2);
    const f=await submitted();expect((await submit(f,{permission_confirmed:false})).error).not.toBeNull();expect((await submit(f,{permission_version:"wrong"})).error).not.toBeNull();expect((await detail(f.id)).status).toBe("unavailable");
    const invalid=await create(),media=await uploadPhoto(invalid);expect((await write(0,invalid,"save",1,content({mediaIds:[media.id],mediaRightsConfirmed:false}))).error).toBeNull();expect((await submit({id:invalid,revision:randomUUID(),version:2})).error).not.toBeNull();
    expect((await write(0,invalid,"save",2,content({mediaIds:[media.id],mediaRightsConfirmed:true,endsAt:new Date(Date.now()-120000).toISOString()}))).error).toBeNull();expect((await submit({id:invalid,revision:randomUUID(),version:3})).error).not.toBeNull();
  });
  it("publishes through genuine permission and location review with real Storage bytes and safe public DTOs",async()=>{
    const f=await published(),item=await detail(f.id);expect(item).toMatchObject({status:"live",content:{title:tag,mediaIds:[f.media.id],priceCents:10000,originalPriceCents:12000}});
    for(const key of ["poster_id","actor_id","permission_review_id","location_review_id","draft","verification_note","source_reference"])expect(item).not.toHaveProperty(key);
    const feed=await guest.rpc("pinpoint_offer_public_feed",{area:place.id});expect(feed.error).toBeNull();expect(publicOfferFeedSchema.parse(feed.data).items.some(item=>item.offerId===f.id)).toBe(true);
    const action=await guest.rpc("pinpoint_offer_public_action",{target:f.id});expect(action.error).toBeNull();expect(publicOfferActionSchema.parse(action.data)).toMatchObject({offerId:f.id,shopName:"Contained fixture shop"});
    const signed=await guest.storage.from("discovery-media").createSignedUrl(f.media.path,60);expect(signed.error).toBeNull();const bytes=await fetch(signed.data!.signedUrl);expect(bytes.ok).toBe(true);expect(Buffer.from(await bytes.arrayBuffer())).toEqual(f.media.bytes);
  });
  it("denies ordinary and AAL1 review while retaining immutable submitted content",async()=>{
    const f=await submitted();expect((await actors[1]!.rpc("pinpoint_offer_review_read",{target:f.id})).error?.code).toBe("42501");
    const low=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});expect((await low.auth.signInWithPassword({email:accounts[2]!.email,password})).error).toBeNull();try{expect((await low.rpc("pinpoint_offer_review_read",{target:f.id})).error?.code).toBe("42501");}finally{await low.auth.signOut({scope:"local"});}
    expect((await write(0,f.id,"save",f.version,{...f.content,title:"Private later draft"})).error).toBeNull();const reviewed=await actors[2]!.rpc("pinpoint_offer_review_read",{target:f.id});expect(reviewed.error).toBeNull();expect(reviewed.data.content.title).toBe(tag);expect(reviewed.data.version).toBe(f.version+1);
    expect((await actors[0]!.from("shopping_offer_revisions").update({content:{title:"Forbidden revision rewrite"}}).eq("id",f.revision)).error).not.toBeNull();
  });
  it("binds permission, location and decision evidence to exact revisions, versions and stored places",async()=>{
    const f=await submitted(),missing=approveArgs(f,{permission:randomUUID(),location:randomUUID()});expect((await actors[2]!.rpc("pinpoint_offer_approve",missing)).error).not.toBeNull();
    const pArgs=permissionArgs(f),p=await actors[2]!.rpc("pinpoint_offer_permission_review_write",pArgs);expect(p.error).toBeNull();expect((await actors[2]!.rpc("pinpoint_offer_permission_review_write",pArgs)).data).toEqual(p.data);expect((await actors[2]!.rpc("pinpoint_offer_permission_review_write",{...pArgs,verification_note:"Changed receipt"})).error?.code).toBe("22023");
    const lArgs=locationArgs(f,p.data.id);expect((await actors[2]!.rpc("pinpoint_offer_location_review_write",{...lArgs,place_snapshot:{...place,name:"Changed stored place"}})).error?.code).toBe("PT409");
    const l=await actors[2]!.rpc("pinpoint_offer_location_review_write",lArgs);expect(l.error).toBeNull();expect((await actors[2]!.rpc("pinpoint_offer_location_review_write",lArgs)).data).toEqual(l.data);
    expect((await write(0,f.id,"save",f.version,f.content)).error).toBeNull();expect((await actors[2]!.rpc("pinpoint_offer_approve",approveArgs(f,{permission:p.data.id,location:l.data.id}))).error?.code).toBe("PT409");expect((await detail(f.id)).status).toBe("unavailable");
  });
  it("rejects, corrects and freshly reviews a new submitted revision",async()=>{
    const f=await submitted(),reject=await actors[2]!.rpc("pinpoint_offer_reject",{...identity(f),reason:"Contained correction required"});expect(reject.error).toBeNull();expect(reject.data.version).toBe(4);expect((await detail(f.id)).status).toBe("unavailable");
    const draft={...f.content,benefit:"Corrected benefit"};expect((await write(0,f.id,"save",4,draft)).error).toBeNull();const next={...f,revision:randomUUID(),version:5,content:draft};expect((await submit(next)).error).toBeNull();next.version=6;const evidence=await reviewed(next);expect((await actors[2]!.rpc("pinpoint_offer_approve",approveArgs(next,evidence))).error).toBeNull();expect(await detail(f.id)).toMatchObject({status:"live",content:{benefit:"Corrected benefit"}});
  });
  it("retains approved content for private saves then invalidates it on resubmission and withdrawal",async()=>{
    const f=await published(),draft={...f.content,title:"Fresh material change"};expect((await write(0,f.id,"save",f.version,draft)).error).toBeNull();expect(await detail(f.id)).toMatchObject({status:"live",content:{title:tag}});
    const next={...f,content:draft,revision:randomUUID(),version:f.version+1};expect((await submit(next)).error).toBeNull();next.version++;expect((await detail(f.id)).status).toBe("unavailable");const evidence=await reviewed(next);expect((await actors[2]!.rpc("pinpoint_offer_approve",approveArgs(next,evidence))).error).toBeNull();expect(await detail(f.id)).toMatchObject({status:"live",content:{title:"Fresh material change"}});
    expect((await write(0,f.id,"withdraw",next.version+1)).error).toBeNull();expect((await detail(f.id)).status).toBe("unavailable");expect((await guest.storage.from("discovery-media").createSignedUrl(f.media.path,60)).error).not.toBeNull();
  });
  it("denies private-photo access and cross-offer ownership while allowing an eligible reviewer",async()=>{
    const f=await submitted();expect((await actors[3]!.rpc("discovery_media_list",{category:"shopping",target:f.id})).data).toEqual([]);expect((await guest.storage.from("discovery-media").createSignedUrl(f.media.path,60)).error).not.toBeNull();expect((await actors[3]!.storage.from("discovery-media").createSignedUrl(f.media.path,60)).error).not.toBeNull();expect((await actors[2]!.storage.from("discovery-media").createSignedUrl(f.media.path,60)).error).toBeNull();
    const other=await create(3);expect((await write(3,other,"save",1,content({mediaIds:[f.media.id],mediaRightsConfirmed:true}))).error).not.toBeNull();expect((await row(other)).version).toBe(1);
  });
  it("denies revoked owner drafts and new private links while a fresh login restores access",async()=>{
    const f=await submitted(),session=(await actors[0]!.auth.getSession()).data.session!;expect((await admin.auth.admin.signOut(session.access_token,"global")).error).toBeNull();
    try{expect((await write(0,f.id,"withdraw",f.version)).error?.code).toBe("42501");expect((await actors[0]!.from("shopping_offers").select("id").eq("id",f.id)).data).toEqual([]);expect((await actors[0]!.storage.from("discovery-media").createSignedUrl(f.media.path,60)).error).not.toBeNull();}finally{await signIn(0);}expect((await actors[0]!.from("shopping_offers").select("id").eq("id",f.id)).data).toHaveLength(1);
  });
  it("hides approved Specials during poster suspension and restores the reviewed snapshot afterward",async()=>{
    const f=await published(),suspension=randomUUID();expect((await admin.from("account_suspensions").insert({id:suspension,user_id:accounts[0]!.id,reason:"Contained Shopping QA"})).error).toBeNull();
    try{expect((await detail(f.id)).status).toBe("unavailable");expect((await write(0,f.id,"withdraw",f.version)).error?.code).toBe("42501");}finally{expect((await admin.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}expect((await detail(f.id)).status).toBe("live");
  });
  it("honors reviewer membership revocation with an existing MFA token",async()=>{
    const f=await submitted();sql(`update public.admin_memberships set revoked_at=clock_timestamp() where user_id='${accounts[2]!.id}'`);try{expect((await actors[2]!.rpc("pinpoint_offer_permission_review_write",permissionArgs(f))).error?.code).toBe("42501");expect((await actors[2]!.rpc("pinpoint_offer_review_read",{target:f.id})).error?.code).toBe("42501");}finally{sql(`update public.admin_memberships set revoked_at=null where user_id='${accounts[2]!.id}'`);}expect((await actors[2]!.rpc("pinpoint_offer_review_read",{target:f.id})).error).toBeNull();
  });
  it("saves and unsaves once for an ordinary consumer without poster enrollment or foreign preference access",async()=>{
    const f=await published();expect(sql(`select count(*) from public.offer_posters where user_id='${accounts[1]!.id}'`)).toBe("0");for(let n=0;n<2;n++)expect((await save(f.id)).data).toEqual({saved:true,savedCount:1});expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});
    expect((await actors[3]!.from("saved_specials").select("offer_id").eq("user_id",accounts[1]!.id)).data).toEqual([]);expect((await actors[1]!.from("saved_specials").insert({user_id:accounts[1]!.id,offer_id:f.id})).error).not.toBeNull();expect((await guest.rpc("saved_specials_read",{})).data).toMatchObject({authenticated:false,targets:[],items:[]});expect((await guest.rpc("saved_specials_write",{category:"shopping",target:f.id,save:true})).error).not.toBeNull();
    await signIn(1);expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});expect((await save(f.id,false)).data).toEqual({saved:false,savedCount:0});expect((await preferences()).targets).not.toContainEqual({category:"shopping",id:f.id});
  });
  it("denies saved-item reads and mutations after consumer session revocation without deleting preferences",async()=>{
    const f=await published();expect((await save(f.id)).error).toBeNull();const session=(await actors[1]!.auth.getSession()).data.session!;expect((await admin.auth.admin.signOut(session.access_token,"global")).error).toBeNull();
    try{const read=await preferences(),raw=await actors[1]!.from("saved_specials").select("offer_id").eq("offer_id",f.id),removed=await actors[1]!.from("saved_specials").delete().eq("offer_id",f.id).select("offer_id"),mutation=await save(f.id,false);expect({readDenied:read.authenticated===false&&read.targets.length===0&&read.items.length===0,rawDenied:raw.data?.length===0,writeDenied:mutation.error?.code==="42501",deleteDenied:removed.data?.length===0||removed.error!==null}).toEqual({readDenied:true,rawDenied:true,writeDenied:true,deleteDenied:true});}finally{await signIn(1);}expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});
  });
  it("denies saved-item access during consumer suspension while guest discovery remains public",async()=>{
    const f=await published();expect((await save(f.id)).error).toBeNull();const suspension=randomUUID();expect((await admin.from("account_suspensions").insert({id:suspension,user_id:accounts[1]!.id,reason:"Contained saved preference QA"})).error).toBeNull();
    try{const read=await preferences(),raw=await actors[1]!.from("saved_specials").select("offer_id").eq("offer_id",f.id),write=await save(f.id,false);expect({readDenied:read.authenticated===false&&read.targets.length===0&&read.items.length===0,writeDenied:write.error?.code==="42501",rawDenied:raw.data?.length===0}).toEqual({readDenied:true,writeDenied:true,rawDenied:true});expect((await detail(f.id)).status).toBe("live");}finally{expect((await admin.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});
  });
  it("denies saved preferences after a session deadline and retains them after eligibility returns",async()=>{
    const f=await published();expect((await save(f.id)).error).toBeNull();const sessionId=String((await actors[1]!.auth.getClaims()).data!.claims.session_id);assert.match(sessionId,/^[0-9a-f-]{36}$/);sql(`update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${sessionId}'`);
    try{expect(await preferences()).toMatchObject({authenticated:false,targets:[],items:[]});expect((await actors[1]!.from("saved_specials").select("offer_id").eq("offer_id",f.id)).data).toEqual([]);expect((await save(f.id,false)).error?.code).toBe("42501");}finally{sql(`update auth.sessions set not_after=null where id='${sessionId}'`);}expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});
  });
  it("denies saved preferences during an account ban without hiding public guest discovery",async()=>{
    const f=await published();expect((await save(f.id)).error).toBeNull();expect((await admin.auth.admin.updateUserById(accounts[1]!.id,{ban_duration:"1h"})).error).toBeNull();
    try{expect(await preferences()).toMatchObject({authenticated:false,targets:[],items:[]});expect((await actors[1]!.from("saved_specials").select("offer_id").eq("offer_id",f.id)).data).toEqual([]);expect((await save(f.id,false)).error?.code).toBe("42501");expect((await detail(f.id)).status).toBe("live");}finally{expect((await admin.auth.admin.updateUserById(accounts[1]!.id,{ban_duration:"none"})).error).toBeNull();}expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});
  });
  it("rejects incomplete save choices and unavailable targets without changing existing preferences",async()=>{
    const f=await published();expect((await save(f.id)).error).toBeNull();for(const args of [{category:"shopping",target:f.id,save:null},{category:"shopping",target:null,save:false},{category:null,target:f.id,save:false},{category:"service",target:f.id,save:false}])expect((await actors[1]!.rpc("saved_specials_write",args)).error?.code).toBe("22023");expect((await save(await create())).error?.code).toBe("22023");expect((await preferences()).targets).toContainEqual({category:"shopping",id:f.id});
  });
  it("recovers the canonical permission submission after its committed response is lost",async()=>{
    const id=await create(),media=await uploadPhoto(id),draft=content({mediaIds:[media.id],mediaRightsConfirmed:true});expect((await write(0,id,"save",1,draft)).error).toBeNull();const f={id,revision:randomUUID(),version:2},previous=globalThis.fetch;let lost=false;
    try{globalThis.fetch=async(input,init)=>{const response=await previous(input,init),url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!lost&&url.pathname==="/rest/v1/rpc/pinpoint_offer_submit_permission"&&response.ok){lost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed response loss"}),{status:503,headers:{"content-type":"application/json"}});}return response;};expect((await submit(f)).error).not.toBeNull();expect(lost).toBe(true);}finally{globalThis.fetch=previous;}
    const recovered=await submit(f);expect(recovered.error).toBeNull();expect(recovered.data).toMatchObject({version:3,pendingRevisionId:f.revision});expect(sql(`select count(*) from public.shopping_offer_revisions where offer_id='${id}'`)).toBe("1");expect(sql(`select count(*) from public.shopping_offer_permissions where offer_id='${id}'`)).toBe("1");
  });
  it("replays an approval receipt once and rejects changed receipts or stale unpublication",async()=>{
    const f=await published(),replay=await actors[2]!.rpc("pinpoint_offer_approve",f.approvalArgs);expect(replay.error).toBeNull();expect(replay.data.version).toBe(f.version);expect(sql(`select count(*) from public.shopping_offer_decisions where offer_id='${f.id}' and action='approve'`)).toBe("1");expect((await actors[2]!.rpc("pinpoint_offer_approve",{...f.approvalArgs,permission_review_id:randomUUID()})).error).not.toBeNull();
    const args={target:f.id,revision:f.revision,expected_version:f.version,request_id:randomUUID(),reason:"Contained publication withdrawal"};expect((await actors[2]!.rpc("pinpoint_offer_unpublish",{...args,expected_version:f.version-1})).error?.code).toBe("PT409");const removed=await actors[2]!.rpc("pinpoint_offer_unpublish",args);expect(removed.error).toBeNull();expect((await detail(f.id)).status).toBe("unavailable");expect((await actors[2]!.rpc("pinpoint_offer_unpublish",args)).data).toEqual(removed.data);
  });
  it("redacts scheduled content and enforces exact inclusive start and exclusive end boundaries",async()=>{
    const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+7200000).toISOString(),f=await published({startsAt:start,endsAt:end});expect(await detail(f.id)).toMatchObject({status:"scheduled",content:null,place:null,poster:null});expect((await guest.rpc("pinpoint_offer_public_action",{target:f.id})).data).toBeNull();
    const at=(time:string)=>JSON.parse(sql(`select private.pinpoint_offer_public_snapshot('${f.id}','${time}'::timestamptz)`));expect(at(new Date(Date.parse(start)-1).toISOString()).status).toBe("scheduled");expect(at(start).status).toBe("live");expect(at(new Date(Date.parse(end)-1).toISOString()).status).toBe("live");expect(at(end)).toMatchObject({status:"expired",content:null,place:null,poster:null});expect((await save(f.id)).error).not.toBeNull();
  });
  it("runs read-only database advisors on the labelled Shopping clone",async()=>{expect((await runCloneAdvisors(cfg,`${cfg.sourceRoot}/artifacts/user-flow-specials-advisors.json`)).passed).toBe(true);});
  it("keeps caller-derived saved wrappers unprivileged and pure validators inaccessible to clients",()=>{
    for(const signature of ["saved_specials_read(boolean)","saved_specials_write(text,uuid,boolean)"])expect(sql(`select not prosecdef from pg_proc where oid='public.${signature}'::regprocedure`)).toBe("t");
    for(const signature of ["discovery_card_validate(jsonb,boolean,boolean)","special_links_validate(jsonb)","special_submission_media_validate(jsonb)","pinpoint_contact_validate(jsonb,boolean)"])expect(sql(`select has_function_privilege('postgres','private.${signature}','EXECUTE') and not has_function_privilege('anon','private.${signature}','EXECUTE') and not has_function_privilege('authenticated','private.${signature}','EXECUTE')`)).toBe("t");
    for(const signature of ["saved_specials_read(boolean)","saved_specials_write(text,uuid,boolean)"])expect(sql(`select prosecdef and proconfig=array['search_path=""']::text[] and not has_function_privilege('anon',oid,'EXECUTE') and has_function_privilege('authenticated',oid,'EXECUTE') from pg_proc where oid='private.${signature}'::regprocedure`)).toBe("t");
  });
  if(cfg?.browserScript)it("browser journey uses real cloned Shopping accounts and MFA",()=>{
    execFileSync(process.execPath,["C:/Users/BB/.agents/skills/playwright/run.js",cfg.browserScript],{cwd:cfg.sourceRoot,env:{...process.env,PINPOINT_MESSAGING_BROWSER_CONFIG:JSON.stringify({...cfg,accounts,password,place,mfaSecret,tag})},stdio:"inherit",windowsHide:true});
  },1200000);
});
