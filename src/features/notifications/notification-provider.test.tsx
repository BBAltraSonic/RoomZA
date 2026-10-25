// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotifications } from "./notification-provider";

const mocks=vi.hoisted(()=>({getUser:vi.fn(),onAuthStateChange:vi.fn(),removeChannel:vi.fn(),unsubscribe:vi.fn(),channel:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/profile/notifications"}));
vi.mock("sonner",()=>({toast:vi.fn()}));
vi.mock("@/lib/supabase/browser",()=>({createClient:()=>({auth:{getUser:mocks.getUser,onAuthStateChange:mocks.onAuthStateChange},channel:mocks.channel,removeChannel:mocks.removeChannel})}));
function Consumer(){
 const state=useNotifications()!;
 return <><output data-testid="identity">{state.userId??"guest"}</output><p role="alert">{state.error??""}</p><button onClick={()=>void state.refresh()}>Retry</button>{state.items.map(item=><p key={item.id}>{item.message}</p>)}</>;
}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const user=(id:string)=>({data:{user:{id}},error:null});
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.onAuthStateChange.mockReturnValue({data:{subscription:{unsubscribe:mocks.unsubscribe}}});
 mocks.channel.mockImplementation(()=>{const channel={on:vi.fn(()=>channel),subscribe:vi.fn(()=>channel)};return channel;});
 mocks.removeChannel.mockResolvedValue("ok");
 vi.stubGlobal("fetch",vi.fn(async()=>Response.json({userId:"second",items:[{id:"event",title:"Private",message:"Second account only",createdAt:"2026-10-15T00:00:00Z",unread:true,href:null}],unreadCount:1,enabled:true,serverNow:"2026-10-15T00:00:00Z"})));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("notification identity recovery",()=>{
 it("handles a rejected identity read and retries before accepting a private inbox",async()=>{
  const pending=deferred<ReturnType<typeof user>>();
  mocks.getUser.mockReturnValueOnce(pending.promise).mockResolvedValue(user("second"));
  render(<NotificationProvider enabled><Consumer/></NotificationProvider>);
  await waitFor(()=>expect(mocks.getUser).toHaveBeenCalledTimes(1));
  await act(async()=>pending.reject(new Error("Lock broken by another request")));
  expect(screen.getByRole("alert").textContent).toContain("could not reconnect");
  expect(screen.queryByText("Second account only")).toBeNull();
  fireEvent.click(screen.getByText("Retry"));
  fireEvent.click(screen.getByText("Retry"));
  await waitFor(()=>expect(screen.getByText("Second account only")).toBeTruthy());
  expect(mocks.getUser).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("identity").textContent).toBe("second");
  expect(screen.getByRole("alert").textContent).toBe("");
 });
 it("an old identity read cannot replace a later authenticated account",async()=>{
  const pending=deferred<ReturnType<typeof user>>();mocks.getUser.mockReturnValue(pending.promise);
  render(<NotificationProvider enabled><Consumer/></NotificationProvider>);
  await waitFor(()=>expect(mocks.getUser).toHaveBeenCalled());
  const callback=mocks.onAuthStateChange.mock.calls[0]![0];
  await act(async()=>callback("SIGNED_IN",{user:{id:"second"}}));
  await waitFor(()=>expect(screen.getByText("Second account only")).toBeTruthy());
  await act(async()=>pending.resolve(user("first")));
  expect(screen.getByTestId("identity").textContent).toBe("second");
  expect(mocks.channel).toHaveBeenCalledTimes(1);
  expect(mocks.channel).toHaveBeenCalledWith("notifications:second");
 });
 it("handles a late rejection after unmount without binding a channel",async()=>{
  const pending=deferred<ReturnType<typeof user>>();mocks.getUser.mockReturnValue(pending.promise);
  const view=render(<NotificationProvider enabled><Consumer/></NotificationProvider>);
  await waitFor(()=>expect(mocks.getUser).toHaveBeenCalled());view.unmount();
  await act(async()=>pending.reject(new Error("Lock released")));
  expect(mocks.channel).not.toHaveBeenCalled();expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
 });
});
