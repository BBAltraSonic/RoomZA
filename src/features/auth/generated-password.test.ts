import { describe, expect, it } from "vitest";

import { generatePassword } from "@/features/auth/generated-password";

describe("generatePassword", () => {
  it("generates an 18-character password with each required character group", () => {
    const password = generatePassword();

    expect(password).toHaveLength(18);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*]/);
  });

  it("uses fresh cryptographic random values for each password", () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});
