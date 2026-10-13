import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({client:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
import {handleNotificationApi} from "./api";
const userId="11111111-1111-4111-8111-111111111111",id="22222222-2222-4222-8222-222222222222";
let client:ReturnType<typeof makeClient>;
function makeClient(){
 const filters:unknown[][]=[];
 const builder={select:vi.fn(()=>builder),eq:vi.fn((...args:unknown[])=>{filters.push(args);return builder;}),is:vi.fn((...args:unknown[])=>{filters.push(args);return builder;}),
 maybeSingle:vi.fn(async()=>({data:null,error:null})),order:vi.fn(()=>builder),limit:vi.fn(()=>builder),or:vi.fn(()=>builder),
 then:(resolve:(value:unknown)=>void)=>Promise.resolve(resolve({data:[{id,type:"new_message",category:"messages",payload:{message:"Fixture",conversationId:id,privateDiagnostic:"secret",url:"https://evil.invalid"},read_at:null,created_at:"2026-10-13T00:00:00Z"}],count:1,error:null}))};
 return {filters,from:vi.fn(()=>builder),auth:{getUser:vi.fn(async()=>({data:{user:{id:userId,is_anonymous:false}},error:null}))},
 rpc:vi.fn(async(name:string)=>({data:name==="notification_access"?true:name==="notification_client_flags"?{inbox:true,push:false}:1,error:null}))};
}
beforeEach(()=>{vi.clearAllMocks();client=makeClient();mocks.client.mockResolvedValue(client);});
describe("authenticated notification endpoints",()=>{
 it("derives the recipient from the session and projects only safe display fields",async()=>{
  const response=await handleNotificationApi(new Request("https://fixture.invalid/api/notifications"));
  expect(response.status).toBe(200);const body=await response.json();
  expect(client.filters).toContainEqual(["recipient_id",userId]);
  expect(client.filters).toContainEqual(["archived_at",null]);
  expect(body.items[0].href).toBe("/messages/"+id);
  expect(JSON.stringify(body)).not.toMatch(/secret|evil.invalid/);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
 });
 it("rejects caller-supplied recipients before querying records",async()=>{
  const response=await handleNotificationApi(new Request("https://fixture.invalid/api/notifications?recipientId="+id));
  expect(response.status).toBe(422);expect(client.from).not.toHaveBeenCalled();
 });
 it("requires a validated active non-anonymous session",async()=>{
  client.rpc.mockResolvedValueOnce({data:false,error:null});
  expect((await handleNotificationApi(new Request("https://fixture.invalid/api/notifications"))).status).toBe(401);
  expect(client.from).not.toHaveBeenCalled();
 });
 it("rejects cross-origin state changes before authentication or writes",async()=>{
  const response=await handleNotificationApi(new Request("https://fixture.invalid/api/notifications",{method:"PATCH",headers:{origin:"https://elsewhere.invalid"},body:JSON.stringify({action:"read",id})}));
  expect(response.status).toBe(403);expect(mocks.client).not.toHaveBeenCalled();
 });
 it("passes only the allowed action to the owner-scoped RPC",async()=>{
  const response=await handleNotificationApi(new Request("https://fixture.invalid/api/notifications",{method:"PATCH",headers:{origin:"https://fixture.invalid"},body:JSON.stringify({action:"archive",id})}));
  expect(response.status).toBe(200);expect(client.rpc).toHaveBeenCalledWith("notification_update_state",{action:"archive",target:id,through:null});
 });
});
