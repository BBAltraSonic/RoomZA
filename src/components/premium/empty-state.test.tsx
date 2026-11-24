// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { Heart } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { EmptyState as RouteEmptyState } from "@/components/ui/route-state";

import { EmptyState } from "./primitives";

afterEach(cleanup);

describe("EmptyState with Piko", () => {
  it("should_show_piko_for_the_mood_instead_of_the_icon", () => {
    const { container } = render(<EmptyState mood="empty" icon={Heart} title="Save your first home" description="Tap Save on a home." />);
    expect(container.querySelector('[data-piko-mood="empty"] img')).toHaveAttribute("src", "/piko/pose/piko-lie-chin.webp");
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByRole("heading", { name: "Save your first home" })).toBeInTheDocument();
  });

  it("should_keep_the_icon_when_no_mood_is_given", () => {
    const { container } = render(<EmptyState icon={Heart} title="Unable to load" description="Try again later." />);
    expect(container.querySelector("[data-piko-mood]")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("should_show_piko_on_route_empty_states_too", () => {
    const { container } = render(<RouteEmptyState mood="noResults" title="Page not found" description="Gone." action={null} />);
    expect(container.querySelector('[data-piko-mood="noResults"] img')).toHaveAttribute("src", "/piko/pose/piko-back.webp");
  });
});
