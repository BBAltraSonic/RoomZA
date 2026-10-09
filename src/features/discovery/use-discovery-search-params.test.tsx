// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { useDiscoverySearchParams } from "./use-discovery-search-params";

// A public asset shell can have empty router query state while the address bar
// has a valid location. This is the reported live screenshot's failure mode.
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it("reads a direct location link despite empty prerendered router params", () => {
  window.history.replaceState(null, "", "/offers?areaId=selected&kind=tourism&page=2");
  const { result, rerender } = renderHook(() => useDiscoverySearchParams());
  expect(Object.fromEntries(result.current)).toEqual({ areaId: "selected", kind: "tourism", page: "2" });
  const original = result.current;
  rerender();
  expect(result.current).toBe(original);
});

it("updates on push, replace and back/forward state without losing IDs", async () => {
  window.history.replaceState(null, "", "/offers?areaId=selected&kind=shopping");
  const push = window.history.pushState;
  const replace = window.history.replaceState;
  const { result, unmount } = renderHook(() => useDiscoverySearchParams());
  await act(async () => { window.history.pushState({ route: "event" }, "", "/offers?areaId=selected&kind=event"); });
  expect(result.current.get("kind")).toBe("event");
  expect(window.history.state).toEqual({ route: "event" });
  await act(async () => { window.history.replaceState({ route: "services" }, "", "/services?areaId=selected&page=3&serviceType=Plumbing"); });
  expect(Object.fromEntries(result.current)).toMatchObject({ areaId: "selected", page: "3", serviceType: "Plumbing" });
  await act(async () => {
    replace.call(window.history, { route: "back" }, "", "/offers?areaId=selected&kind=tourism");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.get("kind")).toBe("tourism");
  unmount();
  expect(window.history.pushState).toBe(push);
  expect(window.history.replaceState).toBe(replace);
});

it("hydrates a query-free public shell into the actual selected location", async () => {
  window.history.replaceState(null, "", "/offers?areaId=selected&kind=event");
  function Shell() {
    const params = useDiscoverySearchParams();
    return <p>{params.get("areaId") ?? "Choose location"}</p>;
  }
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Shell />);
  expect(container.textContent).toBe("Choose location");
  const errors: unknown[] = [];
  const root = hydrateRoot(container, <Shell />, { onRecoverableError: error => errors.push(error) });
  try {
    await act(async () => {});
    expect(container.textContent).toBe("selected");
    expect(errors).toEqual([]);
  } finally { await act(async () => root.unmount()); }
});
