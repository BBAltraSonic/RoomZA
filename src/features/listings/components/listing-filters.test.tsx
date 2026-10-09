// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), params: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }), usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(mocks.params),
}));
import { ListingFilters } from "./listing-filters";
afterEach(() => { cleanup(); vi.useRealTimers(); mocks.replace.mockReset(); mocks.params = ""; });
describe("dashboard search navigation", () => {
  it("does not request another dashboard on mount or an unchanged RSC render", () => {
    vi.useFakeTimers();
    const view = render(<ListingFilters />);
    act(() => vi.advanceTimersByTime(300));
    view.rerender(<ListingFilters />);
    act(() => vi.advanceTimersByTime(300));
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("debounces a changed query and stops replacing when the URL reflects it", () => {
    vi.useFakeTimers();
    const view = render(<ListingFilters />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Cape" } });
    act(() => vi.advanceTimersByTime(300));
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/dashboard?q=Cape");
    mocks.params = "q=Cape";
    view.rerender(<ListingFilters />);
    act(() => vi.advanceTimersByTime(300));
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });
});
