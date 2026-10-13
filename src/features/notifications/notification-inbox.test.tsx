// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {NotificationContext} from "./notification-provider";
import {NotificationInbox} from "./notification-inbox";
vi.mock("next/navigation",()=>({usePathname:()=>"/profile/notifications"}));
vi.mock("next/link",()=>({default:({children,href}:{children:React.ReactNode;href:string})=><a href={href}>{children}</a>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const item={id:"fixture-id",title:"Private fixture",message:"Only the first account sees this",unread:true,createdAt:"2026-10-13T00:00:00Z",href:null};
function context(userId:string,items=[item]){return {userId,items,enabled:true,unreadCount:items.length,serverNow:"2026-10-13T00:00:00Z",error:null,refresh:vi.fn(async()=>{}),change:vi.fn(async()=>true)};}
describe("notification history privacy",()=>{
 it("discards the previous account's page before the next account's request settles",async()=>{
  let resolveNext:(value:Response)=>void=()=>{};
  const fetchMock=vi.fn().mockResolvedValueOnce(Response.json({userId:"first",items:[item],next:null,serverNow:"2026-10-13T00:00:00Z"}))
   .mockImplementationOnce(()=>new Promise<Response>(resolve=>{resolveNext=resolve;}));
  vi.stubGlobal("fetch",fetchMock);
  const view=render(<NotificationContext.Provider value={context("first")}><NotificationInbox/></NotificationContext.Provider>);
  await waitFor(()=>expect(screen.getByText(item.message)).toBeTruthy());
  view.rerender(<NotificationContext.Provider value={context("second",[])}><NotificationInbox/></NotificationContext.Provider>);
  expect(screen.queryByText(item.message)).toBeNull();
  await act(async()=>resolveNext(Response.json({userId:"second",items:[],next:null,serverNow:"2026-10-13T00:00:00Z"})));
  expect(screen.queryByText(item.message)).toBeNull();
 });
});
