/** Opt-in clone runtime only. Auth, REST, Storage, persistence and HTTP sink are real.
 * Application auth/Next adapters are supplied with captured clone sessions; no browser claim.
 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: null as SupabaseClient | null, actor: null as SupabaseClient | null, userId: "", persona: "buyer" }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/admin", () => ({ createClient: () => state.admin, createUntypedClient: () => state.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.actor }));
vi.mock("@/lib/auth", () => ({
  requirePersona: async (persona: string) => { assert.equal(persona,state.persona); return { user: { id: state.userId } }; },
  requireUser: async () => ({ user: { id: state.userId } }), getSessionProfile: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("@/features/chat/actions", () => ({ getOrCreateInquiryConversation: vi.fn() }));
vi.mock("@/features/profile/interaction-data", () => ({ getInteractionProfileMap: vi.fn() }));
import { advancePurchaseProgress, createBuyerInterest, updateBuyerInterest, requestPurchaseViewing } from "@/features/purchase/actions";
import { saveFavorite } from "@/features/favorites/api";
import { createProfileDocumentSignedUrl } from "@/features/profile/data";
import { markNotificationRead } from "@/features/notifications/inbox-actions";
import { processNotificationJob } from "@/features/notifications/jobs";
const cfg = process.env.PINPOINT_PHASE4_RUNTIME ? JSON.parse(process.env.PINPOINT_PHASE4_RUNTIME) : null;
const run = cfg ? describe : describe.skip;
const ids = { document: randomUUID(), version: randomUUID(), share: randomUUID(), notification: randomUUID() };
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
  it("private Storage bytes open through current owner/share links; anonymous, foreign and revoked shares fail",async()=>{
    const bytes="%PDF-1.4\nSynthetic Phase 4 private fixture\n%%EOF";
    objectPath=`${cfg.accounts[4].id}/${ids.document}/${ids.version}.pdf`;
    expect((await actors[4]!.storage.from("profile-documents").upload(objectPath,bytes,{contentType:"application/pdf"})).error).toBeNull();
    expect((await state.admin!.from("profile_documents").insert({id:ids.document,owner_id:cfg.accounts[4].id,document_type:"other",display_name:"Synthetic private fixture"})).error).toBeNull();
    expect((await state.admin!.from("profile_document_versions").insert({id:ids.version,document_id:ids.document,owner_id:cfg.accounts[4].id,version:1,bucket:"profile-documents",path:objectPath,mime_type:"application/pdf",size_bytes:Buffer.byteLength(bytes),checksum_sha256:createHash("sha256").update(bytes).digest("hex")})).error).toBeNull();
    const owner=await createProfileDocumentSignedUrl(cfg.accounts[4].id,await session(4),ids.version,randomUUID());expect("signedUrl" in owner).toBe(true);
    if(typeof owner.signedUrl !== "string") throw new Error("Secure link unavailable");
    const response=await fetch(owner.signedUrl);expect(response.ok).toBe(true);expect(await response.text()).toBe(bytes);
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
    expect((await state.admin!.from("notification_subscriptions").update({enabled:true,frequency:"instant"}).eq("user_id",cfg.accounts[4].id).eq("category","messages").eq("channel","email")).error).toBeNull();
    await actor(1,"seller");expect((await markNotificationRead(ids.notification)).success).toBe(false);
    expect((await actors[1]!.from("notification_events").select("id").eq("id",ids.notification)).data).toEqual([]);
    await actor(4);expect((await markNotificationRead(ids.notification)).success).toBe(true);
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
});
