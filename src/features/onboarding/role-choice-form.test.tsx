// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { RoleChoiceForm } from "./role-choice-form";

vi.mock("@/app/onboarding/actions", () => ({
  chooseRoleAction: vi.fn(),
}));

describe("RoleChoiceForm", () => {
  it("presents both first-value workspaces as accessible submit actions", () => {
    render(<RoleChoiceForm redirectPath="/saved" />);

    expect(screen.getByRole("button", { name: /find a home/i })).toHaveAttribute("value", "renter");
    expect(screen.getByRole("button", { name: /list a property/i })).toHaveAttribute("value", "landlord");
    expect(screen.getByDisplayValue("/saved")).toHaveAttribute("name", "redirect");
  });
});
