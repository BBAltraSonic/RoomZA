import { describe, expect, it } from "vitest";

import { evaluateEmailConfig, parseEnvFile } from "./check-email.mjs";

describe("parseEnvFile", () => {
  it("parses key/value pairs and ignores comments and blanks", () => {
    const env = parseEnvFile(
      ["# comment", "", "RESEND_API_KEY=re_abc", 'RESEND_FROM_EMAIL="hi@roomza.co.za"'].join("\n"),
    );
    expect(env.RESEND_API_KEY).toBe("re_abc");
    expect(env.RESEND_FROM_EMAIL).toBe("hi@roomza.co.za");
  });

  it("keeps values that contain '=' intact", () => {
    const env = parseEnvFile("TOKEN=abc=def==");
    expect(env.TOKEN).toBe("abc=def==");
  });
});

describe("evaluateEmailConfig", () => {
  it("flags a missing API key as not ready", () => {
    const result = evaluateEmailConfig({});
    expect(result.ready).toBe(false);
    expect(result.problems.some((p) => p.includes("RESEND_API_KEY"))).toBe(true);
  });

  it("warns about the fallback sender when RESEND_FROM_EMAIL is missing", () => {
    const result = evaluateEmailConfig({ RESEND_API_KEY: "re_abc" });
    expect(result.ready).toBe(true);
    expect(result.usingFallbackFrom).toBe(true);
    expect(result.problems.some((p) => p.includes("RESEND_FROM_EMAIL"))).toBe(true);
  });

  it("is fully ready with no problems when both values are set", () => {
    const result = evaluateEmailConfig({
      RESEND_API_KEY: "re_abc",
      RESEND_FROM_EMAIL: "hi@roomza.co.za",
    });
    expect(result.ready).toBe(true);
    expect(result.usingFallbackFrom).toBe(false);
    expect(result.problems).toHaveLength(0);
  });
});
