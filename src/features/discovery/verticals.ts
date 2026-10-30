import type { ViewportCategory } from "./viewport-contract";

/** What the visitor is trying to do. Each one is an environment of the same screen. */
export type DiscoveryVertical = "property" | ViewportCategory;

type VerticalConfig = { path: "/" | "/offers" | "/services"; kind?: "tourism" | "event"; title: string };

export const discoveryVerticals: Record<DiscoveryVertical, VerticalConfig> = {
  property: { path: "/", title: "Browse Rentals on the Map" },
  shopping: { path: "/offers", title: "Specials" },
  tourism: { path: "/offers", kind: "tourism", title: "Specials" },
  event: { path: "/offers", kind: "event", title: "Specials" },
  service: { path: "/services", title: "Nearby Services" },
};

export function isDiscoveryPath(pathname: string) {
  return pathname === "/" || pathname === "/offers" || pathname === "/services";
}

export function resolveVertical(pathname: string, search: string): DiscoveryVertical {
  if (pathname === "/services") return "service";
  if (pathname !== "/offers") return "property";
  const kind = new URLSearchParams(search).get("kind");
  return kind === "tourism" || kind === "event" ? kind : "shopping";
}

const sharedParams = ["areaId", "area"];
const viewportParams = ["bbox", "q", "sort"];

/** Moves between environments while keeping where the visitor is looking. */
export function verticalHref(target: DiscoveryVertical, search: string, propertySearch = "") {
  const current = new URLSearchParams(search);
  const { path, kind } = discoveryVerticals[target];
  const next = new URLSearchParams(target === "property" ? propertySearch : "");
  const carried = target === "property" ? sharedParams : [...sharedParams, ...viewportParams, ...(target === "service" ? ["serviceType"] : [])];
  for (const key of carried) {
    const value = current.get(key);
    if (value !== null) next.set(key, value);
  }
  if (kind) next.set("kind", kind);
  if (target !== "property") next.set("view", "map");
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
