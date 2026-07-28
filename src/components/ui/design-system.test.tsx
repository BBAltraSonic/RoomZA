// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";

afterEach(cleanup);

describe("shared design-system primitives", () => {
  it.each([
    ["default", "bg-forest", "shadow-[var(--shadow-control)]"],
    ["outline", "bg-panel", "border-border"],
    ["secondary", "bg-accent", "text-forest"],
    ["ghost", "bg-transparent", "shadow-none"],
    ["destructive", "bg-destructive", "border-destructive"],
  ] as const)("renders the %s button vocabulary", (variant, surfaceClass, detailClass) => {
    render(<Button variant={variant}>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveClass(
      surfaceClass,
      detailClass,
    );
  });

  it("provides default and featured card geometry", () => {
    const { rerender } = render(<Card>Default card</Card>);
    expect(screen.getByText("Default card")).toHaveClass(
      "rounded-lg",
      "shadow-[var(--shadow-card)]",
    );

    rerender(<Card variant="feature">Feature card</Card>);
    expect(screen.getByText("Feature card")).toHaveClass(
      "rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)]",
      "shadow-[var(--shadow-card)]",
    );
  });

  it("renders fields with the shared panel, border, and control elevation", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveClass(
      "bg-panel",
      "border-input",
      "shadow-[var(--shadow-control)]",
    );
  });
});
