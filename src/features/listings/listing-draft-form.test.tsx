// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { LISTING_HANDOFF_KEY, saveListingHandoff } from "@/features/assistant/business/listing-handoff";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));
vi.mock("./actions", () => ({ createListingDraft: vi.fn(), addAssistantWritingToDraft: vi.fn() }));
vi.mock("./location-picker-loader", () => ({ LocationPickerLoader: () => null }));

import { ListingDraftForm } from "./listing-draft-form";

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("ListingDraftForm with an assistant suggestion", () => {
  it("should_open_empty_without_a_suggestion", () => {
    render(<ListingDraftForm />);
    expect(screen.getByLabelText("Listing headline")).toHaveValue("");
    expect(screen.queryByText(/Filled in from the assistant/)).not.toBeInTheDocument();
  });

  it("should_fill_in_the_suggestion_and_say_what_will_be_added", () => {
    saveListingHandoff({ title: "2-bedroom apartment in Bellville", description: "A bright flat.", propertyType: "apartment", listingType: "sale", price: 1_250_000, features: ["wifi", "balcony"] });
    render(<ListingDraftForm />);
    expect(screen.getByLabelText("Listing headline")).toHaveValue("2-bedroom apartment in Bellville");
    expect(screen.getByRole("button", { name: "For sale" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Purchase price (ZAR)")).toHaveValue(1_250_000);
    expect(screen.getByRole("status")).toHaveTextContent("the suggested description and 2 features will be added to it");
  });

  it("should_start_blank_and_forget_the_suggestion_when_asked", () => {
    saveListingHandoff({ title: "2-bedroom apartment in Bellville", description: "", propertyType: null, listingType: "rent", price: null, features: [] });
    render(<ListingDraftForm />);
    fireEvent.click(screen.getByRole("button", { name: "Start blank" }));
    expect(screen.getByLabelText("Listing headline")).toHaveValue("");
    expect(window.sessionStorage.getItem(LISTING_HANDOFF_KEY)).toBeNull();
  });
});
