// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useState } from "react";
import { FloatingDiscoveryDetail } from "./floating-discovery-detail";

afterEach(cleanup);

it("closes by Escape and restores focus without consuming a nested dialog's Escape", () => {
  function Example() {
    const [open, setOpen] = useState(false);
    const [dialog, setDialog] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open property</button>
      {open ? <FloatingDiscoveryDetail label="Property details" expanded={false} onToggleExpanded={() => {}} onClose={() => setOpen(false)}>
        <button onClick={() => setDialog(true)}>Report property</button>
        {dialog ? <div role="dialog" aria-label="Report"><button onClick={() => setDialog(false)}>Cancel report</button></div> : null}
      </FloatingDiscoveryDetail> : null}</>;
  }
  render(<Example />);
  const opener = screen.getByRole("button", { name: "Open property" });
  opener.focus(); fireEvent.click(opener);
  const close = screen.getByRole("button", { name: "Close property details" });
  expect(close).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Report property" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(close).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel report" }));
  // Results and map stay operable while the panel is open.
  opener.focus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
