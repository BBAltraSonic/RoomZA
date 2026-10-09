import { afterEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({select:vi.fn(),ilike:vi.fn(),order:vi.fn(),limit:vi.fn(),from:vi.fn(),forward:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/admin",()=>({createUntypedClient:()=>({from:mocks.from})}));
vi.mock("@/lib/maptiler",()=>({forwardGeocode:mocks.forward}));
import { searchDiscoveryPlaces } from "./server";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const row={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",provider_id:"stored-area",name:"Rondebosch",region:"ZA",full_address:"Rondebosch, ZA",center_lat:-33.96,center_lng:18.47,west:18.4,south:-34,east:18.6,north:-33.9};
function stored(result:unknown){const builder={select:mocks.select,ilike:mocks.ilike,order:mocks.order,limit:mocks.limit};mocks.from.mockReturnValue(builder);mocks.select.mockReturnValue(builder);mocks.ilike.mockReturnValue(builder);mocks.order.mockReturnValue(builder);mocks.limit.mockResolvedValue(result);}
it("uses actual cached app-owned places when a development geocoder key is absent",async()=>{vi.stubEnv("NEXT_PUBLIC_MAPTILER_API_KEY","");stored({data:[row],error:null});expect(await searchDiscoveryPlaces("Rondebosch")).toEqual([expect.objectContaining({id:row.id,providerId:row.provider_id,label:row.name,center:{lat:-33.96,lng:18.47}})]);expect(mocks.forward).not.toHaveBeenCalled();expect(mocks.limit).toHaveBeenCalledWith(6);});
it("escapes wildcard searches and reports database failure",async()=>{vi.stubEnv("NEXT_PUBLIC_MAPTILER_API_KEY","");stored({data:null,error:new Error("offline")});await expect(searchDiscoveryPlaces("test_%")).rejects.toThrow("offline");expect(mocks.ilike).toHaveBeenCalledWith("name","%test\\_\\%%");});
