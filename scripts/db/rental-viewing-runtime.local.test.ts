/** Opt-in real Auth/REST/SQL rental viewing checks. All writes stay in a labelled clone. */
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
vi.mock("@/lib/logger",()=>({logger:{error:vi.fn(),warn:vi.fn(),info:vi.fn(),debug:vi.fn()}}));
import { proposeViewingSlots } from "@/features/viewings/actions/propose-viewing-slots";
import { bookViewingSlot } from "@/features/viewings/actions/book-viewing-slot";
import { runCloneAdvisors } from "./clone-advisors.local.mjs";

const cfg=process.env.PINPOINT_MESSAGING_RUNTIME?JSON.parse(process.env.PINPOINT_MESSAGING_RUNTIME):null;
const run=cfg?describe:describe.skip,originalFetch=globalThis.fetch;
const accounts:Array<{id:string;email:string}>=[],actors:SupabaseClient[]=[],listings:string[]=[];
const tag=`contained-rental-viewing-${randomUUID()}`,password=`Fixture-${randomUUID()}aA1!`;
function sql(query:string){
  assert.match(cfg.dbName,/^pinpoint-release-[0-9a-f-]{36}-db$/);
  const spec=JSON.parse(execFileSync("docker",["inspect",cfg.dbName],{encoding:"utf8"}))[0];
  assert.equal(spec.Config.Labels["pinpoint.release.run"],cfg.dbName.slice(0,-3));
  try{return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();}
  catch{throw new Error("Guarded rental viewing fixture SQL failed; connection arguments withheld");}
}
async function actor(index:number){state.actor=actors[index]!;}
async function signIn(index:number){expect((await actors[index]!.auth.signInWithPassword({email:accounts[index]!.email,password})).error).toBeNull();}
async function revoke(index:number){
  const session=(await actors[index]!.auth.getSession()).data.session!;
  const claims=JSON.parse(Buffer.from(session.access_token.split(".")[1]!,"base64url").toString());
  expect((await state.admin!.auth.admin.signOut(session.access_token,"global")).error).toBeNull();
  const live=await state.admin!.rpc("pinpoint_active_session",{actor_id:accounts[index]!.id,actor_session_id:claims.session_id});
  expect(live.error).toBeNull();expect(live.data).toBe(false);
}
async function fixture(mode:"in_person"|"video_call"="in_person"){
  const listingId=randomUUID();listings.push(listingId);
  const row=await state.admin!.from("listings").insert({id:listingId,landlord_id:accounts[0]!.id,title:tag,address:"Synthetic rental viewing fixture",price:2500,listing_type:"rent",status:"draft",metadata:{publicContact:{email:accounts[0]!.email},contactConsent:true}}).select("updated_at").single();expect(row.error).toBeNull();
  for(let n=0;n<3;n++)expect((await state.admin!.from("listing_images").insert({listing_id:listingId,bucket:"listing-images",path:`${accounts[0]!.id}/${listingId}/${n}.png`,public_url:"http://localhost:3112/icon.png",sort_order:n})).error).toBeNull();
  const claims=await actors[0]!.auth.getClaims();expect(claims.error).toBeNull();
  expect((await state.admin!.rpc("pinpoint_property_lifecycle",{actor_id:accounts[0]!.id,actor_session_id:String(claims.data!.claims.session_id),target:listingId,expected_updated_at:row.data!.updated_at,command:"publish"})).error).toBeNull();
  const applicationIds=[randomUUID(),randomUUID()];
  for(const [index,id]of applicationIds.entries())expect((await state.admin!.from("applications").insert({id,listing_id:listingId,renter_id:accounts[index+1]!.id,status:"submitted",full_name:"Synthetic viewing applicant",income:10000,employment_status:"employed",move_in_date:"2026-11-01",household_size:1})).error).toBeNull();
  const start=new Date(Date.now()+48*3600000),end=new Date(start.getTime()+3600000);
  const payload={proposalId:randomUUID(),listingId,applicationIds:[applicationIds[0]!],mode,slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]};
  return{listingId,applicationIds,payload};
}
async function rows(listingId:string){
  const slots=await state.admin!.from("viewing_slots").select("id,start_time,end_time,is_booked,mode").eq("listing_id",listingId);expect(slots.error).toBeNull();
  const ids=slots.data!.map(row=>row.id);
  const offers=ids.length?await state.admin!.from("viewing_slot_offers").select("id,slot_id,application_id").in("slot_id",ids):{data:[],error:null};expect(offers.error).toBeNull();
  const booked=ids.length?await state.admin!.from("viewings").select("id,application_id,slot_id,status,meeting_room_id,meeting_join_url").in("slot_id",ids):{data:[],error:null};expect(booked.error).toBeNull();
  return{slots:slots.data!,offers:offers.data!,booked:booked.data!};
}
async function proposed(f:Awaited<ReturnType<typeof fixture>>,both=false){
  await actor(0);const payload={...f.payload,applicationIds:both?f.applicationIds:f.payload.applicationIds};
  const result=await proposeViewingSlots(payload);expect(result.success,JSON.stringify(result)).toBe(true);
  const saved=await rows(f.listingId);expect(saved.slots).toHaveLength(1);return saved.slots[0]!.id as string;
}

