// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ImageLightbox } from "./image-lightbox";

const images = [
  { id: "one", public_url: "https://images.example.com/one.jpg" },
  { id: "two", public_url: "https://images.example.com/two.jpg" },
];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImageLightbox accessibility", () => {
  it("acts as a labelled modal and supports arrow and Escape keys", () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        images={images}
        isOpen
        onClose={onClose}
        title="Sea Point Studio"
      />,
    );

    expect(screen.getByRole("dialog", { name: /1 \/ 2.*Sea Point Studio/ })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByAltText("Sea Point Studio, image 1 of 2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText("Sea Point Studio, image 2 of 2")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog and restores the opener when closed", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(
      <ImageLightbox images={images} isOpen onClose={() => {}} title="Home gallery" />,
    );
    expect(screen.getByRole("button", { name: "Close image gallery" })).toHaveFocus();

    rerender(
      <ImageLightbox images={images} isOpen={false} onClose={() => {}} title="Home gallery" />,
    );
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
