// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { TrustMarkdown, transformTrustMarkdownUrl } from "./trust-markdown";

afterEach(() => cleanup());

describe("TrustMarkdown", () => {
  it("renders GFM semantics and ignores raw HTML", () => {
    const { container } = render(<TrustMarkdown markdown={'## Viewing checklist\n\n- Check the taps\n- Test the signal\n\n<script>alert("no")</script>'} />);
    expect(screen.getByRole("heading", { name: "Viewing checklist" })).not.toBeNull();
    expect(screen.getByRole("list")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("drops images from other hosts", () => {
    const { container } = render(<TrustMarkdown markdown="![Unsafe](https://example.com/image.jpg)" />);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("transformTrustMarkdownUrl", () => {
  it("allows safe links and same-site images only", () => {
    expect(transformTrustMarkdownUrl("https://example.com/guide", "href")).toBe("https://example.com/guide");
    expect(transformTrustMarkdownUrl("javascript:alert(1)", "href")).toBe("");
    expect(transformTrustMarkdownUrl("/images/safety.webp", "src")).toBe("/images/safety.webp");
    expect(transformTrustMarkdownUrl("//evil.example/x.webp", "src")).toBe("");
    expect(transformTrustMarkdownUrl("https://example.com/untracked.webp", "src")).toBe("");
  });
});
