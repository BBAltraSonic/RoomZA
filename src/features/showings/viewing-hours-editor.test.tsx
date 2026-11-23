// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("./viewing-hours-actions", () => ({ getMyViewingHours: mocks.load, saveViewingHours: mocks.save }));

import { ViewingHoursEditor } from "./viewing-hours-editor";

beforeEach(() => {
  vi.clearAllMocks();
  // Tuesday 17:00-19:00 already saved.
  mocks.load.mockResolvedValue({ success: true, data: { hours: [{ weekday: 2, startMinute: 1020, endMinute: 1140 }] } });
  mocks.save.mockImplementation(async (hours: unknown) => ({ success: true, data: { hours } }));
});
afterEach(cleanup);

describe("ViewingHoursEditor", () => {
  it("should_show_saved_hours_with_monday_first", async () => {
    render(<ViewingHoursEditor />);
    const editor = await screen.findByRole("group", { name: "Viewing hours" });
    expect(within(editor).getAllByRole("checkbox").map(box => box.getAttribute("aria-label")))
      .toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    expect(within(editor).getByRole("checkbox", { name: "Tuesday" })).toBeChecked();
    expect(within(editor).getByRole("checkbox", { name: "Monday" })).not.toBeChecked();
    expect(within(editor).getByRole("combobox", { name: "Tuesday start" })).toHaveValue("1020");
    expect(within(editor).getByRole("combobox", { name: "Tuesday end" })).toHaveValue("1140");
    expect(within(editor).queryByRole("combobox", { name: "Monday start" })).not.toBeInTheDocument();
  });

  it("should_save_the_whole_week_when_a_day_is_added", async () => {
    render(<ViewingHoursEditor />);
    const editor = await screen.findByRole("group", { name: "Viewing hours" });
    fireEvent.click(within(editor).getByRole("checkbox", { name: "Saturday" }));
    fireEvent.change(within(editor).getByRole("combobox", { name: "Saturday end" }), { target: { value: "780" } });
    fireEvent.click(screen.getByRole("button", { name: "Save viewing hours" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith([
      { weekday: 2, startMinute: 1020, endMinute: 1140 },
      { weekday: 6, startMinute: 600, endMinute: 780 },
    ]));
    expect(await screen.findByText("Viewing hours saved.")).toBeVisible();
  });

  it("should_explain_an_end_time_before_the_start_without_saving", async () => {
    render(<ViewingHoursEditor />);
    const editor = await screen.findByRole("group", { name: "Viewing hours" });
    fireEvent.change(within(editor).getByRole("combobox", { name: "Tuesday end" }), { target: { value: "1020" } });
    fireEvent.click(screen.getByRole("button", { name: "Save viewing hours" }));
    expect(await screen.findByText("Each day needs at least 30 minutes between start and end.")).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("should_offer_a_retry_when_hours_cannot_load", async () => {
    mocks.load.mockResolvedValueOnce({ success: false, error: "Viewing hours could not be loaded. Try again." });
    render(<ViewingHoursEditor />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("group", { name: "Viewing hours" })).toBeInTheDocument();
  });
});
