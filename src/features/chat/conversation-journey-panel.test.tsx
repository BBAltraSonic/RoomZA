// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./conversation-instant-connect-actions", () => ({
  ConversationInstantConnectActions: () => <div>Landlord Instant Connect actions</div>,
}));
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ConversationJourneyPanel } from "./conversation-journey-panel";

const baseProps = {
  journey: null,
  conversationId: "conversation-1",
  applicationId: "application-1",
  listingId: "listing-1",
  listingTitle: "A calm home",
};

describe("ConversationJourneyPanel Instant Connect actions", () => {
  afterEach(() => { cleanup(); refresh.mockClear(); });

  it("shows actions in the landlord desktop and mobile journey surfaces", () => {
    render(<ConversationJourneyPanel {...baseProps} isLandlord />);

    expect(screen.getAllByText("Landlord Instant Connect actions")).toHaveLength(2);
  });

  it("does not show landlord actions to renters", () => {
    render(<ConversationJourneyPanel {...baseProps} isLandlord={false} />);

    expect(screen.queryByText("Landlord Instant Connect actions")).toBeNull();
  });

  it("describes an inquiry as awaiting an application for its owner", () => {
    render(<ConversationJourneyPanel {...baseProps} applicationId={null} isLandlord />);
    expect(screen.queryByText("Application received")).toBeNull();
    expect(screen.getAllByText("Awaiting application").length).toBeGreaterThan(0);
  });

  it("does not invent progress when a linked application could not be loaded", () => {
    render(<ConversationJourneyPanel {...baseProps} isLandlord />);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryAllByText("20%")).toHaveLength(0);
    expect(screen.getAllByText("Application progress unavailable").length).toBeGreaterThan(0);
    const reload = screen.getAllByRole("button", { name: "Reload progress" })[0]!;
    fireEvent.click(reload);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Application progress unavailable").length).toBeGreaterThan(0);
  });

  it("keeps the renter's next step when no application is attached", () => {
    render(<ConversationJourneyPanel {...baseProps} applicationId={null} isLandlord={false} />);
    expect(screen.getAllByText("Apply for this home").length).toBeGreaterThan(0);
    expect(screen.queryByText("Application progress unavailable")).toBeNull();
  });
});
