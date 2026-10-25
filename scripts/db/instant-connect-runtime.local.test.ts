/** Opt-in Instant Connect checks: real clone Auth/REST/RPCs, never a hosted account or device. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state=vi.hoisted(()=>({actor:null as SupabaseClient|null,admin:null as SupabaseClient|null}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>state.actor}));
vi.mock("@/lib/supabase/admin",()=>({createClient:()=>state.admin,createUntypedClient:()=>state.admin}));
vi.mock("@/lib/logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { requestShowing,acceptShowing,declineShowing,checkInShowing,completeShowing,cancelShowing,getCurrentShowing,getLandlordShowingState } from "@/features/showings/actions";
import type { ShowingWindow } from "@/features/showings/showing-status";
import { runCloneAdvisors } from "./clone-advisors.local.mjs";

const cfg=process.env.PINPOINT_MESSAGING_RUNTIME?JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME):null;
const run=cfg?describe:describe.skip,originalFetch=globalThis.fetch;
const tag=`contained-instant-${randomUUID()}`,password=`Fixture-${randomUUID()}aA1!`;
const accounts:Array<{id:string;email:string}>=[],actors:SupabaseClient[]=[],listings:string[]=[];
function sql(query:string){
  assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec=JSON.parse(execFileSync("docker",["inspect",cfg.dbName],{encoding:"utf8"}))[0];
  assert.equal(spec.Config.Labels["pinpoint.release.run"],cfg.dbName.slice(0,-3));
  try{return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}
  catch{throw new Error("Guarded Instant Connect fixture SQL failed; connection arguments withheld");}
}
async function actor(index:number){state.actor=actors[index]!;}
async function signIn(index:number){expect((await actors[index]!.auth.signInWithPassword({email:accounts[index]!.email,password})).error).toBeNull();}
async function revoke(index:number){const token=(await actors[index]!.auth.getSession()).data.session!.access_token;expect((await state.admin!.auth.admin.signOut(token,"global")).error).toBeNull();}
async function fixture(){
  const id=randomUUID();listings.push(id);
  const created=await state.admin!.from("listings").insert({id,landlord_id:accounts[0]!.id,title:tag,address:"Synthetic Instant Connect fixture",price:2500,listing_type:"rent",status:"draft",metadata:{publicContact:{email:accounts[0]!.email},contactConsent:true}}).select("updated_at").single();expect(created.error).toBeNull();
  for(let n=0;n<3;n++)expect((await state.admin!.from("listing_images").insert({listing_id:id,bucket:"listing-images",path:`${accounts[0]!.id}/${id}/${n}.png`,public_url:"http://localhost:3112/icon.png",sort_order:n})).error).toBeNull();
  const claims=await actors[0]!.auth.getClaims();expect(claims.error).toBeNull();
  expect((await state.admin!.rpc("pinpoint_property_lifecycle",{actor_id:accounts[0]!.id,actor_session_id:String(claims.data!.claims.session_id),target:id,expected_updated_at:created.data!.updated_at,command:"publish"})).error).toBeNull();
  return id;
}
async function rows(listingId:string){const result=await state.admin!.from("showing_requests").select("*").eq("listing_id",listingId);expect(result.error).toBeNull();return result.data!;}
async function alerts(listingId:string,type:string){const result=await state.admin!.from("notification_events").select("id,recipient_id,type").eq("type",type).contains("payload",{listingId});expect(result.error).toBeNull();return result.data!;}
async function requested(listingId:string,window:ShowingWindow="now"){
  await actor(1);const result=await requestShowing({listingId,window});expect(result.success,JSON.stringify(result)).toBe(true);if(!result.success)throw Error(result.error);return result.data.request;
}
async function loseRpcResponse(pathname:string,work:()=>Promise<{success:boolean}>){
  const contained=globalThis.fetch;let lost=false;
  try{
    globalThis.fetch=async(input,init)=>{const response=await contained(input,init);const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!lost&&url.pathname===pathname&&response.ok){lost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed showing response loss"}),{status:503,headers:{"content-type":"application/json"}});}return response;};
    expect((await work()).success).toBe(false);expect(lost).toBe(true);
  }finally{globalThis.fetch=contained;}
}

run("Contained Instant Connect",()=>{
  beforeAll(async()=>{
    assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431");
    for(const key of ["QSTASH_TOKEN","RESEND_API_KEY","VAPID_PRIVATE_KEY","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"])expect(process.env[key]).toBeUndefined();
    globalThis.fetch=(input,init)=>{assert.equal(new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).origin,cfg.supabaseUrl,"Blocked external delivery");return originalFetch(input,init);};
    state.admin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    for(let index=0;index<3;index++){
      const email=`${tag}-${index}@pinpoint.invalid`,created=await state.admin.auth.admin.createUser({email,password,email_confirm:true});expect(created.error).toBeNull();accounts.push({id:created.data.user!.id,email});
      actors.push(createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}));await signIn(index);
      sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${created.data.user!.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);
    }
    expect((await state.admin.from("profiles").update({availability_mode:"available",presence_status:"available",last_seen_at:new Date().toISOString()}).eq("id",accounts[0]!.id)).error).toBeNull();
  });
  afterAll(async()=>{
    globalThis.fetch=originalFetch;if(!state.admin)return;
    for(const client of actors)await client.auth.signOut();
    for(const account of accounts)expect((await state.admin.from("notification_events").delete().eq("recipient_id",account.id)).error).toBeNull();
    for(const id of listings){
      expect((await state.admin.from("conversations").delete().eq("listing_id",id)).error).toBeNull();
      expect((await state.admin.from("listings").delete().eq("id",id)).error).toBeNull();
    }
    for(const account of accounts)expect((await state.admin.auth.admin.deleteUser(account.id)).error).toBeNull();
  });
  it("persists all four urgency windows with one canonical concurrent request and owner alert",async()=>{
    for(const [window,minutes]of [["now",15],["within_15",15],["within_30",30],["today",720]] as const){
      const listingId=await fixture();await actor(1);
      const attempts=await Promise.all([requestShowing({listingId,window}),requestShowing({listingId,window})]);expect(attempts.some(result=>result.success)).toBe(true);
      const saved=await rows(listingId);expect(saved).toHaveLength(1);expect(saved[0]!.window_choice).toBe(window);
      expect((Date.parse(saved[0]!.expires_at)-Date.parse(saved[0]!.requested_at))/60000).toBeCloseTo(minutes,1);
      expect(await alerts(listingId,"showing_request")).toHaveLength(1);
    }
  });
  it("keeps roles, private reads, direct table writes and terminal states authoritative",async()=>{
    const listingId=await fixture(),request=await requested(listingId);
    const anon=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    expect((await anon.rpc("respond_showing",{target_request_id:request.id,action:"accept"})).error).not.toBeNull();
    expect((await actors[2]!.from("showing_requests").select("id").eq("id",request.id)).data??[]).toEqual([]);
    for(const action of ["accept","decline","check_in","complete","cancel"]){const outcome=await actors[2]!.rpc("respond_showing",{target_request_id:request.id,action});expect(outcome.error!==null||outcome.data?.[0]?.result==="access_denied").toBe(true);}
    expect((await actors[1]!.from("showing_requests").update({status:"completed"}).eq("id",request.id)).error).not.toBeNull();
    expect((await actors[1]!.from("showing_requests").insert({listing_id:listingId,renter_id:accounts[1]!.id,landlord_id:accounts[0]!.id,status:"accepted",window_choice:"now",expires_at:new Date(Date.now()+60000).toISOString()})).error).not.toBeNull();
    await actor(1);expect((await acceptShowing(request.id)).success).toBe(false);expect((await completeShowing(request.id)).success).toBe(false);
    await actor(0);expect((await acceptShowing(request.id)).success).toBe(true);expect((await checkInShowing(request.id)).success).toBe(false);
    await actor(1);expect((await checkInShowing(request.id)).success).toBe(true);expect((await completeShowing(request.id)).success).toBe(true);
    await actor(0);expect((await cancelShowing(request.id)).success).toBe(true);
    const saved=(await rows(listingId))[0]!;expect(saved.status).toBe("completed");expect(saved.responded_at).toBeTruthy();expect(saved.checked_in_at).toBeTruthy();expect(saved.completed_at).toBeTruthy();expect(saved.conversation_id).toBeTruthy();
  });
  it("recovers a committed request response with the same request and exactly one owner alert",async()=>{
    const listingId=await fixture();await actor(1);
    await loseRpcResponse("/rest/v1/rpc/request_showing",()=>requestShowing({listingId,window:"within_15"}));
    const before=await rows(listingId);expect(before).toHaveLength(1);
    const retry=await requestShowing({listingId,window:"within_15"});expect.soft(retry.success,JSON.stringify(retry)).toBe(true);
    if(retry.success)expect(retry.data.request.id).toBe(before[0]!.id);
    expect(await rows(listingId)).toHaveLength(1);expect.soft(await alerts(listingId,"showing_request")).toHaveLength(1);
  });
  it("recovers committed accept and decline responses and repairs their recipient alerts",async()=>{
    for(const decision of ["accept","decline"] as const){
      const listingId=await fixture(),request=await requested(listingId);await actor(0);
      const work=()=>decision==="accept"?acceptShowing(request.id):declineShowing(request.id);
      await loseRpcResponse("/rest/v1/rpc/respond_showing",work);
      const retry=await work();expect.soft(retry.success,JSON.stringify(retry)).toBe(true);
      const saved=await rows(listingId);expect(saved).toHaveLength(1);expect(saved[0]!.status).toBe(decision==="accept"?"accepted":"declined");
      const conversations=await state.admin!.from("conversations").select("id").eq("listing_id",listingId);expect(conversations.error).toBeNull();expect(conversations.data).toHaveLength(decision==="accept"?1:0);
      expect.soft(await alerts(listingId,decision==="accept"?"showing_accepted":"showing_declined")).toHaveLength(1);
    }
  });
  it("expires late accepts, executes the real sweep transactionally and frees a stale request for retry",async()=>{
    const listingId=await fixture(),request=await requested(listingId);expect((await state.admin!.from("showing_requests").update({expires_at:new Date(Date.now()-60000).toISOString()}).eq("id",request.id)).error).toBeNull();
    // Execute the actual privileged sweep inside a rollback so unrelated clone
    // presence rows are preserved. This is not hosted cron execution proof.
    sql(`begin;select public.sweep_stale_presence();do $$ begin if exists(select 1 from public.showing_requests where id='${request.id}' and status<>'expired') then raise exception 'Fixture was not expired by sweep';end if;end $$;rollback;`);
    expect(sql("select not has_function_privilege('authenticated','public.sweep_stale_presence()','EXECUTE')")).toBe("t");
    await actor(0);const late=await acceptShowing(request.id);expect(late.success).toBe(true);if(late.success)expect(late.data.status).toBe("expired");
    const other=await fixture(),stale=await requested(other);expect((await state.admin!.from("showing_requests").update({expires_at:new Date(Date.now()-60000).toISOString()}).eq("id",stale.id)).error).toBeNull();
    await actor(1);const fresh=await requestShowing({listingId:other,window:"now"});expect.soft(fresh.success,JSON.stringify(fresh)).toBe(true);
    const saved=await rows(other);expect.soft(saved.filter(row=>row.status==="expired")).toHaveLength(1);expect.soft(saved.filter(row=>row.status==="requested")).toHaveLength(1);
  });
  it("denies revoked participant reads, requests and responses then permits fresh-session recovery",async()=>{
    const listingId=await fixture(),request=await requested(listingId),other=await fixture();
    await revoke(1);
    try{
      const read=await actors[1]!.from("showing_requests").select("id").eq("id",request.id);expect.soft(read.data??[],"A revoked JWT must not expose a private showing").toEqual([]);
      const cancelled=await actors[1]!.rpc("respond_showing",{target_request_id:request.id,action:"cancel"});expect.soft(cancelled.error!==null||cancelled.data?.[0]?.result==="access_denied").toBe(true);
      const created=await actors[1]!.rpc("request_showing",{target_listing_id:other,window_choice:"now"});expect.soft(created.error!==null||created.data?.[0]?.result!=="requested").toBe(true);
      expect.soft((await rows(listingId))[0]!.status).toBe("requested");expect.soft(await rows(other)).toHaveLength(0);
    }finally{await signIn(1);}
    await revoke(0);
    try{const accepted=await actors[0]!.rpc("respond_showing",{target_request_id:request.id,action:"accept"});expect.soft(accepted.error!==null||accepted.data?.[0]?.result==="access_denied").toBe(true);expect.soft((await actors[0]!.from("showing_requests").select("id").eq("id",request.id)).data??[]).toEqual([]);}
    finally{await signIn(0);}
    const fresh=await fixture(),eligible=await requested(fresh);await actor(0);expect((await acceptShowing(eligible.id)).success).toBe(true);
  });
  it("denies suspended, restricted and blocked requests or accepts without mutating the request",async()=>{
    const suspension=randomUUID(),restriction=randomUUID();
    const suspended=await fixture();
    try{expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:accounts[1]!.id,reason:"Contained showing eligibility QA"})).error).toBeNull();await actor(1);expect.soft((await requestShowing({listingId:suspended,window:"now"})).success).toBe(false);expect.soft(await rows(suspended)).toHaveLength(0);}
    finally{expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();}
    const listingId=await fixture(),request=await requested(listingId);
    try{
      expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:listingId,reason:"Contained showing eligibility QA"})).error).toBeNull();await actor(0);expect.soft((await acceptShowing(request.id)).success).toBe(false);expect.soft((await rows(listingId))[0]!.status).toBe("requested");
    }finally{expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();}
    for(const blocker of [0,1]){
      const target=await fixture();
      try{expect((await state.admin!.from("profile_blocks").insert({blocker_id:accounts[blocker]!.id,blocked_id:accounts[blocker===0?1:0]!.id})).error).toBeNull();await actor(1);expect.soft((await requestShowing({listingId:target,window:"now"})).success,`Block direction ${blocker}`).toBe(false);expect.soft(await rows(target)).toHaveLength(0);}
      finally{expect((await state.admin!.from("profile_blocks").delete().eq("blocker_id",accounts[blocker]!.id).eq("blocked_id",accounts[blocker===0?1:0]!.id)).error).toBeNull();}
    }
  });
  it("enforces the unavailable-owner Right now boundary at the raw RPC",async()=>{
    const listingId=await fixture();
    try{
      expect((await state.admin!.from("profiles").update({availability_mode:"invisible",presence_status:"offline"}).eq("id",accounts[0]!.id)).error).toBeNull();
      const result=await actors[1]!.rpc("request_showing",{target_listing_id:listingId,window_choice:"now"});expect.soft(result.error!==null||result.data?.[0]?.result!=="requested").toBe(true);expect.soft(await rows(listingId)).toHaveLength(0);
    }finally{expect((await state.admin!.from("profiles").update({availability_mode:"available",presence_status:"available",last_seen_at:new Date().toISOString()}).eq("id",accounts[0]!.id)).error).toBeNull();}
  });
  it("serializes competing owner responses without duplicate conversations or recipient outcomes",async()=>{
    const listingId=await fixture(),request=await requested(listingId);await actor(0);
    const results=await Promise.all([acceptShowing(request.id),declineShowing(request.id)]);expect(results.some(result=>result.success)).toBe(true);
    const saved=(await rows(listingId))[0]!;expect(["accepted","declined"]).toContain(saved.status);
    const conversations=await state.admin!.from("conversations").select("id").eq("listing_id",listingId);expect(conversations.error).toBeNull();expect(conversations.data).toHaveLength(saved.status==="accepted"?1:0);
    const accepted=await alerts(listingId,"showing_accepted"),declined=await alerts(listingId,"showing_declined");expect(accepted.length+declined.length).toBe(1);expect(saved.status==="accepted"?accepted:declined).toHaveLength(1);
  });
  it("restores only the current user's request and distinguishes failed reads from an empty result",async()=>{
    const listingId=await fixture(),request=await requested(listingId);await actor(1);
    expect(await getCurrentShowing(listingId)).toMatchObject({success:true,data:{request:{id:request.id}}});
    const contained=globalThis.fetch;let denied=0;
    try{
      globalThis.fetch=async(input,init)=>{const response=await contained(input,init);const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(url.pathname==="/rest/v1/showing_requests"){await response.arrayBuffer();denied++;return new Response(JSON.stringify({code:"42501",message:"Contained showing read denial"}),{status:403,headers:{"content-type":"application/json"}});}return response;};
      const unavailable=await getCurrentShowing(listingId);expect(unavailable.success).toBe(false);expect(denied).toBeGreaterThan(0);
    }finally{globalThis.fetch=contained;}
    await actor(2);expect(await getCurrentShowing(listingId)).toEqual({success:true,data:{request:null}});
    await actor(0);expect(await getLandlordShowingState()).toMatchObject({success:true,data:{request:{id:request.id}}});
    expect((await state.admin!.from("showing_requests").update({expires_at:new Date(Date.now()-60000).toISOString()}).eq("id",request.id)).error).toBeNull();
    await actor(1);expect(await getCurrentShowing(listingId)).toEqual({success:true,data:{request:null}});
  });
  it("keeps public helpers scoped, mutation wrappers unprivileged and raw writes revoked",async()=>{
    expect(sql("select bool_and(not has_table_privilege(r,'public.showing_requests',p)) from unnest(array['anon','authenticated']) r cross join unnest(array['INSERT','UPDATE','DELETE']) p")).toBe("t");
    expect(sql("select bool_and(not prosecdef) from pg_proc where oid in ('public.request_showing(uuid,public.showing_window,integer)'::regprocedure,'public.respond_showing(uuid,text)'::regprocedure)")).toBe("t");
    expect(sql("select bool_and(prosecdef) from pg_proc where oid in ('private.request_showing(uuid,public.showing_window,integer)'::regprocedure,'private.respond_showing(uuid,text)'::regprocedure)")).toBe("t");
    expect(sql("select bool_and(o.option_value in ('','\"\"')) from pg_proc p cross join lateral pg_options_to_table(p.proconfig) o where p.oid in ('private.request_showing(uuid,public.showing_window,integer)'::regprocedure,'private.respond_showing(uuid,text)'::regprocedure) and o.option_name='search_path'")).toBe("t");
    expect(sql("select bool_and(not has_function_privilege(r,f,'EXECUTE')) from unnest(array['anon','service_role']) r cross join unnest(array['public.request_showing(uuid,public.showing_window,integer)','public.respond_showing(uuid,text)','private.request_showing(uuid,public.showing_window,integer)','private.respond_showing(uuid,text)']) f")).toBe("t");
    expect(sql("select not has_function_privilege('anon','public.showing_session_access()','EXECUTE') and pronargs=0 from pg_proc where oid='public.showing_session_access()'::regprocedure")).toBe("t");
    expect((await actors[1]!.schema("private").rpc("respond_showing",{target_request_id:randomUUID(),action:"accept"})).error).not.toBeNull();
  });
  it("persists all availability modes for the caller and keeps invisible heartbeats private",async()=>{
    const outsider=await state.admin!.from("profiles").select("availability_mode,presence_status,last_seen_at").eq("id",accounts[2]!.id).single();expect(outsider.error).toBeNull();
    try{
      for(const [mode,status]of [["available","available"],["busy","busy"],["auto","offline"],["invisible","offline"]] as const){
        const changed=await actors[0]!.rpc("set_availability_mode",{target_mode:mode});expect(changed.error).toBeNull();expect(changed.data?.[0]).toMatchObject({availability_mode:mode,presence_status:status});
      }
      expect((await actors[0]!.rpc("touch_presence",{desired:"available"})).data?.[0]?.presence_status).toBe("offline");
      expect((await actors[0]!.from("profiles").update({availability_mode:"available"}).eq("id",accounts[0]!.id)).error).not.toBeNull();
      const unchanged=await state.admin!.from("profiles").select("availability_mode,presence_status,last_seen_at").eq("id",accounts[2]!.id).single();expect(unchanged.error).toBeNull();expect(unchanged.data).toEqual(outsider.data);
      const anon=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
      expect((await anon.rpc("set_availability_mode",{target_mode:"available"})).error).not.toBeNull();expect((await anon.rpc("touch_presence",{desired:"available"})).error).not.toBeNull();
      expect(sql("select bool_and(not prosecdef) from pg_proc where oid in ('public.touch_presence(text)'::regprocedure,'public.set_availability_mode(text)'::regprocedure)")).toBe("t");
      expect(sql("select not has_column_privilege('authenticated','public.profiles','availability_mode','UPDATE')")).toBe("t");
    }finally{expect((await actors[0]!.rpc("set_availability_mode",{target_mode:"available"})).error).toBeNull();}
  });
  it("prevents revoked availability and heartbeat writes and recovers with a fresh session",async()=>{
    expect((await actors[0]!.rpc("set_availability_mode",{target_mode:"invisible"})).error).toBeNull();
    const before=await state.admin!.from("profiles").select("availability_mode,presence_status,last_seen_at").eq("id",accounts[0]!.id).single();expect(before.error).toBeNull();await revoke(0);
    try{
      const mode=await actors[0]!.rpc("set_availability_mode",{target_mode:"available"}),heartbeat=await actors[0]!.rpc("touch_presence",{desired:"busy"});
      expect.soft((await actors[0]!.from("profiles").update({availability_mode:"available"}).eq("id",accounts[0]!.id)).error).not.toBeNull();
      expect.soft(mode.error!==null||mode.data?.[0]?.result==="access_denied","Revoked mode mutation").toBe(true);
      expect.soft(heartbeat.error!==null||heartbeat.data?.[0]?.result==="access_denied","Revoked heartbeat mutation").toBe(true);
      const after=await state.admin!.from("profiles").select("availability_mode,presence_status,last_seen_at").eq("id",accounts[0]!.id).single();expect(after.error).toBeNull();expect.soft(after.data).toEqual(before.data);
    }finally{await signIn(0);expect((await actors[0]!.rpc("set_availability_mode",{target_mode:"available"})).error).toBeNull();}
  });
  it("runs read-only database advisors for the showing boundaries on the labelled clone",async()=>{
    const report=await runCloneAdvisors(cfg,`${cfg.sourceRoot}/artifacts/user-flow-instant-connect-advisors.json`);expect(report.passed).toBe(true);
  });
});
