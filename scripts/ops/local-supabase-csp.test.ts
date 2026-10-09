import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
async function csp(environment: string, url: string) {
  vi.stubEnv("NODE_ENV", environment); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url); vi.resetModules();
  const { default: config } = await import("../../next.config");
  const rows = await config.headers!();
  return rows.flatMap(row => row.headers).find(header => header.key === "Content-Security-Policy")!.value;
}
describe("development Supabase CSP origin", () => {
  it("permits only the configured loopback clone port and its websocket origin in development", async () => {
    const value = await csp("development", "http://127.0.0.1:55431/path?ignored=true");
    expect(value).toContain(" http://127.0.0.1:55431"); expect(value).toContain(" ws://127.0.0.1:55431");
    expect(value).not.toContain("/path"); expect(value).not.toContain("ignored=true");
  });
  it("never adds a configured loopback origin in production", async () => {
    const value = await csp("production", "http://127.0.0.1:55431");
    expect(value).not.toContain("55431"); expect(value).not.toContain("54321");
  });
  it("does not broaden development CSP to arbitrary hosts or invalid inputs", async () => {
    expect(await csp("development", "http://untrusted.invalid:55431")).not.toContain("untrusted.invalid");
    expect(await csp("development", "http://127.0.0.1:55431; unsafe.example")).not.toContain("55431");
  });
});
