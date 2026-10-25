// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ImportJobSummary, SourceInspection } from "./types";

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), headers: vi.fn(), upload: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({ channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() }) }));
vi.mock("./adapters/xlsx", () => ({ xlsxAdapter: { inspect: mocks.inspect, discoverHeaders: mocks.headers } }));
vi.mock("./adapters/json", () => ({ jsonAdapter: { inspect: mocks.inspect, discoverHeaders: mocks.headers } }));
vi.mock("./upload", () => ({ uploadImportSource: mocks.upload }));
import { ImportWorkspace } from "./import-workspace";

const base: ImportJobSummary = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sourceKind: "xlsx", sourceName: null, stage: "upload", version: 1, totalRows: 0, processedRows: 0, validRows: 0, warningRows: 0, blockedRows: 0, committedRows: 0, failedRows: 0, heartbeatAt: null, updatedAt: "2026-10-21T00:00:00Z", messageCode: null, messageDetail: null };
const inspection: SourceInspection = { sourceKind: "xlsx", adapterVersion: "1", sheets: ["Instructions", "Listings"], headers: [], warnings: ["Select the worksheet that contains the listings."] };
function setup(sourceKind: ImportJobSummary["sourceKind"] = "xlsx") { return render(<ImportWorkspace initialJob={{ ...base, sourceKind }} initialConfiguration={{ mapping: {}, defaults: {}, selection: { mode: "explicit", included: [] }, sourceMetadata: {}, sheetName: null, recordPath: null }} initialRows={[]} initialNextCursor={null} agents={[]} />); }
const choose = (container: HTMLElement, name: string) => fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["fixture"], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })] } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("import source selection and inspection recovery", () => {
  it("requires an explicit worksheet and uploads the selected sheet's columns", async () => {
    mocks.inspect.mockResolvedValue(inspection);
    mocks.headers.mockResolvedValue(["title", "price"]);
    mocks.upload.mockResolvedValue("contained/source.xlsx");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, data: { job: { ...base, stage: "mapping", version: 2 } } }));
    vi.stubGlobal("fetch", fetcher);
    const { container } = setup(); choose(container, "listings.xlsx");
    await screen.findByRole("combobox", { name: "Worksheet" });
    fireEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Choose the worksheet"));
    expect(mocks.upload).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Worksheet" }), { target: { value: "Listings" } });
    fireEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await screen.findByRole("heading", { name: "Map source columns" });
    expect(mocks.headers).toHaveBeenCalledWith(expect.any(File), { sheet: "Listings" });
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ action: "source_uploaded", sheetName: "Listings", inspection: { headers: ["title", "price"] } });
  });

  it("ignores an old inspection completing after a newer file was selected", async () => {
    let resolveOld!: (value: SourceInspection) => void;
    mocks.inspect.mockImplementationOnce(() => new Promise<SourceInspection>(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ ...inspection, sheets: ["Current A", "Current B"] });
    vi.stubGlobal("fetch", vi.fn());
    const { container } = setup(); choose(container, "old.xlsx");
    await waitFor(() => expect(mocks.inspect).toHaveBeenCalledTimes(1));
    choose(container, "current.xlsx");
    await screen.findByRole("option", { name: "Current B" });
    await act(async () => { resolveOld(inspection); });
    await waitFor(() => expect(screen.queryByRole("option", { name: "Instructions" })).toBeNull());
    expect(screen.getByRole("option", { name: "Current B" })).toBeTruthy();
  });

  it("does not silently upload the first of multiple JSON record paths", async () => {
    mocks.inspect.mockResolvedValue({ ...inspection, sourceKind: "json", sheets: undefined, recordPaths: ["$.instructions", "$.listings"] });
    vi.stubGlobal("fetch", vi.fn());
    const { container } = setup("json");
    const file = new File(["{}"], "source.json", { type: "application/json" });
    // jsdom's File omits the modern text() method; the real parser is separately tested.
    Object.defineProperty(file, "text", { value: async () => "{}" });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await screen.findByRole("combobox", { name: "Repeating record path" });
    fireEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Choose the repeating listing record path"));
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
