// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const account = vi.hoisted(() => ({ isAuthenticated: false }));
vi.mock("@/components/navigation/navigation-account-context", () => ({useDiscoveryAccount:()=>account}));
vi.mock("next/navigation", () => ({useRouter:()=>({push:vi.fn()})}));
vi.mock("sonner", () => ({toast:{error:vi.fn(),info:vi.fn(),success:vi.fn()}}));
import { useFavorites } from "./use-favorites";
import { publishNavigationIdentity } from "@/features/auth/navigation-account-events";
function deferred<T>() { let resolve!: (value:T)=>void; const promise = new Promise<T>(r=>{resolve=r;}); return {promise,resolve}; }
const payload = (ids:string[]) => ({ data:{authenticated:true,favorites:ids} });
const response = (ids:string[]) => ({ok:true,json:async()=>payload(ids)});
beforeEach(()=>{account.isAuthenticated=false;vi.stubGlobal("fetch",vi.fn());});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("saved homes identity races",()=>{
  it("keeps a known signed-in identity usable when saved homes are unavailable",async()=>{
    account.isAuthenticated=true;vi.mocked(fetch).mockRejectedValue(new Error("Contained saved-home outage"));
    const {result}=renderHook(()=>useFavorites());await waitFor(()=>expect(result.current.error).toBe(true));
    expect(result.current.authenticated).toBe(true);expect([...result.current.favorites]).toEqual([]);
  });
  it("rejects late JSON from a previous account",async()=>{
    const body=deferred<ReturnType<typeof payload>>();
    vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:()=>body.promise} as Response).mockResolvedValueOnce(response(["new"]) as Response);
    const {result}=renderHook(()=>useFavorites());
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    await act(async()=>publishNavigationIdentity("next-user"));
    await waitFor(()=>expect(result.current.favorites.has("new")).toBe(true));
    await act(async()=>body.resolve(payload(["old"])));
    expect([...result.current.favorites]).toEqual(["new"]);
  });
  it("clears immediately on sign-out and ignores a late failed mutation",async()=>{
    const write=deferred<Response>();
    vi.mocked(fetch).mockResolvedValueOnce(response(["home"]) as Response).mockImplementationOnce(()=>write.promise);
    const {result}=renderHook(()=>useFavorites());
    await waitFor(()=>expect(result.current.authenticated).toBe(true));
    let mutation!:Promise<boolean>;
    act(()=>{mutation=result.current.toggleFavorite("home");});
    act(()=>publishNavigationIdentity(null));
    expect(result.current.authenticated).toBe(false);
    expect(result.current.favorites.size).toBe(0);
    await act(async()=>{write.resolve({ok:false} as Response);await mutation;});
    expect(result.current.favorites.size).toBe(0);
  });
  it("does not reuse a disposed read on remount",async()=>{
    const old=deferred<ReturnType<typeof payload>>();
    vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:()=>old.promise} as Response).mockResolvedValueOnce(response(["fresh"]) as Response);
    const first=renderHook(()=>useFavorites());
    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    first.unmount();
    const next=renderHook(()=>useFavorites());
    await waitFor(()=>expect(next.result.current.favorites.has("fresh")).toBe(true));
    await act(async()=>old.resolve(payload(["disposed"])));
    expect([...next.result.current.favorites]).toEqual(["fresh"]);
  });
});
