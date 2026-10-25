// @vitest-environment jsdom
import { Component, type ComponentProps, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ change: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/features/profile/actions", () => ({ setProfileRelationshipAction: mocks.change, contactProfileAction: vi.fn(), updateAccountIdentityAction: vi.fn(), updateNormalizedNotificationPreferenceAction: vi.fn(), updateProfilePrivacyAction: vi.fn() }));
vi.mock("@/features/trust/settings-actions", () => ({ cancelPrivacyRequest: vi.fn(), requestDataExport: vi.fn(), signOutEverywhere: vi.fn(), signOutOtherSessions: vi.fn(), submitPrivacyRequest: vi.fn() }));
vi.mock("@/features/profile/components/passkey-controls", () => ({ PasskeyControls: () => null }));
vi.mock("@/features/trust/components/user-mfa-controls", () => ({ UserMfaControls: () => null }));
vi.mock("@/features/notifications/push-controls", () => ({ PushControls: () => null }));
vi.mock("@/lib/supabase/browser", () => ({ createClient: vi.fn() }));

import { PublicProfileActions } from "./public-profile-actions";
import { SettingsSectionView } from "./settings-section";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">Controls failed</p> : this.props.children; }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const success = { success: true, data: undefined } as const;
const publicProps = { profileId: "profile-a", username: "owner-a", signedIn: true, canMessage: false, isMuted: false, listings: [] };
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("Profile relationship request recovery", () => {
  it("keeps public controls usable after an interrupted request and retries the intended change", async () => {
    mocks.change.mockRejectedValueOnce(new Error("Contained transport failure")).mockResolvedValue(success);
    render(<Boundary><PublicProfileActions {...publicProps} /></Boundary>);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be confirmed/i);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Mute" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unmute" })).toBeEnabled());
    expect(mocks.change).toHaveBeenLastCalledWith({ profileId: "profile-a", relationship: "mute", enabled: true });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("locks duplicate and competing public relationship changes in the same turn", async () => {
    const request = deferred<typeof success>(); mocks.change.mockReturnValue(request.promise);
    render(<PublicProfileActions {...publicProps} />);
    const mute = screen.getByRole("button", { name: "Mute" }), block = screen.getByRole("button", { name: "Block" });
    act(() => { mute.click(); mute.click(); block.click(); });
    try { expect(mocks.change).toHaveBeenCalledTimes(1); }
    finally { await act(async () => request.resolve(success)); }
  });
  it("does not apply a late mute response to a different profile", async () => {
    const request = deferred<typeof success>(); mocks.change.mockReturnValue(request.promise);
    const view = render(<PublicProfileActions {...publicProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    view.rerender(<PublicProfileActions {...publicProps} profileId="profile-b" username="owner-b" />);
    await act(async () => request.resolve(success));
    expect(screen.getByRole("button", { name: "Mute" })).toBeEnabled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("shows a server rejection without claiming a changed relationship", async () => {
    mocks.change.mockResolvedValue({ success: false, error: "Account access is unavailable." });
    render(<PublicProfileActions {...publicProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Block" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Account access is unavailable.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Block" })).toBeEnabled());
  });

  const data = {
    profile: { visibility: { profile: "everyone", messaging: "members", phone: "no_one", email: "no_one", reviews: true, activity: false, searchIndexed: false } },
    blocks: [{ blocked_id: "profile-a", profile: { display_name: "Contained owner", username: "owner-a" } }],
    mutes: [{ muted_id: "profile-b", profile: { display_name: "Contained member" } }],
    consentHistory: [], profileVersions: [],
  } as unknown as ComponentProps<typeof SettingsSectionView>["data"];
  it("retains the settings removal control after interruption and permits a retry", async () => {
    mocks.change.mockRejectedValueOnce(new Error("Contained transport failure")).mockResolvedValue(success);
    render(<Boundary><SettingsSectionView section="privacy" data={data} /></Boundary>);
    fireEvent.click(screen.getByRole("button", { name: "Unblock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be confirmed/i);
    expect(mocks.refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Unblock" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.change).toHaveBeenLastCalledWith({ profileId: "profile-a", relationship: "block", enabled: false });
  });
  it("locks competing settings removals until the first request settles", async () => {
    const request = deferred<typeof success>(); mocks.change.mockReturnValue(request.promise);
    render(<SettingsSectionView section="privacy" data={data} />);
    const unblock = screen.getByRole("button", { name: "Unblock" }), unmute = screen.getByRole("button", { name: "Unmute" });
    act(() => { unblock.click(); unmute.click(); });
    try { expect(mocks.change).toHaveBeenCalledTimes(1); }
    finally { await act(async () => request.resolve(success)); }
  });
});
