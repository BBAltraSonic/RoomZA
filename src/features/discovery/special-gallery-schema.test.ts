import { describe, expect, it } from "vitest";
import { offerContentSchema, offerDraftSchema, parseOfferSubmission, validateOfferRevision } from "@/features/offers/schema";
import { entryContentSchema, entryDraftSchema, parseEntrySubmission, validateEntryRevision } from "@/features/entries/schema";
import { serviceDraftSchema } from "@/features/services/schema";

const photos = Array.from({ length: 20 }, (_, index) => "aaaaaaaa-aaaa-4aaa-8aaa-" + String(index).padStart(12, "0"));
const common = { title: "Special", areaId: photos[0], address: "Cape Town", latitude: -33, longitude: 18, startsAt: "2099-01-01T00:00:00Z", endsAt: "2099-01-02T00:00:00Z" };
describe("Special gallery submission policy", () => {
  it.each(["shopping", "tourism", "event"])("supports legacy reads but requires 1–10 photos for new %s submissions", category => {
    const shopping = category === "shopping";
    const content = shopping ? { ...common, benefit: "Benefit", terms: "Terms", shopName: "Shop" } : { ...common, description: "Description", venueName: "Venue" };
    const schema = shopping ? offerContentSchema : entryContentSchema;
    const draft = shopping ? offerDraftSchema : entryDraftSchema;
    const submit = shopping ? parseOfferSubmission : parseEntrySubmission;
    const review = shopping ? validateOfferRevision : validateEntryRevision;
    expect(schema.safeParse(content).success).toBe(true);
    expect(draft.safeParse({ mediaIds: [] }).success).toBe(true);
    expect(() => review(content, Date.now())).not.toThrow();
    expect(() => submit(content, Date.now())).toThrow("at least one photo");
    for (const count of [1, 10]) {
      const withPhotos = { ...content, mediaIds: photos.slice(0, count), mediaRightsConfirmed: true };
      expect(submit(withPhotos, Date.now()).mediaIds).toEqual(photos.slice(0, count));
      expect(() => submit({ ...withPhotos, mediaRightsConfirmed: false }, Date.now())).toThrow("publish these photos");
    }
    expect(schema.safeParse({ ...content, mediaIds: photos.slice(0, 11) }).success).toBe(false);
    expect(draft.safeParse({ mediaIds: photos.slice(0, 11) }).success).toBe(false);
    expect(schema.safeParse({ ...content, mediaIds: [photos[0], photos[0]] }).success).toBe(false);
  });
  it("retains the twenty-photo Services limit", () => {
    expect(serviceDraftSchema.safeParse({ mediaIds: photos }).success).toBe(true);
  });
});
