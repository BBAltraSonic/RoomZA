// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import {
  DiscoveryExploreSections,
  RentalBlogsSection,
  RentalGuidesSection,
} from "./explore-sections";

afterEach(() => cleanup());

describe("DiscoveryExploreSections", () => {
  it("keeps the shared responsive feed sections together", () => {
    const { container } = render(<DiscoveryExploreSections />);

    expect(screen.getByRole("heading", { name: "Lifestyle" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Rental tips" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Browse the blog" })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("heading", { name: "Collections" })).not.toBeNull();

    const lifestyleHeading = screen.getByRole("heading", { name: "Lifestyle" });
    const lifestyleCards = container.querySelectorAll("section[aria-labelledby] > ul > li");
    expect(lifestyleHeading).toHaveClass("sr-only");
    expect(lifestyleCards).toHaveLength(3);
    for (const card of lifestyleCards) {
      expect(card).toHaveClass("w-[calc((100%_-_1rem)/3)]", "min-w-0");
    }
  });
});

describe("RentalGuidesSection", () => {
  it("progressively reveals one guide checklist at a time", () => {
    render(<RentalGuidesSection />);

    const viewingGuide = screen.getByRole("button", { name: /before you view/i });
    const applicationGuide = screen.getByRole("button", { name: /get application-ready/i });

    expect(viewingGuide.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(viewingGuide);
    expect(viewingGuide.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Confirm the monthly rent and move-in costs.")).not.toBeNull();

    fireEvent.click(applicationGuide);
    expect(viewingGuide.getAttribute("aria-expanded")).toBe("false");
    expect(applicationGuide.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByText("Confirm the monthly rent and move-in costs.")).toBeNull();
  });
});

describe("RentalBlogsSection", () => {
  it("links real blog content rather than rendering placeholders", () => {
    render(<RentalBlogsSection blogs={[
      { id: "one", slug: "what-to-check", title: "What to check before you view", excerpt: "Compare homes with a practical viewing checklist.", category: "Viewing" },
      { id: "two", slug: "documents-to-prepare", title: "Documents to prepare", excerpt: "Keep your application moving.", category: "Applying" },
    ]} />);

    expect(screen.getByRole("heading", { name: "Rental tips" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Read What to check before you view" })).toHaveAttribute("href", "/blog/what-to-check");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/blog");
    expect(screen.getByText("Documents to prepare")).not.toBeNull();
    expect(screen.queryByText("Open houses")).toBeNull();
  });

  it("keeps the blog destination visible when no posts are published", () => {
    render(<RentalBlogsSection blogs={[]} />);

    expect(screen.getByRole("heading", { name: "Rental tips" })).not.toBeNull();
    expect(screen.getByText("Fresh reads are on the way")).not.toBeNull();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: "Browse the blog" })).toHaveAttribute("href", "/blog");
  });
});
