// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoveryMapSlot } from "./discovery-stage";
import { DiscoveryWorkspace } from "./discovery-workspace";
import { useWorkspaceNavigation } from "./workspace-navigation";
import { verticalHref, type DiscoveryVertical } from "./verticals";

const mocks = vi.hoisted(() => ({ pathname: "/", mapMounts: 0, routerPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerPush }),
}));

vi.mock("next/dynamic", () => ({
  default: () => function StageMapFixture({ layer }: { layer: { kind: string; props: { label: string } } }) {
    useEffect(() => { mocks.mapMounts += 1; }, []);
    return <div data-testid="stage-map" data-kind={layer.kind}>{layer.props.label}</div>;
  },
}));

function Environment({ name, go }: { name: string; go: { label: string; href: string; vertical: DiscoveryVertical } }) {
  const navigation = useWorkspaceNavigation();
  const [count, setCount] = useState(0);
  const layer = { kind: name === "Property" ? "property" : "points", props: { label: name } } as never;
  return (
    <section aria-label={name}>
      <button onClick={() => setCount(value => value + 1)}>Count {name}: {count}</button>
      <button onClick={() => navigation!.go(go.href, go.vertical)}>{go.label}</button>
      <DiscoveryMapSlot layer={layer} fallback={<p>Map outside workspace</p>} />
    </section>
  );
}

vi.mock("@/features/map-discovery/property-discovery", () => ({
  PropertyDiscovery: () => <Environment name="Property" go={{ label: "To services", href: "/services?view=map", vertical: "service" }} />,
}));
vi.mock("./viewport-discovery-screen", () => ({
  ViewportDiscoveryScreen: ({ category }: { category: string }) => <Environment name={category} go={{ label: "To property", href: "/", vertical: "property" }} />,
}));

afterEach(() => {
  cleanup();
  mocks.mapMounts = 0;
  mocks.routerPush.mockClear();
  window.history.replaceState(null, "", "/");
});

describe("discovery workspace", () => {
  it("should render the environment for the current route", async () => {
    window.history.replaceState(null, "", "/offers?kind=event");
    mocks.pathname = "/offers";
    render(<DiscoveryWorkspace />);
    expect(await screen.findByRole("region", { name: "event" })).toBeInTheDocument();
    mocks.pathname = "/";
  });

  it("should show the map environment straight away when a specials link opens first", async () => {
    window.history.replaceState(null, "", "/services");
    mocks.pathname = "/services";
    render(<DiscoveryWorkspace />);
    expect(await screen.findByRole("region", { name: "service" })).toBeVisible();
    mocks.pathname = "/";
  });

  it("should change environment instantly without asking the router", async () => {
    render(<DiscoveryWorkspace />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    expect(window.location.pathname).toBe("/services");
    expect(await screen.findByRole("region", { name: "service" })).toBeVisible();
    expect(mocks.routerPush).not.toHaveBeenCalled();
  });

  it("should update the document title for the new environment", async () => {
    render(<DiscoveryWorkspace />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    expect(document.title).toBe("Nearby Services | Pinpoint");
  });

  it("should keep one map while the environment changes", async () => {
    render(<DiscoveryWorkspace />);
    expect(screen.getByTestId("stage-map")).toHaveTextContent("Property");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    expect(await screen.findByText("service")).toBeInTheDocument();
    expect(screen.getByTestId("stage-map")).toHaveAttribute("data-kind", "points");
    expect(mocks.mapMounts).toBe(1);
  });

  it("should move the map into the visible environment", async () => {
    render(<DiscoveryWorkspace />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    expect(await screen.findByRole("region", { name: "service" })).toContainElement(screen.getByTestId("stage-map"));
  });

  it("should keep an environment's state when returning to it", async () => {
    render(<DiscoveryWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Count Property: 0" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    fireEvent.click(await screen.findByRole("button", { name: "To property" }));
    expect(await screen.findByRole("button", { name: "Count Property: 1" })).toBeVisible();
  });

  it("should hide the environment that was left", async () => {
    render(<DiscoveryWorkspace />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    expect(screen.queryByRole("region", { name: "Property" })).not.toBeInTheDocument();
  });

  it("should follow the browser back button", async () => {
    render(<DiscoveryWorkspace />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "To services" })); });
    await act(async () => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByRole("region", { name: "Property" })).toBeVisible();
  });

  it("should restore property filters on the way back", () => {
    expect(verticalHref("property", "?areaId=a1", "mode=buy")).toBe("/?mode=buy&areaId=a1");
  });
});

describe("map slot outside the workspace", () => {
  it("should render its own map", () => {
    render(<DiscoveryMapSlot layer={{ kind: "points", props: {} } as never} fallback={<p>Standalone map</p>} />);
    expect(screen.getByText("Standalone map")).toBeInTheDocument();
  });
});
