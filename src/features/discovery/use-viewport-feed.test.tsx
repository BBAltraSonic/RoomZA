// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { clearFeedCache } from "./feed-cache";
import { useViewportFeed } from "./use-viewport-feed";
import type { ViewportQuery } from "./viewport-contract";
const query: ViewportQuery = { category:"service",bounds:{west:18,south:-34,east:19,north:-33},q:"",sort:"Latest",serviceType:"All services" };
const feed = { category:"service",bounds:query.bounds,serverNow:"2026-01-01T00:00:00Z",items:[],totalCount:0 };
afterEach(() => { cleanup(); clearFeedCache(); vi.useRealTimers(); vi.unstubAllGlobals(); });
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
const service = { id:"11111111-1111-4111-8111-111111111111",area_id:"b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb",approved_at:"2026-01-01T00:00:00Z",content:{title:"Fixture",providerName:"Fixture",serviceType:"Plumbing",description:"Fixture",areaId:"b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb",address:"Fixture",latitude:-33.5,longitude:18.5,phone:"+27 11 000 0000"} };
const serviceFeed = { ...feed, items:[service], totalCount:1 };
it("should paint a revisited viewport at once and refresh behind it", async()=>{
  vi.useFakeTimers(); const fetch=vi.fn(async ()=>Response.json(serviceFeed)); vi.stubGlobal("fetch",fetch);
  const moved={...query,bounds:{...query.bounds,east:20}};
  const {result,rerender}=renderHook(({q})=>useViewportFeed(q),{initialProps:{q:query}});
  await advance(); expect(result.current.feed?.items).toHaveLength(1);
  fetch.mockImplementation(async()=>Response.json({...feed,bounds:moved.bounds}));
  rerender({q:moved}); await advance(); expect(result.current.feed?.items).toHaveLength(0);
  fetch.mockImplementation(()=>new Promise<Response>(()=>{}));
  rerender({q:query});
  expect(result.current.feed?.items).toHaveLength(1);
  expect(result.current.loading).toBe(false);
});
it("should not show loading or change rows when a refresh finds nothing new", async()=>{
  vi.useFakeTimers(); let release!:(response:Response)=>void; const fetch=vi.fn(async ()=>Response.json(serviceFeed)); vi.stubGlobal("fetch",fetch);
  const {result}=renderHook(()=>useViewportFeed(query));
  await advance(); const items=result.current.feed?.items;
  fetch.mockImplementation(()=>new Promise<Response>(resolve=>{release=resolve;}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
  expect(result.current.loading).toBe(false);
  await act(async()=>{release(Response.json(serviceFeed));await vi.advanceTimersByTimeAsync(0);});
  expect(result.current.feed?.items).toBe(items);
});
it("should not reuse a cached viewport after a special in it has ended", async()=>{
  vi.useFakeTimers({now:Date.parse("2026-01-01T00:00:00Z")});
  const eventQuery:ViewportQuery={...query,category:"event",sort:"Ending soon"};
  const item={entryId:"11111111-1111-4111-8111-111111111111",category:"event",approvedAt:"2026-01-01T00:00:00Z",state:"live",content:{title:"Fixture",description:"Fixture",venueName:"Fixture",areaId:"b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb",address:"Fixture",latitude:-33.9,longitude:18.4,startsAt:"2025-12-31T00:00:00Z",endsAt:"2026-01-01T00:00:05Z"}};
  const fetch=vi.fn(async ()=>Response.json({...feed,category:"event",items:[item],totalCount:1})); vi.stubGlobal("fetch",fetch);
  const first=renderHook(()=>useViewportFeed(eventQuery)); await advance(); expect(first.result.current.feed?.items).toHaveLength(1); first.unmount();
  await vi.advanceTimersByTimeAsync(6000);
  fetch.mockImplementation(()=>new Promise<Response>(()=>{}));
  const moved={...eventQuery,bounds:{...query.bounds,east:20}};
  const second=renderHook(({q})=>useViewportFeed(q),{initialProps:{q:moved}});
  second.rerender({q:eventQuery});
  expect(second.result.current.feed).toBeNull();
});
