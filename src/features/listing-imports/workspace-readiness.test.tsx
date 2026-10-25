// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImportJobSummary } from "./types";
const mocks=vi.hoisted(()=>({push:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push,refresh:vi.fn()})}));
vi.mock("next/dynamic",()=>({default:()=>()=>null}));
vi.mock("@/lib/supabase/browser",()=>({createClient:()=>({channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn()})}));
import { ImportWorkspace } from "./import-workspace";
import { NewImportForm } from "./new-import-form";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",organizationId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",agentId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const base:ImportJobSummary={id,organizationId,sourceKind:"csv",sourceName:"source.csv",stage:"mapping",version:1,totalRows:0,processedRows:0,validRows:0,warningRows:0,blockedRows:0,committedRows:0,failedRows:0,heartbeatAt:null,updatedAt:"2026-10-20T00:00:00Z",messageCode:null,messageDetail:null};
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("import controls before hydration",()=>{
 it.each(["upload","mapping","failed","validating"] as const)("disables native controls in the %s server document",stage=>{const host=document.createElement("div");host.innerHTML=renderToString(<ImportWorkspace initialJob={{...base,stage}} initialConfiguration={{mapping:{title:"title"},defaults:{responsibleAgentId:agentId},selection:{mode:"explicit",included:[]},sourceMetadata:{headers:["title"]},sheetName:null,recordPath:null}} initialRows={[]} initialNextCursor={null} agents={[{id:agentId,label:"Contained owner",role:"owner"}]} />);const control=stage==="upload"?host.querySelector('input[type="file"]'):stage==="mapping"?host.querySelector("select"):host.querySelector("button");expect(control).not.toBeNull();expect(control?.matches(":disabled")).toBe(true);});
 it("disables source creation in its server document",()=>{const host=document.createElement("div");host.innerHTML=renderToString(<NewImportForm />);expect(host.querySelector('button[type="submit"]')?.matches(":disabled")).toBe(true);expect(host.querySelector('input[type="radio"]')?.matches(":disabled")).toBe(true);});
 it("submits the selected source once after hydration",async()=>{const fetcher=vi.fn().mockResolvedValue(Response.json({ok:true,data:{job:{id}}}));vi.stubGlobal("fetch",fetcher);render(<NewImportForm />);fireEvent.click(screen.getByRole("button",{name:"Continue to upload"}));await waitFor(()=>expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/dashboard/imports/'+id));expect(fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({sourceKind:"csv"});});
});
