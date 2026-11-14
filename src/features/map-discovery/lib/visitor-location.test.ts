import { describe, expect, it, vi } from "vitest";

import { readVisitorLocation } from "./visitor-location";

type PermissionState = "granted" | "denied" | "prompt";

function setup(permission: PermissionState | "unsupported") {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({ coords: { latitude: -26.2, longitude: 28.04 } } as GeolocationPosition),
  );
  const permissions =
    permission === "unsupported"
      ? undefined
      : { query: vi.fn(async () => ({ state: permission }) as PermissionStatus) };
  const onLocation = vi.fn();
  return { geolocation: { getCurrentPosition } as unknown as Geolocation, permissions, getCurrentPosition, onLocation };
}

describe("readVisitorLocation", () => {
  it("should_prompt_for_location_on_a_cold_start", async () => {
    const { geolocation, permissions, getCurrentPosition, onLocation } = setup("prompt");

    await readVisitorLocation({ geolocation, permissions, allowPrompt: true, onLocation });

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(onLocation).toHaveBeenCalledWith({ lat: -26.2, lng: 28.04 });
  });

  it("should_not_prompt_on_a_shared_link_when_permission_was_never_granted", async () => {
    const { geolocation, permissions, getCurrentPosition, onLocation } = setup("prompt");

    await readVisitorLocation({ geolocation, permissions, allowPrompt: false, onLocation });

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });

  it("should_read_location_silently_on_a_shared_link_when_already_granted", async () => {
    const { geolocation, permissions, onLocation } = setup("granted");

    await readVisitorLocation({ geolocation, permissions, allowPrompt: false, onLocation });

    expect(onLocation).toHaveBeenCalledWith({ lat: -26.2, lng: 28.04 });
  });

  it("should_not_prompt_on_a_shared_link_when_the_permissions_api_is_missing", async () => {
    const { geolocation, permissions, getCurrentPosition, onLocation } = setup("unsupported");

    await readVisitorLocation({ geolocation, permissions, allowPrompt: false, onLocation });

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });

  it("should_not_report_location_after_being_cancelled", async () => {
    const { geolocation, permissions, onLocation } = setup("prompt");

    await readVisitorLocation({ geolocation, permissions, allowPrompt: true, onLocation, isCancelled: () => true });

    expect(onLocation).not.toHaveBeenCalled();
  });
});
