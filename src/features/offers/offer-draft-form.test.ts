import { describe, expect, it } from "vitest";
import { draftFormValues, formOfferDraft, offerLocalInput } from "./offer-draft-form";
import { parseOfferSubmission } from "./schema";

describe("South African private draft form", () => {
  it("preserves incomplete drafts and removes cleared fields", () => {
    const values = draftFormValues({ title: "Original" });
    values.title = " "; values.benefit = " New benefit ";
    expect(formOfferDraft(values, null)).toEqual({ benefit: "New benefit" });
  });
  it("uses South Africa time independently of the device timezone", () => {
    expect(offerLocalInput("2026-10-02T22:30:00Z")).toBe("2026-10-03T00:30:00");
    const values = draftFormValues({ startsAt: "2026-10-02T22:30:00Z" });
    expect(Date.parse(formOfferDraft(values, null).startsAt!)).toBe(Date.parse("2026-10-02T22:30:00Z"));
  });
  it("does not turn a missing coordinate into zero or accept non-finite input", () => {
    const values = draftFormValues({});
    expect(formOfferDraft(values, null)).toEqual({});
    values.latitude = "Infinity";
    expect(() => formOfferDraft(values, null)).toThrow();
  });
  it("requires full content only at submission and rejects reversed or ended dates", () => {
    expect(formOfferDraft(draftFormValues({ title: "Partial" }), null)).toEqual({ title: "Partial" });
    expect(() => parseOfferSubmission({ title: "Partial" }, Date.now())).toThrow();
    const full = { title: "Synthetic", benefit: "Fixture", terms: "No redemption", shopName: "Fixture shop", address: "Synthetic", areaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", latitude: -33.9, longitude: 18.4, startsAt: "2026-10-02T12:00:00Z", endsAt: "2026-10-02T11:00:00Z" };
    expect(() => parseOfferSubmission(full, Date.parse("2026-10-01"))).toThrow("after its start");
    expect(() => parseOfferSubmission({ ...full, endsAt: "2026-10-02T13:00:00Z" }, Date.parse("2026-10-02T13:00:00Z"))).toThrow("future");
  });
});
