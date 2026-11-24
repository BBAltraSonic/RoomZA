// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { speechRecognitionConstructor, VoiceInputButton } from "./voice-input";

type Fake = {
  lang: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

let last: Fake | null = null;

function installFakeRecognition() {
  class FakeRecognition {
    lang = "";
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    start = vi.fn();
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();
    onresult: Fake["onresult"] = null;
    onerror: Fake["onerror"] = null;
    onend: Fake["onend"] = null;
    constructor() {
      last = this as unknown as Fake;
    }
  }
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  last = null;
});

describe("VoiceInputButton", () => {
  it("should_show_nothing_where_the_browser_cannot_recognise_speech", () => {
    expect(speechRecognitionConstructor({})).toBeNull();
    render(<VoiceInputButton onText={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should_fill_the_box_with_what_was_heard_in_south_african_english_without_sending", () => {
    installFakeRecognition();
    const onText = vi.fn();
    render(<VoiceInputButton onText={onText} />);
    fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
    expect(last!.lang).toBe("en-ZA");
    expect(last!.start).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop listening" })).toHaveAttribute("aria-pressed", "true");
    act(() => last!.onresult!({ results: [[{ transcript: "furnished room near UWC" }]] }));
    expect(onText).toHaveBeenCalledWith("furnished room near UWC");
    fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
    expect(screen.getByRole("button", { name: "Speak your request" })).toHaveAttribute("aria-pressed", "false");
  });

  it("should_explain_a_blocked_microphone", () => {
    installFakeRecognition();
    const onProblem = vi.fn();
    render(<VoiceInputButton onText={vi.fn()} onProblem={onProblem} />);
    fireEvent.click(screen.getByRole("button", { name: "Speak your request" }));
    act(() => last!.onerror!({ error: "not-allowed" }));
    expect(onProblem).toHaveBeenLastCalledWith("Allow the microphone to speak a request.");
  });
});
