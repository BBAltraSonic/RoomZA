// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAssistantOnArrival, useDockAssistant, useRegisterDockAssistant } from "./dock-assistant";

function Page({ open, toggle }: { open: boolean; toggle: () => void }) {
  useRegisterDockAssistant(open, toggle);
  return null;
}
function Dock() {
  const assistant = useDockAssistant();
  return <span data-testid="dock">{assistant ? (assistant.open ? "open" : "closed") : "none"}</span>;
}

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe("dock assistant hand-off", () => {
  it("should expose the mounted page's assistant to the dock and drop it on unmount", () => {
    const toggle = vi.fn();
    const { rerender } = render(<><Dock /><Page open={false} toggle={toggle} /></>);
    expect(screen.getByTestId("dock")).toHaveTextContent("closed");
    rerender(<><Dock /><Page open toggle={toggle} /></>);
    expect(screen.getByTestId("dock")).toHaveTextContent("open");
    rerender(<Dock />);
    expect(screen.getByTestId("dock")).toHaveTextContent("none");
  });

  it("should hand the dock the page's toggle", () => {
    const toggle = vi.fn();
    function Toggle() {
      const assistant = useDockAssistant();
      return <button type="button" onClick={assistant?.toggle}>Toggle</button>;
    }
    render(<><Toggle /><Page open={false} toggle={toggle} /></>);
    act(() => screen.getByRole("button", { name: "Toggle" }).click());
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("should not open the assistant on mount without an arrival request", () => {
    const toggle = vi.fn();
    render(<Page open={false} toggle={toggle} />);
    expect(toggle).not.toHaveBeenCalled();
  });

  it("should open the assistant once when the person arrived from another page's circle", () => {
    requestAssistantOnArrival();
    const toggle = vi.fn();
    const { unmount } = render(<Page open={false} toggle={toggle} />);
    expect(toggle).toHaveBeenCalledOnce();
    unmount();
    render(<Page open={false} toggle={toggle} />);
    expect(toggle).toHaveBeenCalledOnce();
  });
});
