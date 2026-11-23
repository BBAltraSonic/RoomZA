import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/navigation", () => navigation);
vi.mock("@/features/profile/settings-data", async importOriginal => ({
  ...(await importOriginal<object>()),
  getProfileSettingsData: vi.fn(async () => ({})),
}));
vi.mock("@/features/profile/components/settings-section", () => ({ SettingsSectionView: () => null }));

import SettingsIndexPage from "./page";
import SettingsSectionPage from "./[section]/page";

beforeEach(() => { navigation.redirect.mockReset(); navigation.notFound.mockReset(); });

describe("settings routes", () => {
  it("should_open_settings_on_privacy", () => {
    SettingsIndexPage();
    expect(navigation.redirect).toHaveBeenCalledWith("/settings/privacy");
  });

  it("should_send_the_old_profile_section_to_the_profile_editor", async () => {
    await SettingsSectionPage({ params: Promise.resolve({ section: "profile" }) });
    expect(navigation.redirect).toHaveBeenCalledWith("/profile/edit");
  });
});
