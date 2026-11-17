// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { ListingDepositNote } from "./listing-deposit-note";

afterEach(cleanup);

describe("ListingDepositNote", () => {
  it("should tell an owner with bank details that renters can pay the deposit online", () => {
    render(<ListingDepositNote payoutAccount="ready" />);
    expect(screen.getByText(/Approved renters can pay this deposit through RoomZA/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("should ask an owner without bank details to add them", () => {
    render(<ListingDepositNote payoutAccount="missing" />);
    expect(screen.getByRole("link", { name: "Add bank details" })).toHaveAttribute("href", "/settings/payouts");
  });

  it("should tell someone managing another owner's listing that the owner adds the bank details", () => {
    render(<ListingDepositNote payoutAccount="other_owner" />);
    expect(screen.getByText(/listing owner adds bank details/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("should explain the option when readiness is unknown", () => {
    render(<ListingDepositNote />);
    expect(screen.getByRole("link", { name: "Set up payouts" })).toHaveAttribute("href", "/settings/payouts");
  });
});
