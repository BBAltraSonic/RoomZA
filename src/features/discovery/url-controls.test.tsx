// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useDiscoveryControls } from "./url-controls";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it("restores direct-link controls, preserves place/cursor/IDs and carries controls across views", () => {
  window.history.replaceState(null, "", "/offers?areaId=stored-id&listingId=home-id&q=pizza&sort=Nearest");
  const { result } = renderHook(() => useDiscoveryControls(["Latest", "Nearest"]));
  expect(result.current).toMatchObject({ query: "pizza", sort: "Nearest" });
  act(() => result.current.setQuery("new text"));
  expect(new URLSearchParams(window.location.search).get("listingId")).toBe("home-id");
  expect(result.current.query).toBe("new text");
  const href = result.current.withControls("/offers?areaId=stored-id&view=map&page=2");
  expect(new URL(href, "http://localhost").searchParams.get("q")).toBe("new text");
  expect(href).toContain("page=2");
});

it("reconciles history navigation and ignores unsupported sort values", () => {
  window.history.replaceState(null, "", "/offers?q=old&sort=unsupported");
  const { result } = renderHook(() => useDiscoveryControls(["Ending soon", "Latest"]));
  expect(result.current.sort).toBe("Ending soon");
  act(() => result.current.setSort("Latest"));
  expect(result.current.sort).toBe("Latest");
  act(() => { window.history.replaceState(null, "", "/offers?q=back&sort=Ending+soon"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current).toMatchObject({ query: "back", sort: "Ending soon" });
});

it("keeps rapid controls and repeated history changes on the current location and page", () => {
  window.history.replaceState(null,"","/offers?areaId=place&listingId=home&page=3&view=feed");
  const {result} = renderHook(()=>useDiscoveryControls(["Latest","Nearest"]));
  act(()=>{result.current.setQuery("first");result.current.setSort("Nearest");result.current.setQuery("current");});
  const current=new URLSearchParams(window.location.search);
  expect(Object.fromEntries(current)).toMatchObject({q:"current",sort:"Nearest",areaId:"place",listingId:"home",page:"3",view:"feed"});
  act(()=>{for(const q of ["back","forward","final"]){window.history.replaceState(null,"","/offers?areaId=place&page=3&q="+q);window.dispatchEvent(new PopStateEvent("popstate"));}});
  expect(result.current.query).toBe("final");
});
