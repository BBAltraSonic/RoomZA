// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const state=vi.hoisted(()=>({accept:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock("./actions",()=>({acceptOrganizationInvitation:state.accept}));
import { AcceptInvitation } from "./accept-invitation";
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("organization invitation readiness",()=>{
 it("disables acceptance in the server-rendered document until its client handler is ready",()=>{const html=renderToString(<AcceptInvitation token="contained-invitation-fixture-token" />),container=document.createElement("div");container.innerHTML=html;expect(container.querySelector("button")?.disabled).toBe(true);});
 it("submits once after hydration and shows an identity refusal",async()=>{state.accept.mockResolvedValue({success:false,error:"Sign in with the email address that received this invitation"});render(<AcceptInvitation token="contained-invitation-fixture-token" />);fireEvent.click(screen.getByRole("button",{name:"Accept invitation"}));expect((await screen.findByRole("alert")).textContent).toContain("email address");expect(state.accept).toHaveBeenCalledExactlyOnceWith("contained-invitation-fixture-token");});
});
