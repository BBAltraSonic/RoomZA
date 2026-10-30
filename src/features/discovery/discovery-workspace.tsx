"use client";

import { usePathname } from "next/navigation";
import { Activity, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";
import { PropertyDiscovery } from "@/features/map-discovery/property-discovery";
import { DiscoveryStage } from "./discovery-stage";
import { useBrowserPathname, useDiscoverySearchParams } from "./use-discovery-search-params";
import { discoveryVerticals, isDiscoveryPath, resolveVertical, type DiscoveryVertical } from "./verticals";
import type { ViewportCategory } from "./viewport-contract";
import { WorkspaceNavigationContext } from "./workspace-navigation";

const environmentOrder: DiscoveryVertical[] = ["property", "shopping", "tourism", "event", "service"];
const PRELOAD_DELAY_MS = 1200;

type ViewportScreen = ComponentType<{ category: ViewportCategory; mapApiKey?: string }>;

/**
 * Outside the landing route's initial bundle, but fetched soon after it. Held as
 * a value rather than `lazy()` so a preloaded screen renders in the same commit
 * as the click, with no fallback frame.
 */
let viewportScreen: ViewportScreen | null = null;
async function loadViewportScreen() {
  const { ViewportDiscoveryScreen } = await import("./viewport-discovery-screen");
  viewportScreen = ViewportDiscoveryScreen;
  return viewportScreen;
}

/**
 * The one discovery screen. Property, Specials and Services are environments of
 * it: the map stays alive, and changing what the visitor is looking for swaps the
 * data and results around that map without a route change. Visited environments
 * stay mounted but hidden, so returning to one is instant and keeps its scroll,
 * filters and results.
 */
export function DiscoveryWorkspace({ mapApiKey, children }: { mapApiKey?: string; children?: ReactNode }) {
  const routerPath = usePathname();
  const browserPath = useBrowserPathname();
  const params = useDiscoverySearchParams();
  // A route arriving from elsewhere renders before the address bar has changed.
  const pathname = isDiscoveryPath(browserPath) ? browserPath : routerPath;
  const active = resolveVertical(pathname, params.toString());
  const [visited, setVisited] = useState<ReadonlySet<DiscoveryVertical>>(() => new Set([active]));
  if (!visited.has(active)) setVisited(new Set([...visited, active]));

  const [ViewportScreen, setViewportScreen] = useState(() => viewportScreen);
  const needsViewportNow = active !== "property";
  useEffect(() => {
    if (ViewportScreen) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadViewportScreen().then(screen => { if (!cancelled) setViewportScreen(() => screen); });
    }, needsViewportNow ? 0 : PRELOAD_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ViewportScreen, needsViewportNow]);

  const propertySearch = useRef("");
  useEffect(() => {
    if (active === "property") propertySearch.current = params.toString();
  }, [active, params]);

  const go = useCallback((href: string, vertical: DiscoveryVertical) => {
    window.history.pushState(null, "", href);
    document.title = `${discoveryVerticals[vertical].title} | Pinpoint`;
  }, []);
  const navigation = useMemo(() => ({ go, propertySearch: () => propertySearch.current }), [go]);

  return (
    <WorkspaceNavigationContext.Provider value={navigation}>
      <DiscoveryStage>
        {environmentOrder.filter(vertical => visited.has(vertical)).map(vertical => (
          <Activity key={vertical} mode={vertical === active ? "visible" : "hidden"}>
            {vertical === "property"
              ? <PropertyDiscovery mapApiKey={mapApiKey} />
              : ViewportScreen ? <ViewportScreen category={vertical} mapApiKey={mapApiKey} /> : <DiscoveryPageFallback />}
          </Activity>
        ))}
        {children}
      </DiscoveryStage>
    </WorkspaceNavigationContext.Provider>
  );
}
