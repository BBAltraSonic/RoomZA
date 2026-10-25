import { expect, it } from "vitest";
import { sameImportSelection } from "./selection";

it("retains explicit membership when IDs are reordered or repeated", () => {
  expect(sameImportSelection(
    { mode: "explicit", included: ["second", "first", "first"] },
    { mode: "explicit", included: ["first", "second"] },
  )).toBe(true);
});

it("retains all-matching membership across equivalent filter and exclusion ordering", () => {
  expect(sameImportSelection(
    { mode: "all_matching", excluded: ["b", "a"], filter: { query: "HOME", states: ["warning", "draft_ready"], severities: ["warning", "blocking"] } },
    { mode: "all_matching", excluded: ["a", "b"], filter: { severities: ["blocking", "warning"], states: ["draft_ready", "warning"], query: "home", duplicateOnly: false } },
  )).toBe(true);
});

it("distinguishes a narrowed explicit selection from its preparation", () => {
  expect(sameImportSelection({ mode: "explicit", included: [] }, { mode: "explicit", included: ["chosen"] })).toBe(false);
});

it("distinguishes changed filters, exclusions and selection modes", () => {
  const prepared = { mode: "all_matching" as const, excluded: [], filter: { states: ["draft_ready" as const] } };
  expect(sameImportSelection(prepared, { ...prepared, filter: { states: ["published"] } })).toBe(false);
  expect(sameImportSelection(prepared, { ...prepared, excluded: ["chosen"] })).toBe(false);
  expect(sameImportSelection(prepared, { mode: "explicit", included: [] })).toBe(false);
});
