// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { OffersDiscovery } from "./offers-discovery";
import { ServicesUrlDiscovery } from "../services/services-url-discovery";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/features/discovery/viewport-discovery-screen", () => ({ ViewportDiscoveryScreen: (props: object) => <pre data-testid="viewport">{JSON.stringify(props)}</pre> }));
const props = () => JSON.parse(screen.getByTestId("viewport").textContent!);
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });
it("opens Shopping without requiring an area", () => {
  window.history.replaceState(null, "", "/offers"); render(<OffersDiscovery />);
  expect(props()).toMatchObject({ category: "shopping" });
});
it("reads category changes from the address bar despite empty router state", async () => {
  window.history.replaceState(null, "", "/offers?kind=tourism&bbox=18,-34,19,-33"); render(<OffersDiscovery />);
  expect(props()).toMatchObject({ category: "tourism" });
  await act(async () => { window.history.pushState(null, "", "/offers?kind=event&bbox=18,-34,19,-33"); });
  expect(props()).toMatchObject({ category: "event" });
});
it("opens Services without location onboarding", () => {
  render(<ServicesUrlDiscovery />); expect(props()).toMatchObject({ category: "service" });
});
