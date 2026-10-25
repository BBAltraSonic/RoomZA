/** Opt-in real clone Auth/REST/SQL. No media provider, recording or delivery claim. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({actor:null as SupabaseClient|null,admin:null as SupabaseClient|null}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>state.actor}));
vi.mock("@/lib/supabase/admin",()=>({createClient:()=>state.admin,createUntypedClient:()=>state.admin}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));
import { startLiveTour,scheduleLiveTour,endLiveTour } from "@/features/live-tours/actions";
import { processScheduledTourReminder } from "@/features/live-tours/notifications";
import { runCloneAdvisors } from "./clone-advisors.local.mjs";

const cfg=process.env.PINPOINT_MESSAGING_RUNTIME?JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME):null;
const run=cfg?describe:describe.skip,originalFetch=globalThis.fetch;
const tag=`contained-tour-${randomUUID()}`,password=`Fixture-${randomUUID()}aA1!`;
const accounts:Array<{id:string;email:string}>=[],actors:SupabaseClient[]=[],listings:string[]=[];
let initialFlags:Array<{key:string;enabled:boolean;description:string;updated_at:string}>=[];
const originalServiceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
function sql(query:string){
  assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec=JSON.parse(execFileSync("docker",["inspect",cfg.dbName],{encoding:"utf8"}))[0];assert.equal(spec.Config.Labels["pinpoint.release.run"],cfg.dbName.slice(0,-3));
  try{return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}catch(error){const diagnostic=String((error as {stderr?:unknown}).stderr??"").split(/\r?\n/).find(line=>/^ERROR:/.test(line))??"SQL failed";throw Error(`Guarded tour fixture SQL failed: ${diagnostic.replaceAll(cfg.dbPassword,"[withheld]").slice(0,240)}; connection arguments withheld`);}
}
async function signIn(index:number){expect((await actors[index]!.auth.signInWithPassword({email:accounts[index]!.email,password})).error).toBeNull();}
async function revoke(index:number){const session=(await actors[index]!.auth.getSession()).data.session!;expect((await state.admin!.auth.admin.signOut(session.access_token,"global")).error).toBeNull();}
async function flags(recording=true,scheduled=true){for(const [key,enabled]of [["instant_connect_recording",recording],["instant_connect_scheduled_tours",scheduled]] as const)expect((await state.admin!.from("app_feature_flags").update({enabled}).eq("key",key)).error).toBeNull();}
async function fixture(saved=false){
  const id=randomUUID();listings.push(id);const inserted=await state.admin!.from("listings").insert({id,landlord_id:accounts[0]!.id,title:tag,address:"Synthetic live-tour fixture",price:2500,listing_type:"rent",status:"draft",metadata:{publicContact:{email:accounts[0]!.email},contactConsent:true}}).select("updated_at").single();expect(inserted.error).toBeNull();
  for(let n=0;n<3;n++)expect((await state.admin!.from("listing_images").insert({listing_id:id,bucket:"listing-images",path:`${accounts[0]!.id}/${id}/${n}.png`,public_url:"http://localhost:3112/icon.png",sort_order:n})).error).toBeNull();
  const claims=await actors[0]!.auth.getClaims();expect(claims.error).toBeNull();expect((await state.admin!.rpc("pinpoint_property_lifecycle",{actor_id:accounts[0]!.id,actor_session_id:String(claims.data!.claims.session_id),target:id,expected_updated_at:inserted.data!.updated_at,command:"publish"})).error).toBeNull();
  if(saved)expect((await state.admin!.from("user_favorites").insert({user_id:accounts[1]!.id,listing_id:id})).error).toBeNull();return id;
}
const room=(listingId:string,id=randomUUID())=>({target_listing_id:listingId,target_tour_id:id,target_room_id:`roomza-tour-${id.replaceAll("-","")}`,target_join_url:`https://meet.jit.si/roomza-tour-${id.replaceAll("-","")}`});
async function start(listingId:string){const result=await actors[0]!.rpc("start_live_tour",room(listingId));expect(result.error).toBeNull();expect(result.data?.[0]?.result).toBe("started");return result.data![0]!.tour_id as string;}
async function schedule(listingId:string,at=new Date(Date.now()+20*60000).toISOString()){
  const result=await actors[0]!.rpc("schedule_live_tour",{...room(listingId),target_scheduled_at:at,target_duration_minutes:30});expect(result.error).toBeNull();expect(result.data?.[0]?.result).toBe("scheduled");return result.data![0]!.tour_id as string;
}
async function row(id:string){const result=await state.admin!.from("live_tours").select("*").eq("id",id).single();expect(result.error).toBeNull();return result.data!;}
async function rows(listingId:string){const result=await state.admin!.from("live_tours").select("*").eq("listing_id",listingId);expect(result.error).toBeNull();return result.data!;}
async function consent(id:string,index:number,granted=true){const result=await actors[index]!.rpc("set_live_tour_recording_consent",{target_tour_id:id,target_granted:granted,target_policy_version:"phase3-v1"});expect(result.error).toBeNull();expect(result.data?.[0]?.result).toBe("updated");}
async function record(id:string){await consent(id,0);await consent(id,1);const result=await actors[0]!.rpc("start_live_tour_recording",{target_tour_id:id,target_participant_ids:[accounts[1]!.id]});expect(result.error).toBeNull();expect(result.data?.[0]?.result).toBe("recording");}
async function events(id:string,type:string){const result=await state.admin!.from("notification_events").select("id,recipient_id").eq("type",type).contains("payload",{tourId:id});expect(result.error).toBeNull();return result.data!;}
const denied=(result:{error:unknown;data:unknown},success:string[])=>result.error!==null||!success.includes((result.data as Array<{result:string}>|null)?.[0]?.result??"");
async function loseRpc(pathname:string,work:()=>Promise<{success:boolean}>){const saved=globalThis.fetch;let lost=false;try{globalThis.fetch=async(input,init)=>{const response=await saved(input,init);const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!lost&&url.pathname===pathname&&response.ok){lost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed tour response loss"}),{status:503,headers:{"content-type":"application/json"}});}return response;};expect((await work()).success).toBe(false);expect(lost).toBe(true);}finally{globalThis.fetch=saved;}}

run("Contained live tours",()=>{
  beforeAll(async()=>{
    assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431");for(const key of ["QSTASH_TOKEN","RESEND_API_KEY","VAPID_PRIVATE_KEY","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"])expect(process.env[key]).toBeUndefined();
    // A test-only extra SQL filter keeps original cloned search-alert recipients
    // out of fixture notifications. Reads, mutations, Auth and RLS remain real.
    globalThis.fetch=(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);assert.equal(url.origin,cfg.supabaseUrl,"Blocked external tour delivery");if(url.pathname==="/rest/v1/search_alerts")url.searchParams.append("user_id",`in.(${accounts.map(account=>account.id).join(",")})`);return originalFetch(input instanceof Request?new Request(url,input):url.href,init);};
    state.admin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});process.env.SUPABASE_SERVICE_ROLE_KEY=cfg.serviceKey;
    const saved=await state.admin.from("app_feature_flags").select("*").in("key",["instant_connect_recording","instant_connect_scheduled_tours"]);expect(saved.error).toBeNull();initialFlags=saved.data!;
    for(let index=0;index<3;index++){const email=`${tag}-${index}@pinpoint.invalid`,created=await state.admin.auth.admin.createUser({email,password,email_confirm:true});expect(created.error).toBeNull();accounts.push({id:created.data.user!.id,email});actors.push(createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}));await signIn(index);sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${created.data.user!.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);}
    await flags();state.actor=actors[0]!;
  });
  afterAll(async()=>{
    if(state.admin){
      if(initialFlags.length)expect((await state.admin.from("app_feature_flags").upsert(initialFlags,{onConflict:"key"})).error).toBeNull();
      if(accounts.length)sql(`delete from public.notification_events where recipient_id in (${accounts.map(account=>`'${account.id}'`).join(",")});delete from public.consent_events where user_id in (${accounts.map(account=>`'${account.id}'`).join(",")});`);
      for(const id of listings)sql(`delete from public.listing_restrictions where listing_id='${id}';delete from public.live_tours where listing_id='${id}';delete from public.listings where id='${id}';`);
      for(const client of actors)await client.auth.signOut();for(const account of accounts)expect((await state.admin.auth.admin.deleteUser(account.id)).error).toBeNull();
    }
    globalThis.fetch=originalFetch;if(originalServiceKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalServiceKey;
  });
  it("persists a canonical live room, denies foreign mutations and exposes only active public entry",async()=>{
    const listingId=await fixture(),id=await start(listingId),retry=await actors[0]!.rpc("start_live_tour",room(listingId));expect(retry.error).toBeNull();expect(retry.data?.[0]).toMatchObject({result:"already_live",tour_id:id});expect(await rows(listingId)).toHaveLength(1);
    const anon=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});expect((await anon.rpc("get_active_public_live_tour",{target_listing_id:listingId})).data?.[0]?.tour_id).toBe(id);
    expect(denied(await actors[2]!.rpc("end_live_tour",{target_tour_id:id}),["ended","noop"])).toBe(true);expect((await anon.rpc("end_live_tour",{target_tour_id:id})).error).not.toBeNull();
    expect((await actors[0]!.rpc("end_live_tour",{target_tour_id:id,observed_peak_viewers:99999})).error).toBeNull();expect(await row(id)).toMatchObject({status:"ended",peak_viewers:10000});expect((await anon.rpc("get_active_public_live_tour",{target_listing_id:listingId})).data??[]).toEqual([]);
  });
  it("serializes concurrent starts into one canonical active room",async()=>{
    const listingId=await fixture(),results=await Promise.all([actors[0]!.rpc("start_live_tour",room(listingId)),actors[0]!.rpc("start_live_tour",room(listingId))]);expect(results.every(result=>result.error===null)).toBe(true);expect(new Set(results.map(result=>result.data?.[0]?.tour_id)).size).toBe(1);expect(await rows(listingId)).toHaveLength(1);
  });
  it("enforces schedule validation and permits scheduled start, cancellation and ended states",async()=>{
    const listingId=await fixture(),id=await schedule(listingId);expect((await actors[0]!.rpc("start_scheduled_live_tour",{target_tour_id:id})).data?.[0]?.result).toBe("started");expect((await actors[0]!.rpc("end_live_tour",{target_tour_id:id})).data?.[0]?.result).toBe("ended");
    const cancelled=await schedule(await fixture());expect((await actors[0]!.rpc("cancel_scheduled_live_tour",{target_tour_id:cancelled})).data?.[0]?.result).toBe("cancelled");expect((await actors[0]!.rpc("start_scheduled_live_tour",{target_tour_id:cancelled})).data?.[0]?.result).toBe("invalid_state");
    const invalid=await actors[0]!.rpc("schedule_live_tour",{...room(await fixture()),target_scheduled_at:new Date(Date.now()+60000).toISOString(),target_duration_minutes:30});expect(denied(invalid,["scheduled"])).toBe(true);
  });
  it("honors disabled scheduling for new starts while retaining cancellation",async()=>{
    const first=await schedule(await fixture()),second=await schedule(await fixture());await flags(true,false);
    try{expect.soft(denied(await actors[0]!.rpc("start_scheduled_live_tour",{target_tour_id:first}),["started"])).toBe(true);expect.soft((await row(first)).status).toBe("scheduled");expect((await actors[0]!.rpc("cancel_scheduled_live_tour",{target_tour_id:second})).data?.[0]?.result).toBe("cancelled");const outcome=await actors[0]!.rpc("schedule_live_tour",{...room(await fixture()),target_scheduled_at:new Date(Date.now()+3600000).toISOString(),target_duration_minutes:30});expect(denied(outcome,["scheduled"])).toBe(true);}finally{await flags();}
  });
  it("denies revoked lifecycle writes and private consent reads then restores a fresh session",async()=>{
    const id=await start(await fixture());await consent(id,0);await consent(id,1);const other=await fixture();await revoke(0);
    try{expect.soft(denied(await actors[0]!.rpc("start_live_tour",room(other)),["started","already_live"])).toBe(true);expect.soft(denied(await actors[0]!.rpc("end_live_tour",{target_tour_id:id}),["ended","noop"])).toBe(true);expect.soft((await row(id)).status).toBe("live");expect.soft((await actors[0]!.from("live_tour_recording_consents").select("user_id").eq("tour_id",id)).data??[]).toEqual([]);}finally{await signIn(0);}
    const fresh=await start(await fixture());expect((await row(fresh)).status).toBe("live");
  });
  it("denies suspended owners and restricted listings at the raw start boundary",async()=>{
    const listingId=await fixture(),suspension=randomUUID();expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:accounts[0]!.id,reason:"Contained tour QA"})).error).toBeNull();
    try{expect.soft(denied(await actors[0]!.rpc("start_live_tour",room(listingId)),["started"])).toBe(true);expect.soft(await rows(listingId)).toHaveLength(0);}finally{expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}
    const restricted=await fixture(),restriction=randomUUID();expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:restricted,reason:"Contained tour QA"})).error).toBeNull();try{expect.soft(denied(await actors[0]!.rpc("start_live_tour",room(restricted)),["started"])).toBe(true);expect.soft(await rows(restricted)).toHaveLength(0);}finally{expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();}
  });
  it("retains raw mutation denial and participant-only consent visibility",async()=>{
    const id=await start(await fixture());await consent(id,0);await consent(id,1);expect((await actors[2]!.from("live_tour_recording_consents").select("user_id").eq("tour_id",id)).data??[]).toEqual([]);expect((await actors[1]!.from("live_tour_recording_consents").update({granted:false,revoked_at:new Date().toISOString()}).eq("tour_id",id)).error).not.toBeNull();expect((await actors[0]!.from("live_tours").update({status:"ended",ended_at:new Date().toISOString()}).eq("id",id)).error).not.toBeNull();
  });
  it("keeps recording disabled and forbids a recording link without a recorded consented session",async()=>{
    const id=await start(await fixture());await flags(false,true);try{expect(denied(await actors[0]!.rpc("start_live_tour_recording",{target_tour_id:id,target_participant_ids:[accounts[1]!.id]}),["recording"])).toBe(true);expect.soft(denied(await actors[0]!.rpc("set_live_tour_recording_link",{target_tour_id:id,target_recording_url:"https://fixture.invalid/unconsented.mp4"}),["saved"])).toBe(true);expect.soft((await row(id)).recording_url).toBeNull();}finally{await flags();}
  });
  it("requires both consents, records legal state transitions and restricts recording mutation to the host",async()=>{
    const id=await start(await fixture());const missing=await actors[0]!.rpc("start_live_tour_recording",{target_tour_id:id,target_participant_ids:[accounts[1]!.id]});expect(missing.data?.[0]).toMatchObject({result:"consent_required",missing_consents:2});await record(id);
    expect(denied(await actors[2]!.rpc("finish_live_tour_recording",{target_tour_id:id,target_result:"stopped"}),["stopped"])).toBe(true);expect((await actors[0]!.rpc("finish_live_tour_recording",{target_tour_id:id,target_result:"stopped"})).data?.[0]?.result).toBe("stopped");expect((await row(id)).recording_retention_expires_at).toBeTruthy();expect((await actors[0]!.rpc("set_live_tour_recording_link",{target_tour_id:id,target_recording_url:"https://fixture.invalid/consented.mp4"})).data?.[0]?.result).toBe("saved");
  });
  it("stops the recording state immediately when a participant withdraws consent",async()=>{
    const id=await start(await fixture());await record(id);await consent(id,1,false);expect.soft((await row(id)).recording_status).not.toBe("recording");const retry=await actors[0]!.rpc("start_live_tour_recording",{target_tour_id:id,target_participant_ids:[accounts[1]!.id]});expect(retry.error).toBeNull();expect(retry.data?.[0]?.result).toBe("consent_required");
  });
  it("recovers committed live-start response loss with the same room and one saved-home alert",async()=>{
    const listingId=await fixture(true);state.actor=actors[0]!;await loseRpc("/rest/v1/rpc/start_live_tour",()=>startLiveTour(listingId));const first=(await rows(listingId))[0]!;const retry=await startLiveTour(listingId);expect.soft(retry.success,JSON.stringify(retry)).toBe(true);if(retry.success)expect(retry.data.tour.id).toBe(first.id);expect(await rows(listingId)).toHaveLength(1);expect.soft(await events(first.id,"live_tour_started")).toHaveLength(1);
  });
  it("recovers a committed scheduled response rather than creating another tour or losing its alert",async()=>{
    const listingId=await fixture(true),input={listingId,scheduledAt:new Date(Date.now()+3600000).toISOString(),durationMinutes:30};state.actor=actors[0]!;await loseRpc("/rest/v1/rpc/schedule_live_tour",()=>scheduleLiveTour(input));const first=(await rows(listingId))[0]!;const retry=await scheduleLiveTour(input);expect.soft(retry.success,JSON.stringify(retry)).toBe(true);if(retry.success)expect(retry.data.tour.id).toBe(first.id);expect.soft(await rows(listingId)).toHaveLength(1);expect.soft(await events(first.id,"live_tour_scheduled")).toHaveLength(1);
  });
  it("suppresses stale and cancelled reminders without marking an unavailable tour delivered",async()=>{
    const id=await schedule(await fixture(true)),past=new Date(Date.now()-24*3600000).toISOString();expect((await state.admin!.from("live_tours").update({scheduled_at:past}).eq("id",id)).error).toBeNull();const canonical=await row(id);const outcome=await processScheduledTourReminder(id,canonical.scheduled_at!,tag);expect.soft(outcome).toMatchObject({success:true,skipped:true});expect.soft(await events(id,"live_tour_reminder")).toHaveLength(0);expect.soft((await row(id)).reminder_sent_at).toBeNull();
    const cancelled=await schedule(await fixture(true));expect((await actors[0]!.rpc("cancel_scheduled_live_tour",{target_tour_id:cancelled})).error).toBeNull();expect(await processScheduledTourReminder(cancelled,(await row(cancelled)).scheduled_at!,tag)).toMatchObject({success:true,skipped:true});
  });
  it("keeps a due reminder retryable when event persistence fails",async()=>{
    const id=await schedule(await fixture(true)),tour=await row(id),saved=globalThis.fetch;let failed=0;try{globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if((url.pathname==="/rest/v1/notification_events"||url.pathname==="/rest/v1/rpc/record_scheduled_live_tour_notifications")&&((init?.method??(input instanceof Request?input.method:"GET")).toUpperCase()==="POST")){failed++;return new Response(JSON.stringify({code:"42501",message:"Contained event persistence denial"}),{status:403,headers:{"content-type":"application/json"}});}return saved(input,init);};const result=await processScheduledTourReminder(id,tour.scheduled_at!,tag);expect(failed).toBeGreaterThan(0);expect.soft(result.success).toBe(false);expect.soft((await row(id)).reminder_sent_at).toBeNull();}finally{globalThis.fetch=saved;}
  });
  it("suppresses a reminder cancelled while its audience is being read",async()=>{
    const id=await schedule(await fixture(true)),tour=await row(id),saved=globalThis.fetch;let cancelled=false;
    try{globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!cancelled&&url.pathname==="/rest/v1/user_favorites"){cancelled=true;expect((await actors[0]!.rpc("cancel_scheduled_live_tour",{target_tour_id:id})).error).toBeNull();}return saved(input,init);};
      const outcome=await processScheduledTourReminder(id,tour.scheduled_at!,tag);expect(cancelled).toBe(true);expect.soft(outcome.success).toBe(true);expect.soft(await events(id,"live_tour_reminder")).toHaveLength(0);expect.soft((await row(id)).reminder_sent_at).toBeNull();
    }finally{globalThis.fetch=saved;}
  });
  it("suppresses scheduled reminders for a restricted listing",async()=>{
    const listingId=await fixture(true),id=await schedule(listingId),tour=await row(id),restriction=randomUUID();expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:listingId,reason:"Contained reminder restriction QA"})).error).toBeNull();
    try{expect.soft((await processScheduledTourReminder(id,tour.scheduled_at!,tag)).success).toBe(true);expect.soft(await events(id,"live_tour_reminder")).toHaveLength(0);expect.soft((await row(id)).reminder_sent_at).toBeNull();}finally{expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();}
  });
  it("runs read-only database advisors on the labelled tour clone",async()=>{
    const prefix=cfg.runtimeCase==="live-tour-pip-browser"?"user-flow-live-tour-pip":"user-flow-live-tour";
    expect((await runCloneAdvisors(cfg,`${cfg.sourceRoot}/artifacts/${prefix}-advisors.json`)).passed).toBe(true);
  });
  it("keeps an unreadable reminder audience retryable without a partial alert",async()=>{
    const id=await schedule(await fixture(true)),tour=await row(id),saved=globalThis.fetch;
    try{globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(url.pathname==="/rest/v1/user_favorites")return new Response(JSON.stringify({code:"42501",message:"Contained audience denial"}),{status:403,headers:{"content-type":"application/json"}});return saved(input,init);};
      expect((await processScheduledTourReminder(id,tour.scheduled_at!,tag)).success).toBe(false);expect(await events(id,"live_tour_reminder")).toHaveLength(0);expect((await row(id)).reminder_sent_at).toBeNull();
    }finally{globalThis.fetch=saved;}
  });
  it("persists service-created scheduled alerts and completes one ordinary due reminder without duplicates",async()=>{
    const id=await schedule(await fixture(true)),tour=await row(id);
    const created=await state.admin!.rpc("record_scheduled_live_tour_notifications",{target_tour_id:id,target_scheduled_at:tour.scheduled_at!,target_kind:"live_tour_scheduled",target_recipient_ids:[accounts[1]!.id],target_message:"Contained scheduled alert"});expect(created.error).toBeNull();expect(created.data?.[0]?.result).toBe("recorded");expect(created.data?.[0]?.event_ids).toHaveLength(1);
    expect(await processScheduledTourReminder(id,tour.scheduled_at!,tag)).toMatchObject({success:true,skipped:false});expect(await events(id,"live_tour_reminder")).toHaveLength(1);expect((await row(id)).reminder_sent_at).not.toBeNull();expect(await processScheduledTourReminder(id,tour.scheduled_at!,tag)).toMatchObject({success:true,skipped:true});expect(await events(id,"live_tour_reminder")).toHaveLength(1);
  });
  it("does not report a scheduled or cancelled tour as ended",async()=>{
    const id=await schedule(await fixture());state.actor=actors[0]!;expect((await endLiveTour(id,0)).success).toBe(false);expect((await row(id)).status).toBe("scheduled");await actors[0]!.rpc("cancel_scheduled_live_tour",{target_tour_id:id});expect((await endLiveTour(id,0)).success).toBe(false);expect((await row(id)).status).toBe("cancelled");
  });
  it("does not bypass the saved-home six-hour throttle when history cannot be read",async()=>{
    const listingId=await fixture(true);state.actor=actors[0]!;const first=await startLiveTour(listingId);expect(first.success).toBe(true);if(!first.success)return;expect(await events(first.data.tour.id,"live_tour_started")).toHaveLength(1);await actors[0]!.rpc("end_live_tour",{target_tour_id:first.data.tour.id});const saved=globalThis.fetch;
    try{globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);const method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();if(url.pathname==="/rest/v1/notification_events"&&method==="GET")return new Response(JSON.stringify({code:"42501",message:"Contained history denial"}),{status:403,headers:{"content-type":"application/json"}});return saved(input,init);};expect((await startLiveTour(listingId)).success).toBe(true);}finally{globalThis.fetch=saved;}
    const second=(await rows(listingId)).find(tour=>tour.status==="live")!;expect(await events(second.id,"live_tour_started")).toHaveLength(0);expect((await startLiveTour(listingId)).success).toBe(true);expect(await events(second.id,"live_tour_started")).toHaveLength(0);
  });
  it("limits scheduled notification persistence to the service role and hides private participant snapshots",async()=>{
    const signature="record_scheduled_live_tour_notifications(uuid,timestamp with time zone,text,uuid[],text)";
    expect(sql(`select not prosecdef and not has_function_privilege('authenticated','public.${signature}','EXECUTE') and not has_function_privilege('anon','public.${signature}','EXECUTE') and has_function_privilege('service_role','public.${signature}','EXECUTE') from pg_proc where oid='public.${signature}'::regprocedure`)).toBe("t");
    expect(sql("select relrowsecurity and relforcerowsecurity and not has_table_privilege('authenticated',oid,'SELECT') and not has_table_privilege('anon',oid,'SELECT') and not has_table_privilege('service_role',oid,'SELECT') from pg_class where oid='private.live_tour_recording_participants'::regclass")).toBe("t");
  });
  it("keeps private presence authorization bound to a live session",async()=>{
    const id=await start(await fixture()),session=(await actors[1]!.auth.getSession()).data.session!,claims=JSON.parse(Buffer.from(session.access_token.split(".")[1]!,"base64url").toString());
    const check=()=>sql(`begin read only;set local role authenticated;set local request.jwt.claims='${JSON.stringify(claims).replaceAll("'","''")}';select private.can_access_live_tour_presence('presence:tour:${id}');rollback;`);
    expect(check()).toBe("t");await revoke(1);try{expect(check()).toBe("f");}finally{await signIn(1);}
  });
  it("keeps mutation wrappers unprivileged and caller-derived session helpers non-spoofable",async()=>{
    const signatures=["start_live_tour(uuid,uuid,text,text)","schedule_live_tour(uuid,uuid,text,text,timestamp with time zone,integer)","start_scheduled_live_tour(uuid)","cancel_scheduled_live_tour(uuid)","end_live_tour(uuid,integer)","set_live_tour_recording_consent(uuid,boolean,text)","start_live_tour_recording(uuid,uuid[])","finish_live_tour_recording(uuid,text,text)","set_live_tour_recording_link(uuid,text,text)"];
    for(const signature of signatures){expect(sql(`select not prosecdef from pg_proc where oid='public.${signature}'::regprocedure`)).toBe("t");expect(sql(`select prosecdef from pg_proc where oid='private.${signature}'::regprocedure`)).toBe("t");expect(sql(`select not has_function_privilege('anon','public.${signature}','EXECUTE') and not has_function_privilege('service_role','public.${signature}','EXECUTE')`)).toBe("t");}
    expect(sql("select pronargs=0 and not has_function_privilege('anon','public.live_tour_session_access()','EXECUTE') from pg_proc where oid='public.live_tour_session_access()'::regprocedure")).toBe("t");
  });
  it("does not let an unrelated consenting account stop a recording by withdrawing",async()=>{
    const id=await start(await fixture());await record(id);await consent(id,2,true);await consent(id,2,false);expect((await row(id)).recording_status).toBe("recording");
  });
  it("recovers recording start and stop retries without resetting the established timestamps",async()=>{
    const id=await start(await fixture());await record(id);const before=await row(id);const retry=await actors[0]!.rpc("start_live_tour_recording",{target_tour_id:id,target_participant_ids:[accounts[1]!.id]});expect(retry.error).toBeNull();expect((await row(id)).recording_started_at).toBe(before.recording_started_at);
    expect((await actors[0]!.rpc("finish_live_tour_recording",{target_tour_id:id,target_result:"stopped"})).data?.[0]?.result).toBe("stopped");const stopped=await row(id);const again=await actors[0]!.rpc("finish_live_tour_recording",{target_tour_id:id,target_result:"stopped"});expect(again.error).toBeNull();expect(again.data?.[0]?.result).toBe("stopped");expect((await row(id)).recording_ended_at).toBe(stopped.recording_ended_at);
  });
  it("rejects unrecognized recording policy versions",async()=>{
    const id=await start(await fixture());const invalid=await actors[1]!.rpc("set_live_tour_recording_consent",{target_tour_id:id,target_granted:true,target_policy_version:"unrecognized-policy"});expect(denied(invalid,["updated"])).toBe(true);
  });
  it("binds a newly consented recording participant and honors their later withdrawal",async()=>{
    const id=await start(await fixture());await record(id);const before=await row(id);await consent(id,2,true);
    const joined=await actors[0]!.rpc("start_live_tour_recording",{target_tour_id:id,target_participant_ids:[accounts[1]!.id,accounts[2]!.id]});expect(joined.error).toBeNull();expect(joined.data?.[0]?.result).toBe("recording");expect((await row(id)).recording_started_at).toBe(before.recording_started_at);await consent(id,2,false);expect((await row(id)).recording_status).toBe("stopped");
  });
  it("removes viewer room access when the listing is restricted or its host is suspended",async()=>{
    const listingId=await fixture(),id=await start(listingId),restriction=randomUUID(),suspension=randomUUID();expect((await actors[1]!.from("live_tours").select("id").eq("id",id)).data).toHaveLength(1);const guest=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:listingId,reason:"Contained viewer access QA"})).error).toBeNull();try{expect.soft((await actors[1]!.from("live_tours").select("id").eq("id",id)).data??[]).toEqual([]);expect((await actors[0]!.from("live_tours").select("id").eq("id",id)).data).toHaveLength(1);}finally{expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();}
    expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:accounts[0]!.id,reason:"Contained viewer access QA"})).error).toBeNull();try{expect.soft((await actors[1]!.from("live_tours").select("id").eq("id",id)).data??[]).toEqual([]);expect.soft((await guest.rpc("get_active_public_live_tour",{target_listing_id:listingId})).data??[]).toEqual([]);}finally{expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}
  });

  it("returns only a final status and listing link while keeping viewer tour history private",async()=>{
    const listingId=await fixture(),id=await start(listingId);expect((await actors[0]!.rpc("end_live_tour",{target_tour_id:id})).error).toBeNull();expect((await actors[1]!.from("live_tours").select("*").eq("id",id)).data).toEqual([]);
    const ended=await actors[1]!.rpc("get_live_tour_terminal_state",{target_tour_id:id});expect(ended.error).toBeNull();expect(ended.data).toEqual([{status:"ended",listing_id:listingId}]);
    const nextListing=await fixture(),cancelledId=await schedule(nextListing);await actors[0]!.rpc("cancel_scheduled_live_tour",{target_tour_id:cancelledId});expect((await actors[1]!.rpc("get_live_tour_terminal_state",{target_tour_id:cancelledId})).data).toEqual([{status:"cancelled",listing_id:nextListing}]);
    expect(sql("select not prosecdef and pronargs=1 and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('service_role',oid,'EXECUTE') from pg_proc where oid='public.get_live_tour_terminal_state(uuid)'::regprocedure")).toBe("t");
  });
  it("keeps final-state links unavailable after restriction or session revocation",async()=>{
    const listingId=await fixture(),id=await start(listingId),restriction=randomUUID();await actors[0]!.rpc("end_live_tour",{target_tour_id:id});expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:listingId,reason:"Contained final state QA"})).error).toBeNull();
    try{expect((await actors[1]!.rpc("get_live_tour_terminal_state",{target_tour_id:id})).data).toEqual([]);}finally{expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();}
    await revoke(1);try{expect((await actors[1]!.rpc("get_live_tour_terminal_state",{target_tour_id:id})).data).toEqual([]);}finally{await signIn(1);}expect((await actors[1]!.rpc("get_live_tour_terminal_state",{target_tour_id:id})).data).toHaveLength(1);
  });
  it.skipIf(!cfg?.browserScript)("browser journey uses real clone tour accounts",async()=>{
    const listingId=await fixture(true);
    execFileSync(process.execPath,["C:/Users/BB/.agents/skills/playwright/run.js",cfg.browserScript],{
      cwd:cfg.sourceRoot,env:{...process.env,PINPOINT_MESSAGING_BROWSER_CONFIG:JSON.stringify({...cfg,accounts,password,listingId,listingTitle:tag})},stdio:"inherit",windowsHide:true,
    });
  },600000);
});
