import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const queryFiles = [
  "src/features/trust/acceptance.ts",
  "src/features/trust/admin-actions.ts",
  "src/features/trust/privacy-export.ts",
  "src/features/trust/settings-data.ts",
];

describe("trust document PostgREST relationships", () => {
  it("disambiguates the version-to-document relationship in every embedded query", () => {
    const source = queryFiles
      .map((file) => readFileSync(path.resolve(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/document:trust_documents\(/);
    expect(
      source.match(
        /document:trust_documents!trust_document_versions_document_id_fkey\(/g,
      ),
    ).toHaveLength(6);
  });
});
