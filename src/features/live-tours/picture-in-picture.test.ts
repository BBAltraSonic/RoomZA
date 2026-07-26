import { describe, expect, it, vi } from "vitest";

import { getDocumentPictureInPicture } from "./picture-in-picture";

describe("Document Picture-in-Picture capability", () => {
  it("accepts only an API with requestWindow", () => {
    const requestWindow = vi.fn();
    expect(getDocumentPictureInPicture({ requestWindow })).toEqual({
      requestWindow,
    });
    expect(getDocumentPictureInPicture({})).toBeNull();
    expect(getDocumentPictureInPicture(null)).toBeNull();
  });
});
