// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ProposeViewingModal } from "./propose-viewing-modal";

const mocks = vi.hoisted(() => ({ rental: vi.fn(), buyer: vi.fn(), refresh: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/viewings/actions/propose-viewing-slots", () => ({ proposeViewingSlots: mocks.rental }));
vi.mock("@/features/purchase/actions", () => ({ proposeBuyerViewingSlots: mocks.buyer }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/lib/motion/primitives", () => ({ PendingGlyph: ({ label }: { label: string }) => <span>{label}</span> }));
vi.mock("@/components/ui/calendar", () => ({ Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) => <button onClick={() => onSelect(new Date("2030-01-20T00:00:00"))}>Choose future date</button> }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
beforeEach(() => { vi.clearAllMocks(); mocks.rental.mockResolvedValue({ success: true }); mocks.buyer.mockResolvedValue({ success: true }); });
afterEach(cleanup);
async function addSlot() {
  fireEvent.click(screen.getByRole("button", { name: "Propose viewings" }));
  fireEvent.click(await screen.findByRole("button", { name: "Choose future date" }));
  fireEvent.click(screen.getByRole("button", { name: "Add slot" }));
}

describe("viewing proposal journeys", () => {
  it("sends buyer time slots through the buyer action rather than the application action", async () => {
    render(<ProposeViewingModal listingId="listing" buyerInterestId="interest" expectedUpdatedAt="2030-01-19T12:00:00.000Z" />); await addSlot();
    fireEvent.click(screen.getByRole("button", { name: "Video call" }));
    fireEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.buyer).toHaveBeenCalledWith({ buyerInterestId: "interest", expectedUpdatedAt: "2030-01-19T12:00:00.000Z", mode: "video_call", slots: [expect.objectContaining({ startTime: expect.any(String), endTime: expect.any(String) })] });
    expect(mocks.rental).not.toHaveBeenCalled();
    const slot = mocks.buyer.mock.calls[0]![0].slots[0];
    expect(Date.parse(slot.endTime) - Date.parse(slot.startTime)).toBe(3600000);
  });
  it("keeps the rental application recipients and listing identity", async () => {
    render(<ProposeViewingModal listingId="listing" applicantIds={["app"]} />); await addSlot();
    fireEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    await waitFor(() => expect(mocks.rental).toHaveBeenCalled());
    expect(mocks.rental).toHaveBeenCalledWith(expect.objectContaining({ listingId: "listing", applicationIds: ["app"], mode: "in_person" }));
    expect(mocks.buyer).not.toHaveBeenCalled();
  });
  it("returns the confirmed buyer revision and viewing date to the editing card", async () => {
    const data={updatedAt:"2030-01-19T12:00:00.000Z",viewingDate:"2030-01-20T12:00:00.000Z"};
    mocks.buyer.mockResolvedValueOnce({success:true,data});const onBuyerProposed=vi.fn();
    render(<ProposeViewingModal listingId="listing" buyerInterestId="interest" expectedUpdatedAt="2030-01-19T12:00:00.000Z" onBuyerProposed={onBuyerProposed} />);await addSlot();
    fireEvent.click(screen.getByRole("button",{name:"Send proposal"}));
    await waitFor(()=>expect(onBuyerProposed).toHaveBeenCalledWith(data));
  });
  it("keeps chosen slots and releases pending state after a network failure", async () => {
    mocks.buyer.mockRejectedValueOnce(new Error("network"));
    render(<ProposeViewingModal listingId="listing" buyerInterestId="interest" expectedUpdatedAt="2030-01-19T12:00:00.000Z" />); await addSlot();
    fireEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Check your viewings")));
    expect(screen.getByRole("button", { name: "Send proposal" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Remove slot" })).toBeVisible();
  });
  it("rejects an empty time without throwing or adding an invalid slot", async () => {
    render(<ProposeViewingModal listingId="listing" buyerInterestId="interest" expectedUpdatedAt="2030-01-19T12:00:00.000Z" />);
    fireEvent.click(screen.getByRole("button", { name: "Propose viewings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Choose future date" }));
    fireEvent.change(screen.getByLabelText("Viewing start time"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Add slot" }));
    expect(mocks.error).toHaveBeenCalledWith("Choose a valid viewing time.");
    expect(screen.getByRole("button", { name: "Send proposal" })).toBeDisabled();
  });

  it("locks proposal edits while sending so successful submission cannot erase new input", async () => {
    let resolve!: (value: { success: boolean }) => void;
    mocks.buyer.mockReturnValue(new Promise(res => { resolve = res; }));
    render(<ProposeViewingModal listingId="listing" buyerInterestId="interest" expectedUpdatedAt="2030-01-19T12:00:00.000Z" />); await addSlot();
    fireEvent.click(screen.getByRole("button", { name: "Send proposal" }));
    expect(screen.getByRole("button", { name: "Video call" })).toBeDisabled();
    expect(screen.getByLabelText("Viewing start time")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove slot" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sending viewing proposal" }));
    expect(mocks.buyer).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ success: true }));
  });

  it("reuses the rental attempt after an uncertain response", async () => {
    mocks.rental.mockRejectedValueOnce(new Error("lost response"));
    render(<ProposeViewingModal listingId="listing" applicantIds={["app"]} />);await addSlot();
    fireEvent.click(screen.getByRole("button",{name:"Send proposal"}));await waitFor(()=>expect(mocks.error).toHaveBeenCalled());
    const first=mocks.rental.mock.calls[0]![0];expect(first.proposalId).toMatch(/^[0-9a-f-]{36}$/);
    fireEvent.click(screen.getByRole("button",{name:"Send proposal"}));await waitFor(()=>expect(mocks.rental).toHaveBeenCalledTimes(2));
    expect(mocks.rental.mock.calls[1]![0]).toEqual(first);
  });

  it("uses a different rental attempt when the user changes the proposed mode", async () => {
    mocks.rental.mockRejectedValueOnce(new Error("lost response"));
    render(<ProposeViewingModal listingId="listing" applicantIds={["app"]} />);await addSlot();
    fireEvent.click(screen.getByRole("button",{name:"Send proposal"}));await waitFor(()=>expect(mocks.error).toHaveBeenCalled());
    const first=mocks.rental.mock.calls[0]![0];fireEvent.click(screen.getByRole("button",{name:"Video call"}));
    fireEvent.click(screen.getByRole("button",{name:"Send proposal"}));await waitFor(()=>expect(mocks.rental).toHaveBeenCalledTimes(2));
    expect(mocks.rental.mock.calls[1]![0].proposalId).not.toBe(first.proposalId);expect(mocks.rental.mock.calls[1]![0].mode).toBe("video_call");
  });
});
