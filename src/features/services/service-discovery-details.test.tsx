// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { ServicesDiscovery } from "@/app/services/services-discovery";
import { ViewportDiscoveryScreen } from "@/features/discovery/viewport-discovery-screen";
import type { DiscoveryMapProps } from "@/features/discovery/discovery-map";
import { ServiceDetailContent } from "./service-detail-content";
import type { PublicService } from "./schema";

const fixture = vi.hoisted(() => ({ map: null as DiscoveryMapProps | null, items: [] as PublicService[] }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item: PublicService = { id, area_id: id, approved_at: "2026-10-11T08:00:00Z", content: { title: "Tap repairs", providerName: "Local plumber", serviceType: "Plumbing", description: "Full service details", areaId: id, address: "10 Fixture Road", latitude: -33, longitude: 18, phone: "021 555 0100" } };
const place = { id, providerId: "fixture", label: "Fixture", secondaryLabel: "ZA", fullAddress: "Fixture, ZA", center: { lat: -33, lng: 18 }, bounds: { west: 17, south: -34, east: 19, north: -32 } };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => (props: ComponentProps<typeof ServiceDetailContent>) => <ServiceDetailContent {...props} /> }));
vi.mock("@/features/discovery/discovery-map-loader", () => ({ DiscoveryMapLoader: (props: DiscoveryMapProps) => { fixture.map = props; return <div data-testid="map">Map</div>; } }));
vi.mock("@/features/map-discovery/location-selector", () => ({ LocationSelector: () => null }));
vi.mock("@/features/discovery/use-viewport-feed", () => ({ useViewportFeed: () => ({ feed: { category: "service", items: fixture.items, totalCount: fixture.items.length, serverNow: "2026-10-11T08:00:00Z" }, loading: false, error: false, refresh: vi.fn() }) }));
vi.mock("@/lib/motion/primitives", () => ({ BlurImage: () => null }));
beforeEach(() => {
  fixture.items = [item]; fixture.map = null;
  window.history.replaceState(null, "", "/services?bbox=17,-34,19,-32");
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("1024"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.startsWith("/api/places/") ? { data: { place } } : url === "/api/services/" + id ? { item } : { areaId: id, totalCount: 1, page: 1, items: [item], hasNext: false })));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
it.each(["viewport", "legacy"] as const)("wires service card details into the %s screen without remounting discovery", async source => {
  render(source === "viewport" ? <ViewportDiscoveryScreen category="service" /> : <ServicesDiscovery areaId={id} area="Fixture" />);
  const button = await screen.findByRole("button", { name: "View details for Tap repairs" });
  const map = screen.getByTestId("map"), results = button.closest("ul")!;
  if (source === "viewport") act(() => fixture.map?.onBoundsChange?.(place.bounds));
  act(() => fixture.map?.onSelect?.(id));
  expect(window.location.search).not.toContain("detailId");
  button.focus(); fireEvent.click(button);
  const details = await screen.findByRole("complementary", { name: "Service details" });
  expect(await within(details).findByRole("heading", { name: "About this service" })).toBeVisible();
  expect(fixture.map?.selectedId).toBe(id);
  expect(screen.getByTestId("map")).toBe(map); expect(results.isConnected).toBe(true);
  fireEvent.click(within(details).getByRole("button", { name: "Back to services" }));
  expect(screen.getByTestId("map")).toBe(map); expect(results.isConnected).toBe(true);
});
it("opens a linked service absent from the viewport results", async () => {
  fixture.items = [];
  window.history.replaceState(null, "", "/services?bbox=17,-34,19,-32&detailId=" + id);
  render(<ViewportDiscoveryScreen category="service" />);
  expect(await screen.findByRole("heading", { name: "Tap repairs" })).toBeVisible();
  expect(document.querySelector('[data-card-category="service"]')).toBeNull();
  expect(screen.getByTestId("map")).toBeInTheDocument();
});
