// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { serviceSubmissionSchema } from "./schema";
const mocks=vi.hoisted(()=>({fetch:vi.fn(),push:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push})}));
vi.mock("@/features/guest-contact/contact-fields",()=>({ContactFields:()=>null}));
vi.mock("@/features/map-discovery/location-selector",()=>({LocationSelector:()=>null}));
import { ServiceEditor } from "./service-workspace";
const id="550e8400-e29b-41d4-a716-446655440094",other="550e8400-e29b-41d4-a716-446655440095",photo="550e8400-e29b-41d4-a716-446655440096",nextPhoto="550e8400-e29b-41d4-a716-446655440097";
const initial:z.infer<typeof serviceSubmissionSchema>={id,version:2,status:"draft",draft:{title:"Contained media service",providerName:"Fixture provider",serviceType:"Plumbing",description:"Contained photo fixture",areaId:"550e8400-e29b-41d4-a716-446655440098",address:"Fixture address",latitude:-26.2,longitude:28.04,phone:"+27000000000",publicContact:{email:"qa@pinpoint.invalid"},contactConsent:true,mediaIds:[photo],mediaRightsConfirmed:true},submitted:null,updated_at:"2026-10-18T08:00:00Z"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
const firstMedia={id:photo,url:"/contained-first-photo.png"},newMedia={id:nextPhoto,url:"/contained-new-photo.png"};
const imageUrl=(image:HTMLElement)=>{const source=image.getAttribute("src")!;return new URL(source,"http://localhost").searchParams.get("url")??source;};
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal("fetch",mocks.fetch);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("refreshes real media fields when explicit canonical recovery loads a photo added elsewhere",async()=>{
  let mediaReads=0;
  mocks.fetch.mockImplementation(async(url:string,options?:RequestInit)=>{
    if(url.startsWith("/api/discovery-media?"))return json({media:++mediaReads===1?[firstMedia]:[firstMedia,newMedia]});
    if(options?.method==="POST")return json({error:"This service changed."},409);
    return json({item:{...initial,version:4,draft:{...initial.draft,mediaIds:[photo,nextPhoto]}}});
  });
  render(<ServiceEditor initial={initial}/>);
  expect(imageUrl(await screen.findByRole("img",{name:"Service photo 1"}))).toBe(firstMedia.url);
  fireEvent.click(screen.getByRole("button",{name:"Save private draft"}));
  fireEvent.click(await screen.findByRole("button",{name:"Replace my edits with saved version"}));
  expect(imageUrl(await screen.findByRole("img",{name:"Service photo 2"}))).toBe(newMedia.url);
  expect(mediaReads).toBe(2);
});
it("blocks submission without photo rights and permits an explicit corrected retry",async()=>{
  const writes:Array<Record<string,unknown>>=[];
  mocks.fetch.mockImplementation(async(url:string,options?:RequestInit)=>{
    if(url.startsWith("/api/discovery-media?"))return json({media:[firstMedia]});
    const body=JSON.parse(String(options?.body));writes.push(body);
    return json({id,version:body.command==="save"?3:4,status:body.command==="save"?"draft":"submitted"});
  });
  render(<ServiceEditor initial={{...initial,draft:{...initial.draft,mediaRightsConfirmed:false}}}/>);
  await screen.findByRole("img",{name:"Service photo 1"});
  fireEvent.click(screen.getByRole("checkbox",{name:/I have permission to publish this provider/}));
  fireEvent.click(screen.getByRole("button",{name:"Submit for review"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Confirm that you may publish these photos.");expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole("checkbox",{name:/I own these photos/}));
  fireEvent.click(screen.getByRole("button",{name:"Submit for review"}));
  expect(await screen.findByText(/Submitted privately for review/)).toBeVisible();
  expect(writes).toHaveLength(2);expect(writes[0]).toMatchObject({draft:{mediaIds:[photo],mediaRightsConfirmed:true}});
});
it("does not show a previous service's late photo response in the next editor",async()=>{
  let finish!:(response:Response)=>void;
  mocks.fetch.mockImplementation((url:string)=>url.includes(`target=${id}`)?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(json({media:[newMedia]})));
  const view=render(<ServiceEditor initial={initial}/>);
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
  view.rerender(<ServiceEditor initial={{...initial,id:other,draft:{...initial.draft,mediaIds:[nextPhoto]}}}/>);
  expect(imageUrl(await screen.findByRole("img",{name:"Service photo 1"}))).toBe(newMedia.url);
  await act(async()=>finish(json({media:[firstMedia]})));
  expect(imageUrl(screen.getByRole("img",{name:"Service photo 1"}))).toBe(newMedia.url);
});
