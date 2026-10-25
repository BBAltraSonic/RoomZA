// @vitest-environment jsdom
import { Component, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({start:vi.fn(),schedule:vi.fn(),startScheduled:vi.fn(),cancel:vi.fn(),end:vi.fn(),consent:vi.fn(),record:vi.fn(),finish:vi.fn(),link:vi.fn(),client:vi.fn(),push:vi.fn(),refresh:vi.fn(),toast:vi.fn(),consents:vi.fn(),command:vi.fn(),access:vi.fn()}));
vi.mock("./actions",()=>({startLiveTour:mocks.start,scheduleLiveTour:mocks.schedule,startScheduledLiveTour:mocks.startScheduled,cancelScheduledLiveTour:mocks.cancel,endLiveTour:mocks.end,setLiveTourRecordingConsent:mocks.consent,startLiveTourRecording:mocks.record,finishLiveTourRecording:mocks.finish,saveLiveTourRecordingLink:mocks.link}));
vi.mock("@/lib/supabase/browser",()=>({createClient:mocks.client}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push,refresh:mocks.refresh})}));
vi.mock("sonner",()=>({toast:{success:mocks.toast,error:vi.fn()}}));
vi.mock("./live-tour-video",()=>({LiveTourVideo:({apiRef}:{apiRef:{current:unknown}})=>{apiRef.current={executeCommand:mocks.command};return <div>Contained video provider</div>;}}));
import { LiveTourControls } from "./go-live-button";
import { LiveTourRoom } from "./live-tour-room";
import type { LiveTour, LiveTourWithListing } from "./types";
const owner="550e8400-e29b-41d4-a716-446655440072",viewer="550e8400-e29b-41d4-a716-446655440073",listingId="550e8400-e29b-41d4-a716-446655440071";
const tour={id:"550e8400-e29b-41d4-a716-446655440074",listing_id:listingId,host_id:owner,status:"live",room_id:"roomza-tour-contained",join_url:"https://fixture.invalid/room",peak_viewers:1,recording_status:"off",recording_url:null,scheduled_at:null,scheduled_duration_minutes:30,listing:{id:listingId,title:"Contained live tour",address:"Synthetic fixture",landlord_id:owner,status:"published"}} as LiveTourWithListing;
const flags={scheduledTours:true,recording:true,moderation:false,pictureInPicture:false};
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<p role="alert">Controls failed</p>:this.props.children;}}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
beforeEach(()=>{
  vi.resetAllMocks();mocks.start.mockResolvedValue({success:true,data:{tour}});mocks.cancel.mockResolvedValue({success:true,data:{status:"cancelled"}});mocks.end.mockResolvedValue({success:true,data:{status:"ended"}});mocks.finish.mockResolvedValue({success:true,data:{status:"stopped"}});mocks.consent.mockResolvedValue({success:true,data:{granted:false}});mocks.consents.mockResolvedValue({data:[{user_id:owner,granted:true,policy_version:"phase3-v1"},{user_id:viewer,granted:true,policy_version:"phase3-v1"}],error:null});
  mocks.access.mockResolvedValue({data:{status:"live",recording_status:"off"},error:null});
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),abortSignal:vi.fn().mockReturnThis(),limit:mocks.consents,maybeSingle:mocks.access};
  const channel={on:vi.fn().mockReturnThis(),subscribe:vi.fn(),track:vi.fn(async()=>{}),untrack:vi.fn(async()=>{}),presenceState:vi.fn(()=>({}))};channel.subscribe.mockImplementation((callback:(status:string)=>void)=>{queueMicrotask(()=>callback("SUBSCRIBED"));return channel;});
  mocks.client.mockReturnValue({from:vi.fn(()=>query),channel:vi.fn(()=>channel),removeChannel:vi.fn(async()=>{}),rpc:vi.fn(()=>({abortSignal:vi.fn(async()=>({data:[{status:"live"}],error:null}))})),auth:{onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:vi.fn()}}}))}});

});
afterEach(cleanup);
describe("live-tour control recovery",()=>{
  it("contains an interrupted start and permits an ordinary retry",async()=>{
    mocks.start.mockRejectedValueOnce(new Error("Contained tour transport failure"));render(<Boundary><LiveTourControls listingId={listingId} scheduledEnabled/></Boundary>);fireEvent.click(screen.getByRole("button",{name:"Go live"}));expect(await screen.findByText("The tour action could not be confirmed. Check the current status and try again.")).toBeVisible();expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();const retry=screen.getByRole("button",{name:"Go live"});await waitFor(()=>expect(retry).toBeEnabled());fireEvent.click(retry);await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith(`/live-tours/${tour.id}`));
  });
  it("locks duplicate same-turn starts",async()=>{
    const pending=deferred<{success:true;data:{tour:LiveTour}}>();mocks.start.mockReturnValue(pending.promise);render(<LiveTourControls listingId={listingId} scheduledEnabled/>);const button=screen.getByRole("button",{name:"Go live"});act(()=>{button.click();button.click();button.click();});expect(mocks.start).toHaveBeenCalledTimes(1);await act(async()=>pending.resolve({success:true,data:{tour}}));
  });
  it("ignores a late start result after a different listing replaces the controls",async()=>{
    const pending=deferred<{success:true;data:{tour:LiveTour}}>();mocks.start.mockReturnValue(pending.promise);const view=render(<LiveTourControls listingId={listingId} scheduledEnabled/>);fireEvent.click(screen.getByRole("button",{name:"Go live"}));view.rerender(<LiveTourControls listingId="550e8400-e29b-41d4-a716-446655440075" scheduledEnabled/>);await act(async()=>pending.resolve({success:true,data:{tour}}));expect(mocks.push).not.toHaveBeenCalled();expect(mocks.toast).not.toHaveBeenCalled();
  });
  it("keeps scheduled cancellation usable after a transport rejection",async()=>{
    mocks.cancel.mockRejectedValueOnce(new Error("Contained cancellation failure"));render(<Boundary><LiveTourControls listingId={listingId} scheduledEnabled upcomingTour={{...tour,status:"scheduled",scheduled_at:new Date(Date.now()+3600000).toISOString()}}/></Boundary>);fireEvent.click(screen.getByRole("button",{name:"Cancel scheduled open house"}));expect(await screen.findByText("The tour action could not be confirmed. Check the current status and try again.")).toBeVisible();expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();
  });
  it("allows a viewer to withdraw consent during recording",async()=>{
    mocks.access.mockResolvedValue({data:{status:"live",recording_status:"recording"},error:null});
    render(<Boundary><LiveTourRoom tour={{...tour,recording_status:"recording"}} currentUserId={viewer} currentUserName="Synthetic viewer" flags={flags}/></Boundary>);const button=await screen.findByRole("button",{name:"Consented"});expect(button).toBeEnabled();fireEvent.click(button);await waitFor(()=>expect(mocks.consent).toHaveBeenCalledWith(tour.id,false));
  });
  it("dispatches a host provider stop when the authoritative recording state stops",async()=>{
    render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);await screen.findByRole("button",{name:"Consented"});const channel=mocks.client.mock.results[0]!.value.channel.mock.results[0].value;const listener=channel.on.mock.calls.find((call:unknown[])=>(call[1] as {table?:string}).table==="live_tours")[2] as (payload:{new:{recording_status:string}})=>void;act(()=>listener({new:{recording_status:"recording"}}));await screen.findByRole("button",{name:"Stop recording"});mocks.command.mockClear();act(()=>listener({new:{recording_status:"stopped"}}));await waitFor(()=>expect(mocks.command).toHaveBeenCalledWith("stopRecording","file",false));
  });
  it("contains a room-end transport failure without replacing the video controls",async()=>{
    mocks.end.mockRejectedValueOnce(new Error("Contained room-end failure"));render(<Boundary><LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/></Boundary>);fireEvent.click(screen.getByRole("button",{name:"End tour"}));expect(await screen.findByText("The tour action could not be confirmed. Check the current status and try again.")).toBeVisible();expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();expect(screen.getByText("Contained video provider")).toBeVisible();
  });
  it("locks competing room mutations in the same turn",async()=>{
    const pending=deferred<{success:true;data:{status:"ended"}}>();mocks.end.mockReturnValue(pending.promise);render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);const choice=await screen.findByRole("button",{name:"Consented"}),end=screen.getByRole("button",{name:"End tour"});act(()=>{end.click();end.click();choice.click();});expect(mocks.end).toHaveBeenCalledTimes(1);expect(mocks.consent).not.toHaveBeenCalled();await act(async()=>pending.resolve({success:true,data:{status:"ended"}}));
  });
  it("contains a rejected consent choice while retaining its current state",async()=>{
    mocks.consent.mockRejectedValueOnce(new Error("Contained consent transport failure"));render(<Boundary><LiveTourRoom tour={tour} currentUserId={viewer} currentUserName="Synthetic viewer" flags={flags}/></Boundary>);fireEvent.click(await screen.findByRole("button",{name:"Consented"}));expect(await screen.findByText("The tour action could not be confirmed. Check the current status and try again.")).toBeVisible();expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Consented"})).toBeEnabled();
  });
  it("ignores a room-end reply after another room replaces it",async()=>{
    const pending=deferred<{success:true;data:{status:"ended"}}>();mocks.end.mockReturnValue(pending.promise);const view=render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);fireEvent.click(screen.getByRole("button",{name:"End tour"}));view.rerender(<LiveTourRoom tour={{...tour,id:"550e8400-e29b-41d4-a716-446655440076",listing:{...tour.listing,title:"Replacement live room"}}} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);await act(async()=>pending.resolve({success:true,data:{status:"ended"}}));expect(screen.getByText("Replacement live room")).toBeVisible();expect(screen.getByRole("button",{name:"End tour"})).toBeEnabled();expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("does not start the provider from an older approval after a newer recording stop",async()=>{
    const pending=deferred<{success:true;data:{status:"recording"}}>();mocks.record.mockReturnValue(pending.promise);render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);await screen.findByRole("button",{name:"Consented"});const channel=mocks.client.mock.results[0]!.value.channel.mock.results[0].value;channel.presenceState.mockReturnValue({v:[{role:"viewer",joinedAt:new Date().toISOString(),userId:viewer}]});const sync=channel.on.mock.calls.find((call:unknown[])=>call[0]==="presence")[2] as ()=>void;act(sync);fireEvent.click(await screen.findByRole("button",{name:"Start recording"}));const update=channel.on.mock.calls.find((call:unknown[])=>(call[1] as {table?:string}).table==="live_tours")[2] as (payload:{new:{recording_status:string}})=>void;act(()=>{update({new:{recording_status:"recording"}});update({new:{recording_status:"stopped"}});});await act(async()=>pending.resolve({success:true,data:{status:"recording"}}));expect(mocks.command.mock.calls.some((call:unknown[])=>call[0]==="startRecording")).toBe(false);
  });
  it("keeps a failed provider stop visible and retryable",async()=>{
    render(<Boundary><LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/></Boundary>);await screen.findByRole("button",{name:"Consented"});const channel=mocks.client.mock.results[0]!.value.channel.mock.results[0].value;const update=channel.on.mock.calls.find((call:unknown[])=>(call[1] as {table?:string}).table==="live_tours")[2] as (payload:{new:{recording_status:string}})=>void;act(()=>update({new:{recording_status:"recording"}}));await screen.findByRole("button",{name:"Stop recording"});mocks.command.mockImplementationOnce(()=>{throw Error("Contained provider stop failure");});act(()=>update({new:{recording_status:"stopped"}}));const retry=await screen.findByRole("button",{name:"Retry recording stop"});fireEvent.click(retry);await waitFor(()=>expect(screen.queryByRole("button",{name:"Retry recording stop"})).not.toBeInTheDocument());expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();
  });
  it("removes the video when a protected read says room access is unavailable",async()=>{
    mocks.access.mockResolvedValue({data:null,error:null});render(<LiveTourRoom tour={tour} currentUserId={viewer} currentUserName="Synthetic viewer" flags={{...flags,recording:false}}/>);expect(await screen.findByText("Access to this tour is unavailable.")).toBeVisible();expect(screen.queryByText("Contained video provider")).not.toBeInTheDocument();
  });
  it.each(["ended","cancelled"] as const)("uses the safe final-state response after a viewer loses the private %s row",async(finalStatus)=>{
    mocks.access.mockResolvedValue({data:null,error:null});mocks.client().rpc.mockReturnValue({abortSignal:vi.fn().mockResolvedValue({data:[{status:finalStatus,listing_id:listingId}],error:null})});render(<LiveTourRoom tour={tour} currentUserId={viewer} currentUserName="Synthetic viewer" flags={{...flags,recording:false}}/>);
    expect(await screen.findByRole("heading",{name:finalStatus==="ended"?"This live tour has ended":"This open house was cancelled"})).toBeVisible();expect(screen.queryByText("Contained video provider")).not.toBeInTheDocument();expect(screen.getByRole("link",{name:"Back to listing"})).toHaveAttribute("href",`/?listingId=${listingId}`);
  });
  it("retains the video during a failed protected status read and retries",async()=>{
    mocks.access.mockRejectedValue(new Error("Contained status read failure"));render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={{...flags,recording:false}}/>);const video=screen.getByText("Contained video provider");expect(await screen.findByText("Tour status could not be refreshed. Try again.")).toBeVisible();expect(video).toBeVisible();mocks.access.mockResolvedValue({data:{status:"live",recording_status:"off"},error:null});fireEvent.click(screen.getByRole("button",{name:"Retry tour status"}));await waitFor(()=>expect(screen.queryByText("Tour status could not be refreshed. Try again.")).not.toBeInTheDocument());expect(screen.getByText("Contained video provider")).toBe(video);
  });
  it("does not let a delayed status read restore recording after a newer stop",async()=>{
    const pending=deferred<{data:{status:string;recording_status:string};error:null}>();mocks.access.mockReturnValueOnce(pending.promise);
    render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);await screen.findByRole("button",{name:"Consented"});
    const channel=mocks.client.mock.results[0]!.value.channel.mock.results[0].value;const update=channel.on.mock.calls.find((call:unknown[])=>(call[1] as {table?:string}).table==="live_tours")[2] as (payload:{new:{recording_status:string}})=>void;
    act(()=>{update({new:{recording_status:"recording"}});update({new:{recording_status:"stopped"}});});await act(async()=>pending.resolve({data:{status:"live",recording_status:"recording"},error:null}));
    expect(screen.queryByRole("button",{name:"Stop recording"})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Start recording"})).toBeVisible();
  });
  it("disables a scheduled listing start when scheduling is off while retaining cancellation",()=>{
    render(<LiveTourControls listingId={listingId} scheduledEnabled={false} upcomingTour={{...tour,status:"scheduled",scheduled_at:new Date(Date.now()+3600000).toISOString()}}/>);
    expect(screen.getByRole("button",{name:"Start"})).toBeDisabled();expect(screen.getByRole("button",{name:"Cancel scheduled open house"})).toBeEnabled();
  });
  it("binds a newly present consented viewer without dispatching another provider start",async()=>{
    mocks.record.mockResolvedValue({success:true,data:{status:"recording"}});render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={flags}/>);await screen.findByRole("button",{name:"Consented"});
    const channel=mocks.client.mock.results[0]!.value.channel.mock.results[0].value;const update=channel.on.mock.calls.find((call:unknown[])=>(call[1] as {table?:string}).table==="live_tours")[2] as (payload:{new:{recording_status:string}})=>void;act(()=>update({new:{recording_status:"recording"}}));await screen.findByRole("button",{name:"Stop recording"});mocks.command.mockClear();
    channel.presenceState.mockReturnValue({viewer:[{role:"viewer",joinedAt:new Date().toISOString(),userId:viewer}]});const sync=channel.on.mock.calls.find((call:unknown[])=>call[0]==="presence")[2] as ()=>void;act(sync);
    await waitFor(()=>expect(mocks.record).toHaveBeenCalledWith(tour.id,[viewer]));expect(mocks.command.mock.calls.some((call:unknown[])=>call[0]==="startRecording")).toBe(false);
  });
  it("disables a scheduled room start when scheduling is off while retaining cancellation",async()=>{
    mocks.access.mockResolvedValue({data:{status:"scheduled",recording_status:"off"},error:null});render(<LiveTourRoom tour={{...tour,status:"scheduled",scheduled_at:new Date(Date.now()+3600000).toISOString()}} currentUserId={owner} currentUserName="Synthetic host" flags={{...flags,scheduledTours:false}}/>);
    expect(screen.getByRole("button",{name:"Start open house"})).toBeDisabled();expect(screen.getByRole("button",{name:"Cancel"})).toBeEnabled();
  });
  it("removes the room on sign-out and ignores an older end reply",async()=>{
    const pending=deferred<{success:true;data:{status:"ended"}}>();mocks.end.mockReturnValueOnce(pending.promise);render(<LiveTourRoom tour={tour} currentUserId={owner} currentUserName="Synthetic host" flags={{...flags,recording:false}}/>);fireEvent.click(screen.getByRole("button",{name:"End tour"}));const listener=mocks.client.mock.results[0]!.value.auth.onAuthStateChange.mock.calls[0]?.[0] as ((event:string,session:null)=>void)|undefined;expect(listener).toBeTypeOf("function");act(()=>listener?.("SIGNED_OUT",null));await act(async()=>pending.resolve({success:true,data:{status:"ended"}}));expect(screen.queryByText("Contained video provider")).not.toBeInTheDocument();expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

