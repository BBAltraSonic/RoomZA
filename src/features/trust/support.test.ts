import { describe, expect, it } from "vitest";

import { SUPPORT_EMAIL, supportMailto } from "./support";

describe("supportMailto", () => {
  it("should_address_the_published_support_inbox", () => {
    expect(supportMailto()).toBe(`mailto:${SUPPORT_EMAIL}`);
  });

  it("should_encode_the_subject_so_it_survives_mail_clients", () => {
    expect(supportMailto("Account suspension & review")).toBe(
      `mailto:${SUPPORT_EMAIL}?subject=Account%20suspension%20%26%20review`,
    );
  });
});
