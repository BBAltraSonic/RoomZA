import { describe, expect, it } from "vitest";

import {
  LIVE_VIDEO_CONNECT_TIMEOUT_MS,
  nextLiveVideoConnectionState,
} from "./live-video-connection";

describe("live video connection state", () => {
  it("uses a 10s connection timeout", () => {
    expect(LIVE_VIDEO_CONNECT_TIMEOUT_MS).toBe(10_000);
  });

  it("moves between connecting, connected, and failed states", () => {
    expect(nextLiveVideoConnectionState("retry")).toBe("connecting");
    expect(nextLiveVideoConnectionState("load")).toBe("connected");
    expect(nextLiveVideoConnectionState("timeout")).toBe("failed");
  });
});
