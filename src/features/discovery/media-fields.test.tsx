// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaFields, type CardDraftPresentation } from "./media-fields";

const ids = Array.from({ length: 20 }, (_, index) => "aaaaaaaa-aaaa-4aaa-8aaa-" + String(index).padStart(12, "0"));
const media = ids.map(id => ({ id, url: "https://example.com/" + id + ".jpg" }));
function Editor({ category = "shopping", initial = {}, busy = vi.fn() }: { category?: string; initial?: CardDraftPresentation; busy?: (value: boolean) => void }) {
  const [value, setValue] = useState(initial);
  return <><MediaFields category={category} target={ids[0]!} version={2} value={value} onChange={setValue} onBusyChange={busy} /><output data-testid="draft">{JSON.stringify(value)}</output></>;
}
const draft = () => JSON.parse(screen.getByTestId("draft").textContent!);
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Special photo editing", () => {
  it.each(["shopping", "tourism", "event"])("uploads multiple %s photos in order and lets the poster change the cover", async category => {
    const busy = vi.fn(); let next = 0;
    const fetcher = vi.fn((_url, options) => Promise.resolve(Response.json(options?.method === "POST" ? { media: media[next++] } : { media })));
    vi.stubGlobal("fetch", fetcher);
    render(<Editor category={category} busy={busy} />);
    const input = screen.getByLabelText("Upload photo");
    expect(input).toHaveAttribute("multiple");
    fireEvent.change(input, { target: { files: [new File(["photo"], "one.jpg", { type: "image/jpeg" }), new File(["photo"], "two.png", { type: "image/png" })] } });
    await waitFor(() => expect(draft().mediaIds).toEqual(ids.slice(0, 2)));
    expect(busy.mock.calls).toEqual([[true], [false]]);
    const posts = fetcher.mock.calls.filter(call => call[1]?.method === "POST");
    expect(posts[0]?.[1].body.get("expectedVersion")).toBe("2");
    expect(draft().mediaRightsConfirmed).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Move photo 2 earlier" }));
    expect(draft().mediaIds).toEqual([ids[1], ids[0]]);
    expect(screen.getByText("Cover photo").parentElement).toContainElement(screen.getByRole("img", { name: "Special photo 1" }));
    expect(screen.getByRole("img", { name: "Special photo 1" }).getAttribute("src")).toContain(ids[1]);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(draft().mediaRightsConfirmed).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove photo from draft" })[0]!);
    expect(draft().mediaIds).toEqual([ids[0]]);
    expect(draft().mediaRightsConfirmed).toBe(false);
  });
  it("preserves successful uploads and other draft fields when a later upload fails", async () => {
    let next = 0;
    vi.stubGlobal("fetch", vi.fn((_url, options) => Promise.resolve(options?.method === "POST"
      ? next++ === 0 ? Response.json({ media: media[0] }) : Response.json({ error: "Upload failed. Keep your draft." }, { status: 422 })
      : Response.json({ media: [] }))));
    render(<Editor initial={{ priceCents: 9900 }} />);
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [new File(["photo"], "one.jpg"), new File(["photo"], "two.jpg")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Keep your draft");
    expect(draft()).toMatchObject({ mediaIds: [ids[0]], priceCents: 9900, mediaRightsConfirmed: false });
    expect(screen.getByLabelText("Upload photo")).toBeEnabled();
  });
  it("rejects an eleven-photo selection before making upload requests", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ media: [] })); vi.stubGlobal("fetch", fetcher);
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: Array.from({ length: 11 }, () => new File(["photo"], "photo.jpg")) } });
    expect(await screen.findByRole("alert")).toHaveTextContent("up to 10 photos");
    expect(fetcher.mock.calls.every(call => call[1]?.method !== "POST")).toBe(true);
    expect(draft().mediaIds).toBeUndefined();
  });
  it("hides upload controls at the category limit and retains Services' twenty-photo capacity", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ media })));
    const view = render(<Editor initial={{ mediaIds: ids.slice(0, 10) }} />);
    expect(screen.queryByLabelText("Upload photo")).not.toBeInTheDocument();
    view.rerender(<Editor category="service" initial={{ mediaIds: ids.slice(0, 10) }} />);
    expect(screen.getByLabelText("Upload photo")).toBeInTheDocument();
  });
});
