/** Opt-in clone runtime only. Auth, REST, Storage, persistence and HTTP sink are real.
 * Application auth/Next adapters are supplied with captured clone sessions; no browser claim.
 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: null as SupabaseClient | null, actor: null as SupabaseClient | null, userId: "", persona: "buyer" }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-request-id": "contained-runtime" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createClient: () => state.admin, createUntypedClient: () => state.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.actor }));
vi.mock("@/lib/auth", () => ({
  requirePersona: async (persona: string) => { assert.equal(persona,state.persona); return { user: { id: state.userId } }; },
  requireUser: async () => ({ user: { id: state.userId } }), getSessionProfile: vi.fn(),
  requireAnyPersona: async () => ({ user: { id: state.userId } }),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/features/chat/actions", () => ({ getOrCreateInquiryConversation: vi.fn() }));
vi.mock("@/features/profile/interaction-data", () => ({ getInteractionProfileMap: vi.fn(async () => new Map()) }));
vi.mock("@/features/listings/management-scope", () => ({ getListingManagementScope: async () => ({ managedOrganizationId: null }) }));
import { advancePurchaseProgress, createBuyerInterest, updateBuyerInterest, requestPurchaseViewing, proposeBuyerViewingSlots, bookBuyerViewingSlot } from "@/features/purchase/actions";
import { getMyPurchases } from "@/features/purchase/data";
import { getLiveViewing } from "@/features/viewings/actions/live-viewing";
import { getProfileViewingCount } from "@/features/profile/viewing-count";
import { getLandlordViewings } from "@/features/viewings/actions/get-landlord-viewings";
import { saveFavorite } from "@/features/favorites/api";
import { createProfileDocumentSignedUrl } from "@/features/profile/data";
import { markNotificationRead } from "@/features/notifications/inbox-actions";
import { processNotificationJob } from "@/features/notifications/jobs";
import { submitApplication } from "@/features/applications/actions";
import { createDocumentSignedUrl } from "@/features/applications/document-signed-url";
const cfg = process.env.PINPOINT_PHASE4_RUNTIME ? JSON.parse(process.env.PINPOINT_PHASE4_RUNTIME) : null;
const run = cfg ? describe : describe.skip;
const ids = { document: randomUUID(), version: randomUUID(), share: randomUUID(), notification: randomUUID(), pushEvent: randomUUID() };
const actors: SupabaseClient[] = [];
let objectPath = "";
let sink: ReturnType<typeof createServer> | undefined;
let sinkOrigin: string | undefined;
const originalFetch = globalThis.fetch;
const deliveries: Array<{ to: string; subject: string; html: string }> = [];
async function actor(index: number, persona = "buyer") {
  state.actor = actors[index]!; state.userId = cfg.accounts[index].id; state.persona = persona;
}
async function session(index: number) {
  const claims = await actors[index]!.auth.getClaims(); expect(claims.error).toBeNull();
  return String(claims.data!.claims.session_id);
}
function fixtureSql(query: string) {
  assert.match(cfg.dbName, /^pinpoint-release-[0-9a-f-]{36}-db$/);
  return execFileSync("docker",["exec","-i","-e",`PGPASSWORD=${cfg.dbPassword}`,cfg.dbName,"psql","-X","-q","-h","127.0.0.1","-U","supabase_admin","-d","postgres","-At","-v","ON_ERROR_STOP=1"],{input:query,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
}
function fixturePdf() {
  const stream="BT /F1 12 Tf 40 40 Td (Synthetic test fixture) Tj ET";
  const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  const chunks=[Buffer.from("%PDF-1.4\n%\xff\xff\xff\xff\n","latin1")],offsets=[0];
  for(const [index,object] of objects.entries()){offsets.push(chunks.reduce((sum,chunk)=>sum+chunk.length,0));chunks.push(Buffer.from(`${index+1} 0 obj\n${object}\nendobj\n`));}
  const xref=chunks.reduce((sum,chunk)=>sum+chunk.length,0);
  chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,"0")+" 00000 n \n").join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
async function recoveryRental(){
 const listingId=randomUUID();
 const rental=await state.admin!.from("listings").insert({id:listingId,landlord_id:cfg.accounts[0].id,title:"Contained rental recovery",address:"Synthetic fixture",price:2500,listing_type:"rent",status:"draft",metadata:{publicContact:{email:cfg.accounts[0].email},contactConsent:true}}).select("updated_at").single();expect(rental.error).toBeNull();
 for(let n=0;n<3;n++)expect((await state.admin!.from("listing_images").insert({listing_id:listingId,bucket:"listing-images",path:`${cfg.accounts[0].id}/${listingId}/${n}.png`,public_url:`http://127.0.0.1:55431/fixture/${n}`,sort_order:n})).error).toBeNull();
 expect((await state.admin!.rpc("pinpoint_property_lifecycle",{actor_id:cfg.accounts[0].id,actor_session_id:await session(0),target:listingId,expected_updated_at:rental.data!.updated_at,command:"publish"})).error).toBeNull();return listingId;
}
function rentalForm(listingId:string,bytes?:Buffer){
 const form=new FormData();for(const [key,value]of Object.entries({listingId,fullName:"Contained Renter",income:"12000",employmentStatus:"employed",moveInDate:new Date(Date.now()+86400000).toISOString().slice(0,10),householdSize:"2"}))form.set(key,value);
 if(bytes)form.set("idDocument",new File([new Uint8Array(bytes)],"fixture.pdf",{type:"application/pdf"}));return form;
}
run("Phase 4 isolated platform runtime", () => {
  beforeAll(async () => {
    assert.equal(cfg.supabaseUrl,"http://127.0.0.1:55431"); assert.equal(cfg.storageEnabled,true);
    globalThis.fetch = (input, init) => {
      const origin = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).origin;
      assert.ok(origin === cfg.supabaseUrl || origin === sinkOrigin, "Blocked runtime request outside clone/sink");
      return originalFetch(input, init);
    };
    state.admin=createClient(cfg.supabaseUrl,cfg.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    for(const account of cfg.accounts) {
      const client=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
      expect((await client.auth.signInWithPassword({ email: account.email, password: cfg.password })).error).toBeNull(); actors.push(client);
    }
  });
  afterAll(async () => {
    if(!state.admin) return;
    await state.admin.from("notification_events").delete().eq("id",ids.notification);
    await state.admin.from("profile_document_shares").delete().eq("id",ids.share);
    await state.admin.from("profile_documents").update({current_version_id:null}).eq("id",ids.document);
    await state.admin.from("profile_document_versions").delete().eq("id",ids.version);
    await state.admin.from("profile_documents").delete().eq("id",ids.document);
    if(objectPath) expect((await actors[4]!.storage.from("profile-documents").remove([objectPath])).error).toBeNull();
    for(const client of actors) await client.auth.signOut();
    if(sink) await new Promise<void>(resolve => sink!.close(() => resolve()));
    globalThis.fetch = originalFetch;
  });
  it("a committed rental submission survives a lost response with its private document bytes intact",async()=>{
    const listingId=await recoveryRental(),bytes=fixturePdf(),paths:string[]=[];
    let applicationId="",responseLost=false;
    await actor(4,"renter");const containedFetch=globalThis.fetch;
    try {
      globalThis.fetch=async(input,init)=>{
        const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
        const response=await containedFetch(input,init);
        if(url.pathname.startsWith("/storage/v1/object/application-documents/")&&init?.method==="POST"&&response.ok){const path=decodeURIComponent(url.pathname.slice("/storage/v1/object/application-documents/".length));expect(path.startsWith(cfg.accounts[4].id+"/")).toBe(true);paths.push(path);}
        if(url.pathname.endsWith("/rpc/submit_application_atomic")&&!responseLost&&response.ok){const committed=await response.clone().json();if(committed[0]?.result==="created"){applicationId=committed[0].application_id;responseLost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained lost submission response"}),{status:503,headers:{"content-type":"application/json"}});}}
        return response;
      };
      const form=rentalForm(listingId,bytes);
      const result=await submitApplication(form);globalThis.fetch=containedFetch;
      expect(responseLost,"The underlying rental transaction must have committed").toBe(true);
      const docs=await state.admin!.from("documents").select("id,bucket,path").eq("application_id",applicationId);expect(docs.error).toBeNull();expect(docs.data).toHaveLength(1);
      const download=await actors[4]!.storage.from(docs.data![0]!.bucket!).download(docs.data![0]!.path!);
      expect(download.error,"A lost response must not delete the committed document bytes").toBeNull();
      expect(Buffer.from(await download.data!.arrayBuffer()).equals(bytes)).toBe(true);
      for(const participant of [4,0]){
        await actor(participant,participant===4?"renter":"landlord");
        const signed=await createDocumentSignedUrl(docs.data![0]!.id,"contained-valid-rental-document");expect(signed.ok,JSON.stringify(signed)).toBe(true);
        if(signed.ok){const response=await fetch(signed.url);expect(response.ok).toBe(true);expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(true);}
      }
      await actor(1,"renter");expect((await createDocumentSignedUrl(docs.data![0]!.id,"contained-foreign-document")).ok).toBe(false);
      state.actor=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const anonymous=await createDocumentSignedUrl(docs.data![0]!.id,"contained-anonymous-document");expect(anonymous.ok).toBe(false);if(!anonymous.ok)expect(anonymous.httpStatus).toBe(401);
      await actor(4,"renter");
      expect(result.success,JSON.stringify(result)).toBe(true);
      if(result.success)expect(result.data?.applicationId).toBe(applicationId);
    }finally{
      globalThis.fetch=containedFetch;
      if(paths.length)expect((await actors[4]!.storage.from("application-documents").remove(paths)).error).toBeNull();
      if(applicationId)expect((await state.admin!.from("applications").delete().eq("id",applicationId)).error).toBeNull();
      expect((await state.admin!.from("listings").delete().eq("id",listingId)).error).toBeNull();
    }
  },60000);
  it("a committed rental submission can finish after the caller deadline without losing its staged PDF",async()=>{
    const listingId=await recoveryRental(),bytes=fixturePdf();await actor(4,"renter");
    const containedFetch=globalThis.fetch;let applicationId="",release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});let finish!:(response:Response)=>void;
    const completed=new Promise<Response>(resolve=>{finish=resolve;});let forwarded:Promise<Response>|undefined;
    try {
      globalThis.fetch=(input,init)=>{
        const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
        if(url.pathname.endsWith("/rpc/submit_application_atomic")){
          applicationId=JSON.parse(String(init!.body)).target_application_id;
          forwarded=(async()=>{await gate;const response=await containedFetch(input,init);finish(response.clone());return response;})();return forwarded;
        }
        return containedFetch(input,init);
      };
      const result=await submitApplication(rentalForm(listingId,bytes));
      expect(result.success).toBe(false);if(!result.success)expect(result.details).toEqual({submissionStatus:"uncertain"});
      expect(applicationId).toMatch(/^[0-9a-f-]{36}$/);
      expect((await state.admin!.from("applications").select("id").eq("id",applicationId)).data).toEqual([]);
      globalThis.fetch=containedFetch;release();const committed=await(await completed).json();expect(committed[0]?.result).toBe("created");
      const docs=await state.admin!.from("documents").select("bucket,path").eq("application_id",applicationId);expect(docs.error).toBeNull();expect(docs.data).toHaveLength(1);
      const download=await actors[4]!.storage.from(docs.data![0]!.bucket!).download(docs.data![0]!.path!);expect(download.error).toBeNull();expect(Buffer.from(await download.data!.arrayBuffer()).equals(bytes)).toBe(true);
      const repeated=await submitApplication(rentalForm(listingId,bytes));expect(repeated.success).toBe(false);
      expect((await state.admin!.from("applications").select("id").eq("listing_id",listingId)).data).toHaveLength(1);
    }finally{
      globalThis.fetch=containedFetch;release();if(forwarded)await forwarded;
      const docs=await state.admin!.from("documents").select("path").eq("application_id",applicationId);
      if(docs.data?.length)expect((await actors[4]!.storage.from("application-documents").remove(docs.data.map(doc=>doc.path!))).error).toBeNull();
      await state.admin!.from("applications").delete().eq("listing_id",listingId);await state.admin!.from("listings").delete().eq("id",listingId);
    }
  },60000);
  it("a committed rental submission document cannot sign another account's private object",async()=>{
    const listingId=await recoveryRental(),bytes=fixturePdf(),foreignPath=`${cfg.accounts[1].id}/${randomUUID()}/private.pdf`;
    await actor(4,"renter");let applicationId="";
    try{
      const submitted=await submitApplication(rentalForm(listingId));expect(submitted.success,JSON.stringify(submitted)).toBe(true);if(!submitted.success)throw new Error(submitted.error);applicationId=submitted.data!.applicationId;
      expect((await actors[1]!.storage.from("application-documents").upload(foreignPath,bytes,{contentType:"application/pdf"})).error).toBeNull();
      expect((await actors[4]!.storage.from("application-documents").download(foreignPath)).error).not.toBeNull();
      const forged=await actors[4]!.from("documents").insert({application_id:applicationId,type:"id",file_url:foreignPath,path:foreignPath,bucket:"application-documents",uploaded_by:cfg.accounts[4].id,mime_type:"application/pdf",byte_size:bytes.length}).select("id").single();
      expect(forged.error).toBeNull();const result=await createDocumentSignedUrl(forged.data!.id,"contained-forged-reference");
      expect(result.ok,"Application ownership cannot authorize another renter's private file").toBe(false);
      const landlordRead=await actors[0]!.storage.from("application-documents").download(foreignPath);
      expect(landlordRead.error,"A forged application row must not grant a landlord direct access to another user's object").not.toBeNull();
    }finally{
      expect((await actors[1]!.storage.from("application-documents").remove([foreignPath])).error).toBeNull();
      if(applicationId)await state.admin!.from("applications").delete().eq("id",applicationId);await state.admin!.from("listings").delete().eq("id",listingId);
    }
  },60000);
  it("repeated genuine buyer interest persists once; seller status/notes/progress save atomically and stale/foreign writes fail",async()=>{
    await actor(4);
    const favorite = await saveFavorite(new Request("http://localhost/api/favorites", { method:"POST", headers:{"content-type":"application/json"},body:JSON.stringify({listingId:cfg.saleId,listingType:"sale"}) }));
    expect(favorite.status).toBe(200);
    expect((await actors[4]!.from("user_favorites").select("listing_id").eq("listing_id",cfg.saleId)).data).toEqual([{listing_id:cfg.saleId}]);
    const first=await createBuyerInterest(cfg.saleId);expect(first.success).toBe(true);
    const second=await createBuyerInterest(cfg.saleId);expect(second).toEqual(first);
    if(!first.success) throw new Error(first.error);
    const id=first.data.buyerInterestId;
    const loaded=await state.admin!.from("buyer_interests").select("updated_at").eq("id",id).single();expect(loaded.error).toBeNull();
    await actor(0,"seller");
    const input={buyerInterestId:id,expectedUpdatedAt:loaded.data!.updated_at,status:"accepted" as const,notes:"Private fixture note",viewingDate:null};
    const saved=await updateBuyerInterest(input);expect(saved.success).toBe(true);
    const persisted=await state.admin!.from("buyer_interest_private_notes").select("notes").eq("buyer_interest_id",id).single();expect(persisted.data!.notes).toBe(input.notes);
    const progress=await actors[4]!.from("purchase_progress").select("completed_stages").eq("listing_id",cfg.saleId).single();expect(progress.data!.completed_stages).toContain("sale_agreed");
    expect((await updateBuyerInterest(input)).success).toBe(false);
    await actor(1,"seller"); expect((await updateBuyerInterest(input)).success).toBe(false);
    expect((await actors[4]!.from("buyer_interest_private_notes").select("notes").eq("buyer_interest_id",id)).data).toEqual([]);
    await actor(4);expect((await requestPurchaseViewing(cfg.saleId)).success).toBe(true);
    const after=await actors[4]!.from("purchase_progress").select("completed_stages").eq("listing_id",cfg.saleId).single();expect(after.data!.completed_stages).not.toContain("viewing_scheduled");
    const stages=await Promise.all([advancePurchaseProgress(cfg.saleId,"contacted_seller"),advancePurchaseProgress(cfg.saleId,"negotiating")]);
    expect(stages.every(result=>result.success)).toBe(true);
    const merged=await actors[4]!.from("purchase_progress").select("completed_stages").eq("listing_id",cfg.saleId).single();
    expect(merged.data!.completed_stages).toEqual(expect.arrayContaining(["property_saved","sale_agreed","contacted_seller","negotiating"]));
  },30000);
  it("proposal failure rolls back all rows and a lost response retries without duplicate invitations",async()=>{
    const fixture=await state.admin!.from("buyer_interests").insert({listing_id:cfg.saleId,seller_id:cfg.accounts[0].id,buyer_id:cfg.accounts[2].id}).select("id,updated_at").single();
    expect(fixture.error).toBeNull();
    const target=fixture.data!.id;
    const start=new Date(Date.now()+172800000),end=new Date(start.getTime()+1800000);
    const payload={buyerInterestId:target,expectedUpdatedAt:fixture.data!.updated_at,mode:"in_person" as const,slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]};
    const containedFetch=globalThis.fetch;
    try {
      await actor(0,"seller");
      const rpcArgs={actor_id:cfg.accounts[0].id,actor_session_id:await session(0),target,expected_updated_at:payload.expectedUpdatedAt,proposed_mode:payload.mode,proposed_slots:payload.slots};
      for(const client of [actors[0]!,createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false}})])
        expect((await client.rpc("pinpoint_buyer_viewing_propose",rpcArgs)).error?.code).toBe("42501");
      expect((await actors[0]!.from("buyer_viewing_proposals").select("result")).error?.code).toBe("42501");
      expect((await state.admin!.rpc("pinpoint_buyer_viewing_propose",{...rpcArgs,actor_session_id:randomUUID()})).error?.code).toBe("42501");
      expect((await state.admin!.rpc("pinpoint_buyer_viewing_propose",{...rpcArgs,proposed_slots:[payload.slots[0],payload.slots[0]]})).error?.code).toBe("22023");
      fixtureSql(`create function public.qa_proposal_offer_failure() returns trigger language plpgsql as $$ begin if new.buyer_interest_id='${target}' then raise exception 'Contained offer failure'; end if; return new; end; $$; create trigger qa_proposal_offer_failure before insert on public.viewing_slot_offers for each row execute function public.qa_proposal_offer_failure();`);
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      const partial=await state.admin!.from("viewing_slots").select("id").eq("listing_id",cfg.saleId);
      expect(partial.error).toBeNull();expect(partial.data,"Failed proposal must not leave orphan slots").toEqual([]);
      expect((await state.admin!.from("buyer_interests").select("updated_at").eq("id",target).single()).data!.updated_at).toBe(payload.expectedUpdatedAt);
      fixtureSql("drop trigger qa_proposal_offer_failure on public.viewing_slot_offers; drop function public.qa_proposal_offer_failure();");
      let responseLost=false;
      globalThis.fetch=async(input,init)=>{
        const response=await containedFetch(input,init);
        const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
        if(url.pathname.endsWith("/rpc/pinpoint_buyer_viewing_propose")&&!responseLost&&response.ok){responseLost=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained lost response"}),{status:503,headers:{"content-type":"application/json"}});}
        return response;
      };
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);expect(responseLost).toBe(true);
      globalThis.fetch=containedFetch;
      const retried=await proposeBuyerViewingSlots(payload);expect(retried.success,JSON.stringify(retried)).toBe(true);
      expect(await proposeBuyerViewingSlots(payload)).toEqual(retried);
      expect(await Promise.all([proposeBuyerViewingSlots(payload),proposeBuyerViewingSlots(payload)])).toEqual([retried,retried]);
      const offers=await state.admin!.from("viewing_slot_offers").select("id,slot_id").eq("buyer_interest_id",target);
      expect(offers.error).toBeNull();expect(offers.data).toHaveLength(1);
      expect((await state.admin!.from("viewing_slots").select("id").eq("listing_id",cfg.saleId)).data).toHaveLength(1);
      expect((await proposeBuyerViewingSlots({...payload,mode:"video_call"})).success).toBe(false);
      const changed=await state.admin!.from("buyer_interests").update({status:"negotiating",updated_at:new Date(Date.now()+1000).toISOString()}).eq("id",target);
      expect(changed.error).toBeNull();expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      await actor(1,"seller");expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
    } finally {
      globalThis.fetch=containedFetch;
      fixtureSql("drop trigger if exists qa_proposal_offer_failure on public.viewing_slot_offers; drop function if exists public.qa_proposal_offer_failure();");
      await state.admin!.from("buyer_interests").delete().eq("id",target);
      await state.admin!.from("viewing_slots").delete().eq("listing_id",cfg.saleId).eq("created_by",cfg.accounts[0].id);
    }
  },60000);
  it("real seller invitations book once, persist in purchases and expose viewing details only to participants",async()=>{
    const interest=await state.admin!.from("buyer_interests").select("id,updated_at").eq("listing_id",cfg.saleId).eq("buyer_id",cfg.accounts[4].id).single();
    expect(interest.error).toBeNull();
    const interestId=interest.data!.id;
    const start=new Date(Date.now()+86400000), end=new Date(start.getTime()+1800000);
    await actor(1,"seller");
    expect((await proposeBuyerViewingSlots({buyerInterestId:interestId,expectedUpdatedAt:interest.data!.updated_at,mode:"in_person",slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]})).success).toBe(false);
    await actor(0,"seller");
    const stale=await proposeBuyerViewingSlots({buyerInterestId:interestId,expectedUpdatedAt:"2000-01-01T00:00:00Z",mode:"in_person",slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]});
    expect(stale.success).toBe(false);
    expect((await state.admin!.from("viewing_slot_offers").select("id").eq("buyer_interest_id",interestId)).data).toEqual([]);
    expect((await state.admin!.from("viewing_slots").select("id").eq("listing_id",cfg.saleId)).data).toEqual([]);
    const proposed=await proposeBuyerViewingSlots({buyerInterestId:interestId,expectedUpdatedAt:interest.data!.updated_at,mode:"in_person",slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]});
    expect(proposed.success,JSON.stringify(proposed)).toBe(true);
    if(!proposed.success) throw new Error(proposed.error);
    const savedAfterProposal=await updateBuyerInterest({buyerInterestId:interestId,expectedUpdatedAt:proposed.data.updatedAt,status:"accepted",notes:"Seller note after proposal",viewingDate:new Date(proposed.data.viewingDate).toISOString()});
    expect(savedAfterProposal.success,JSON.stringify(savedAfterProposal)).toBe(true);
    const revised=await state.admin!.from("buyer_interests").select("viewing_date").eq("id",interestId).single();
    expect(revised.error).toBeNull();expect(new Date(revised.data!.viewing_date!).getTime()).toBe(start.getTime());
    await actor(4);
    const offered=await getMyPurchases();expect(offered.success,JSON.stringify(offered)).toBe(true);
    if(!offered.success) throw new Error(offered.error);
    const purchase=offered.data.find(row=>row.id===interestId)!;
    expect(purchase.viewings).toHaveLength(0);
    expect(purchase.viewing_slot_offers).toHaveLength(1);
    const slotRef=purchase.viewing_slot_offers[0]!.slot;
    const slot=Array.isArray(slotRef)?slotRef[0]:slotRef;expect(slot).toBeTruthy();
    await actor(1);expect((await bookBuyerViewingSlot({buyerInterestId:interestId,slotId:slot!.id})).success).toBe(false);
    await actor(4);
    const containedFetch=globalThis.fetch;let lostBookingResponse=false;
    try{
      globalThis.fetch=async(input,init)=>{
        const response=await containedFetch(input,init);
        const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
        if(!lostBookingResponse&&url.pathname==="/rest/v1/rpc/book_buyer_viewing_slot_atomic"&&response.ok){
          lostBookingResponse=true;await response.arrayBuffer();return new Response(JSON.stringify({message:"Contained committed buyer booking response loss"}),{status:503,headers:{"content-type":"application/json"}});
        }
        return response;
      };
      expect((await bookBuyerViewingSlot({buyerInterestId:interestId,slotId:slot!.id})).success).toBe(false);expect(lostBookingResponse).toBe(true);
    }finally{globalThis.fetch=containedFetch;}
    const committed=await state.admin!.from("viewings").select("id").eq("slot_id",slot!.id);expect(committed.error).toBeNull();expect(committed.data).toHaveLength(1);
    const raced=await Promise.all([bookBuyerViewingSlot({buyerInterestId:interestId,slotId:slot!.id}),bookBuyerViewingSlot({buyerInterestId:interestId,slotId:slot!.id})]);
    // Both retries belong to the same buyer and recover the same committed
    // appointment. A second appointment must never be created.
    expect(raced.every(result=>result.success),JSON.stringify(raced)).toBe(true);
    expect(raced.map(result=>result.success?result.data:null)).toEqual([committed.data![0]!.id,committed.data![0]!.id]);
    const booked=raced.find(result=>result.success)!;
    if(!booked.success) throw new Error("Booking failed");
    const persisted=await getMyPurchases();expect(persisted.success).toBe(true);
    if(!persisted.success)throw new Error(persisted.error);
    const saved=persisted.data.find(row=>row.id===interestId)!;
    expect(saved.viewings).toHaveLength(1);
    expect(saved.viewings[0]!.id).toBe(booked.data);
    expect(saved.progress!.completed_stages).toContain("viewing_scheduled");
    expect(await getProfileViewingCount(actors[4]!,cfg.accounts[4].id)).toBe(1);
    await actor(0,"seller");
    const owner=await getLandlordViewings();expect(owner.success,JSON.stringify(owner)).toBe(true);
    if(!owner.success)throw new Error(owner.error);
    expect(owner.data.proposed).toHaveLength(0);expect(owner.data.booked).toHaveLength(1);
    expect(owner.data.booked[0]!.id).toBe(booked.data);
    for(const participant of [4,0]) {
      await actor(participant);
      const live=await getLiveViewing(booked.data);expect(live.success).toBe(true);
      if(!live.success)throw new Error(live.error);
      expect(live.data.viewing?.id).toBe(booked.data);
      expect(live.data.viewing?.buyer_interest).toBeTruthy();
    }
    await actor(1);
    const foreign=await getMyPurchases();expect(foreign.success).toBe(true);
    if(foreign.success)expect(foreign.data).toEqual([]);
    const denied=await getLiveViewing(booked.data);expect(denied.success).toBe(true);
    if(denied.success)expect(denied.data.viewing).toBeNull();
    expect(await getProfileViewingCount(actors[1]!,cfg.accounts[4].id)).toBe(0);
  },60000);
  it("organization proposal retries still require current membership, selection and a live unsuspended session",async()=>{
    const org=randomUUID();let target="";let suspension="";
    const previous=await state.admin!.from("profiles").select("active_organization_id").eq("id",cfg.accounts[0].id).single();expect(previous.error).toBeNull();
    const prior=previous.data!.active_organization_id;
    fixtureSql(`insert into public.organizations(id,name,slug,owner_id) values('${org}','Contained QA','qa-${org}','${cfg.accounts[0].id}'); insert into public.organization_memberships(organization_id,user_id,role) values('${org}','${cfg.accounts[0].id}','owner'); update public.profiles set active_organization_id='${org}' where id='${cfg.accounts[0].id}'; update public.listings set organization_id='${org}' where id='${cfg.saleId}';`);
    try {
      const created=await state.admin!.from("buyer_interests").insert({listing_id:cfg.saleId,seller_id:cfg.accounts[0].id,buyer_id:cfg.accounts[2].id}).select("id,updated_at").single();expect(created.error).toBeNull();target=created.data!.id;
      const start=new Date(Date.now()+259200000),end=new Date(start.getTime()+1800000);
      const payload={buyerInterestId:target,expectedUpdatedAt:created.data!.updated_at,mode:"video_call" as const,slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]};
      await actor(0,"seller");
      fixtureSql(`update public.organization_memberships set role='agent' where organization_id='${org}' and user_id='${cfg.accounts[0].id}';`);
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      fixtureSql(`update public.organization_memberships set role='admin' where organization_id='${org}' and user_id='${cfg.accounts[0].id}';`);
      const first=await proposeBuyerViewingSlots(payload);expect(first.success,JSON.stringify(first)).toBe(true);
      fixtureSql(`update public.organization_memberships set revoked_at=clock_timestamp() where organization_id='${org}' and user_id='${cfg.accounts[0].id}';`);
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      fixtureSql(`update public.organization_memberships set revoked_at=null where organization_id='${org}' and user_id='${cfg.accounts[0].id}'; update public.profiles set active_organization_id=null where id='${cfg.accounts[0].id}';`);
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      fixtureSql(`update public.profiles set active_organization_id='${org}' where id='${cfg.accounts[0].id}';`);
      suspension=randomUUID();
      expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:cfg.accounts[0].id,reason:"Contained proposal QA"})).error).toBeNull();
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();suspension="";
      const lease=await session(0);
      fixtureSql(`update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where id='${lease}';`);
      expect((await proposeBuyerViewingSlots(payload)).success).toBe(false);
      fixtureSql(`update auth.sessions set not_after=null where id='${lease}';`);
      expect(await proposeBuyerViewingSlots(payload)).toEqual(first);
      expect((await state.admin!.from("viewing_slot_offers").select("id").eq("buyer_interest_id",target)).data).toHaveLength(1);
    } finally {
      if(suspension)await state.admin!.from("account_suspensions").delete().eq("id",suspension);
      if(target){
        const slots=await state.admin!.from("viewing_slot_offers").select("slot_id").eq("buyer_interest_id",target);
        if(slots.data?.length)await state.admin!.from("viewing_slots").delete().in("id",slots.data.map(row=>row.slot_id));
        await state.admin!.from("buyer_interests").delete().eq("id",target);
      }
      fixtureSql(`update public.listings set organization_id=null where id='${cfg.saleId}'; update public.profiles set active_organization_id=${prior?`'${prior}'`:"null"} where id='${cfg.accounts[0].id}'; delete from public.organizations where id='${org}' and slug='qa-${org}';`);
    }
  },60000);
  it("buyer booking boundaries deny revoked, suspended, expired and foreign access while preserving one concurrent winner",async()=>{
    const listingId=randomUUID(),restriction=randomUUID(),suspension=randomUUID();let lease="";
    const start=new Date(Date.now()+48*3600000),end=new Date(start.getTime()+1800000);
    try{
      const listing=await state.admin!.from("listings").insert({id:listingId,landlord_id:cfg.accounts[0].id,title:"Contained buyer booking boundary",address:"Synthetic fixture",price:500000,sale_price:500000,listing_type:"sale",status:"draft",metadata:{publicContact:{email:cfg.accounts[0].email},contactConsent:true}}).select("updated_at").single();expect(listing.error).toBeNull();
      for(let n=0;n<3;n++)expect((await state.admin!.from("listing_images").insert({listing_id:listingId,bucket:"listing-images",path:`${cfg.accounts[0].id}/${listingId}/${n}.png`,public_url:"http://127.0.0.1:55431/fixture.png",sort_order:n})).error).toBeNull();
      expect((await state.admin!.rpc("pinpoint_property_lifecycle",{actor_id:cfg.accounts[0].id,actor_session_id:await session(0),target:listingId,expected_updated_at:listing.data!.updated_at,command:"publish"})).error).toBeNull();
      const interest=await state.admin!.from("buyer_interests").insert({listing_id:listingId,seller_id:cfg.accounts[0].id,buyer_id:cfg.accounts[4].id}).select("id,updated_at").single();expect(interest.error).toBeNull();
      await actor(0,"seller");expect((await proposeBuyerViewingSlots({buyerInterestId:interest.data!.id,expectedUpdatedAt:interest.data!.updated_at,mode:"video_call",slots:[{startTime:start.toISOString(),endTime:end.toISOString()}]})).success).toBe(true);
      const offer=await state.admin!.from("viewing_slot_offers").select("slot_id").eq("buyer_interest_id",interest.data!.id).single();expect(offer.error).toBeNull();const slotId=offer.data!.slot_id;
      const raw=(index=4,id=interest.data!.id)=>actors[index]!.rpc("book_buyer_viewing_slot_atomic",{target_slot_id:slotId,target_buyer_interest_id:id});
      expect((await raw(1)).error?.code).toBe("42501");
      expect((await actors[4]!.from("viewing_slots").update({is_booked:true}).eq("id",slotId)).error?.code).toBe("42501");
      expect((await actors[4]!.from("viewings").insert({id:randomUUID(),slot_id:slotId,buyer_interest_id:interest.data!.id,status:"booked"})).error?.code).toBe("42501");
      expect((await state.admin!.from("listing_restrictions").insert({id:restriction,listing_id:listingId,reason:"Contained buyer viewing boundary QA"})).error).toBeNull();expect((await raw()).error?.code).toBe("42501");
      expect((await state.admin!.from("listing_restrictions").delete().eq("id",restriction)).error).toBeNull();
      expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:cfg.accounts[4].id,reason:"Contained buyer viewing boundary QA"})).error).toBeNull();expect((await raw()).error?.code).toBe("42501");
      expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull();
      lease=await session(4);fixtureSql(`update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where id='${lease}'`);expect((await raw()).error?.code).toBe("42501");fixtureSql(`update auth.sessions set not_after=null where id='${lease}'`);
      expect((await state.admin!.from("buyer_interests").update({status:"declined"}).eq("id",interest.data!.id)).error).toBeNull();expect((await raw()).error?.code).toBe("42501");
      expect((await state.admin!.from("buyer_interests").update({status:"interested"}).eq("id",interest.data!.id)).error).toBeNull();
      expect((await state.admin!.from("viewing_slots").update({start_time:new Date(Date.now()-7200000).toISOString(),end_time:new Date(Date.now()-3600000).toISOString()}).eq("id",slotId)).error).toBeNull();expect((await raw()).error?.code).toBe("PT409");
      expect((await state.admin!.from("viewing_slots").update({start_time:start.toISOString(),end_time:end.toISOString()}).eq("id",slotId)).error).toBeNull();
      const token=(await actors[4]!.auth.getSession()).data.session!.access_token;expect((await state.admin!.auth.admin.signOut(token,"global")).error).toBeNull();expect((await raw()).error?.code).toBe("42501");
      expect((await actors[4]!.auth.signInWithPassword({email:cfg.accounts[4].email,password:cfg.password})).error).toBeNull();
      const rival=await state.admin!.from("buyer_interests").insert({listing_id:listingId,seller_id:cfg.accounts[0].id,buyer_id:cfg.accounts[2].id}).select("id").single();expect(rival.error).toBeNull();
      expect((await state.admin!.from("viewing_slot_offers").insert({slot_id:slotId,buyer_interest_id:rival.data!.id})).error).toBeNull();
      const race=await Promise.all([raw(),raw(2,rival.data!.id)]);expect(race.filter(result=>!result.error)).toHaveLength(1);
      const winner=race[0]!.error?2:4,winnerInterest=winner===4?interest.data!.id:rival.data!.id;
      const saved=await state.admin!.from("viewings").select("id,buyer_interest_id,meeting_room_id,meeting_join_url").eq("slot_id",slotId);expect(saved.error).toBeNull();expect(saved.data).toHaveLength(1);expect(saved.data![0]!.buyer_interest_id).toBe(winnerInterest);expect(saved.data![0]!.meeting_room_id).toBeTruthy();expect(saved.data![0]!.meeting_join_url).toContain("https://meet.jit.si/");
      const recovered=await raw(winner,winnerInterest);expect(recovered.error).toBeNull();expect(recovered.data).toBe(saved.data![0]!.id);
    }finally{
      if(lease)fixtureSql(`update auth.sessions set not_after=null where id='${lease}'`);
      await state.admin!.from("listing_restrictions").delete().eq("id",restriction);await state.admin!.from("account_suspensions").delete().eq("id",suspension);
      expect((await actors[4]!.auth.signInWithPassword({email:cfg.accounts[4].email,password:cfg.password})).error).toBeNull();
      expect((await state.admin!.from("listings").delete().eq("id",listingId)).error).toBeNull();
    }
  },120000);
  it("private Storage bytes open through current owner/share links; anonymous, foreign and revoked shares fail",async()=>{
    const bytes=fixturePdf();
    objectPath=`${cfg.accounts[4].id}/${ids.document}/${ids.version}.pdf`;
    expect((await actors[4]!.storage.from("profile-documents").upload(objectPath,bytes,{contentType:"application/pdf"})).error).toBeNull();
    expect((await state.admin!.from("profile_documents").insert({id:ids.document,owner_id:cfg.accounts[4].id,document_type:"other",display_name:"Synthetic private fixture"})).error).toBeNull();
    expect((await state.admin!.from("profile_document_versions").insert({id:ids.version,document_id:ids.document,owner_id:cfg.accounts[4].id,version:1,bucket:"profile-documents",path:objectPath,mime_type:"application/pdf",size_bytes:Buffer.byteLength(bytes),checksum_sha256:createHash("sha256").update(bytes).digest("hex")})).error).toBeNull();
    const owner=await createProfileDocumentSignedUrl(cfg.accounts[4].id,await session(4),ids.version,randomUUID());expect("signedUrl" in owner).toBe(true);
    if(typeof owner.signedUrl !== "string") throw new Error("Secure link unavailable");
    const response=await fetch(owner.signedUrl);expect(response.ok).toBe(true);expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect((await fetch(`${cfg.supabaseUrl}/storage/v1/object/public/profile-documents/${objectPath}`)).ok).toBe(false);
    const anonymous=createClient(cfg.supabaseUrl,cfg.anonKey,{auth:{persistSession:false}});
    expect((await anonymous.storage.from("profile-documents").download(objectPath)).error).not.toBeNull();
    expect((await actors[1]!.storage.from("profile-documents").download(objectPath)).error).not.toBeNull();
    expect(await createProfileDocumentSignedUrl(cfg.accounts[1].id,await session(1),ids.version,randomUUID())).toEqual({error:"forbidden"});
    expect((await state.admin!.from("profile_document_shares").insert({id:ids.share,document_id:ids.document,version_id:ids.version,owner_id:cfg.accounts[4].id,grantee_id:cfg.accounts[1].id,purpose:"manual"})).error).toBeNull();
    expect("signedUrl" in await createProfileDocumentSignedUrl(cfg.accounts[1].id,await session(1),ids.version,randomUUID())).toBe(true);
    expect((await state.admin!.from("profile_document_shares").update({revoked_at:new Date().toISOString()}).eq("id",ids.share)).error).toBeNull();
    expect(await createProfileDocumentSignedUrl(cfg.accounts[1].id,await session(1),ids.version,randomUUID())).toEqual({error:"forbidden"});
    expect(await createProfileDocumentSignedUrl(cfg.accounts[4].id,randomUUID(),ids.version,randomUUID())).toEqual({error:"forbidden"});
  },30000);
  it("notification recipient privacy, read state and actual HTTP sink delivery persist",async()=>{
    expect((await state.admin!.from("notification_events").insert({id:ids.notification,recipient_id:cfg.accounts[4].id,type:"new_message",payload:{message:"<fixture> Private update"}})).error).toBeNull();
    const ambiguous=await state.admin!.from("notification_events").select("id,profiles!inner(email)").eq("id",ids.notification);
    expect(ambiguous.error?.code).toBe("PGRST201");
    expect((await state.admin!.from("notification_subscriptions").update({enabled:true,frequency:"instant"}).eq("user_id",cfg.accounts[4].id).eq("category","messages").eq("channel","email")).error).toBeNull();
    await actor(1,"seller");expect((await markNotificationRead(ids.notification)).success).toBe(false);
    expect((await actors[1]!.from("notification_events").select("id").eq("id",ids.notification)).data).toEqual([]);
    await actor(4);
    const owned=await actors[4]!.from("notification_events").select("id,read_at").eq("id",ids.notification).maybeSingle();
    expect(owned.error,JSON.stringify(owned.error)).toBeNull();expect(owned.data).not.toBeNull();
    const marked=await markNotificationRead(ids.notification);
    if(!marked.success){
      const diagnostic=await actors[4]!.from("notification_events").update({read_at:new Date().toISOString()}).eq("id",ids.notification);
      expect(diagnostic.error,JSON.stringify(diagnostic.error)).toBeNull();
    }
    expect(marked.success,JSON.stringify(marked)).toBe(true);
    const read=await state.admin!.from("notification_events").select("read_at").eq("id",ids.notification).single();expect(read.data!.read_at).not.toBeNull();
    sink=createServer(async(req,res)=>{let body="";for await(const chunk of req)body+=chunk;deliveries.push(JSON.parse(body));res.writeHead(200,{"content-type":"application/json"});res.end('{"id":"isolated-delivery"}');});
    await new Promise<void>(resolve=>sink!.listen(0,"127.0.0.1",resolve));
    const address=sink.address();assert.ok(address && typeof address!=="string");
    sinkOrigin = `http://127.0.0.1:${address.port}`;
    const delivered=await processNotificationJob(ids.notification,randomUUID(),async(to,subject,html)=>{
      assert.equal(to,cfg.accounts[4].email);
      const response=await fetch(`${sinkOrigin}/delivery`,{method:"POST",body:JSON.stringify({to,subject,html})});
      return {data:await response.json(),error:null};
    });
    expect(delivered).toEqual({sent:true});expect(deliveries).toHaveLength(1);expect(deliveries[0]!.html).toContain("&lt;fixture&gt;");
    const sent=await state.admin!.from("notification_events").select("sent_at,locked_at").eq("id",ids.notification).single();expect(sent.data!.sent_at).not.toBeNull();expect(sent.data!.locked_at).toBeNull();
  },30000);
  it("real stable push authorization accepts only a current consented device and valid lease; never delivers externally",async()=>{
    const admin=state.admin!,user=cfg.accounts[4].id,sessionId=await session(4);
    const flag=await admin.from("app_feature_flags").select("enabled").eq("key","notifications_push").single();
    expect(flag.error).toBeNull();
    expect((await actors[4]!.rpc("pinpoint_active_session",{actor_id:user,actor_session_id:sessionId})).error?.code).toBe("42501");
    const locked=fixtureSql(`begin; select public.pinpoint_active_session('${user}','${sessionId}'); select jsonb_agg(distinct c.relname||':'||l.mode) from pg_locks l join pg_class c on c.oid=l.relation where l.pid=pg_backend_pid() and l.relation in ('auth.sessions'::regclass,'auth.users'::regclass); rollback;`);
    expect(locked).toContain("sessions:RowShareLock");expect(locked).toContain("users:RowShareLock");
    let deviceId:string|undefined;
    try {
      expect((await admin.from("app_feature_flags").update({enabled:true}).eq("key","notifications_push")).error).toBeNull();
      expect((await admin.from("notification_subscriptions").upsert({user_id:user,category:"messages",channel:"push",enabled:true,frequency:"instant"},{onConflict:"user_id,category,channel"})).error).toBeNull();
      const subscription={endpoint:`https://fcm.googleapis.com/fcm/send/isolated-${ids.pushEvent}`,keys:{p256dh:"A".repeat(87),auth:"A".repeat(22)},label:"Synthetic clone device"};
      const registered=await actors[4]!.rpc("notification_device_manage",{command:"register",subscription});
      expect(registered.error,JSON.stringify(registered.error)).toBeNull();deviceId=registered.data.id;
      const foreign=await actors[1]!.rpc("notification_device_manage",{command:"register",subscription:{...subscription,keys:{...subscription.keys,auth:"B".repeat(22)}}});
      expect(foreign.error?.code).toBe("42501");
      expect((await admin.from("notification_events").insert({id:ids.pushEvent,recipient_id:user,type:"new_message",category:"messages",payload:{message:"Synthetic push authorization fixture"}})).error).toBeNull();
      const claimed=await admin.rpc("notifications_claim_push",{batch_size:100});
      expect(claimed.error,JSON.stringify(claimed.error)).toBeNull();
      const delivery=claimed.data.find((row:{event:{id:string}})=>row.event.id===ids.pushEvent);
      expect(delivery).toBeTruthy();
      const authorization=async(lease=delivery.leaseToken)=>{
        const result=await admin.rpc("notifications_authorize_push",{target:delivery.id,lease});
        expect(result.error,JSON.stringify(result.error)).toBeNull();return result.data;
      };
      expect((await authorization()).allowed).toBe(true);
      expect((await authorization(randomUUID())).allowed).toBe(false);
      expect((await actors[4]!.rpc("notifications_authorize_push",{target:delivery.id,lease:delivery.leaseToken})).error?.code).toBe("42501");
      fixtureSql(`update auth.sessions set not_after=now()-interval '1 second' where id='${sessionId}' and user_id='${user}'`);
      expect((await authorization()).allowed).toBe(false);
      fixtureSql(`update auth.sessions set not_after=null where id='${sessionId}' and user_id='${user}'`);
      expect((await authorization()).allowed).toBe(true);
      expect((await actors[4]!.rpc("notification_update_state",{action:"read",target:ids.pushEvent})).error).toBeNull();
      expect((await authorization()).allowed).toBe(false);
      expect((await admin.from("notification_events").update({read_at:null}).eq("id",ids.pushEvent)).error).toBeNull();
      expect((await admin.from("notification_subscriptions").update({enabled:false}).eq("user_id",user).eq("category","messages").eq("channel","push")).error).toBeNull();
      expect((await authorization()).allowed).toBe(false);
      expect((await admin.from("notification_subscriptions").update({enabled:true}).eq("user_id",user).eq("category","messages").eq("channel","push")).error).toBeNull();
      expect((await admin.from("notification_options").upsert({user_id:user,previews:false})).error).toBeNull();
      expect(await authorization()).toEqual({allowed:true,previews:false});
      expect((await actors[4]!.rpc("notification_device_manage",{command:"remove",device:deviceId})).error).toBeNull();
      expect((await authorization()).allowed).toBe(false);
    } finally {
      fixtureSql(`update auth.sessions set not_after=null where id='${sessionId}' and user_id='${user}'`);
      expect((await admin.from("notification_events").delete().eq("id",ids.pushEvent)).error).toBeNull();
      if(deviceId) expect((await admin.from("notification_push_devices").delete().eq("id",deviceId)).error).toBeNull();
      expect((await admin.from("app_feature_flags").update({enabled:flag.data!.enabled}).eq("key","notifications_push")).error).toBeNull();
    }
  },60000);
  it("read-only notification access still denies expired/revoked sessions, anonymous and suspended/banned identities",async()=>{
    const user=cfg.accounts[4].id, sessionId=await session(4), suspension=randomUUID();
    async function visible(expected: number) {
      const result=await actors[4]!.from("notification_events").select("id").eq("id",ids.notification);
      expect(result.error,JSON.stringify(result.error)).toBeNull();expect(result.data).toHaveLength(expected);
    }
    await visible(1);
    fixtureSql(`update auth.sessions set not_after=now()-interval '1 second' where id='${sessionId}' and user_id='${user}'`);
    await visible(0);
    fixtureSql(`update auth.sessions set not_after=null where id='${sessionId}' and user_id='${user}'; update auth.users set is_anonymous=true where id='${user}'`);
    await visible(0);
    fixtureSql(`update auth.users set is_anonymous=false,banned_until=now()+interval '1 day' where id='${user}'`);
    await visible(0);
    fixtureSql(`update auth.users set banned_until=null where id='${user}'`);
    expect((await state.admin!.from("account_suspensions").insert({id:suspension,user_id:user,reason:"Synthetic notification access fixture"})).error).toBeNull();
    try { await visible(0); } finally { expect((await state.admin!.from("account_suspensions").delete().eq("id",suspension)).error).toBeNull(); }
    await visible(1);
    const content=await actors[4]!.from("notification_events").update({payload:{message:"Forbidden rewrite"}}).eq("id",ids.notification);
    expect(content.error?.code).toBe("42501");
    const token=(await actors[4]!.auth.getSession()).data.session!.access_token;
    const stale=createClient(cfg.supabaseUrl,cfg.anonKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    expect((await actors[4]!.auth.signOut()).error).toBeNull();
    const revoked=await stale.from("notification_events").select("id").eq("id",ids.notification);
    expect(revoked.error,JSON.stringify(revoked.error)).toBeNull();expect(revoked.data).toEqual([]);
    const action=await stale.rpc("notification_update_state",{action:"archive",target:ids.notification});
    expect(action.error?.code).toBe("42501");
    expect((await actors[4]!.auth.signInWithPassword({email:cfg.accounts[4].email,password:cfg.password})).error).toBeNull();
    const stillRevoked=await stale.from("notification_events").select("id").eq("id",ids.notification);
    expect(stillRevoked.error).toBeNull();expect(stillRevoked.data).toEqual([]);
  },30000);
});
