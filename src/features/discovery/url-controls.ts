"use client";

import { useDiscoverySearchParams } from "./use-discovery-search-params";

/** Page-local controls are shareable, reloadable and part of browser history. */
export function useDiscoveryControls(sorts: readonly [string, ...string[]], types: readonly string[] = []) {
  const params = useDiscoverySearchParams();
  const query = (params.get("q") ?? "").slice(0, 120);
  const sort = sorts.includes(params.get("sort") ?? "") ? params.get("sort")! : sorts[0];
  const type = types.includes(params.get("serviceType") ?? "") ? params.get("serviceType")! : types[0];
  function update(key: string, value: string, replace = false) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    window.dispatchEvent(new Event("pinpoint:discovery-controls"));
  }
  function withControls(href: string) {
    const [path, search = ""] = href.split("?");
    const next = new URLSearchParams(search);
    if (query) next.set("q", query);
    if (params.has("sort")) next.set("sort", sort);
    if (type && params.has("serviceType")) next.set("serviceType", type);
    return path + "?" + next;
  }
  return { query, sort, type, setQuery: (value: string) => update("q", value.slice(0, 120), true), setSort: (value: string) => update("sort", value), setType: (value: string) => update("serviceType", value), withControls };
}
