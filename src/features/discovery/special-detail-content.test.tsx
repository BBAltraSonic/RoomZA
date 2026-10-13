// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpecialDetailContent } from "./special-detail-content";
import { openSpecialDirections } from "./special-detail-data";
vi.mock("./saved-specials-client", () => ({ useSavedSpecial: () => ({ saved: false, pending: false, count: 3, toggle: vi.fn() }) }));
vi.mock("@/features/admin/components/report-panel", () => ({ ReportPanel: () => <button>Report this offer</button> }));
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", other="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", now="2026-10-09T10:00:00Z";
const common = { title:"Published title", address:"Approved address", areaId:id, latitude:-33, longitude:18, startsAt:now, endsAt:"2026-10-09T12:00:00Z", publicContact:{email:"venue@example.com"}, contactConsent:true, visitUrl:"https://example.com/this-post", bookingUrl:"https://example.com/book-this-post", priceCents:0 };
const entry=(category:"event"|"tourism"="event",target=id)=>({item:{entryId:target,category,content:{...common,description:"Long approved description. ".repeat(30),venueName:"Approved venue"},approvedAt:now,state:"live"},serverNow:now});
const offer={status:"live",offerId:id,revisionId:id,areaId:id,confirmedAt:now,serverNow:now,startsAt:now,endsAt:common.endsAt,content:{...common,benefit:"Approved benefit",terms:"Full approved terms",shopName:"Approved shop"},place:{id,name:"Place",region:"ZA",fullAddress:"Approved address"},poster:{username:"poster",displayName:"Poster"}};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
describe("Shared Special details",()=>{
  it.each(["event","tourism","shopping"] as const)("renders approved %s content and exact post actions",async category=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json(category==="shopping"?offer:entry(category))));
    render(<SpecialDetailContent target={{id,category}} contained />);
    expect(await screen.findByRole("heading",{name:"Published title"})).toBeVisible();
    const book=await screen.findByRole("link",{name:"Book"}),visit=screen.getByRole("link",{name:"Visit"});
    expect(book).toHaveAttribute("href",common.bookingUrl);expect(book).toHaveAttribute("target","_blank");expect(book).toHaveAttribute("rel","noopener noreferrer");expect(visit).toHaveAttribute("href",common.visitUrl);
    expect(screen.getByText("Free")).toBeVisible();expect(screen.getAllByText(/9 Oct 2026, 12:00 SAST/)[0]).toBeVisible();
    expect(screen.getByRole("button",{name:"Directions"})).toBeEnabled();
    if(category==="shopping"){expect(screen.getByText("Full approved terms")).toBeVisible();expect(screen.getByText("Approved benefit")).toBeVisible();expect(screen.getByText(/Posted by Poster/)).toBeVisible();}
    else expect(screen.getByText(entry().item.content.description.trim())).toBeVisible();
  });
  it("omits missing links, price and imagery without inventing values",async()=>{
    const value=entry(); delete (value.item.content as Partial<typeof common>).visitUrl;delete (value.item.content as Partial<typeof common>).bookingUrl;delete (value.item.content as Partial<typeof common>).priceCents;
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json(value)));render(<SpecialDetailContent target={{id,category:"event"}} />);await screen.findByRole("heading",{name:"Published title"});
    expect(screen.queryByRole("link",{name:"Book"})).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Visit"})).not.toBeInTheDocument();expect(screen.queryByText("Free")).not.toBeInTheDocument();expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("disables external actions during refresh and clears them on withdrawal",async()=>{
    let resolve!: (response:Response)=>void;
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json(entry())).mockImplementationOnce(()=>new Promise<Response>(done=>{resolve=done;}));vi.stubGlobal("fetch",fetcher);
    render(<SpecialDetailContent target={{id,category:"event"}} contained />);await screen.findByRole("link",{name:"Visit"});fireEvent.click(screen.getByRole("button",{name:"Check again"}));
    expect(screen.queryByRole("link",{name:"Visit"})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Directions"})).toBeDisabled();
    await act(async()=>resolve(Response.json({item:null,serverNow:now},{status:404})));expect(screen.queryByText("Approved venue")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Directions"})).not.toBeInTheDocument();
  });
  it("ignores a late result after the selected item changes",async()=>{
    let resolve!: (response:Response)=>void;
    vi.stubGlobal("fetch",vi.fn().mockImplementationOnce(()=>new Promise<Response>(done=>{resolve=done;})).mockResolvedValueOnce(Response.json({...entry("event",other),item:{...entry("event",other).item,content:{...entry().item.content,title:"Second title"}}})));
    const view=render(<SpecialDetailContent target={{id,category:"event"}} />);view.rerender(<SpecialDetailContent target={{id:other,category:"event"}} />);await screen.findByRole("heading",{name:"Second title"});await act(async()=>resolve(Response.json(entry())));expect(screen.queryByRole("heading",{name:"Published title"})).not.toBeInTheDocument();
  });
  it("fails closed on category mismatch",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json(entry("tourism"))));render(<SpecialDetailContent target={{id,category:"event"}} />);expect(await screen.findByRole("alert")).toHaveTextContent("Could not check");expect(screen.queryByRole("link",{name:"Book"})).not.toBeInTheDocument();
  });
  it("times out a stalled read with a retry state",async()=>{
    vi.useFakeTimers();vi.stubGlobal("fetch",vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(new Error("timeout"))))));render(<SpecialDetailContent target={{id,category:"event"}} />);
    await act(async()=>vi.advanceTimersByTimeAsync(12000));expect(screen.getByRole("alert")).toHaveTextContent("Could not check");expect(screen.getByRole("button",{name:"Check again"})).toBeEnabled();
  });
  it.each(["shopping","event"] as const)("opens validated %s Maps destinations rather than JSON endpoints",async category=>{
    const url="https://www.google.com/maps/dir/?api=1&destination=-33,18",navigate=vi.fn();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({[category==="shopping"?"destination":"url"]:url,serverNow:now,endsAt:common.endsAt})));
    await openSpecialDirections({id,category},new AbortController().signal,performance.now()+60000,navigate);expect(navigate).toHaveBeenCalledWith(url);
  });
  it("refuses expired directions and a non-Maps destination",async()=>{
    const navigate=vi.fn();vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(Response.json({url:"https://www.google.com/maps/dir/?api=1&destination=-33,18",serverNow:common.endsAt,endsAt:common.endsAt})).mockResolvedValueOnce(Response.json({url:"https://example.com",serverNow:now,endsAt:common.endsAt})));
    await expect(openSpecialDirections({id,category:"event"},new AbortController().signal,performance.now()+60000,navigate)).rejects.toThrow();await expect(openSpecialDirections({id,category:"event"},new AbortController().signal,performance.now()+60000,navigate)).rejects.toThrow();expect(navigate).not.toHaveBeenCalled();
  });
  it.each(["https://user:secret@www.google.com/maps/dir/?api=1&destination=-33,18", "https://www.google.com/maps/dir/?api=1&destination=-33,18&redirect=elsewhere", "https://www.google.com/maps/dir/?api=1&destination=--33,18"])("rejects malformed venue directions %s",async url=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({url,serverNow:now,endsAt:common.endsAt})));
    await expect(openSpecialDirections({id,category:"event"},new AbortController().signal,performance.now()+60000,vi.fn())).rejects.toThrow();
  });
});
