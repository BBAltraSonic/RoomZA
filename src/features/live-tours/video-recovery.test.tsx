// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { LiveTourVideo, type JitsiExternalApi } from "./live-tour-video";

afterEach(() => {
  cleanup();
  document.querySelectorAll('script[data-pinpoint-jitsi-api="true"]').forEach(script => script.remove());
  delete window.JitsiMeetExternalAPI;
  delete window.documentPictureInPicture;
});

function pictureFixture() {
  const callbacks = new Map<string, (payload: never) => void>(), frame = document.createElement("iframe"), dispose = vi.fn();
  const apiRef = { current: null as JitsiExternalApi | null };
  window.JitsiMeetExternalAPI = class {
    constructor(_domain: string, options: { parentNode: HTMLElement }) { options.parentNode.append(frame); }
    addEventListener(event: string, listener: (payload: never) => void) { callbacks.set(event, listener); }
    dispose() { dispose(); frame.remove(); }
    executeCommand() {}
    getIFrame() { return frame; }
    async getRoomsInfo() { return { rooms: [] }; }
  };
  const events = new EventTarget(), close = vi.fn();
  const popup = { document: document.implementation.createHTMLDocument("Contained picture window"), addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), close, closed: false } as unknown as Window;
  const request = vi.fn<() => Promise<Window>>().mockResolvedValue(popup);
  window.documentPictureInPicture = { requestWindow: request };
  const props = { joinUrl: "https://fixture.invalid/room", roomId: "contained-picture-room", title: "Contained video", displayName: "Synthetic viewer", isHost: false, moderationEnabled: false, pictureInPictureEnabled: true, onConferenceJoined: vi.fn(), onRecordingStatusChanged: vi.fn(), onRecordingLinkAvailable: vi.fn(), apiRef };
  const join = async () => {
    await waitFor(() => expect(apiRef.current).not.toBeNull());
    act(() => callbacks.get("videoConferenceJoined")?.({ id: "contained-viewer" } as never));
  };
  return { frame, popup, close, request, props, join, dispose };
}

it("keeps picture-in-picture unavailable until the video has joined", async () => {
  const fixture = pictureFixture(); render(<LiveTourVideo {...fixture.props}/>);
  expect(screen.getByRole("button", { name: "Keep visible" })).toBeDisabled();
  await fixture.join(); expect(screen.getByRole("button", { name: "Keep visible" })).toBeEnabled();
});

it("contains picture permission denial and permits a successful ordinary retry", async () => {
  const fixture = pictureFixture(); fixture.request.mockRejectedValueOnce(new DOMException("Contained permission denial", "NotAllowedError"));
  render(<LiveTourVideo {...fixture.props}/>); await fixture.join(); fireEvent.click(screen.getByRole("button", { name: "Keep visible" }));
  expect(await screen.findByText("Could not keep the video visible. Try again.")).toBeVisible(); expect(document.body.contains(fixture.frame)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Keep visible" }));
  await waitFor(() => expect(fixture.popup.document.body.contains(fixture.frame)).toBe(true));
  expect(screen.queryByText("Could not keep the video visible. Try again.")).not.toBeInTheDocument(); expect(fixture.request).toHaveBeenCalledTimes(2);
});

it("locks duplicate picture requests and closes a window that opens after unmount", async () => {
  const fixture = pictureFixture(); let resolve!: (popup: Window) => void;
  fixture.request.mockReturnValue(new Promise<Window>(done => { resolve = done; }));
  const view = render(<LiveTourVideo {...fixture.props}/>); await fixture.join(); const button = screen.getByRole("button", { name: "Keep visible" });
  act(() => { button.click(); button.click(); button.click(); });
  expect.soft(fixture.request).toHaveBeenCalledTimes(1); expect.soft(button).toBeDisabled(); view.unmount();
  await act(async () => resolve(fixture.popup));
  expect(fixture.popup.document.body.contains(fixture.frame)).toBe(false); expect(fixture.close).toHaveBeenCalledTimes(1);
});

it("does not interrupt room teardown when the video provider throws during disposal", async () => {
  const fixture = pictureFixture(); fixture.dispose.mockImplementation(() => { throw new Error("Contained provider disposal failure"); });
  const view = render(<LiveTourVideo {...fixture.props}/>); await fixture.join();
  expect(() => view.unmount()).not.toThrow(); expect(fixture.props.apiRef.current).toBeNull();
});

it("loads a fresh video script after a failed attempt and connects on retry", async () => {
  const apiRef = { current: null as JitsiExternalApi | null };
  render(<LiveTourVideo joinUrl="https://fixture.invalid/room" roomId="contained-room" title="Contained video" displayName="Synthetic viewer" isHost={false} moderationEnabled={false} pictureInPictureEnabled={false} onConferenceJoined={vi.fn()} onRecordingStatusChanged={vi.fn()} onRecordingLinkAvailable={vi.fn()} apiRef={apiRef}/>);
  const failed = document.querySelector<HTMLScriptElement>('script[data-pinpoint-jitsi-api="true"]')!;
  expect(failed).not.toBeNull();
  await act(async () => failed.dispatchEvent(new Event("error")));
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(document.querySelector('script[data-pinpoint-jitsi-api="true"]')).not.toBe(failed));
  const callbacks = new Map<string, (payload: never) => void>();
  window.JitsiMeetExternalAPI = class {
    addEventListener(event: string, listener: (payload: never) => void) { callbacks.set(event, listener); }
    dispose() {}
    executeCommand() {}
    getIFrame() { return document.createElement("iframe"); }
    async getRoomsInfo() { return { rooms: [] }; }
  };
  await act(async () => document.querySelector('script[data-pinpoint-jitsi-api="true"]')!.dispatchEvent(new Event("load")));
  await waitFor(() => expect(apiRef.current).not.toBeNull());
  act(() => callbacks.get("videoConferenceJoined")?.({ id: "contained-participant" } as never));
  expect(screen.queryByText("Connecting to video room...")).not.toBeInTheDocument();
  expect(screen.queryByText("Video connection failed. Check permissions and try again.")).not.toBeInTheDocument();
});
