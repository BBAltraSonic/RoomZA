// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { ServiceDetailsProvider, ServiceDetailSurface, useServiceDetails } from "./service-details";
import { ServiceDetailContent } from "./service-detail-content";
import { ServiceFeedCard } from "./service-feed-card";
import { DiscoveryShell } from "@/features/discovery/discovery-shell";
import type { PublicService } from "./schema";

const ui = vi.hoisted(() => ({ desktop: true, map: vi.fn() }));
vi.mock("next/dynamic", () => ({ default: () => (props: ComponentProps<typeof ServiceDetailContent>) => <ServiceDetailContent {...props} /> }));
vi.mock("@/lib/motion/primitives", () => ({ BlurImage: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} /> }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const item: PublicService = {
  id, area_id: id, approved_at: "2026-10-11T08:00:00Z",
  content: { title: "Tap repairs", providerName: "Local plumber", serviceType: "Plumbing", description: "Full service description. ".repeat(20).trim(), areaId: id, address: "10 Fixture Road", latitude: -33, longitude: 18, phone: "021 555 0100", publicContact: { whatsapp: "+27215550100", email: "fixture@example.com" }, contactConsent: true },
  media: [{ id, url: "https://example.com/first.jpg" }, { id: otherId, url: "https://example.com/second.jpg" }],
};
function Browse() {
  const details = useServiceDetails();
  return <DiscoveryShell header={<header>Discovery header</header>} resultsLabel="Services results" detailLabel="Service details"
    results={<div data-testid="results"><ServiceFeedCard item={item} onShowOnMap={ui.map} /></div>}
    detail={details?.id ? <ServiceDetailSurface /> : undefined} map={<div data-testid="map">Map</div>} />;
}
function browse() { return render(<ServiceDetailsProvider><Browse /></ServiceDetailsProvider>); }
const content = () => document.querySelector<HTMLElement>('[data-slot="service-detail-content"]')!;
beforeEach(() => {
  ui.desktop = true; ui.map.mockReset(); window.sessionStorage.clear();
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("1024") && ui.desktop, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ item })));
  window.history.replaceState({ preserved: true }, "", "/services?bbox=18,-34,19,-33&q=tap&sort=Nearest&serviceType=Plumbing&view=feed&page=2");
});
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(["title", "photo", "body"] as const)("opens desktop details from the %s and restores focus and discovery state", async source => {
  browse();
  const result = within(screen.getByTestId("results"));
  const button = result.getByRole("button", { name: "View details for Tap repairs" });
  const target = source === "title" ? button : source === "photo" ? result.getAllByRole("img")[0]! : result.getByText("Local plumber");
  if (source === "title") button.focus();
  fireEvent.click(target);
  await waitFor(() => expect(content()).not.toBeNull());
  expect(await within(content()).findByText(item.content.description)).toBeVisible();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("map")).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Service details" })).toBeInTheDocument();
  const params = new URLSearchParams(window.location.search);
  expect(params.get("detailId")).toBe(id);
  expect(params.get("q")).toBe("tap"); expect(params.get("bbox")).toBe("18,-34,19,-33");
  expect(params.get("sort")).toBe("Nearest"); expect(params.get("serviceType")).toBe("Plumbing"); expect(params.get("page")).toBe("2");
  expect(window.history.state).toEqual({ preserved: true });
  fireEvent.click(within(content()).getByRole("button", { name: "Back to services" }));
  await waitFor(() => expect(document.activeElement).toBe(button));
  expect(content()).toBeNull(); expect(window.location.search).not.toContain("detailId");
  expect(screen.getByTestId("results")).toBeInTheDocument();
});

it("opens details with the keyboard and closes the desktop panel with Escape", async () => {
  browse(); const user = userEvent.setup();
  screen.getByRole("button", { name: "View details for Tap repairs" }).focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(content()).not.toBeNull());
  await within(content()).findByText(item.content.description);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(content()).toBeNull());
});

it("keeps contact, description, map actions and photo swipes independent", () => {
  browse(); const results = screen.getByTestId("results"), scoped = within(results);
  scoped.getByRole("link", { name: "Call" }).addEventListener("click", event => event.preventDefault());
  fireEvent.click(scoped.getByRole("link", { name: "Call" }));
  fireEvent.click(scoped.getByRole("button", { name: "Read full description" }));
  fireEvent.click(scoped.getByRole("button", { name: "Show on map" }));
  expect(ui.map).toHaveBeenCalledOnce(); expect(window.location.search).not.toContain("detailId");
  const photo = scoped.getAllByRole("img")[0]!;
  fireEvent.pointerDown(photo, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(photo, { clientX: 30, clientY: 100 });
  fireEvent.click(photo, { detail: 1 });
  expect(window.location.search).not.toContain("detailId");
});

it("opens a mobile sheet and dismisses it with Escape", async () => {
  ui.desktop = false; browse(); fireEvent.click(screen.getByRole("button", { name: "Browse listings" }));
  const button = screen.getByRole("button", { name: "View details for Tap repairs" }); button.focus(); fireEvent.click(button);
  const dialog = await screen.findByRole("group", { name: "Service details" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(dialog.closest('[data-slot="mobile-detail-sheet"]')).toBeInTheDocument();
  expect(screen.getByText("Discovery header")).toBeVisible();
  expect(await within(dialog).findByText(item.content.description)).toBeVisible();
  expect(within(dialog).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining("https://wa.me/27215550100"));
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("group", { name: "Service details" })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "View details for Tap repairs" })).toHaveFocus();
});

