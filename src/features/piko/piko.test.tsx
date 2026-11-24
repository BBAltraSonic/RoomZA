// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { Piko, PikoFace } from "./piko";

afterEach(cleanup);

describe("Piko", () => {
  it("should_show_the_pose_for_a_mood_capped_to_a_sharp_size", () => {
    const { container } = render(<Piko mood="tip" height={400} />);
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", "/piko/pose/piko-peek.webp");
    expect(image).toHaveAttribute("height", "129");
    expect(image).toHaveAttribute("alt", "");
  });

  it("should_describe_piko_when_asked_to", () => {
    render(<Piko mood="welcome" height={120} alt="Piko waving hello" />);
    expect(screen.getByRole("img", { name: "Piko waving hello" })).toHaveAttribute("src", "/piko/pose/piko-wave.webp");
  });

  it("should_only_animate_when_asked_and_let_reduced_motion_stop_it", () => {
    const { container, rerender } = render(<Piko mood="empty" height={120} />);
    expect(container.firstElementChild).not.toHaveAttribute("data-piko-animate");
    rerender(<Piko mood="empty" height={120} animate="bob" />);
    expect(container.firstElementChild).toHaveAttribute("data-piko-animate", "bob");
  });

  it("should_show_the_face_for_a_mood_as_a_decorative_avatar", () => {
    const { container } = render(<PikoFace mood="thinking" size={32} />);
    const image = container.querySelector("img")!;
    expect(image).toHaveAttribute("src", "/piko/face/piko-thinking.webp");
    expect(image).toHaveAttribute("alt", "");
    expect(container.firstElementChild).toHaveAttribute("data-piko-mood", "thinking");
  });
});
