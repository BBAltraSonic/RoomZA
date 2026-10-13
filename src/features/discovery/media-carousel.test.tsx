// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaCarousel } from "./media-carousel";

const media = Array.from({ length: 3 }, (_, index) => ({ id: String(index), url: "https://example.com/photo-" + index + ".jpg" }));
beforeEach(() => { Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: vi.fn(), configurable: true, writable: true }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Special detail photo carousel", () => {
  it("starts on the cover, has bounded buttons and contains complete posters", () => {
    render(<MediaCarousel media={media} title="Poster" />);
    expect(screen.getByRole("img", { name: "Poster, photo 1" })).toHaveClass("object-contain");
    expect(screen.getByText("1 / 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous photo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("img", { name: "Poster, photo 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByText("3 / 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next photo" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(screen.getByText("2 / 3")).toBeVisible();
  });
  it("supports keyboard navigation without looping", () => {
    render(<MediaCarousel media={media} title="Poster" />);
    const track = screen.getByLabelText("Photos, use left and right arrow keys to browse");
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeVisible();
    fireEvent.keyDown(track, { key: "End" }); fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeVisible();
    fireEvent.keyDown(track, { key: "Home" }); fireEvent.keyDown(track, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeVisible();
    expect(HTMLElement.prototype.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "instant" });
  });
  it("tracks native horizontal swiping and supplies snap points without vertical gesture interception", () => {
    render(<MediaCarousel media={media} title="Poster" />);
    const track = screen.getByLabelText("Photos, use left and right arrow keys to browse");
    Object.defineProperty(track, "clientWidth", { value: 300 });
    track.scrollLeft = 600; fireEvent.scroll(track);
    expect(screen.getByText("3 / 3")).toBeVisible();
    expect(track).toHaveClass("overflow-x-auto", "snap-x", "snap-mandatory");
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(HTMLElement.prototype.scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: "instant" });
  });
  it("resets for a changed gallery but preserves position on signed URL refresh", () => {
    const view = render(<MediaCarousel media={media} title="Poster" />);
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    view.rerender(<MediaCarousel media={media.map(photo => ({ ...photo, url: photo.url + "?new-signature" }))} title="Poster" />);
    expect(screen.getByText("2 / 3")).toBeVisible();
    view.rerender(<MediaCarousel media={media.map(photo => ({ ...photo, id: "other-" + photo.id }))} title="Other Special" />);
    expect(screen.getByText("1 / 3")).toBeVisible();
  });
  it("shows a stable placeholder for legacy posts and hides single-photo navigation", () => {
    const view = render(<MediaCarousel title="Legacy Special" />);
    expect(screen.getByText("Photo unavailable")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    view.rerender(<MediaCarousel media={[media[0]!]} title="Single photo" />);
    expect(screen.getByRole("img", { name: "Single photo, photo 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("retains navigation when an image fails and shows the next image normally", () => {
    render(<MediaCarousel media={media} title="Poster" />);
    fireEvent.error(screen.getByRole("img", { name: "Poster, photo 1" }));
    expect(screen.getByText("Photo unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("img", { name: "Poster, photo 2" })).toBeInTheDocument();
  });
});
