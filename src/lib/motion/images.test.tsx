// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImgHTMLAttributes } from "react";
import { AnimatedNumber, BlurImage } from "./primitives";
// Native image mock exposes browser load/error events for lifecycle regression coverage.
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img alt="" {...props} /> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("image lifecycle and accurate counts", () => {
  it("resets loaded state for a new source and recovers from a broken earlier image", () => {
    const { rerender, container } = render(<BlurImage src="/first.jpg" alt="Home" loadingTestId="loading" />);
    fireEvent.load(screen.getByRole("img")); expect(container.querySelector('[data-image-loaded="true"]')).toBeTruthy();
    rerender(<BlurImage src="/second.jpg" alt="Home" loadingTestId="loading" />);
    expect(container.querySelector('[data-image-loaded="false"]')).toBeTruthy(); expect(screen.getByTestId("loading")).toBeTruthy();
    fireEvent.error(screen.getByRole("img")); expect(screen.getByText("Image unavailable")).toBeTruthy();
    rerender(<BlurImage src="/third.jpg" alt="Home" loadingTestId="loading" />);
    expect(screen.queryByText("Image unavailable")).toBeNull(); fireEvent.load(screen.getByRole("img")); expect(screen.queryByTestId("loading")).toBeNull();
  });
  it("recognizes cached images even when no load event is delivered", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLImageElement.prototype, "currentSrc", "get").mockReturnValue("/cached.jpg");
    render(<BlurImage src="/cached.jpg" alt="Home" loadingTestId="loading" />);
    expect(screen.queryByTestId("loading")).toBeNull();
  });
  it("settles a cached broken image into its fallback", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    vi.spyOn(HTMLImageElement.prototype, "currentSrc", "get").mockReturnValue("/broken.jpg");
    render(<BlurImage src="/broken.jpg" alt="Home" loadingTestId="loading" />);
    expect(screen.getByText("Image unavailable")).toBeTruthy(); expect(screen.queryByTestId("loading")).toBeNull();
  });
  it("shows the current count immediately on first render and on updates", () => {
    const { rerender, container } = render(<AnimatedNumber value={1234} />); expect(container.textContent).toBe((1234).toLocaleString("en-ZA"));
    act(() => rerender(<AnimatedNumber value={42} />)); expect(screen.getByText("42")).toBeTruthy();
  });
});
