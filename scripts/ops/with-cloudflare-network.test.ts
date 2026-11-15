import { describe, expect, it } from "vitest";

import {
  CLOUDFLARE_NETWORK_NODE_OPTIONS,
  toShellCommand,
  withCloudflareNetworkNodeOptions,
} from "./with-cloudflare-network.mjs";

describe("with-cloudflare-network", () => {
  it("should add both connection flags when NODE_OPTIONS is unset", () => {
    expect(withCloudflareNetworkNodeOptions(undefined)).toBe(
      CLOUDFLARE_NETWORK_NODE_OPTIONS.join(" "),
    );
  });

  it("should keep the caller's existing NODE_OPTIONS in front", () => {
    const merged = withCloudflareNetworkNodeOptions("--max-old-space-size=6144");

    expect(merged).toBe(
      `--max-old-space-size=6144 ${CLOUDFLARE_NETWORK_NODE_OPTIONS.join(" ")}`,
    );
  });

  it("should not repeat a flag that is already present", () => {
    const merged = withCloudflareNetworkNodeOptions(
      "--no-network-family-autoselection --max-old-space-size=6144",
    );

    expect(merged.match(/--no-network-family-autoselection/g)).toHaveLength(1);
    expect(merged).toContain("--dns-result-order=ipv4first");
  });

  it("should respect a DNS order the caller already chose", () => {
    const merged = withCloudflareNetworkNodeOptions("--dns-result-order=verbatim");

    expect(merged).toContain("--dns-result-order=verbatim");
    expect(merged).not.toContain("--dns-result-order=ipv4first");
  });

  it("should quote only the arguments that contain whitespace", () => {
    expect(toShellCommand(["wrangler", "deploy", "--message", "two words"])).toBe(
      'wrangler deploy --message "two words"',
    );
  });
});
