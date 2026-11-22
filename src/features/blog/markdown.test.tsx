// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { BlogMarkdown } from "./markdown";

afterEach(() => cleanup());

describe("BlogMarkdown", () => {
  it("renders GFM semantics and ignores raw HTML", () => {
    const { container } = render(<BlogMarkdown markdown={'## Viewing checklist\n\n- Check the taps\n- Test the signal\n\n<script>alert("no")</script>'} />);
    expect(screen.getByRole("heading", { name: "Viewing checklist" })).not.toBeNull();
    expect(screen.getByRole("list")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("drops unsafe image sources", () => {
    const { container } = render(<BlogMarkdown markdown="![Unsafe](https://example.com/image.jpg)" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