it("restores details on reload and Back/Forward without depending on visible results", async () => {
  browse(); fireEvent.click(screen.getByRole("button", { name: "View details for Tap repairs" }));
  await waitFor(() => expect(content()).not.toBeNull());
  await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 50)); });
  await waitFor(() => expect(content()).toBeNull());
  await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 50)); });
  await waitFor(() => expect(content()).not.toBeNull());
  cleanup(); browse(); expect(await within(content()).findByText(item.content.description)).toBeVisible();
  expect(fetch).toHaveBeenCalledWith("/api/services/" + id, expect.objectContaining({ cache: "no-store" }));
});

it("loads a directly linked service even with no result cards", async () => {
  window.history.replaceState(null, "", "/services?detailId=" + id);
  render(<ServiceDetailsProvider><ServiceDetailSurface /></ServiceDetailsProvider>);
  expect(await screen.findByRole("heading", { name: "Tap repairs" })).toBeVisible();
  expect(document.querySelector('[data-card-category="service"]')).toBeNull();
});

it("ignores malformed detail links without starting a request", () => {
  window.history.replaceState(null, "", "/services?detailId=invalid");
  render(<ServiceDetailsProvider><ServiceDetailSurface /></ServiceDetailsProvider>);
  expect(content()).toBeNull(); expect(fetch).not.toHaveBeenCalled();
});

it("shows an unavailable state for an unpublished service and supports retry after failure", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValueOnce(Response.json({ item: null }, { status: 404 }));
  const onClose = vi.fn(); render(<ServiceDetailContent id={id} onClose={onClose} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
  fireEvent.click(screen.getByRole("button", { name: "Retry service details" }));
  expect(await screen.findByText("This service is no longer available.")).toBeVisible();
  expect(screen.queryByRole("link", { name: "Call" })).not.toBeInTheDocument();
});

it("aborts old requests on switching or closing and never displays the previous service", async () => {
  let resolveFirst!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(Response.json({ item: { ...item, id: otherId, content: { ...item.content, title: "Electrical repairs" } } }));
  const onClose = vi.fn(), view = render(<ServiceDetailContent id={id} onClose={onClose} />);
  const signal = vi.mocked(fetch).mock.calls[0]![1]!.signal!;
  view.rerender(<ServiceDetailContent id={otherId} onClose={onClose} />);
  expect(signal.aborted).toBe(true);
  expect(await screen.findByRole("heading", { name: "Electrical repairs" })).toBeVisible();
  await act(async () => resolveFirst(Response.json({ item })));
  expect(screen.queryByRole("heading", { name: "Tap repairs" })).not.toBeInTheDocument();
  const currentSignal = vi.mocked(fetch).mock.calls[1]![1]!.signal!;
  view.unmount(); expect(currentSignal.aborted).toBe(true);
});

it("rejects a response for a different service", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ item: { ...item, id: otherId } }));
  render(<ServiceDetailContent id={id} onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("link", { name: "Call" })).not.toBeInTheDocument();
});

it("keeps media order, supports photo buttons and uses a placeholder without photos", async () => {
  const view = render(<ServiceDetailContent id={id} onClose={vi.fn()} />);
  const photos = await screen.findAllByRole("img");
  expect(photos.map(photo => photo.getAttribute("data-src"))).toEqual(item.media!.map(image => image.url));
  const scroller = photos[0]!.parentElement!.parentElement!;
  Object.defineProperty(scroller, "clientWidth", { value: 300 });
  const scrollTo = vi.fn(); scroller.scrollTo = scrollTo;
  fireEvent.click(screen.getByRole("button", { name: "Next service photo" }));
  expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: "smooth" });
  fireEvent.scroll(scroller, { target: { scrollLeft: 300 } });
  expect(screen.getByText("Photo 2 of 2")).toBeVisible();
  expect(screen.getByRole("button", { name: "Next service photo" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous service photo" }));
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });
  vi.mocked(fetch).mockResolvedValue(Response.json({ item: { ...item, id: otherId, media: [] } }));
  view.rerender(<ServiceDetailContent id={otherId} onClose={vi.fn()} />);
  expect(await screen.findByText("Photos not provided")).toBeVisible(); expect(screen.queryAllByRole("img")).toHaveLength(0);
});
