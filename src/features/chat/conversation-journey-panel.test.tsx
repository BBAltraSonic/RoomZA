// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./conversation-instant-connect-actions", () => ({
  ConversationInstantConnectActions: () => <div>Landlord Instant Connect actions</div>,
}));

import { ConversationJourneyPanel } from "./conversation-journey-panel";

const baseProps = {
  journey: null,
  conversationId: "conversation-1",
  applicationId: "application-1",
  listingId: "listing-1",
  listingTitle: "A calm home",
};

describe("ConversationJourneyPanel Instant Connect actions", () => {
  afterEach(cleanup);

  it("shows actions in the landlord desktop and mobile journey surfaces", () => {
    render(<ConversationJourneyPanel {...baseProps} isLandlord />);

    expect(screen.getAllByText("Landlord Instant Connect actions")).toHaveLength(2);
  });

  it("does not show landlord actions to renters", () => {
    render(<ConversationJourneyPanel {...baseProps} isLandlord={false} />);

    expect(screen.queryByText("Landlord Instant Connect actions")).toBeNull();
  });
});
