// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("./workspace-request", () => ({ requestOfferWorkspace: mocks.request }));
import { PosterControls } from "./poster-controls";
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
describe("explicit poster enrollment", () => {
  it("enrolls without identity and refreshes the owned workspace", async () => {
    mocks.request.mockResolvedValue({ ok: true, data: {} });
    render(<PosterControls enrollment="required" />);
    fireEvent.click(screen.getByRole("button", { name: "Become an offer poster" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.request).toHaveBeenCalledWith({}, true);
  });
  it("does not offer re-enrollment after revocation", () => {
    render(<PosterControls enrollment="revoked" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Re-enrollment cannot restore it");
  });
  it("retains a create ID through an uncertain response so retry cannot create a second draft", async () => {
    mocks.request.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({ ok: false, status: 409, message: "Conflict" });
    render(<PosterControls enrollment="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Create private draft" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Create private draft" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    expect(mocks.request.mock.calls[0]?.[0].offerId).toBe(mocks.request.mock.calls[1]?.[0].offerId);
  });
});
