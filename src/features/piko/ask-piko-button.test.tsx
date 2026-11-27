// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { useRegisterDockAssistant } from "@/features/piko/dock-assistant";

import { AskPikoButton } from "./ask-piko-button";
import { PikoTipProvider } from "./tips-context";

afterEach(cleanup);

function Page({ open, toggle }: { open: boolean; toggle: () => void }) {
  useRegisterDockAssistant(open, toggle);
  return <AskPikoButton />;
}

describe("AskPikoButton", () => {
  it("should_open_piko_for_the_item_on_screen", () => {
    const toggle = vi.fn();
    render(<Page open={false} toggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Piko" }));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("should_leave_piko_open_when_it_already_is", () => {
    const toggle = vi.fn();
    render(<Page open toggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Piko" }));
    expect(toggle).not.toHaveBeenCalled();
  });

  it("should_not_show_where_the_page_has_no_piko", () => {
    render(<AskPikoButton />);
    expect(screen.queryByRole("button", { name: "Ask Piko" })).toBeNull();
  });
});

describe("AskPikoButton tip", () => {
  it("should_show_piko's_tip_for_the_open_item", () => {
    render(
      <PikoTipProvider tip="Ends today at 17:00">
        <Page open={false} toggle={vi.fn()} />
      </PikoTipProvider>,
    );
    expect(screen.getByRole("note", { name: "Piko's tip" })).toHaveTextContent("Ends today at 17:00");
  });

  it("should_show_no_tip_without_one", () => {
    render(<Page open={false} toggle={vi.fn()} />);
    expect(screen.queryByRole("note", { name: "Piko's tip" })).toBeNull();
  });
});
