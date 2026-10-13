// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { ViewportDiscoveryScreen } from "./viewport-discovery-screen";
import type { DiscoveryMapProps } from "./discovery-map";
import type { DiscoveryPlace } from "@/features/places/place";
import type { ViewportQuery, ViewportResponse } from "./viewport-contract";
const fixture = vi.hoisted(() => ({ map: null as DiscoveryMapProps | null, query: null as ViewportQuery | null, feed: null as ViewportResponse | null, loading: false, error: false, refresh: vi.fn() }));
const areaId="b247a158-ae5d-4ed8-b1d4-a0081f3f7cdb";
const place: DiscoveryPlace={id:areaId,providerId:"fixture",label:"Rondebosch",secondaryLabel:"Cape Town",fullAddress:"Rondebosch, Cape Town",center:{lat:-33.96,lng:18.48},bounds:{west:18.45,south:-34,east:18.52,north:-33.9}};
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams(),useRouter:()=>({push:(href:string)=>window.history.pushState(window.history.state,"",href)})}));
vi.mock("./discovery-map-loader",()=>({DiscoveryMapLoader:(props:DiscoveryMapProps)=>{fixture.map=props; return <div data-testid="pins">{props.points.map(p=><span key={p.id}>{p.title}</span>)}</div>;}}));
vi.mock("./use-viewport-feed",()=>({useViewportFeed:(query:ViewportQuery|null)=>{fixture.query=query;return {feed:fixture.feed,loading:fixture.loading,error:fixture.error,refresh:fixture.refresh};}}));
vi.mock("@/features/map-discovery/location-selector",()=>({LocationSelector:({onSelect}:{onSelect:(place:DiscoveryPlace)=>void})=><button onClick={()=>onSelect(place)}>Choose fixture location</button>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,"","/");fixture.map=null;fixture.query=null;fixture.feed=null;fixture.loading=false;fixture.error=false;});
it.each(["shopping","tourism","event","service"] as const)("loads %s from initial map bounds without area selection or a card click",category=>{
  window.history.replaceState({preserved:true},"",category==="service"?"/services":"/offers");
  render(<ViewportDiscoveryScreen category={category}/>);
  expect(fixture.map).not.toBeNull();expect(fixture.query).toBeNull();
  act(()=>fixture.map!.onBoundsChange!({west:18,south:-34,east:19,north:-33}));
  expect(fixture.query).toMatchObject({category,bounds:{west:18,south:-34,east:19,north:-33}});
  expect(new URL(window.location.href).searchParams.get("bbox")).toBe("18,-34,19,-33");
  expect(window.history.state).toEqual({preserved:true});
  expect(screen.queryByText(/Choose a location to see/)).not.toBeInTheDocument();
});
it("uses shared bounds before area and carries them across category tabs",()=>{
  vi.stubGlobal("fetch",vi.fn(()=>new Promise(()=>{})));
  window.history.replaceState(null,"",`/offers?areaId=${areaId}&bbox=20,-30,21,-29`);
  render(<ViewportDiscoveryScreen category="shopping"/>);
  expect(fixture.map?.targetBounds).toEqual({west:20,south:-30,east:21,north:-29});
  for(const label of ["Places","Events","Services"]) expect(new URL(screen.getByRole("link",{name:label}).getAttribute("href")!,window.location.origin).searchParams.get("bbox")).toBe("20,-30,21,-29");
});
it("resolves a legacy area link before positioning and requesting its viewport",async()=>{
  let resolve!: (response:Response)=>void;
  vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(done=>{resolve=done;})));
  window.history.replaceState(null,"",`/offers?areaId=${areaId}`);
  render(<ViewportDiscoveryScreen category="tourism"/>);
  expect(fixture.map).toBeNull();expect(fixture.query).toBeNull();
  await act(async()=>resolve(Response.json({data:{place}})));
  expect(fixture.map?.targetBounds).toEqual(place.bounds);
  act(()=>fixture.map!.onBoundsChange!(place.bounds));
  expect(fixture.query?.bounds).toEqual(place.bounds);
  act(()=>fixture.map!.onBoundsChange!({west:20,south:-30,east:21,north:-29}));
  expect(fixture.query?.bounds.west).toBe(20);
  expect(fixture.query).not.toHaveProperty("areaId");
});
it("location selection moves the camera and subsequent movement leaves the suburb",()=>{
  vi.stubGlobal("fetch",vi.fn(()=>new Promise(()=>{})));
  window.history.replaceState(null,"","/services?bbox=20,-30,21,-29");
  render(<ViewportDiscoveryScreen category="service"/>);
  fireEvent.click(screen.getByRole("button",{name:"Choose fixture location"}));
  expect(fixture.map?.targetBounds).toEqual(place.bounds);
  act(()=>fixture.map!.onBoundsChange!({west:22,south:-30,east:23,north:-29}));
  expect(fixture.query?.bounds.west).toBe(22);
});
it("renders cards and pins from the same results, retaining them with a retry message",()=>{
  const id="11111111-1111-4111-8111-111111111111";
  fixture.feed={category:"service",bounds:place.bounds,serverNow:"2026-10-08T00:00:00Z",totalCount:251,items:[{id,area_id:areaId,approved_at:"2026-10-08T00:00:00Z",content:{title:"Fixture plumber",providerName:"Fixture",serviceType:"Plumbing",description:"Fixture only",phone:"+27000000000",areaId,address:"Rondebosch",latitude:-33.96,longitude:18.48}}]};
  fixture.error=true;
  render(<ViewportDiscoveryScreen category="service"/>);
  expect(screen.getByTestId("pins")).toHaveTextContent("Fixture plumber");
  expect(screen.getByRole("heading",{name:"Fixture plumber"})).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Previously loaded results remain available");
  expect(screen.getByText(/Showing up to 250 listings/)).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"Refresh services"}));expect(fixture.refresh).toHaveBeenCalled();
});
