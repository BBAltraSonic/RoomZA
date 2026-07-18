// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => false };
});

import { LandlordTrustSignals } from "./landlord-trust-signals";

afterEach(cleanup);

describe("LandlordTrustSignals", () => {
  const summary = {
    medianFirstResponseSeconds: 18 * 60,
    phoneVerified: true,
    emailVerified: true,
  };

  it("renders the three prioritized compact chips", () => {
    render(<LandlordTrustSignals summary={summary} compact />);
    expect(screen.getByRole("button", { name: /Responds in 18 mins/i })).toHaveTextContent("18 min response");
    expect(screen.getByRole("button", { name: /Verified Phone/i })).toHaveTextContent("Phone");
    expect(screen.getByRole("button", { name: /Verified Email/i })).toHaveTextContent("Email");
  });

  it("opens explanatory content on press", async () => {
    render(<LandlordTrustSignals summary={summary} />);
    fireEvent.click(screen.getByRole("button", { name: /Verified Phone/i }));
    expect(await screen.findByText(/one-time code/i)).toBeVisible();
  });

  it("does not activate an enclosing property card", () => {
    const onCardClick = vi.fn();
    render(<div onClick={onCardClick}><LandlordTrustSignals summary={summary} compact /></div>);
    fireEvent.click(screen.getByRole("button", { name: /Verified Email/i }));
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("shows the profile-only empty state", () => {
    const empty = { medianFirstResponseSeconds: null, phoneVerified: false, emailVerified: false };
    const { rerender } = render(<LandlordTrustSignals summary={empty} />);
    expect(screen.queryByText(/No published trust signals/i)).not.toBeInTheDocument();
    rerender(<LandlordTrustSignals summary={empty} showEmpty />);
    expect(screen.getByText("No published trust signals yet")).toBeVisible();
  });
});