run("Contained rental viewing recovery",()=>{
  beforeAll(async()=>{
    assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431");
    for(const key of ["RESEND_API_KEY","QSTASH_TOKEN","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN"])expect(process.env[key]).toBeUndefined();
    globalThis.fetch=(input,init)=>{assert.equal(new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url).origin,cfg.supabaseUrl,"Blocked external delivery");return originalFetch(input,init);};
    state.admin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    for(let index=0;index<4;index++){
      const email=`${tag}-${index}@pinpoint.invalid`,created=await state.admin.auth.admin.createUser({email,password,email_confirm:true});expect(created.error).toBeNull();
      accounts.push({id:created.data.user!.id,email});actors.push(createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}}));await signIn(index);
      sql(`insert into public.policy_acceptances(user_id,document_id,version_id,source) select '${created.data.user!.id}',d.id,d.current_version_id,'settings' from public.trust_documents d where d.current_version_id is not null on conflict do nothing`);
    }
  });
  afterAll(async()=>{
    globalThis.fetch=originalFetch;if(!state.admin)return;
    for(const client of actors)await client.auth.signOut();
    for(const account of accounts)expect((await state.admin.from("notification_events").delete().eq("recipient_id",account.id)).error).toBeNull();
    for(const id of listings)expect((await state.admin.from("listings").delete().eq("id",id)).error).toBeNull();
    for(const account of accounts)expect((await state.admin.auth.admin.deleteUser(account.id)).error).toBeNull();
  });
  it("rolls back slots when invitation insertion fails",async()=>{
    const f=await fixture();await actor(0);
    sql(`create function public.qa_rental_offer_failure() returns trigger language plpgsql as $$ begin if new.application_id='${f.applicationIds[0]}' then raise exception 'Contained rental offer failure'; end if; return new; end; $$;create trigger qa_rental_offer_failure before insert on public.viewing_slot_offers for each row execute function public.qa_rental_offer_failure();`);
    try{expect((await proposeViewingSlots(f.payload)).success).toBe(false);const saved=await rows(f.listingId);expect.soft(saved.slots,"A failed proposal must not leave orphan slots").toHaveLength(0);expect(saved.offers).toHaveLength(0);}
    finally{sql("drop trigger qa_rental_offer_failure on public.viewing_slot_offers;drop function public.qa_rental_offer_failure();");}
  });
  it("retries a committed proposal after response loss without duplicate slots, offers or alerts",async()=>{
    const f=await fixture();await actor(0);const contained=globalThis.fetch;let lost=false;
    try{globalThis.fetch=async(input,init)=>{const response=await contained(input,init),url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!lost&&init?.method==="POST"&&["/rest/v1/viewing_slot_offers","/rest/v1/rpc/pinpoint_rental_viewing_propose"].includes(url.pathname)&&response.ok){lost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed proposal response loss"}),{status:503,headers:{"content-type":"application/json"}});}return response;};expect((await proposeViewingSlots(f.payload)).success).toBe(false);expect(lost).toBe(true);}
    finally{globalThis.fetch=contained;}
    const result=await proposeViewingSlots(f.payload);expect(result.success,JSON.stringify(result)).toBe(true);expect((await proposeViewingSlots(f.payload)).success).toBe(true);
    const saved=await rows(f.listingId);expect.soft(saved.slots).toHaveLength(1);expect.soft(saved.offers).toHaveLength(1);
    const alerts=await state.admin!.from("notification_events").select("id").eq("recipient_id",accounts[1]!.id).eq("type","viewing_proposed").contains("payload",{listingId:f.listingId});expect(alerts.error).toBeNull();expect.soft(alerts.data).toHaveLength(1);
  });
  it("retries a committed booking response and retains one video room and alert",async()=>{
    const f=await fixture("video_call"),slotId=await proposed(f);await actor(1);const contained=globalThis.fetch;let lost=false;
    try{globalThis.fetch=async(input,init)=>{const response=await contained(input,init),url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);if(!lost&&url.pathname==="/rest/v1/rpc/book_viewing_slot_atomic"&&response.ok){lost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed booking response loss"}),{status:503,headers:{"content-type":"application/json"}});}return response;};expect((await bookViewingSlot({slotId,applicationId:f.applicationIds[0]!})).success).toBe(false);expect(lost).toBe(true);}
    finally{globalThis.fetch=contained;}
    const retried=await bookViewingSlot({slotId,applicationId:f.applicationIds[0]!});expect.soft(retried.success,JSON.stringify(retried)).toBe(true);
    const saved=await rows(f.listingId);expect(saved.booked).toHaveLength(1);expect.soft(retried.success&&retried.data).toBe(saved.booked[0]!.id);expect(saved.booked[0]!.meeting_room_id).toBeTruthy();expect(saved.booked[0]!.meeting_join_url).toContain("https://meet.jit.si/");
    const alerts=await state.admin!.from("notification_events").select("id").eq("idempotency_key",`viewing_booked:${saved.booked[0]!.id}`);expect(alerts.error).toBeNull();expect.soft(alerts.data).toHaveLength(1);
  });
  it("denies expired slots and withdrawn applications",async()=>{
    for(const kind of ["expired","withdrawn"]){const f=await fixture(),slotId=await proposed(f);if(kind==="expired")expect((await state.admin!.from("viewing_slots").update({start_time:new Date(Date.now()-7200000).toISOString(),end_time:new Date(Date.now()-3600000).toISOString()}).eq("id",slotId)).error).toBeNull();else expect((await state.admin!.from("applications").update({status:"withdrawn"}).eq("id",f.applicationIds[0]!)).error).toBeNull();await actor(1);expect.soft((await bookViewingSlot({slotId,applicationId:f.applicationIds[0]!})).success,kind).toBe(false);expect.soft((await rows(f.listingId)).booked,kind).toHaveLength(0);}
  });
  it("denies a revoked renter token at the raw booking RPC and permits a fresh session",async()=>{
    const f=await fixture(),slotId=await proposed(f);await revoke(1);try{const raw=await actors[1]!.rpc("book_viewing_slot_atomic",{target_slot_id:slotId,target_application_id:f.applicationIds[0]});expect.soft(raw.error,"A JWT whose Auth session was removed must not book").not.toBeNull();expect.soft((await rows(f.listingId)).booked).toHaveLength(0);}finally{await signIn(1);}
    await actor(1);expect.soft((await bookViewingSlot({slotId,applicationId:f.applicationIds[0]!})).success).toBe(true);
  });
  it("allows one concurrent invited booking and denies an uninvited account",async()=>{
    const f=await fixture(),slotId=await proposed(f,true);
    const outsider=await actors[3]!.rpc("book_viewing_slot_atomic",{target_slot_id:slotId,target_application_id:f.applicationIds[0]});expect(outsider.error).not.toBeNull();
    const attempts=await Promise.all([actors[1]!.rpc("book_viewing_slot_atomic",{target_slot_id:slotId,target_application_id:f.applicationIds[0]}),actors[2]!.rpc("book_viewing_slot_atomic",{target_slot_id:slotId,target_application_id:f.applicationIds[1]})]);expect(attempts.filter(result=>!result.error)).toHaveLength(1);const saved=await rows(f.listingId);expect(saved.booked).toHaveLength(1);expect(saved.booked[0]!.meeting_room_id).toBeNull();expect(saved.booked[0]!.meeting_join_url).toBeNull();
  });
  it("prevents an invited renter from changing the proposed time or forging a direct booking",async()=>{
    const f=await fixture(),slotId=await proposed(f),before=(await rows(f.listingId)).slots[0]!;
    const changed=await actors[1]!.from("viewing_slots").update({start_time:new Date(Date.now()+96*3600000).toISOString(),end_time:new Date(Date.now()+97*3600000).toISOString()}).eq("id",slotId).select("id");expect.soft(changed.data??[]).toEqual([]);expect.soft((await rows(f.listingId)).slots[0]!.start_time).toBe(before.start_time);
    const forged=await actors[1]!.from("viewings").insert({id:randomUUID(),slot_id:slotId,application_id:f.applicationIds[0],status:"booked"});expect.soft(forged.error).not.toBeNull();expect.soft((await rows(f.listingId)).booked).toHaveLength(0);
    const locked=await actors[1]!.from("viewing_slots").update({is_booked:true}).eq("id",slotId).select("id");expect(locked.error).not.toBeNull();expect((await rows(f.listingId)).slots[0]!.is_booked).toBe(false);
  });
  it("binds receipt retries to the actor and payload and rejects a revoked owner",async()=>{
    const f=await fixture();await proposed(f);await actor(3);
    expect((await proposeViewingSlots(f.payload)).success).toBe(false);await actor(0);
    const changed={...f.payload,mode:"video_call" as const};expect((await proposeViewingSlots(changed)).success).toBe(false);
    expect((await proposeViewingSlots({...f.payload,proposalId:randomUUID()})).success).toBe(true);
    expect((await rows(f.listingId)).slots).toHaveLength(1);expect((await rows(f.listingId)).offers).toHaveLength(1);
    await revoke(0);try{
      try{expect((await proposeViewingSlots(f.payload)).success).toBe(false);}
      catch(error){if(!(error instanceof Error)||!error.message.includes("NEXT_REDIRECT"))throw error;}
      expect((await rows(f.listingId)).slots).toHaveLength(1);
    }finally{await signIn(0);}
    expect((await proposeViewingSlots(f.payload)).success).toBe(true);
  });
  it("enforces the private helper, service-only proposal and read-only ordinary table contracts",async()=>{
    expect(sql("select bool_and(not has_table_privilege(r,t,p)) from unnest(array['anon','authenticated']) r cross join unnest(array['public.viewing_slots','public.viewing_slot_offers','public.viewings']) t cross join unnest(array['INSERT','UPDATE','DELETE']) p")).toBe("t");
    expect(sql("select has_function_privilege('authenticated','public.book_viewing_slot_atomic(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','public.book_viewing_slot_atomic(uuid,uuid)','EXECUTE')")).toBe("t");
    expect(sql("select not prosecdef from pg_proc where oid='public.book_viewing_slot_atomic(uuid,uuid)'::regprocedure")).toBe("t");
    expect(sql("select prosecdef from pg_proc where oid='private.book_rental_viewing_slot(uuid,uuid)'::regprocedure")).toBe("t");
    expect(sql("select o.option_value in ('','\"\"') from pg_proc p cross join lateral pg_options_to_table(p.proconfig) o where p.oid='private.book_rental_viewing_slot(uuid,uuid)'::regprocedure and o.option_name='search_path'")).toBe("t");
    expect(sql("select not has_function_privilege('anon','private.book_rental_viewing_slot(uuid,uuid)','EXECUTE') and not has_function_privilege('authenticated','private.rental_viewing_account_eligible(uuid,uuid)','EXECUTE')")).toBe("t");
    expect(sql("select has_function_privilege('authenticated','public.book_buyer_viewing_slot_atomic(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','public.book_buyer_viewing_slot_atomic(uuid,uuid)','EXECUTE')")).toBe("t");
    expect(sql("select not prosecdef from pg_proc where oid='public.book_buyer_viewing_slot_atomic(uuid,uuid)'::regprocedure")).toBe("t");
    expect(sql("select prosecdef from pg_proc where oid='private.book_buyer_viewing_slot(uuid,uuid)'::regprocedure")).toBe("t");
    expect(sql("select o.option_value in ('','\"\"') from pg_proc p cross join lateral pg_options_to_table(p.proconfig) o where p.oid='private.book_buyer_viewing_slot(uuid,uuid)'::regprocedure and o.option_name='search_path'")).toBe("t");
    expect(sql("select not has_function_privilege('anon','private.book_buyer_viewing_slot(uuid,uuid)','EXECUTE') and not has_function_privilege('service_role','private.book_buyer_viewing_slot(uuid,uuid)','EXECUTE')")).toBe("t");
    const f=await fixture(),claims=await actors[0]!.auth.getClaims();
    const raw=await actors[0]!.rpc("pinpoint_rental_viewing_propose",{actor_id:accounts[0]!.id,actor_session_id:claims.data!.claims.session_id,proposal_id:f.payload.proposalId,target_listing_id:f.listingId,target_application_ids:f.payload.applicationIds,proposed_mode:f.payload.mode,proposed_slots:f.payload.slots});expect(raw.error?.code).toBe("42501");
    expect((await actors[0]!.from("rental_viewing_proposals").select("id")).error?.code).toBe("42501");
    expect((await actors[0]!.schema("private").rpc("book_rental_viewing_slot",{target_slot_id:randomUUID(),target_application_id:f.applicationIds[0]})).error).not.toBeNull();
  });
  it("notifies a newly invited renter when an existing recipient shares the same slots",async()=>{
    const f=await fixture();await proposed(f);await actor(0);
    const extended=await proposeViewingSlots({...f.payload,proposalId:randomUUID(),applicationIds:f.applicationIds});
    expect(extended.success,JSON.stringify(extended)).toBe(true);
    const saved=await rows(f.listingId);expect(saved.slots).toHaveLength(1);expect(saved.offers).toHaveLength(2);
    const alerts=await state.admin!.from("notification_events").select("id,recipient_id").eq("type","viewing_proposed").contains("payload",{listingId:f.listingId});
    expect(alerts.error).toBeNull();expect(alerts.data!.map(row=>row.recipient_id).sort()).toEqual([accounts[1]!.id,accounts[2]!.id].sort());
  });
  it("revalidates organization membership and selection even for a saved proposal receipt",async()=>{
    const f=await fixture(),org=randomUUID(),owner=accounts[0]!.id;
    const claims=await actors[0]!.auth.getClaims();expect(claims.error).toBeNull();
    const raw=()=>state.admin!.rpc("pinpoint_rental_viewing_propose",{actor_id:owner,actor_session_id:claims.data!.claims.session_id,proposal_id:f.payload.proposalId,target_listing_id:f.listingId,target_application_ids:f.payload.applicationIds,proposed_mode:f.payload.mode,proposed_slots:f.payload.slots});
    sql(`insert into public.organizations(id,name,slug,owner_id) values('${org}','Contained rental QA','qa-${org}','${owner}');insert into public.organization_memberships(organization_id,user_id,role) values('${org}','${owner}','agent');update public.profiles set active_organization_id='${org}' where id='${owner}';update public.listings set organization_id='${org}' where id='${f.listingId}';`);
    try{
      await actor(0);expect((await raw()).error?.code).toBe("42501");expect((await proposeViewingSlots(f.payload)).success).toBe(false);
      sql(`update public.organization_memberships set role='admin' where organization_id='${org}' and user_id='${owner}'`);
      const first=await raw();expect(first.error).toBeNull();expect((await proposeViewingSlots(f.payload)).success).toBe(true);
      sql(`update public.organization_memberships set revoked_at=clock_timestamp() where organization_id='${org}' and user_id='${owner}'`);
      expect((await raw()).error?.code).toBe("42501");expect((await proposeViewingSlots(f.payload)).success).toBe(false);
      sql(`update public.organization_memberships set revoked_at=null where organization_id='${org}' and user_id='${owner}';update public.profiles set active_organization_id=null where id='${owner}'`);
      expect((await raw()).error?.code).toBe("42501");expect((await proposeViewingSlots(f.payload)).success).toBe(false);
      sql(`update public.profiles set active_organization_id='${org}' where id='${owner}';update public.organizations set deleted_at=clock_timestamp() where id='${org}'`);
      expect((await raw()).error?.code).toBe("42501");
      sql(`update public.organizations set deleted_at=null where id='${org}'`);
      expect((await raw()).data).toEqual(first.data);expect((await rows(f.listingId)).slots).toHaveLength(1);
    }finally{
      sql(`update public.listings set organization_id=null where id='${f.listingId}';update public.profiles set active_organization_id=null where id='${owner}';delete from public.organizations where id='${org}' and slug='qa-${org}'`);
    }
  });
  it("denies restricted listings, rejected applications and suspended participants at the raw boundaries",async()=>{
    const f=await fixture(),slotId=await proposed(f),restriction=randomUUID(),suspension=randomUUID();
    const claims=await actors[0]!.auth.getClaims();expect(claims.error).toBeNull();
    const rawProposal=()=>state.admin!.rpc("pinpoint_rental_viewing_propose",{actor_id:accounts[0]!.id,actor_session_id:claims.data!.claims.session_id,proposal_id:f.payload.proposalId,target_listing_id:f.listingId,target_application_ids:f.payload.applicationIds,proposed_mode:f.payload.mode,proposed_slots:f.payload.slots});
    const rawBook=()=>actors[1]!.rpc("book_viewing_slot_atomic",{target_slot_id:slotId,target_application_id:f.applicationIds[0]});
    try{
      expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:f.listingId,reason:"Contained rental viewing access QA"})).error).toBeNull();
      expect((await rawProposal()).error?.code).toBe("42501");expect((await rawBook()).error?.code).toBe("42501");
      expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();
      for(const index of [0,1]){
        expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:accounts[index]!.id,reason:"Contained rental viewing access QA"})).error).toBeNull();
        expect((await (index===0?rawProposal():rawBook())).error?.code).toBe("42501");
        expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();
      }
      expect((await state.admin!.from("applications").update({status:"rejected"}).eq("id",f.applicationIds[0]!)).error).toBeNull();
      expect((await rawProposal()).error?.code).toBe("42501");expect((await rawBook()).error?.code).toBe("42501");expect((await rows(f.listingId)).booked).toHaveLength(0);
      expect((await state.admin!.from("applications").update({status:"submitted"}).eq("id",f.applicationIds[0]!)).error).toBeNull();
      expect((await rawProposal()).error).toBeNull();expect((await rawBook()).error).toBeNull();expect((await rows(f.listingId)).booked).toHaveLength(1);
    }finally{
      await state.admin!.from("listing_restrictions").delete().eq("id",restriction);await state.admin!.from("account_suspensions").delete().eq("id",suspension);
    }
  });
  it("runs read-only database advisors on the labelled clone",async()=>{
    const report=await runCloneAdvisors(cfg,`${cfg.sourceRoot}/artifacts/user-flow-rental-viewing-advisors.json`);
    expect(report.passed,"The local advisor command must complete; findings are reviewed separately").toBe(true);
  });
});
