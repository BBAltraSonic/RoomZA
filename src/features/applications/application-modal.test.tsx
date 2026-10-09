// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import type {ReactNode} from "react";
const mocks=vi.hoisted(()=>({check:vi.fn()}));
vi.mock("./actions",()=>({checkApplicationEligibility:mocks.check,submitApplication:vi.fn()}));
vi.mock("@/components/ui/dialog",()=>({Dialog:({open,children,onOpenChange}:{open:boolean;children:ReactNode;onOpenChange:(open:boolean)=>void})=>open?<div>{children}<button onClick={()=>onOpenChange(false)}>Fixture close</button></div>:null,DialogContent:({children}:{children:ReactNode})=><div>{children}</div>,DialogHeader:({children}:{children:ReactNode})=><div>{children}</div>,DialogTitle:({children}:{children:ReactNode})=><h1>{children}</h1>,DialogDescription:({children}:{children:ReactNode})=><p>{children}</p>}));
import {ApplicationModal} from "./application-modal";
afterEach(()=>{cleanup();vi.resetAllMocks();});
it("ignores an old listing's late eligibility response",async()=>{
 let finish!:(value:unknown)=>void;
 mocks.check.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce({eligible:false,reason:"not_renter"});
 const {rerender}=render(<ApplicationModal listingId="old" initialOpen/>);
 rerender(<ApplicationModal listingId="current" initialOpen/>);
 await screen.findByText("You need a renter account to apply for a property.");
 await act(async()=>finish({eligible:false,reason:"unauthenticated"}));
 expect(screen.queryByText("Sign in required")).toBeNull();
});
it("does not apply eligibility after the modal closes",async()=>{
 let finish!:(value:unknown)=>void;mocks.check.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 render(<ApplicationModal listingId="home" initialOpen/>);
 await waitFor(()=>expect(mocks.check).toHaveBeenCalled());
 fireEvent.click(screen.getByText("Fixture close"));
 await act(async()=>finish({eligible:false,reason:"unauthenticated"}));
 expect(screen.queryByText("Sign in required")).toBeNull();
});
