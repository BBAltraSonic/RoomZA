// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useViewportFeed } from "./use-viewport-feed";
import type { ViewportQuery } from "./viewport-contract";
const query: ViewportQuery = { category:"service",bounds:{west:18,south:-34,east:19,north:-33},q:"",sort:"Latest",serviceType:"All services" };
const feed = { category:"service",bounds:query.bounds,serverNow:"2026-01-01T00:00:00Z",items:[],totalCount:0 };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const advance = () => act(async () => { await vi.advanceTimersByTimeAsync(201); });
it("waits for map bounds, automatically loads and refetches for settled movement", async () => {
  vi.useFakeTimers(); const fetch = vi.fn().mockResolvedValue(Response.json(feed)); vi.stubGlobal("fetch",fetch);
  const { result, rerender } = renderHook(({query})=>useViewportFeed(query),{initialProps:{query:null as ViewportQuery|null}});
  await advance(); expect(fetch).not.toHaveBeenCalled();
  rerender({query}); await advance(); expect(result.current.feed).toEqual(feed);
  const next = {...query,bounds:{...query.bounds,east:20}}; fetch.mockResolvedValue(Response.json({...feed,bounds:next.bounds}));
  rerender({query:next}); await advance(); expect(fetch.mock.calls[1]?.[0]).toContain("bbox=18%2C-34%2C20%2C-33");
  expect(result.current.feed?.bounds.east).toBe(20);
});
it("ignores superseded responses and retains the last results on a failed refresh", async () => {
  vi.useFakeTimers(); let first!: (response:Response)=>void;
  const fetch = vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{first=resolve;})).mockResolvedValueOnce(Response.json({...feed,bounds:{...query.bounds,east:20}})); vi.stubGlobal("fetch",fetch);
  const { result, rerender } = renderHook(({query})=>useViewportFeed(query),{initialProps:{query}});
  await advance(); const signal=fetch.mock.calls[0]?.[1].signal;
  rerender({query:{...query,bounds:{...query.bounds,east:20}}}); await advance(); expect(signal.aborted).toBe(true);
  await act(async()=>first(Response.json(feed))); expect(result.current.feed?.bounds.east).toBe(20);
  fetch.mockRejectedValue(new Error("offline")); act(()=>result.current.refresh()); await advance();
  expect(result.current.error).toBe(true); expect(result.current.feed?.bounds.east).toBe(20);
});
it("rejects replies from a different viewport", async()=>{
  vi.useFakeTimers(); vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({...feed,bounds:{...query.bounds,east:20}})));
  const {result}=renderHook(()=>useViewportFeed(query)); await advance(); expect(result.current.feed).toBeNull(); expect(result.current.error).toBe(true);
});
it("removes expired results even when a moved viewport fails to refresh", async()=>{
  vi.useFakeTimers();
  const eventQuery:ViewportQuery={...query,category:"event",sort:"Ending soon"};
  const item={entryId:"11111111-1111-4111-8111-111111111111",category:"event",approvedAt:"2026-01-01T00:00:00Z",state:"live",content:{title:"Fixture",description:"Fixture",venueName:"Fixture",areaId:"b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb",address:"Fixture",latitude:-33.9,longitude:18.4,startsAt:"2025-12-31T00:00:00Z",endsAt:"2026-01-01T00:00:01Z"}};
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({...feed,category:"event",items:[item],totalCount:1})).mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch",fetch);
  const {result,rerender}=renderHook(({q})=>useViewportFeed(q),{initialProps:{q:eventQuery}});
  await advance();expect(result.current.feed?.items).toHaveLength(1);
  rerender({q:{...eventQuery,bounds:{...query.bounds,east:20}}});await advance();
  expect(result.current.error).toBe(true);expect(result.current.feed?.items).toHaveLength(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(result.current.feed).toBeNull();
});
