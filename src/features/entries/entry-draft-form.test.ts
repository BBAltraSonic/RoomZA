import { describe, expect, it } from "vitest";
import { entryDraftFormValues, entryLocalInput, formEntryDraft } from "./entry-draft-form";

const areaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
describe("private entry form conversion", () => {
  it("converts SAST input independently of the browser timezone", () => {
    const draft = formEntryDraft({ title: "Venue", description: "Open hours", venueName: "Hall", address: "Road",
      latitude: "-33.9", longitude: "18.4", startsAt: "2035-10-03T08:30", endsAt: "2035-10-03T10:30" }, areaId);
    expect(draft.startsAt).toBe("2035-10-03T08:30:00+02:00");
    expect(entryDraftFormValues(draft).startsAt).toBe("2035-10-03T08:30:00");
    expect(entryLocalInput("2035-10-03T06:30:00.000Z")).toBe("2035-10-03T08:30:00");
  });
  it("saves partial drafts without manufacturing a place or incomplete numeric value", () => {
    expect(formEntryDraft({ title: " Draft ", description: "", venueName: "", address: "", latitude: "", longitude: "", startsAt: "", endsAt: "" }, null))
      .toEqual({ title: "Draft" });
  });
  it("rejects malformed coordinates rather than silently turning them into null", () => {
    expect(() => formEntryDraft({ title: "", description: "", venueName: "", address: "", latitude: "east", longitude: "", startsAt: "", endsAt: "" }, null)).toThrow();
  });
});
