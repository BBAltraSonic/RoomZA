// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualCopyPopover } from "./manual-copy-popover";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ManualCopyPopover", () => {
  it("focuses and selects the read-only URL", () => {
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    render(<ManualCopyPopover url="https://roomza.example/listing/123" onClose={vi.fn()} />);

    const input = screen.getByRole("textbox", { name: "Listing link" });
    expect(input.hasAttribute("readonly")).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(select).toHaveBeenCalled();
  });

  it("closes with Escape", () => {
    const onClose = vi.fn();
    render(<ManualCopyPopover url="https://roomza.example/listing/123" onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on an outside pointer press but stays open for inside interaction", () => {
    const onClose = vi.fn();
    render(<ManualCopyPopover url="https://roomza.example/listing/123" onClose={onClose} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Select" }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
