// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { PushControls } from "./push-controls";
import { defaultNotificationOptions } from "./contract";

vi.mock("@/components/ui/button", () => ({ Button: ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => <button disabled={disabled} onClick={onClick}>{children}</button> }));
const request = vi.hoisted(() => vi.fn());
vi.mock("./notification-provider", () => ({ notificationRequest: request }));
vi.mock("@/features/profile/actions", () => ({ updateNormalizedNotificationPreferenceAction: vi.fn() }));
const settings = () => ({ options: defaultNotificationOptions, devices: [], flags: { push: false }, publicKey: null, subscriptions: [] });
const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  request.mockReset().mockResolvedValue(settings());
});
afterEach(() => {
  cleanup();
  if (serviceWorkerDescriptor) Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
  else Reflect.deleteProperty(navigator, "serviceWorker");
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("push settings hydration", () => {
  it("hydrates a server-rendered unsupported snapshot before detecting browser support", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const browserWindow = window;
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", function Notification() {});
    vi.stubGlobal("isSecureContext", true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    vi.stubGlobal("window", undefined);
    const html = renderToString(<PushControls />);
    vi.stubGlobal("window", browserWindow);
    expect(html).toContain("does not currently support device notifications");
    container.innerHTML = html;
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, <PushControls />, { onRecoverableError: error => errors.push(error) }); });
    expect(errors).toEqual([]);
    expect(container.textContent).not.toContain("does not currently support device notifications");
    await act(async () => root.unmount());
  });

  it("offers recovery after settings fail to load instead of leaving disabled controls with no retry", async () => {
    request.mockRejectedValueOnce(new Error("Network failed"));
    render(<PushControls />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry notification settings" }));
    expect(await screen.findByText(/Device notifications are being prepared/)).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("prevents initial loading from overwriting edits entered before server preferences arrive", async () => {
    let resolve!: (value: ReturnType<typeof settings>) => void;
    request.mockReturnValueOnce(new Promise(res => { resolve = res; }));
    render(<PushControls />);
    expect(screen.getByLabelText("Timezone")).toBeDisabled();
    expect(screen.getByLabelText("Show message previews")).toBeDisabled();
    await act(async () => resolve(settings()));
    expect(screen.getByLabelText("Timezone")).toBeEnabled();
  });
});
