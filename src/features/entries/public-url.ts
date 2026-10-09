import type { EntryCategory } from "./schema";
export function entryFeedHref(category:EntryCategory,areaId:string|null,view:"feed"|"map",page=1,area?:string) {
  const params=new URLSearchParams({kind:category,view});if(areaId)params.set("areaId",areaId);if(area)params.set("area",area);if(page>1)params.set("page",String(page));return "/offers?"+params;
}
