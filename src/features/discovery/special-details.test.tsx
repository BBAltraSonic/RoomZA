// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import { SpecialDetailsProvider, SpecialDetailSurface, useSpecialDetails } from "./special-details";
import { SpecialDetailContent } from "./special-detail-content";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { DiscoveryShell } from "./discovery-shell";
import type { PublicEntry } from "@/features/entries/public-contract";
const ui=vi.hoisted(()=>({desktop:true,save:vi.fn()}));
vi.mock("next/dynamic",()=>({default:()=> (props:ComponentProps<typeof SpecialDetailContent>)=><SpecialDetailContent {...props}/>}));
vi.mock("next/link",()=>({default:({children,onNavigate,...props}:{children:ReactNode;onNavigate?:(event:{preventDefault:()=>void})=>void;href:string;prefetch?:boolean})=>{
  const {prefetch,...rest}=props;void prefetch;
  return <a {...rest} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();onNavigate?.(event);}}}>{children}</a>;
}}));
vi.mock("./saved-specials-client",()=>({useSavedSpecial:()=>({saved:false,pending:false,count:0,toggle:ui.save})}));
vi.mock("@/features/admin/components/report-panel",()=>({ReportPanel:()=>null}));
vi.mock("@/lib/motion/primitives",()=>({BlurImage:({alt}:{alt:string})=><span role="img" aria-label={alt}/> }));
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",now="2026-10-09T10:00:00Z";
const item:PublicEntry={entryId:id,category:"event",approvedAt:now,state:"live",content:{title:"Specific event",description:"Complete event information",venueName:"Venue",address:"Address",areaId:id,latitude:-33,longitude:18,startsAt:now,endsAt:"2026-10-09T12:00:00Z",visitUrl:"https://example.com/specific-event",bookingUrl:"https://example.com/tickets"},media:[{id,url:"https://example.com/photo.jpg"}]};
const shoppingContent = { ...item.content, benefit: "Shopping benefit", terms: "Shopping terms", shopName: "Shop" };
const { description: ignoredDescription, venueName: ignoredVenue, ...validShoppingContent } = shoppingContent;
void ignoredDescription; void ignoredVenue;
function Browse({category="event"}:{category?:"event"|"tourism"|"shopping"}){
  const details=useSpecialDetails();
  const card=(expanded:boolean)=>category==="shopping"?<OfferFeedCard item={{offerId:id,revisionId:id,confirmedAt:now,startsAt:now,endsAt:item.content.endsAt,areaId:id,status:"live",content:validShoppingContent,place:{id,name:"Place",region:"ZA",fullAddress:"Address"},poster:null,media:item.media}} expanded={expanded}/>:<EntryFeedCard item={{...item,category}} expanded={expanded}/>;
  return <DiscoveryShell header={<header>Discovery header</header>} results={<div data-testid="results">{card(false)}</div>} resultsLabel="Results" detail={details?.id?<SpecialDetailSurface/>:undefined} map={<div data-testid="map">Map{!details?.id?card(true):null}</div>}/>;
}
beforeEach(()=>{
  ui.desktop=true;ui.save.mockReset();
  vi.stubGlobal("matchMedia",vi.fn((query:string)=>({matches:query.includes("1024")&&ui.desktop,media:query,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()})));
  vi.stubGlobal("fetch",vi.fn().mockImplementation((url:string)=>Promise.resolve(Response.json(url.includes("/offers/")?{status:"live",offerId:id,revisionId:id,areaId:id,confirmedAt:now,serverNow:now,startsAt:now,endsAt:item.content.endsAt,content:validShoppingContent,place:{id,name:"Place",region:"ZA",fullAddress:"Address"},poster:null}:{item,serverNow:now}))));
  window.history.replaceState({preserved:true},"","/offers?kind=event&bbox=18,-34,19,-33&q=music&sort=Latest&view=feed&page=2");
});
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each(["map","results"] as const)("opens the same desktop detail content from the %s card and restores focus on close",async source=>{
  render(<SpecialDetailsProvider category="event"><Browse/></SpecialDetailsProvider>);
  const link=within(screen.getByTestId(source)).getByRole("link",{name:"Specific event"});link.focus();fireEvent.click(link);
  expect(await screen.findByText("Complete event information")).toBeVisible();expect(screen.getByRole("link",{name:"Visit"})).toHaveAttribute("href",item.content.visitUrl);
  expect(window.location.search).toContain("detailId="+id);expect(window.location.search).toContain("page=2");expect(window.location.search).toContain("q=music");expect(window.history.state).toEqual({preserved:true});
  const resultContainer=screen.getByTestId("results");expect(resultContainer.closest(".hidden")).not.toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Close Special details"}));await waitFor(()=>expect(screen.queryByText("Complete event information")).not.toBeInTheDocument());expect(within(screen.getByTestId("results")).getByRole("link",{name:"Specific event"})).toHaveFocus();expect(window.location.search).not.toContain("detailId");expect(window.location.search).toContain("bbox=");
});
it("opens image details while keeping map and Save actions independent",async()=>{
  render(<SpecialDetailsProvider category="event"><Browse/></SpecialDetailsProvider>);
  const result=screen.getByTestId("results");fireEvent.click(within(result).getByRole("button",{name:"Save Special"}));expect(ui.save).toHaveBeenCalledOnce();expect(window.location.search).not.toContain("detailId");
  fireEvent.click(within(result).getByRole("link",{name:"View details: Specific event"}));await screen.findByText("Complete event information");
});
it.each(["shopping", "tourism", "event"] as const)("uses the same %s cover in result/map cards and the complete detail carousel", async category => {
  const media = [item.media![0]!, { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", url: "https://example.com/second.jpg" }];
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json(category === "shopping"
    ? { status: "live", offerId: id, revisionId: id, areaId: id, confirmedAt: now, serverNow: now, startsAt: now, endsAt: item.content.endsAt, content: validShoppingContent, place: { id, name: "Place", region: "ZA", fullAddress: "Address" }, poster: null, media }
    : { item: { ...item, category, media }, serverNow: now }))));
  render(<SpecialDetailsProvider category={category}><Browse category={category} /></SpecialDetailsProvider>);
  expect(within(screen.getByTestId("results")).getByRole("img", { name: item.content.title })).toBeInTheDocument();
  expect(within(screen.getByTestId("map")).getByRole("img", { name: item.content.title })).toBeInTheDocument();
  fireEvent.click(within(screen.getByTestId("map")).getByRole("link", { name: "View details: " + item.content.title }));
  expect(await screen.findByText("1 / 2")).toBeVisible();
  expect(screen.getByRole("img", { name: item.content.title + ", photo 1" })).toBeVisible();
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: vi.fn(), configurable: true, writable: true });
  fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
  expect(screen.getByRole("img", { name: item.content.title + ", photo 2" })).toBeVisible();
});
it("restores URL-backed details through reload and Back/Forward",async()=>{
  render(<SpecialDetailsProvider category="event"><Browse/></SpecialDetailsProvider>);fireEvent.click(within(screen.getByTestId("results")).getByRole("link",{name:"Specific event"}));await screen.findByText("Complete event information");
  await act(async()=>{window.history.back();await new Promise(resolve=>setTimeout(resolve,50));});await waitFor(()=>expect(screen.queryByText("Complete event information")).not.toBeInTheDocument());
  await act(async()=>{window.history.forward();await new Promise(resolve=>setTimeout(resolve,50));});await screen.findByText("Complete event information");
  cleanup();render(<SpecialDetailsProvider category="event"><Browse/></SpecialDetailsProvider>);await screen.findByText("Complete event information");
});
it("uses a mobile modal sheet with the same content and Escape dismissal",async()=>{
  ui.desktop=false;render(<SpecialDetailsProvider category="event"><Browse/></SpecialDetailsProvider>);fireEvent.click(within(screen.getByTestId("results")).getByRole("link",{name:"Specific event"}));
  const dialog=await screen.findByRole("dialog",{name:"Special details"});expect(dialog).toHaveAttribute("aria-modal","true");expect(within(dialog).getByText("Complete event information")).toBeVisible();
  fireEvent.keyDown(dialog,{key:"Escape"});await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(window.location.search).not.toContain("detailId");
});
it("loads Shopping's full terms through the same surface",async()=>{
  window.history.replaceState(null,"","/offers?detailId="+id);render(<SpecialDetailsProvider category="shopping"><Browse category="shopping"/></SpecialDetailsProvider>);expect(await screen.findByText("Shopping terms")).toBeVisible();expect(screen.getByText("Shopping benefit")).toBeVisible();
});
it("dismisses the desktop panel with Escape even when focus returns to the map",async()=>{
  render(<SpecialDetailsProvider category="event"><Browse/></SpecialDetailsProvider>);
  fireEvent.click(within(screen.getByTestId("results")).getByRole("link",{name:"Specific event"}));
  await screen.findByText("Complete event information");
  fireEvent.keyDown(document,{key:"Escape"});
  await waitFor(()=>expect(screen.queryByText("Complete event information")).not.toBeInTheDocument());
});
