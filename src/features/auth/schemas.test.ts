import { describe, expect, it } from "vitest";

import { authCredentialsSchema, passwordResetRequestSchema, updatePasswordSchema } from "./schemas";

describe("auth schemas", () => {
  it("normalizes valid credentials", () => {
    expect(authCredentialsSchema.parse({ email: " User@Example.COM ", password: "secret1" })).toEqual({
      email: "user@example.com",
      password: "secret1",
    });
  });

  it("rejects invalid credentials", () => {
    expect(authCredentialsSchema.safeParse({ email: "not-email", password: "secret1" }).success).toBe(false);
    expect(authCredentialsSchema.safeParse({ email: "user@example.com", password: "12345" }).success).toBe(false);
  });

  it("normalizes password reset requests", () => {
    expect(passwordResetRequestSchema.parse({ email: " Reset@Example.COM " })).toEqual({
      email: "reset@example.com",
    });
  });

  it("requires matching reset passwords and a token", () => {
    expect(updatePasswordSchema.safeParse({ token: "tok", password: "secret1", confirmPassword: "secret1" }).success).toBe(true);
    expect(updatePasswordSchema.safeParse({ token: "", password: "secret1", confirmPassword: "secret1" }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({ token: "tok", password: "secret1", confirmPassword: "secret2" }).success).toBe(false);
  });
});
