// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PublicOfferDetailScreen } from "./public-detail-screen";
import type { PublicOfferDetail } from "./public-contract";

vi.mock("@/features/discovery/saved-specials-client", () => ({ SavedSpecialsProvider: ({ children }: { children: React.ReactNode }) => children, useSavedSpecial: () => ({ saved: false, pending: false, count: 0, toggle: vi.fn() }) }));

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = "2026-10-02T10:00:00Z";
const live: PublicOfferDetail = { status: "live", offerId: id, revisionId: id, areaId: id, confirmedAt: now, serverNow: now, startsAt: now, endsAt: "2026-10-02T10:00:02Z", content: { publicContact: { whatsapp: "+27215550100" }, contactConsent: true, title: "Confirmed title", benefit: "Benefit", terms: "Reviewed terms", shopName: "Shop", address: "Shop address", areaId: id, latitude: -33.97, longitude: 18.48, startsAt: now, endsAt: "2026-10-02T10:00:02Z" }, place: { id, name: "Place", region: "ZA", fullAddress: "Place address" }, poster: null };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("customer offer availability", () => {
  it("does not call a long-valid offer expired when the browser timer limit only wakes a refresh", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const long = { ...live, endsAt: "2026-11-02T10:00:00Z", content: { ...live.content, endsAt: "2026-11-02T10:00:00Z" } };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(long))).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicOfferDetailScreen offerId={id} initial={long} />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Get directions" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_147_483_647); });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Confirmed title");
    expect(screen.queryByText("This offer has ended")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get directions" })).toBeDisabled();
  });
  it("keeps directions disabled until fresh read and expires using DB/monotonic time despite a wrong device date", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2099-01-01T00:00:00Z"));
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; })).mockResolvedValue(new Response(JSON.stringify({ ...live, status: "expired", content: null, place: null, poster: null }), { status: 410 }));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicOfferDetailScreen offerId={id} initial={live} />);
    expect(screen.getByRole("button", { name: "Get directions" })).toBeDisabled();
    await act(async () => { resolve(new Response(JSON.stringify(live))); });
    expect(screen.getByRole("button", { name: "Get directions" })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(2001); });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This offer has ended");
    expect(screen.queryByText("Reviewed terms")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get directions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
  });
  it("hides stale public content on read failure and supports explicit retry", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ status: "unavailable", serverNow: now }), { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicOfferDetailScreen offerId={id} initial={live} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not check");
    expect(screen.queryByText("Reviewed terms")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByRole("heading", { name: "This offer is unavailable" })).toBeVisible();
  });
  it("rechecks a restored page and ignores a superseded request", async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; })).mockResolvedValueOnce(new Response(JSON.stringify({ status: "unavailable", serverNow: now }), { status: 404 }));
    vi.stubGlobal("fetch", fetcher);
    render(<PublicOfferDetailScreen offerId={id} initial={live} />);
    await act(async () => { window.dispatchEvent(new Event("pageshow")); });
    expect(screen.getByRole("heading", { name: "This offer is unavailable" })).toBeVisible();
    await act(async () => { resolve(new Response(JSON.stringify(live))); });
    expect(screen.queryByText("Reviewed terms")).not.toBeInTheDocument();
  });
});
