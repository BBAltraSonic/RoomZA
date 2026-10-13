// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SavedSpecialsProvider, useSavedSpecial } from "./saved-specials-client";
const target = { category: "shopping" as const, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
function Heart() { const save = useSavedSpecial(target, 76); return <button disabled={save.pending} aria-pressed={save.saved} onClick={() => void save.toggle()}>{save.count}</button>; }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Special save state", () => {
  it("restores saved state and aggregate count after a failed removal", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false }); vi.stubGlobal("fetch", fetch);
    render(<SavedSpecialsProvider initialTargets={[target]}><Heart /></SavedSpecialsProvider>);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not be updated"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true"); expect(screen.getByRole("button")).toHaveTextContent("76");
    expect(fetch.mock.calls[0]![1].method).toBe("DELETE");
  });
  it("shares an in-flight load with the first heart tap and keeps its final state", async () => {
    let finishLoad!: (response: unknown) => void;
    const load = new Promise(resolve => { finishLoad = resolve; });
    const fetch = vi.fn().mockReturnValueOnce(load).mockResolvedValue({ ok: true, json: async () => ({ saved: false, savedCount: 75 }) }); vi.stubGlobal("fetch", fetch);
    render(<SavedSpecialsProvider><Heart /></SavedSpecialsProvider>); fireEvent.click(screen.getByRole("button"));
    await act(async () => { finishLoad({ ok: true, json: async () => ({ authenticated: true, targets: [target] }) }); });
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls[1]![1].method).toBe("DELETE");
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false"); expect(screen.getByRole("button")).toHaveTextContent("75");
  });
  it("deduplicates rapid save taps and uses the server aggregate", async () => {
    let finishSave!: (response: unknown) => void;
    const fetch = vi.fn().mockReturnValue(new Promise(resolve => { finishSave = resolve; })); vi.stubGlobal("fetch", fetch);
    render(<SavedSpecialsProvider initialTargets={[]}><Heart /></SavedSpecialsProvider>);
    fireEvent.click(screen.getByRole("button")); fireEvent.click(screen.getByRole("button"));
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => { finishSave({ ok: true, json: async () => ({ saved: true, savedCount: 81 }) }); });
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true"); expect(screen.getByRole("button")).toHaveTextContent("81");
  });
});
