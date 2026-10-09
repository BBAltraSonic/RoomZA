// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useDiscoveryControls } from "./url-controls";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it("restores direct-link controls, preserves place/cursor/IDs and carries controls across views", () => {
  window.history.replaceState(null, "", "/services?areaId=stored-id&listingId=home-id&q=plumber&sort=Nearest&serviceType=Plumbing");
  const { result } = renderHook(() => useDiscoveryControls(["Latest", "Nearest"], ["All services", "Plumbing"]));
  expect(result.current).toMatchObject({ query: "plumber", sort: "Nearest", type: "Plumbing" });
  act(() => result.current.setQuery("new text"));
  expect(new URLSearchParams(window.location.search).get("listingId")).toBe("home-id");
  expect(result.current.query).toBe("new text");
  const href = result.current.withControls("/services?areaId=stored-id&view=map&page=2");
  expect(new URL(href, "http://localhost").searchParams.get("q")).toBe("new text");
  expect(href).toContain("page=2");
  expect(href).toContain("serviceType=Plumbing");
});

it("reconciles history navigation and ignores unsupported category-specific sort/type values", () => {
  window.history.replaceState(null, "", "/offers?q=old&sort=unsupported&serviceType=Plumbing");
  const { result } = renderHook(() => useDiscoveryControls(["Ending soon", "Latest"]));
  expect(result.current.sort).toBe("Ending soon");
  expect(result.current.type).toBeUndefined();
  act(() => result.current.setSort("Latest"));
  expect(result.current.sort).toBe("Latest");
  act(() => { window.history.replaceState(null, "", "/offers?q=back&sort=Ending+soon"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current).toMatchObject({ query: "back", sort: "Ending soon" });
});

it("keeps rapid controls and repeated history changes on the current location and page", () => {
  window.history.replaceState(null,"","/services?areaId=place&listingId=home&page=3&view=feed");
  const {result} = renderHook(()=>useDiscoveryControls(["Latest","Nearest"],["All services","Plumbing"]));
  act(()=>{result.current.setQuery("first");result.current.setSort("Nearest");result.current.setType("Plumbing");result.current.setQuery("current");});
  const current=new URLSearchParams(window.location.search);
  expect(Object.fromEntries(current)).toMatchObject({q:"current",sort:"Nearest",serviceType:"Plumbing",areaId:"place",listingId:"home",page:"3",view:"feed"});
  act(()=>{for(const q of ["back","forward","final"]){window.history.replaceState(null,"","/services?areaId=place&page=3&q="+q);window.dispatchEvent(new PopStateEvent("popstate"));}});
  expect(result.current.query).toBe("final");
});
