import { afterEach, describe, expect, it, vi } from "vitest";
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, auth: { getUser } }) }));
vi.mock("./presentation-data", () => ({ enrichDiscoveryItems: async <T,>(items: T[]) => items }));
import { handleSavedSpecials } from "./saved-specials-api";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request=(method:string,origin="https://pinpoint.test",body:unknown={category:"shopping",id})=>new Request("https://pinpoint.test/api/saved-specials",{method,headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(body)});
afterEach(() => vi.resetAllMocks());
describe("account-backed Specials saving", () => {
 it("rejects cross-origin mutations before database access", async () => { expect((await handleSavedSpecials(request("POST","https://other.test"))).status).toBe(403); expect(rpc).not.toHaveBeenCalled(); });
 it("requires an actual signed-in account", async () => { getUser.mockResolvedValue({data:{user:null}});expect((await handleSavedSpecials(request("POST"))).status).toBe(401);expect(rpc).not.toHaveBeenCalled(); });
 it("rejects malformed targets rather than accepting arbitrary IDs", async () => { expect((await handleSavedSpecials(request("POST",undefined,{category:"service",id}))).status).toBe(422);expect(rpc).not.toHaveBeenCalled(); });
 it("uses the validated RPC and returns real aggregate counts", async () => { getUser.mockResolvedValue({data:{user:{id,is_anonymous:false}}});rpc.mockResolvedValue({data:{saved:true,savedCount:76},error:null});const response=await handleSavedSpecials(request("POST"));expect(await response.json()).toEqual({saved:true,savedCount:76});expect(rpc).toHaveBeenCalledWith("saved_specials_write",{category:"shopping",target:id,save:true});expect(response.headers.get("cache-control")).toBe("private, no-store"); });
 it("permits removal with the same ownership-bound RPC", async () => { getUser.mockResolvedValue({data:{user:{id}}});rpc.mockResolvedValue({data:{saved:false,savedCount:75},error:null});await handleSavedSpecials(request("DELETE"));expect(rpc).toHaveBeenCalledWith("saved_specials_write",{category:"shopping",target:id,save:false}); });
});
