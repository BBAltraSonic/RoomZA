// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const mocks=vi.hoisted(()=>({office:vi.fn(),select:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock("./actions",()=>({createOrganization:vi.fn(),createOrganizationOffice:mocks.office,inviteOrganizationMember:vi.fn(),revokeOrganizationMember:vi.fn(),selectActiveOrganization:mocks.select}));
import { OrganizationManagement } from "./organization-management";
import { OrganizationSelector } from "./organization-selector";
const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const memberships=[{organizationId:a,organizationName:"First team",organizationSlug:"first-team",role:"owner" as const,importsPilotEnabled:true,active:true},{organizationId:b,organizationName:"Second team",organizationSlug:"second-team",role:"admin" as const,importsPilotEnabled:true,active:false}];
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("organization controls before and after hydration",()=>{
 it.each([null,{organizationName:"Contained team",role:"owner" as const}])("protects server-rendered management fields until handlers are ready (%j)",organization=>{const host=document.createElement("div");host.innerHTML=renderToString(<OrganizationManagement organization={organization} offices={[]} members={[]} invitations={[]} />);expect(host.querySelector("input")?.matches(":disabled")).toBe(true);});
 it("disables the server-rendered workspace selector",()=>{const host=document.createElement("div");host.innerHTML=renderToString(<OrganizationSelector memberships={memberships} activeOrganizationId={a} />);expect(host.querySelector("select")?.disabled).toBe(true);});
 it("accepts a hydrated office edit and retains it after a refused action",async()=>{mocks.office.mockResolvedValue({success:false,error:"Only organization owners and admins can manage offices."});render(<OrganizationManagement organization={{organizationName:"Contained team",role:"agent"}} offices={[]} members={[]} invitations={[]} />);fireEvent.change(screen.getByRole("textbox",{name:"Office name"}),{target:{value:"Retained agent office"}});fireEvent.click(screen.getByRole("button",{name:"Add office"}));expect((await screen.findByRole("status")).textContent).toContain("Only organization owners");expect((screen.getByRole("textbox",{name:"Office name"}) as HTMLInputElement).value).toBe("Retained agent office");expect(mocks.office).toHaveBeenCalledExactlyOnceWith({name:"Retained agent office",address:""});});
 it("keeps the selected workspace when a hydrated switch is refused",async()=>{mocks.select.mockResolvedValue({success:false,error:"You no longer have access to that organization."});render(<OrganizationSelector memberships={memberships} activeOrganizationId={a} />);fireEvent.change(screen.getByRole("combobox",{name:"Workspace"}),{target:{value:b}});expect((await screen.findByRole("alert")).textContent).toContain("no longer have access");expect((screen.getByRole("combobox",{name:"Workspace"}) as HTMLSelectElement).value).toBe(a);expect(mocks.select).toHaveBeenCalledExactlyOnceWith(b);expect(mocks.refresh).not.toHaveBeenCalled();});
});
