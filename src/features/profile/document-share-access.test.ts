import { describe, expect, it } from "vitest";
import { canOpenDocumentShare } from "./document-share-access";
describe("private document share relations", () => {
  it("handles actual object relations and refuses another landlord", () => {
    const share = [{ grantee_id: null, application: { listing: { landlord_id: "owner" } } }];
    expect(canOpenDocumentShare(share,"owner")).toBe(true);
    expect(canOpenDocumentShare(share,"other")).toBe(false);
  });
  it("handles missing relations and explicit recipients", () => {
    expect(canOpenDocumentShare([{ grantee_id: null, application: null }],"owner")).toBe(false);
    expect(canOpenDocumentShare([{ grantee_id: "owner", application: null }],"owner")).toBe(true);
  });
});
