// @vitest-environment jsdom
import { Component, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({request:vi.fn(),accept:vi.fn(),decline:vi.fn(),cancel:vi.fn(),complete:vi.fn(),checkIn:vi.fn(),current:vi.fn(),inbox:vi.fn(),byId:vi.fn(),success:vi.fn(),error:vi.fn(),client:vi.fn(),push:vi.fn(),refresh:vi.fn()}));
vi.mock("@/features/showings/actions",()=>({requestShowing:mocks.request,acceptShowing:mocks.accept,declineShowing:mocks.decline,cancelShowing:mocks.cancel,completeShowing:mocks.complete,checkInShowing:mocks.checkIn,getCurrentShowing:mocks.current,getLandlordShowingState:mocks.inbox}));
vi.mock("@/features/chat/actions",()=>({requestListingVideoCall:vi.fn(),requestListingVoiceCall:vi.fn()}));
vi.mock("@/lib/supabase/browser",()=>({createClient:mocks.client}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push,refresh:mocks.refresh})}));
vi.mock("sonner",()=>({toast:{success:mocks.success,error:mocks.error}}));
import { ConnectNowSheet } from "./connect-now-sheet";
import { ShowingRequestBanner } from "./showing-request-banner";
import type { ShowingRequest } from "./actions";

const listingId="550e8400-e29b-41d4-a716-446655440021",ownerId="550e8400-e29b-41d4-a716-446655440022";
const request={id:"550e8400-e29b-41d4-a716-446655440023",listing_id:listingId,renter_id:"550e8400-e29b-41d4-a716-446655440024",landlord_id:ownerId,status:"requested",window_choice:"now",eta_minutes:null,requested_at:new Date().toISOString(),expires_at:new Date(Date.now()+900000).toISOString(),responded_at:null,checked_in_at:null,completed_at:null,created_at:new Date().toISOString(),conversation_id:null} satisfies ShowingRequest;
const props={listingId,latitude:-26,longitude:28,presence:"available" as const,inline:true,onMessage:vi.fn(async()=>{})};
const accepted={...request,status:"accepted" as const,conversation_id:"550e8400-e29b-41d4-a716-446655440025"};
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<p role="alert">Controls failed</p>:this.props.children;}}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
async function open(){fireEvent.click(screen.getByRole("button",{name:"Connect now"}));return screen.findByRole("button",{name:"Right now"});}
beforeEach(()=>{
  vi.resetAllMocks();mocks.current.mockResolvedValue({success:true,data:{request:null}});mocks.inbox.mockResolvedValue({success:true,data:{request}});
  mocks.request.mockResolvedValue({success:true,data:{request}});mocks.accept.mockResolvedValue({success:true,data:{status:"accepted",request:accepted}});mocks.decline.mockResolvedValue({success:true,data:{status:"declined",request:{...request,status:"declined"}}});
  mocks.byId.mockResolvedValue({data:null,error:null});
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:mocks.byId};
  const channel={on:vi.fn().mockReturnThis(),subscribe:vi.fn().mockReturnThis()};mocks.client.mockReturnValue({from:vi.fn(()=>query),channel:vi.fn(()=>channel),removeChannel:vi.fn(async()=>{}),auth:{onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}}))}});
});
const originalGeolocation=Object.getOwnPropertyDescriptor(navigator,"geolocation");
afterEach(()=>{cleanup();if(originalGeolocation)Object.defineProperty(navigator,"geolocation",originalGeolocation);else Reflect.deleteProperty(navigator,"geolocation");});

