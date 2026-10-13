import {beforeAll,afterEach,describe,it,expect,vi} from "vitest";
import {buildPushPayload} from "@block65/webcrypto-web-push";
import {dispatchNotifications,pushContent} from "./index";
let subscription:{endpoint:string;keys:{p256dh:string;auth:string}};
let keys:{subject:string;publicKey:string;privateKey:string};
beforeAll(async()=>{
 const vapid=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const jwk=await crypto.subtle.exportKey("jwk",vapid.privateKey);
 const raw=await crypto.subtle.exportKey("raw",vapid.publicKey);
 const device=await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
 keys={subject:"https://fixture.invalid",publicKey:Buffer.from(raw).toString("base64url"),privateKey:jwk.d!};
 subscription={endpoint:"https://fcm.googleapis.com/fcm/send/fixture",keys:{p256dh:Buffer.from(await crypto.subtle.exportKey("raw",device.publicKey)).toString("base64url"),auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url")}};
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const event={id:"11111111-1111-4111-8111-111111111111",type:"new_message" as const,payload:{message:"Private fixture preview"},read_at:null,created_at:"2026-10-13T00:00:00Z"};
describe("notification Worker",()=>{
 it("encrypts a real Web Push payload using modern VAPID and aes128gcm",async()=>{
  const payload=await buildPushPayload({data:{body:"Private fixture preview"},options:{ttl:60}},{...subscription,expirationTime:null},keys);
  const headers=new Headers(payload.headers);
  expect(headers.get("content-encoding")).toBe("aes128gcm");
  expect(headers.get("authorization")).toMatch(/^vapid /);
  expect(Buffer.from(payload.body as ArrayBuffer).toString()).not.toContain("Private fixture preview");
 });
 it("omits previews when the recipient disables them",()=>{
  expect(pushContent({event,previews:false,accountId:"fixture"}).body).not.toContain("Private fixture preview");
  expect(pushContent({event,previews:true,accountId:"fixture"}).body).toBe("Private fixture preview");
 });
 it.each([{allow:false,status:201,outcome:"skipped"},{allow:true,status:410,outcome:"gone"},{allow:true,status:503,outcome:"retry"}])("rechecks consent and records $outcome without contacting unrelated services",async({allow,status,outcome})=>{
  let claims=0;const completed:Record<string,unknown>[]=[];const pushes=vi.fn();
  vi.spyOn(console,"info").mockImplementation(()=>{});
  vi.stubGlobal("fetch",vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
   const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
   if(url.hostname==="fcm.googleapis.com"){pushes();return new Response(null,{status});}
   if(url.hostname!=="qleeedwnnfvmfjjymoco.supabase.co")throw new Error("Non-fixture network blocked");
   const name=url.pathname.split("/").at(-1);
   if(name==="notifications_claim_push")return Response.json(claims++===0?[{id:"delivery",leaseToken:"lease",accountId:"fixture",attempt:1,previews:true,event,subscription}]:[]);
   if(name==="notifications_authorize_push")return Response.json({allowed:allow,previews:true});
   if(name==="notifications_finish_push"){completed.push(JSON.parse(String(init?.body)));return Response.json(true);}
   if(name==="notifications_process_reminders"||name==="notifications_metrics")return Response.json({});
   throw new Error("Unexpected RPC");
  }));
  const env={NOTIFICATION_SUPABASE_URL:"https://qleeedwnnfvmfjjymoco.supabase.co",VAPID_SUBJECT:"https://roomza.pinpoint-roomza.workers.dev",
   SUPABASE_SERVICE_ROLE_KEY:"fixture",VAPID_PRIVATE_KEY:keys.privateKey,VAPID_PUBLIC_KEY:keys.publicKey,CRON_SECRET:"fixture",
   APP:{fetch:async()=>Response.json({processed:0})}} as NotificationWorkerEnv;
  await dispatchNotifications(env);
  expect(completed[0]?.outcome).toBe(outcome);expect(pushes).toHaveBeenCalledTimes(allow?1:0);
 });
});
