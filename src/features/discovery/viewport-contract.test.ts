import { expect, it } from "vitest";
import { parseViewportBbox, viewportResponseSchema } from "./viewport-contract";
const bounds = { west:18,south:-34,east:19,north:-33 };
const item = { entryId:"00000000-0000-4000-8000-000000000001", category:"event", approvedAt:"2026-01-01T00:00:00Z", state:"upcoming",
  content:{ title:"Demo concert",description:"Synthetic",venueName:"Demo venue",areaId:"00000000-0000-4000-8000-000000000002",address:"Demo address",latitude:-33.9,longitude:18.5,startsAt:"2026-01-02T17:00:00Z",endsAt:"2026-01-02T20:00:00Z" } };
it("validates ordered finite bounds, including direct links", () => {
  expect(parseViewportBbox("18,-34,19,-33")).toEqual(bounds);
  for (const value of [null,"","18,-34,18,-33","18,-34,19,-34","Infinity,0,1,2","1,2,3","-181,0,1,2"]) expect(parseViewportBbox(value)).toBeNull();
});
it("allows different area IDs in the same viewport but rejects out-of-bounds content and oversized results", () => {
  const feed = { category:"event",bounds,serverNow:"2026-01-01T00:00:00Z",totalCount:251,items:[item] };
  expect(viewportResponseSchema.safeParse(feed).success).toBe(true);
  expect(viewportResponseSchema.safeParse({...feed,items:Array(251).fill(item)}).success).toBe(false);
  expect(viewportResponseSchema.safeParse({...feed,items:[{...item,content:{...item.content,longitude:20}}]}).success).toBe(false);
  expect(viewportResponseSchema.safeParse({...feed,privateReview:"hidden"}).success).toBe(false);
});
