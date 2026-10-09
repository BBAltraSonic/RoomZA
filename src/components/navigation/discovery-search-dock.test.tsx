// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoverySearch, DiscoverySearchDock, DiscoverySearchProvider } from "./discovery-search-dock";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("shared mobile search dock", () => {
  it.each(["Property", "Services", "Specials"])("keeps one working %s form in the sheet and returns it to desktop", (category) => {
    let mobile = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", () => ({ matches: mobile, addEventListener: (_event: string, callback: () => void) => listeners.add(callback), removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback) }));
    const onSearchFocus = vi.fn();
    function Surface({ view = "map", docked = true }: { view?: "map" | "feed"; docked?: boolean }) {
      const [query, setQuery] = useState("");
      return <DiscoverySearchProvider onSearchFocus={onSearchFocus}>
        <header><DiscoverySearch view={view}><form role="search" onSubmit={event => event.preventDefault()}><input aria-label={category + " search"} value={query} onChange={event => setQuery(event.target.value)} /><button type="button" onClick={() => setQuery("")}>Clear</button></form></DiscoverySearch></header>
        <aside>{docked ? <DiscoverySearchDock /> : null}</aside>
      </DiscoverySearchProvider>;
    }
    const ui = render(<Surface />);
    const input = screen.getByRole("textbox", { name: category + " search" });
    expect(input.closest('[data-slot="discovery-search-dock"]')).not.toBeNull();
    expect(screen.getAllByRole("search")).toHaveLength(1);
    fireEvent.focus(input);
    expect(onSearchFocus).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: "Cape Town" } });
    expect(input).toHaveValue("Cape Town");
    act(() => { mobile = false; listeners.forEach(callback => callback()); });
    expect(screen.getByRole("textbox")).toHaveValue("Cape Town");
    expect(screen.getByRole("textbox").closest("header")).not.toBeNull();
    act(() => { mobile = true; listeners.forEach(callback => callback()); });
    expect(screen.getByRole("textbox").closest("aside")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    ui.rerender(<Surface view="feed" />);
    expect(screen.getByRole("textbox").closest("header")).not.toBeNull();
    ui.rerender(<Surface docked={false} />);
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(screen.getByRole("textbox").closest("header")).not.toBeNull();
  });
});
