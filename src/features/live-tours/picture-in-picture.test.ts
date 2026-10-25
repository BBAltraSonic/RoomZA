// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDocumentPictureInPicture, moveElementToPictureInPicture } from "./picture-in-picture";

afterEach(() => document.body.replaceChildren());

function containedWindow() {
  const events = new EventTarget();
  const close = vi.fn();
  const popup = { document: document.implementation.createHTMLDocument("Contained picture-in-picture"), addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), close, closed: false } as unknown as Window;
  return { popup, close, events };
}

function containedFrame() {
  const parent = document.createElement("div"), before = document.createElement("span"), frame = document.createElement("iframe"), after = document.createElement("span");
  frame.style.width = "480px"; frame.style.height = "270px";
  parent.append(before, frame, after); document.body.append(parent);
  return { parent, frame, before, after };
}

describe("Document Picture-in-Picture capability", () => {
  it("accepts only an API with requestWindow", () => {
    const requestWindow = vi.fn();
    expect(getDocumentPictureInPicture({ requestWindow })).toEqual({
      requestWindow,
    });
    expect(getDocumentPictureInPicture({})).toBeNull();
    expect(getDocumentPictureInPicture(null)).toBeNull();
  });
  it("retains the inline frame without a leftover slot after permission denial", async () => {
    const { parent, frame, before, after } = containedFrame();
    await expect(moveElementToPictureInPicture(frame, { requestWindow: vi.fn().mockRejectedValue(new DOMException("Contained denial", "NotAllowedError")) })).rejects.toHaveProperty("name", "NotAllowedError");
    expect([...parent.childNodes]).toEqual([before, frame, after]);
    expect(frame.style.width).toBe("480px"); expect(frame.style.height).toBe("270px");
  });
  it("returns the exact frame and its styles, closes the popup and makes repeated cleanup harmless", async () => {
    const { parent, frame, before, after } = containedFrame(), { popup, close, events } = containedWindow();
    const moved = await moveElementToPictureInPicture(frame, { requestWindow: async () => popup });
    expect(popup.document.body.contains(frame)).toBe(true);
    moved.restore(); moved.restore(); events.dispatchEvent(new Event("pagehide"));
    expect([...parent.childNodes]).toEqual([before, frame, after]);
    expect(frame.style.width).toBe("480px"); expect(frame.style.height).toBe("270px");
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("closes a permission result that arrives after cancellation without moving the frame", async () => {
    const { parent, frame, before, after } = containedFrame(), { popup, close } = containedWindow(), controller = new AbortController();
    let resolve!: (value: Window) => void;
    const pending = moveElementToPictureInPicture(frame, { requestWindow: () => new Promise<Window>(done => { resolve = done; }) }, controller.signal);
    const result = pending.catch(error => error);
    controller.abort(); resolve(popup);
    expect(await result).toHaveProperty("name", "AbortError");
    expect([...parent.childNodes]).toEqual([before, frame, after]);
    expect(popup.document.body.contains(frame)).toBe(false); expect(close).toHaveBeenCalledTimes(1);
  });
});
