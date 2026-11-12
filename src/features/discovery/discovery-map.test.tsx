// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoveryMap } from "./discovery-map";
const mocks = vi.hoisted(() => ({ fitBounds: vi.fn(), easeTo: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), forward: vi.fn(), initial: {} as object }));
vi.mock("motion/react", () => ({ useReducedMotion: () => true }));
vi.mock("@/lib/maptiler", () => ({ getMapTilerStyleUrl: () => "fixture-style", forwardGeocode: mocks.forward }));
vi.mock("react-map-gl/maplibre", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    default: forwardRef(function Fixture({ children, onLoad, onMoveEnd, onError, initialViewState }: { children: ReactNode; onLoad: () => void; onMoveEnd: () => void; onError: () => void; initialViewState: object }, ref) {
      mocks.initial = initialViewState;
      useImperativeHandle(ref, () => ({ ...mocks, getBounds: () => ({ getWest: () => 18, getSouth: () => -34, getEast: () => 19, getNorth: () => -33 }), getCenter: () => ({ lat: -33.9, lng: 18.4 }), getZoom: () => 13, getMap: () => ({ getContainer: () => ({ clientHeight: 600, closest: () => null }) }) }));
      return <div><button onClick={onLoad}>Load fixture map</button><button onClick={onMoveEnd}>Move fixture map</button><button onClick={onError}>Fail fixture map</button>{children}</div>;
    }), Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>, Popup: ({ children, anchor, maxWidth }: { children: ReactNode; anchor?: string; maxWidth?: string }) => <div data-testid="fixture-popup" data-anchor={anchor} data-max-width={maxWidth}>{children}</div>,
  };
});
const point = { id: "result", title: "Local provider", latitude: -33.9, longitude: 18.4 };
const originalGeo = Object.getOwnPropertyDescriptor(navigator, "geolocation");
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); if (originalGeo) Object.defineProperty(navigator,"geolocation",originalGeo); else Reflect.deleteProperty(navigator,"geolocation"); });
describe("pin content", () => {
  const camera = { lng: 18.4, lat: -33.9, zoom: 14 };
  const meal = { ...point, id: "meal", title: "Family meal special", kind: "special" as const, identity: "Chicken Shack", headline: "R45", detail: "Family meal", tag: "50% off", startsAt: "2026-10-30T08:00:00+02:00", endsAt: "2026-10-30T20:00:00+02:00" };
  const view = (props: Partial<Parameters<typeof DiscoveryMap>[0]>) => render(<DiscoveryMap mapApiKey="fixture" place={null} points={[meal]} onSelect={vi.fn()} initialCamera={camera} categoryLabel="Specials" {...props} />);
  const loadBounds = () => fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));

  it("should say what the special is and how far it is from the visitor", () => {
    view({ userLocation: { lat: -33.9, lng: 18.41 } });
    loadBounds();
    expect(screen.getByText("R45")).toBeInTheDocument();
    expect(screen.getByText("50% off")).toBeInTheDocument();
    expect(screen.getByText("Family meal · 900 m")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your location" })).toBeInTheDocument();
  });

  it("should never present a distance without the visitor's location", () => {
    view({});
    loadBounds();
    expect(screen.getByText("Family meal")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Your location" })).not.toBeInTheDocument();
  });

  it("should count down and pulse from its own clock when a special is nearly over", () => {
    const { container } = view({ serverNow: "2026-10-30T19:30:00+02:00" });
    loadBounds();
    expect(screen.getByText("30m left")).toBeInTheDocument();
    expect(container.querySelector(".map-pin-pulse")).toBeInTheDocument();
  });

  it("should use an already shared location without prompting or moving a resumed map", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: -33.9, longitude: 18.41 } } as GeolocationPosition));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: async () => ({ state: "granted" }) } });
    const onUserLocation = vi.fn();
    view({ onUserLocation });
    loadBounds();
    await act(async () => { await Promise.resolve(); });
    expect(onUserLocation).toHaveBeenCalledWith({ lat: -33.9, lng: 18.41 });
    expect(mocks.easeTo).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "permissions");
  });

  it("should not prompt a resumed map for location", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: async () => ({ state: "prompt" }) } });
    view({});
    loadBounds();
    await act(async () => { await Promise.resolve(); });
    expect(getCurrentPosition).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "permissions");
  });

  it("should keep calm pins still", () => {
    const { container } = view({ serverNow: "2026-10-30T09:00:00+02:00" });
    loadBounds();
    expect(container.querySelector(".map-pin-pulse")).not.toBeInTheDocument();
  });

  it("should tell visitors when an event starts", () => {
    const concert = { ...meal, kind: "event" as const, headline: "R120", detail: "Jazz night", tag: undefined, startsAt: "2026-10-30T19:00:00+02:00", endsAt: "2026-10-30T22:00:00+02:00" };
    view({ points: [concert], serverNow: "2026-10-30T09:00:00+02:00" });
    loadBounds();
    expect(screen.getByText("Today 19:00")).toBeInTheDocument();
  });
});
describe("sharing a live map between environments", () => {
  const camera = { lng: 18.4, lat: -33.9, zoom: 13 };
  it("should give an environment the viewport when it takes over a loaded map", () => {
    const first = vi.fn(), second = vi.fn();
    const view = render(<DiscoveryMap mapApiKey="fixture" place={null} points={[]} onSelect={vi.fn()} onBoundsChange={first} initialCamera={camera} categoryLabel="Specials" />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    expect(first).toHaveBeenCalledTimes(1);
    view.rerender(<DiscoveryMap mapApiKey="fixture" place={null} points={[]} onSelect={vi.fn()} onBoundsChange={second} initialCamera={camera} categoryLabel="Services" />);
    expect(second).toHaveBeenCalledWith({ west: 18, south: -34, east: 19, north: -33 });
  });
  it("should report the viewport on load even when a target is linked, because the live camera wins", () => {
    const report = vi.fn();
    render(<DiscoveryMap mapApiKey="fixture" place={null} points={[]} onSelect={vi.fn()} onBoundsChange={report} targetBounds={{ west: 1, south: 1, east: 2, north: 2 }} initialCamera={camera} categoryLabel="Services" />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    expect(report).toHaveBeenCalledTimes(1);
    expect(mocks.fitBounds).not.toHaveBeenCalled();
  });
});
describe("category map controls", () => {
  it.each(["Services", "Specials"])("keeps %s results available for the selected bounds when the map is unavailable", categoryLabel => {
    const report = vi.fn(), targetBounds = { west: 18, south: -34, east: 19, north: -33 };
    render(<DiscoveryMap place={null} points={[]} onSelect={vi.fn()} onBoundsChange={report} targetBounds={targetBounds} categoryLabel={categoryLabel} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The map is not configured.");
    expect(report).toHaveBeenCalledWith(targetBounds);
  });
  it("keeps the selected catalogue viewport available after a map startup failure", () => {
    const report = vi.fn(), targetBounds = { west: 20, south: -30, east: 21, north: -29 };
    render(<DiscoveryMap mapApiKey="fixture" place={null} points={[]} onSelect={vi.fn()} onBoundsChange={report} targetBounds={targetBounds} categoryLabel="Services" />);
    fireEvent.click(screen.getByRole("button", { name: "Fail fixture map" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The map could not be loaded.");
    expect(report).toHaveBeenCalledWith(targetBounds);
  });
  it("lets the selected popup choose a viewport-safe anchor and removes the default width constraint", () => { render(<DiscoveryMap mapApiKey="fixture" place={null} points={[point]} selectedId="result" selectedCard={<div>Selected card</div>} onSelect={vi.fn()} categoryLabel="Specials" />); expect(screen.getByTestId("fixture-popup")).not.toHaveAttribute("data-anchor"); expect(screen.getByTestId("fixture-popup")).toHaveAttribute("data-max-width","none"); });
  it("reports initial and settled bounds, with Johannesburg fallback after permission denial", () => {
    const denied = vi.fn((_success, failure) => failure({ code: 1 }));
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: denied } });
    const report = vi.fn();
    render(<DiscoveryMap mapApiKey="fixture" place={null} points={[point]} onSelect={vi.fn()} onBoundsChange={report} categoryLabel="Specials" />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    expect(mocks.initial).toEqual({ latitude: -26.2041, longitude: 28.0473, zoom: 11 });
    expect(denied).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith({west:18,south:-34,east:19,north:-33});
    fireEvent.click(screen.getByRole("button", { name: "Move fixture map" }));
    expect(report).toHaveBeenCalledTimes(2);
    expect(mocks.fitBounds).not.toHaveBeenCalled();
    expect(mocks.easeTo).not.toHaveBeenCalled();
  });
  it("restores shared bounds without geolocation and never refits or recentres on a data refresh", () => {
    const locate = vi.fn();
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: locate } });
    const props = { mapApiKey:"fixture",place:null,onSelect:vi.fn(),categoryLabel:"Services",targetBounds:{west:18,south:-34,east:19,north:-33} };
    const {rerender} = render(<DiscoveryMap {...props} points={[point]} selectedId="result" />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    expect(mocks.fitBounds).toHaveBeenCalledOnce(); expect(mocks.easeTo).toHaveBeenCalledOnce(); expect(locate).not.toHaveBeenCalled();
    rerender(<DiscoveryMap {...props} points={[{...point}, {...point,id:"other"}]} selectedId="result" />);
    expect(mocks.fitBounds).toHaveBeenCalledOnce(); expect(mocks.easeTo).toHaveBeenCalledOnce();
  });
  it("does not let a late geolocation response override a chosen location", () => {
    let finish!: PositionCallback;
    Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:(success:PositionCallback)=>{finish=success;}}});
    const props={mapApiKey:"fixture",place:null,points:[],onSelect:vi.fn(),categoryLabel:"Specials"};
    const {rerender}=render(<DiscoveryMap {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Load fixture map"}));
    rerender(<DiscoveryMap {...props} targetBounds={{west:20,south:-30,east:21,north:-29}}/>);
    act(()=>finish({coords:{latitude:-26,longitude:28}} as GeolocationPosition));
    expect(mocks.fitBounds).toHaveBeenCalledOnce(); expect(mocks.easeTo).not.toHaveBeenCalled();
  });
  it("retains camera, locate, results and selected-result directions actions", () => {
    const opened = vi.spyOn(window, "open").mockReturnValue(null);
    const select = vi.fn();
    render(<DiscoveryMap mapApiKey="fixture" place={null} points={[point]} selectedId="result" onSelect={select} categoryLabel="Services" />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    mocks.fitBounds.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Show all results on map" }));
    expect(mocks.fitBounds).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(mocks.zoomIn).toHaveBeenCalledWith({ duration: 0 });
    expect(mocks.zoomOut).toHaveBeenCalledWith({ duration: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Show Local provider" }));
    expect(select).toHaveBeenCalledWith("result");
    fireEvent.click(screen.getByRole("button", { name: "Directions to selected service" }));
    expect(opened).toHaveBeenCalledWith(expect.stringContaining("-33.9"), "_blank", "noopener,noreferrer");
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: -26, longitude: 28 } } as GeolocationPosition) } });
    fireEvent.click(screen.getByRole("button", { name: "Locate me" }));
    expect(mocks.easeTo).toHaveBeenLastCalledWith({ center: [28, -26], zoom: 15, duration: 0 });
  });
  it.each(["Specials", "Services"])("removes Nearby controls and places requests from %s", async categoryLabel => {
    render(<DiscoveryMap mapApiKey="fixture" place={null} points={[point]} onSelect={vi.fn()} categoryLabel={categoryLabel} />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    fireEvent.click(screen.getByRole("button", { name: "Move fixture map" }));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: /nearby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nearby essentials" })).not.toBeInTheDocument();
    expect(mocks.forward).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Show Local provider" })).toBeInTheDocument();
  });
});
