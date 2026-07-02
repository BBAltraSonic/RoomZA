import { describe, expect, it } from "vitest";

import { sanitizeUserText } from "@/lib/sanitize";

describe("sanitizeUserText", () => {
  it("strips executable script content before rendering user text", () => {
    expect(sanitizeUserText('Hello <script>alert("xss")</script><img src=x onerror=alert(1)> javascript:alert(1)')).toBe(
      "Hello <img src=x>",
    );
  });

  it("removes control characters and trims whitespace", () => {
    expect(sanitizeUserText(" \u0000hello\u0007 ")).toBe("hello");
  });
});
