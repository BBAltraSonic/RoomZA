import { describe, expect, it } from "vitest";

import {
  MAX_APPLICATION_DOCUMENT_BYTES,
  MAX_APPLICATION_DOCUMENTS,
  validateApplicationDocuments,
} from "./document-bounds";

function file(type: string, size: number) {
  return { type, size } as File;
}

describe("validateApplicationDocuments", () => {
  it("accepts supported files up to 10 MB and up to 20 documents", () => {
    const documents = Array.from({ length: MAX_APPLICATION_DOCUMENTS }, (_, index) => ({
      field: `document-${index}`,
      file: file("application/pdf", MAX_APPLICATION_DOCUMENT_BYTES),
    }));

    expect(validateApplicationDocuments(documents)).toEqual({ valid: true });
  });

  it("rejects unsupported document types with field indication", () => {
    expect(validateApplicationDocuments([{ field: "idDocument", file: file("application/msword", 1024) }])).toEqual({
      valid: false,
      fieldErrors: { idDocument: ["Documents must be PDF, JPEG, or PNG files."] },
    });
  });

  it("rejects documents larger than 10 MB with field indication", () => {
    expect(validateApplicationDocuments([{ field: "payslipDocument", file: file("application/pdf", MAX_APPLICATION_DOCUMENT_BYTES + 1) }])).toEqual({
      valid: false,
      fieldErrors: { payslipDocument: ["Document must be 10 MB or smaller."] },
    });
  });

  it("rejects more than 20 documents with a form-level indication", () => {
    const documents = Array.from({ length: MAX_APPLICATION_DOCUMENTS + 1 }, (_, index) => ({
      field: `document-${index}`,
      file: file("image/png", 1024),
    }));

    expect(validateApplicationDocuments(documents)).toEqual({
      valid: false,
      fieldErrors: { _form: ["Upload no more than 20 documents per application."] },
    });
  });
});