describe("Instant Connect screen recovery",()=>{
  function updateListener(){return mocks.client.mock.results[0]!.value.channel.mock.results[0].value.on.mock.calls.find((call:unknown[])=>(call[1] as {event?:string}).event==="UPDATE")[2] as (payload:{new:ShowingRequest})=>void;}
  it("keeps renter controls usable after a rejected request transport and retries",async()=>{
    mocks.request.mockRejectedValueOnce(new Error("Contained showing transport failure"));render(<Boundary><ConnectNowSheet {...props}/></Boundary>);
    fireEvent.click(await open());await waitFor(()=>expect(mocks.error).toHaveBeenCalled());expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();
    const retry=await screen.findByRole("button",{name:"Right now"});await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);
    await waitFor(()=>expect(mocks.request).toHaveBeenCalledTimes(2));
  });
  it("locks same-turn duplicate and competing renter requests",async()=>{
    const pending=deferred<{success:true;data:{request:ShowingRequest}}>();mocks.request.mockReturnValue(pending.promise);render(<ConnectNowSheet {...props}/>);
    const trigger=await open(),other=screen.getByRole("button",{name:"Within 15 minutes"});
    act(()=>{fireEvent.click(trigger);fireEvent.click(trigger);fireEvent.click(other);});expect(mocks.request).toHaveBeenCalledTimes(1);
    await act(async()=>pending.resolve({success:true,data:{request}}));
  });
  it("restores an accepted request on reopening without sending a new request",async()=>{
    mocks.current.mockResolvedValue({success:true,data:{request:accepted}});render(<ConnectNowSheet {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Connect now"}));expect(await screen.findByText("Accepted. Message the landlord or check in when you arrive.")).toBeVisible();expect(mocks.request).not.toHaveBeenCalled();expect(screen.getByRole("link",{name:"Message"})).toHaveAttribute("href",`/messages/${accepted.conversation_id}`);
  });
  it("distinguishes an initial read failure and retries before offering a new request",async()=>{
    mocks.current.mockResolvedValue({success:false,error:"Your showing request could not be loaded. Try again."});render(<ConnectNowSheet {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Connect now"}));expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/);expect(screen.queryByRole("button",{name:"Right now"})).not.toBeInTheDocument();
    mocks.current.mockResolvedValue({success:true,data:{request:null}});fireEvent.click(screen.getByRole("button",{name:"Try again"}));expect(await screen.findByRole("button",{name:"Right now"})).toBeEnabled();
  });
  it("ignores a late request result after another listing replaces the current one",async()=>{
    const pending=deferred<{success:true;data:{request:ShowingRequest}}>();mocks.request.mockReturnValueOnce(pending.promise);const view=render(<ConnectNowSheet {...props}/>);
    fireEvent.click(await open());view.rerender(<ConnectNowSheet {...props} listingId="550e8400-e29b-41d4-a716-446655440026"/>);
    await act(async()=>pending.resolve({success:true,data:{request:accepted}}));expect(screen.queryByText(/Accepted\. Message/)).not.toBeInTheDocument();expect(mocks.success).not.toHaveBeenCalled();
  });
  it("keeps the owner banner usable after a thrown accept and restores the canonical conversation on retry",async()=>{
    mocks.accept.mockRejectedValueOnce(new Error("Contained showing transport failure"));render(<Boundary><ShowingRequestBanner landlordId={ownerId} initialRequest={request}/></Boundary>);
    fireEvent.click(screen.getByRole("button",{name:"Accept showing request"}));expect(await screen.findByText(/could not be confirmed/i)).toBeVisible();expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Accept showing request"}));expect(await screen.findByRole("link",{name:"Message"})).toHaveAttribute("href",`/messages/${accepted.conversation_id}`);
  });
  it("locks same-turn owner decisions and honors a canonical terminal response",async()=>{
    const pending=deferred<{success:true;data:{status:"completed";request:ShowingRequest}}>();mocks.accept.mockReturnValue(pending.promise);render(<ShowingRequestBanner landlordId={ownerId} initialRequest={request}/>);
    const accept=screen.getByRole("button",{name:"Accept showing request"}),decline=screen.getByRole("button",{name:"Decline showing request"});
    act(()=>{fireEvent.click(accept);fireEvent.click(accept);fireEvent.click(decline);});expect(mocks.accept).toHaveBeenCalledTimes(1);expect(mocks.decline).not.toHaveBeenCalled();
    await act(async()=>pending.resolve({success:true,data:{status:"completed",request:{...request,status:"completed"}}}));expect(screen.queryByText(/Showing accepted/)).not.toBeInTheDocument();
  });
  it("uses a canonical request row so a terminal renter action can finish without Realtime",async()=>{
    mocks.current.mockResolvedValue({success:true,data:{request:accepted}});mocks.cancel.mockResolvedValue({success:true,data:{status:"cancelled",request:{...accepted,status:"cancelled"}}});render(<ConnectNowSheet {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Connect now"}));fireEvent.click(await screen.findByRole("button",{name:"Cancel"}));expect(await screen.findByText(/showing request is cancelled/)).toBeVisible();expect(await screen.findByRole("button",{name:"Request again"})).toBeEnabled();
  });
  it("discards an in-flight request after sign-out",async()=>{
    const pending=deferred<{success:true;data:{request:ShowingRequest}}>();mocks.request.mockReturnValueOnce(pending.promise);render(<ConnectNowSheet {...props}/>);fireEvent.click(await open());
    const listener=mocks.client.mock.results[0]!.value.auth.onAuthStateChange.mock.calls[0][0] as (event:string,session:null)=>void;
    act(()=>listener("SIGNED_OUT",null));await act(async()=>pending.resolve({success:true,data:{request:accepted}}));
    expect(screen.queryByText(/Accepted\. Message/)).not.toBeInTheDocument();expect(mocks.success).not.toHaveBeenCalled();
  });
  it.each(["unavailable","denied","far"] as const)("keeps check-in usable when emulated location is %s",async kind=>{
    mocks.current.mockResolvedValue({success:true,data:{request:accepted}});
    Object.defineProperty(navigator,"geolocation",{configurable:true,value:kind==="unavailable"?undefined:{getCurrentPosition:(success:PositionCallback,failure:PositionErrorCallback)=>{
      if(kind==="denied")failure({code:1,message:"Contained denial",PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});
      else success({coords:{latitude:0,longitude:0},timestamp:Date.now()} as GeolocationPosition);
    }}});
    render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));fireEvent.click(await screen.findByRole("button",{name:"Check in"}));
    await waitFor(()=>expect(mocks.error).toHaveBeenCalled());expect(mocks.checkIn).not.toHaveBeenCalled();await waitFor(()=>expect(screen.getByRole("button",{name:"Check in"})).toBeEnabled());
  });
  it("locks location attempts and prevents a delayed position from checking into another listing",async()=>{
    mocks.current.mockResolvedValue({success:true,data:{request:accepted}});let position:PositionCallback|undefined;
    const locate=vi.fn((success:PositionCallback)=>{position=success;});Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:locate}});
    const view=render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));const button=await screen.findByRole("button",{name:"Check in"});
    act(()=>{fireEvent.click(button);fireEvent.click(button);fireEvent.click(screen.getByRole("button",{name:"Cancel"}));});expect(locate).toHaveBeenCalledTimes(1);expect(mocks.cancel).not.toHaveBeenCalled();
    mocks.current.mockResolvedValue({success:true,data:{request:null}});view.rerender(<ConnectNowSheet {...props} listingId="550e8400-e29b-41d4-a716-446655440026"/>);
    await act(async()=>position?.({coords:{latitude:-26,longitude:28},timestamp:Date.now()} as GeolocationPosition));expect(mocks.checkIn).not.toHaveBeenCalled();
  });
  it("offers renewal for an expired request without waiting for a live event",async()=>{
    mocks.current.mockResolvedValue({success:true,data:{request:{...request,expires_at:new Date(Date.now()-60000).toISOString()}}});render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));
    expect(await screen.findByText("This showing request is expired.")).toBeVisible();expect(screen.getByRole("button",{name:"Request again"})).toBeEnabled();
  });
  it("distinguishes an unavailable owner inbox from an empty one and retries",async()=>{
    mocks.inbox.mockResolvedValue({success:false,error:"Showing requests could not be loaded. Try again."});render(<ShowingRequestBanner landlordId={ownerId} initialRequest={null}/>);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/);mocks.inbox.mockResolvedValue({success:true,data:{request}});fireEvent.click(screen.getByRole("button",{name:"Try again"}));expect(await screen.findByRole("button",{name:"Accept showing request"})).toBeEnabled();
  });
  it("shows a peer completion instead of silently replacing it with fresh-request options",async()=>{
    const completed={...accepted,status:"completed" as const};mocks.current.mockResolvedValue({success:true,data:{request:accepted}});mocks.byId.mockResolvedValue({data:completed,error:null});render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));await screen.findByRole("button",{name:"Check in"});
    mocks.current.mockResolvedValue({success:true,data:{request:null}});act(()=>updateListener()({new:completed}));expect(await screen.findByText("This showing request is completed.")).toBeVisible();
  });
  it("does not let an older action reply reopen a newer terminal state",async()=>{
    const completed={...accepted,status:"completed" as const},pending=deferred<{success:true;data:{status:"cancelled";request:ShowingRequest}}>();mocks.current.mockResolvedValue({success:true,data:{request:accepted}});mocks.byId.mockResolvedValue({data:completed,error:null});mocks.cancel.mockReturnValueOnce(pending.promise);
    render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));fireEvent.click(await screen.findByRole("button",{name:"Cancel"}));
    mocks.current.mockResolvedValue({success:true,data:{request:null}});act(()=>updateListener()({new:completed}));await screen.findByText("This showing request is completed.");
    await act(async()=>pending.resolve({success:true,data:{status:"cancelled",request:{...accepted,status:"cancelled"}}}));expect(screen.getByText("This showing request is completed.")).toBeVisible();expect(screen.queryByText("This showing request is cancelled.")).not.toBeInTheDocument();
  });
  it("recovers a missed terminal event from its known private request on reconnect",async()=>{
    const completed={...accepted,status:"completed" as const};mocks.current.mockResolvedValue({success:true,data:{request:accepted}});mocks.byId.mockResolvedValue({data:completed,error:null});render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));await screen.findByRole("button",{name:"Check in"});
    mocks.current.mockResolvedValue({success:true,data:{request:null}});act(()=>window.dispatchEvent(new Event("online")));expect(await screen.findByText("This showing request is completed.")).toBeVisible();expect(mocks.byId).toHaveBeenCalled();
  });
  it("keeps ordinary property browsing off showing streams until a request exists",async()=>{
    render(<ConnectNowSheet {...props}/>);await open();const client=mocks.client.mock.results[0]!.value;
    await waitFor(()=>expect(mocks.current).toHaveBeenCalled());expect(client.channel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Right now"}));await waitFor(()=>expect(client.channel).toHaveBeenCalledTimes(1));
    expect(client.channel.mock.results[0].value.on.mock.calls).toContainEqual(["postgres_changes",expect.objectContaining({event:"UPDATE",filter:`id=eq.${request.id}`}),expect.any(Function)]);
  });
  it("releases the renter stream after a terminal response while retaining its acknowledgement",async()=>{
    mocks.current.mockResolvedValue({success:true,data:{request:accepted}});mocks.cancel.mockResolvedValue({success:true,data:{status:"cancelled",request:{...accepted,status:"cancelled"}}});render(<ConnectNowSheet {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Connect now"}));
    fireEvent.click(await screen.findByRole("button",{name:"Cancel"}));expect(await screen.findByText("This showing request is cancelled.")).toBeVisible();await waitFor(()=>expect(mocks.client.mock.results[0]!.value.removeChannel).toHaveBeenCalledTimes(1));
  });
});
