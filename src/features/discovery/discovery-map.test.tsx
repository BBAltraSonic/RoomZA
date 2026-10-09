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
    default: forwardRef(function Fixture({ children, onLoad, onMoveEnd, initialViewState }: { children: ReactNode; onLoad: () => void; onMoveEnd: () => void; initialViewState: object }, ref) {
      mocks.initial = initialViewState;
      useImperativeHandle(ref, () => ({ ...mocks, getBounds: () => ({ getWest: () => 18, getSouth: () => -34, getEast: () => 19, getNorth: () => -33 }), getCenter: () => ({ lat: -33.9, lng: 18.4 }), getZoom: () => 13, getMap: () => ({ getContainer: () => ({ clientHeight: 600 }) }) }));
      return <div><button onClick={onLoad}>Load fixture map</button><button onClick={onMoveEnd}>Move fixture map</button>{children}</div>;
    }), Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>, Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});
const point = { id: "result", title: "Local provider", latitude: -33.9, longitude: 18.4 };
const originalGeo = Object.getOwnPropertyDescriptor(navigator, "geolocation");
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); if (originalGeo) Object.defineProperty(navigator,"geolocation",originalGeo); else Reflect.deleteProperty(navigator,"geolocation"); });
describe("category map controls", () => {
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
  it("retains camera, locate, Nearby, results and selected-result directions actions", () => {
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
  it("does not revive nearby results after the panel closes", async () => {
    let finish!: (value: never[]) => void;
    const pending = new Promise<never[]>(resolve => { finish = resolve; });
    mocks.forward.mockReturnValue(pending);
    render(<DiscoveryMap mapApiKey="fixture" place={null} points={[]} onSelect={vi.fn()} categoryLabel="Specials" />);
    fireEvent.click(screen.getByRole("button", { name: "Load fixture map" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore nearby places" }));
    await act(async () => {});
    expect(mocks.forward).toHaveBeenCalledTimes(5);
    expect(screen.getByRole("region", { name: "Nearby essentials" })).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Close nearby places" })[1]!);
    expect(mocks.forward.mock.calls[0]![0].signal.aborted).toBe(true);
    await act(async () => finish([]));
    expect(screen.queryByRole("region", { name: "Nearby essentials" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore nearby places" })).toHaveAttribute("aria-pressed", "false");
  });
});
