// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelectViewingSlot } from "./select-viewing-slot";

const mocks = vi.hoisted(() => ({ rental: vi.fn(), buyer: vi.fn(), refresh: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/features/viewings/actions/book-viewing-slot", () => ({ bookViewingSlot: mocks.rental }));
vi.mock("@/features/purchase/actions", () => ({ bookBuyerViewingSlot: mocks.buyer }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/lib/motion/primitives", () => ({ PendingGlyph: ({ label }: { label: string }) => <span>{label}</span>, SuccessFeedback: ({ title, description }: { title: string; description: string }) => <div>{title}{description}</div> }));
beforeEach(() => { vi.clearAllMocks(); mocks.rental.mockResolvedValue({ success: true, data: "viewing" }); mocks.buyer.mockResolvedValue({ success: true, data: "buyer-viewing" }); });
afterEach(cleanup);
const slot = { id: "slot", start_time: "2027-01-20T10:00:00Z", end_time: "2027-01-20T11:00:00Z", mode: "in_person" as const };
function choose() { fireEvent.click(screen.getByRole("button", { name: /Jan 20/ })); fireEvent.click(screen.getByRole("button", { name: "Confirm booking" })); }

describe("viewing booking journeys", () => {
  it("books a rental without offering a video room for an in-person appointment", async () => {
    render(<SelectViewingSlot applicationId="application" slots={[slot]} />); choose();
    await screen.findByText(/Viewing confirmed/);
    expect(mocks.rental).toHaveBeenCalledWith({ applicationId: "application", slotId: "slot" });
    expect(screen.queryByRole("link", { name: "Open viewing" })).not.toBeInTheDocument();
    expect(screen.getByText(/Meet at the property/)).toBeVisible();
  });
  it("books a buyer appointment through the buyer action and opens its video route", async () => {
    render(<SelectViewingSlot buyerInterestId="interest" slots={[{ ...slot, mode: "video_call" }]} />); choose();
    expect(await screen.findByRole("link", { name: "Open viewing" })).toHaveAttribute("href", "/viewings/buyer-viewing/live");
    expect(mocks.buyer).toHaveBeenCalledWith({ buyerInterestId: "interest", slotId: "slot" });
    expect(mocks.rental).not.toHaveBeenCalled();
  });
  it("releases pending state after a lost response and lets the user check before retrying", async () => {
    mocks.rental.mockRejectedValueOnce(new Error("network"));
    render(<SelectViewingSlot applicationId="application" slots={[slot]} />); choose();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Refresh to check")));
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeEnabled();
    expect(screen.queryByText(/Viewing confirmed/)).not.toBeInTheDocument();
  });
  it("requires selecting a slot again after an atomic booking conflict", async () => {
    mocks.rental.mockResolvedValue({ success: false, error: "Already booked" });
    render(<SelectViewingSlot applicationId="application" slots={[slot]} />); choose();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Already booked"));
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
  });
});
