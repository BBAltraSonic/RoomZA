// @vitest-environment jsdom
import { Component, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({change:vi.fn()}));
vi.mock("./actions",()=>({setAvailabilityMode:mocks.change}));
import { AvailabilityToggle } from "./availability-toggle";
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<p role="alert">Controls failed</p>:this.props.children;}}
beforeEach(()=>{vi.resetAllMocks();mocks.change.mockResolvedValue({success:true,data:{mode:"available"}});});
afterEach(cleanup);
describe("availability control recovery",()=>{
  it("contains an interrupted availability update, restores the selection and permits retry",async()=>{
    mocks.change.mockRejectedValueOnce(new Error("Contained availability transport failure"));render(<Boundary><AvailabilityToggle currentMode="invisible"/></Boundary>);
    fireEvent.click(screen.getByRole("button",{name:/^Available/}));expect(await screen.findByText("Availability could not be confirmed. Try again.")).toBeVisible();expect(screen.queryByText("Controls failed")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:/^Invisible/})).toHaveAttribute("aria-pressed","true");const available=screen.getByRole("button",{name:/^Available/});await waitFor(()=>expect(available).toBeEnabled());fireEvent.click(available);
    expect(await screen.findByText("Availability updated.")).toBeVisible();expect(available).toHaveAttribute("aria-pressed","true");expect(mocks.change).toHaveBeenCalledTimes(2);
  });
  it("locks duplicate and competing same-turn availability changes",async()=>{
    let resolve!:(value:{success:true;data:{mode:string}})=>void;mocks.change.mockReturnValue(new Promise(done=>{resolve=done;}));render(<AvailabilityToggle currentMode="invisible"/>);
    const available=screen.getByRole("button",{name:/^Available/}),busy=screen.getByRole("button",{name:/^Busy/});act(()=>{available.click();available.click();busy.click();});expect(mocks.change).toHaveBeenCalledTimes(1);
    await act(async()=>resolve({success:true,data:{mode:"available"}}));expect(available).toHaveAttribute("aria-pressed","true");
  });
  it("keeps the previous privacy selection after a rejected server result",async()=>{
    mocks.change.mockResolvedValue({success:false,error:"Failed to update availability."});render(<AvailabilityToggle currentMode="invisible"/>);fireEvent.click(screen.getByRole("button",{name:/^Available/}));
    expect(await screen.findByText("Failed to update availability.")).toBeVisible();expect(screen.getByRole("button",{name:/^Invisible/})).toHaveAttribute("aria-pressed","true");
  });
});

