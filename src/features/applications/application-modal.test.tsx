// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import type {ReactNode} from "react";
const mocks=vi.hoisted(()=>({check:vi.fn(),submit:vi.fn()}));
vi.mock("./actions",()=>({checkApplicationEligibility:mocks.check,submitApplication:mocks.submit}));
vi.mock("@/components/ui/dialog",async()=>{
 const {createContext,useContext}=await import("react");const OpenContext=createContext(false);
 return {Dialog:({open,children,onOpenChange}:{open:boolean;children:ReactNode;onOpenChange:(open:boolean)=>void})=><OpenContext.Provider value={open}>{children}{open?<button onClick={()=>onOpenChange(false)}>Fixture close</button>:null}</OpenContext.Provider>,DialogContent:({children}:{children:ReactNode})=>useContext(OpenContext)?<div>{children}</div>:null,DialogHeader:({children}:{children:ReactNode})=><div>{children}</div>,DialogTitle:({children}:{children:ReactNode})=><h1>{children}</h1>,DialogDescription:({children}:{children:ReactNode})=><p>{children}</p>};
});
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
async function readyForm(){
 mocks.check.mockResolvedValue({eligible:true,reason:null});render(<ApplicationModal listingId="550e8400-e29b-41d4-a716-446655440000" initialOpen/>);
 const name=await screen.findByLabelText("Full legal name");fireEvent.change(name,{target:{value:"Test Renter"}});
 fireEvent.change(screen.getByLabelText("Monthly income (ZAR)"),{target:{value:"12000"}});
 fireEvent.change(screen.getByLabelText("Move-in date"),{target:{value:"2099-01-01"}});
 fireEvent.change(screen.getByLabelText("Household size"),{target:{value:"2"}});
 return name.closest("form")!;
}
it("keeps an uncertain transport failure usable and offers the persisted applications workspace",async()=>{
 mocks.submit.mockRejectedValue(new Error("Network response lost"));const form=await readyForm();fireEvent.submit(form);
 const alert=await screen.findByRole("alert");expect(alert.textContent).toContain("could not be confirmed");
 expect(screen.getByRole("link",{name:"Check applications"}).getAttribute("href")).toBe("/applications");
 await waitFor(()=>expect((screen.getByRole("button",{name:"Submit application"}) as HTMLButtonElement).disabled).toBe(false));
 expect((screen.getByLabelText("Full legal name") as HTMLInputElement).value).toBe("Test Renter");
});
it("locks fields and rejects a duplicate form event while submission is pending",async()=>{
 let finish!:(value:unknown)=>void;mocks.submit.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const form=await readyForm();
 fireEvent.submit(form);fireEvent.submit(form);expect(mocks.submit).toHaveBeenCalledTimes(1);
 expect(screen.getByLabelText("Full legal name").matches(":disabled")).toBe(true);
 await act(async()=>finish({success:false,error:"Known rejection"}));
 expect((await screen.findByRole("alert")).textContent).toContain("Known rejection");
 expect(screen.queryByRole("link",{name:"Check applications"})).toBeNull();
});
it("a late success cannot replace the editor reopened after dismissal",async()=>{
 let finish!:(value:unknown)=>void;mocks.submit.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const form=await readyForm();fireEvent.submit(form);
 fireEvent.click(screen.getByText("Fixture close"));fireEvent.click(screen.getByRole("button",{name:"Apply now"}));
 await screen.findByLabelText("Full legal name");await act(async()=>finish({success:true,data:{applicationId:"fixture"}}));
 expect(screen.queryByText("Application submitted")).toBeNull();expect(screen.getByLabelText("Full legal name")).toBeTruthy();
});
