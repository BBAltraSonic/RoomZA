import { describe, expect, it } from "vitest";
import * as z from "@/lib/zod";

function firstMessage(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected the input to be rejected");
  return result.error.issues[0]?.message;
}

describe("app zod default messages", () => {
  it("says Required for missing or empty values", () => {
    expect(firstMessage(z.object({ name: z.string() }), {})).toBe("Required");
    expect(firstMessage(z.object({ name: z.string() }), { name: null })).toBe("Required");
    expect(firstMessage(z.string().min(1), "")).toBe("Required");
  });

  it("explains length limits in characters", () => {
    expect(firstMessage(z.string().min(8), "short")).toBe("Must be at least 8 characters");
    expect(firstMessage(z.string().max(3), "abcd")).toBe("Must be at most 3 characters");
    expect(firstMessage(z.string().max(1), "ab")).toBe("Must be at most 1 character");
  });

  it("explains number limits and types", () => {
    expect(firstMessage(z.number().min(5), 1)).toBe("Must be 5 or more");
    expect(firstMessage(z.number().positive(), 0)).toBe("Must be more than 0");
    expect(firstMessage(z.number().max(10), 11)).toBe("Must be 10 or less");
    expect(firstMessage(z.coerce.number(), "abc")).toBe("Enter a number");
    expect(firstMessage(z.number().int(), 2.5)).toBe("Must be a whole number");
  });

  it("names the expected format", () => {
    expect(firstMessage(z.string().email(), "nope")).toBe("Enter a valid email address");
    expect(firstMessage(z.string().url(), "nope")).toBe("Enter a valid URL");
    expect(firstMessage(z.string().uuid(), "nope")).toBe("Invalid ID");
    expect(firstMessage(z.string().datetime(), "nope")).toBe("Enter a valid date and time");
  });

  it("asks for a valid option and enough selections", () => {
    expect(firstMessage(z.enum(["a", "b"]), "c")).toBe("Select a valid option");
    expect(firstMessage(z.array(z.string()).min(1), [])).toBe("Select at least one");
    expect(firstMessage(z.array(z.string()).max(2), ["a", "b", "c"])).toBe("Select no more than 2");
  });

  it("keeps a schema's own message", () => {
    expect(firstMessage(z.string().min(1, "Address is required"), "")).toBe("Address is required");
    expect(firstMessage(z.enum(["a"], { message: "Select a listing type" }), "x")).toBe("Select a listing type");
  });
});
