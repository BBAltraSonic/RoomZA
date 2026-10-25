// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SellerPipeline } from "./seller-pipeline";

const mocks=vi.hoisted(()=>({update:vi.fn(),conversation:vi.fn(),error:vi.fn(),success:vi.fn(),push:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push})}));
vi.mock("./actions",()=>({updateBuyerInterest:mocks.update,getOrCreateBuyerInterestConversation:mocks.conversation}));
vi.mock("sonner",()=>({toast:{success:mocks.success,error:mocks.error}}));
vi.mock("@/lib/motion/primitives",()=>({SuccessFeedback:()=>null}));
const proposal={updatedAt:"2030-01-20T08:00:01.000Z",viewingDate:"2030-01-21T08:30:00.000Z"};
vi.mock("@/features/viewings/components/propose-viewing-modal",()=>({
  ProposeViewingModal:({onBuyerProposed,disabled}:{onBuyerProposed?:(value:typeof proposal)=>void;disabled?:boolean})=><button disabled={disabled} onClick={()=>onBuyerProposed?.(proposal)}>Send fixture proposal</button>,
}));
const row={id:"interest",listing_id:"listing",status:"interested" as const,notes:"",viewing_date:null,created_at:"2030-01-20T08:00:00.000Z",updated_at:"2030-01-20T08:00:00.000Z",buyer:{id:"buyer",full_name:"Fixture buyer",email:null,phone:null,avatar_url:null},listing:{id:"listing",title:"Fixture sale",address:"Fixture address",sale_price:1000000,price:0}};
beforeEach(()=>{vi.clearAllMocks();mocks.update.mockResolvedValue({success:true,data:{updatedAt:"2030-01-20T08:00:02.000Z"}});});
afterEach(cleanup);
describe("seller pipeline recovery",()=>{
  it("keeps an unsaved note while advancing the revision and viewing date from the seller's own proposal",async()=>{
    render(<SellerPipeline interests={[row]} />);
    fireEvent.change(screen.getByLabelText("Private notes"),{target:{value:"Unsaved seller context"}});
    fireEvent.click(screen.getByRole("button",{name:"Send fixture proposal"}));
    fireEvent.click(screen.getByRole("button",{name:/^Save$/}));
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith({buyerInterestId:row.id,expectedUpdatedAt:proposal.updatedAt,status:"interested",notes:"Unsaved seller context",viewingDate:proposal.viewingDate}));
  });
  it("retains the user's original revision for drafts when another actor changes the server row",async()=>{
    const view=render(<SellerPipeline interests={[row]} />);
    fireEvent.change(screen.getByLabelText("Private notes"),{target:{value:"Local unsaved note"}});
    view.rerender(<SellerPipeline interests={[{...row,updated_at:proposal.updatedAt,notes:"Another actor's note"}]} />);
    fireEvent.click(screen.getByRole("button",{name:/^Save$/}));
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({expectedUpdatedAt:row.updated_at,notes:"Local unsaved note"})));
  });
  it("locks edits and duplicate submissions until a save resolves, then keeps the draft on conflict",async()=>{
    let resolve!:(value:{success:false;error:string})=>void;
    mocks.update.mockReturnValue(new Promise(done=>{resolve=done;}));
    render(<SellerPipeline interests={[row]} />);
    fireEvent.change(screen.getByLabelText("Private notes"),{target:{value:"Keep this draft"}});
    fireEvent.click(screen.getByRole("button",{name:/^Save$/}));
    await waitFor(()=>expect(screen.getByLabelText("Private notes")).toBeDisabled());
    expect(screen.getByRole("combobox",{name:"Pipeline status"})).toBeDisabled();
    expect(screen.getByLabelText("Viewing")).toBeDisabled();
    expect(screen.getByRole("button",{name:"Send fixture proposal"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:/^Save$/}));expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async()=>resolve({success:false,error:"Buyer interest changed. Reload before saving."}));
    expect(screen.getByLabelText("Private notes")).toBeEnabled();expect(screen.getByLabelText("Private notes")).toHaveValue("Keep this draft");
    expect(mocks.error).toHaveBeenCalledWith("Buyer interest changed. Reload before saving.");
  });
  it("recovers from a lost save response without crashing or clearing the draft",async()=>{
    mocks.update.mockRejectedValueOnce(new Error("transport"));
    render(<SellerPipeline interests={[row]} />);
    fireEvent.change(screen.getByLabelText("Private notes"),{target:{value:"Keep after network failure"}});
    fireEvent.click(screen.getByRole("button",{name:/^Save$/}));
    await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Reload buyer interest before retrying")));
    await waitFor(()=>expect(screen.getByRole("button",{name:/^Save$/})).toBeEnabled());expect(screen.getByLabelText("Private notes")).toHaveValue("Keep after network failure");
  });
  it("lets the seller retry conversation entry after a transport failure",async()=>{
    mocks.conversation.mockRejectedValueOnce(new Error("transport"));
    render(<SellerPipeline interests={[row]} />);fireEvent.click(screen.getByRole("button",{name:/^Contact$/}));
    await waitFor(()=>expect(mocks.error).toHaveBeenCalledWith("Unable to open this conversation. Try again."));
    expect(screen.getByRole("button",{name:/^Contact$/})).toBeEnabled();expect(mocks.push).not.toHaveBeenCalled();
  });
});
