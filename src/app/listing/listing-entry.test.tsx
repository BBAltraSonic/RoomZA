import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({published:vi.fn(),discovery:vi.fn<(props:Record<string,unknown>)=>null>(()=>null)}));
vi.mock("@/features/listings/actions",()=>({getPublishedListing:mocks.published}));
vi.mock("@/features/map-discovery/discovery-page",()=>({DiscoveryPage:(props:Record<string,unknown>)=>mocks.discovery(props)}));
vi.mock("@/features/map-discovery/discovery-page-fallback",()=>({DiscoveryPageFallback:()=>null}));
import ListingPage from "./[id]/page";
const id="550e8400-e29b-41d4-a716-446655440020";
beforeEach(()=>vi.clearAllMocks());
it("retains safe public availability on a direct property link without exposing raw presence",async()=>{
  const presence={badge:"available",name:"Synthetic public lister"};
  mocks.published.mockResolvedValue({id,title:"Synthetic property",address:"Fixture",price:2500,listing_type:"rent",latitude:-26.2,longitude:28,images:[],landlordTrust:null,landlordPresence:presence,last_seen_at:"private heartbeat"});
  renderToStaticMarkup(await ListingPage({params:Promise.resolve({id})}));
  expect(mocks.discovery).toHaveBeenCalledWith(expect.objectContaining({initialListing:expect.objectContaining({id,landlordPresence:presence})}));
  const rendered=mocks.discovery.mock.calls[0]?.[0] as Record<string,unknown>;
  expect(JSON.stringify(rendered)).not.toContain("private heartbeat");
});
