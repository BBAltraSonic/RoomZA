import { describe, expect, it } from "vitest";
import { specialUrlSchema } from "./special-link-schema";
import { entryDraftFormValues, formEntryDraft } from "@/features/entries/entry-draft-form";
import { draftFormValues, formOfferDraft } from "@/features/offers/offer-draft-form";
describe("Special links", () => {
  it.each(["http://example.com", "javascript:alert(1)", "//example.com", "https://user:secret@example.com", "https://", "https://example.com/a b", "https://example.com\\evil", "https://example.com/" + "x".repeat(2048)])("rejects unsafe or invalid URL %s", value => {
    expect(specialUrlSchema.safeParse(value).success).toBe(false);
  });
  it("retains paths, queries and fragments identifying a particular post", () => {
    expect(specialUrlSchema.parse(" https://example.com/events/123?ticket=adult#book ")).toBe("https://example.com/events/123?ticket=adult#book");
  });
  it("round-trips both draft forms and omits empty links without requiring them on old posts", () => {
    const links = { visitUrl: "https://example.com/post", bookingUrl: "https://example.com/book" };
    expect(formEntryDraft(entryDraftFormValues(links), null)).toEqual(links);
    expect(formOfferDraft(draftFormValues(links), null)).toEqual(links);
    expect(formEntryDraft({ ...entryDraftFormValues(links), visitUrl: " ", bookingUrl: "" }, null)).toEqual({});
    expect(formOfferDraft(draftFormValues({ title: "Old post" }), null)).toEqual({ title: "Old post" });
  });
});
