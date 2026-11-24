import type { ListingWriting } from "../business/listing-writer";
import type { BusinessRequest } from "../business/request-intent";
import type { ListerCase } from "./lister-cases";
import type { WritingCase } from "./writing-cases";

/** Flattens a business request into the fields the job 2 test set compares. */
export function requestFields(request: BusinessRequest): Record<string, string | number | boolean | undefined> {
  switch (request.template) {
    case "people_list":
      return { ...request.filters };
    case "change_preview": {
      const { kind, ...rest } = request.change;
      return { change: kind, ...rest };
    }
    case "reminders":
      return request.create ? { reminderText: request.create.text, reminderDue: request.create.due ?? undefined } : {};
    default:
      return {};
  }
}

/** Job 2: the right template, and every expected field with the expected value. */
export function scoreListerCase(example: ListerCase, request: BusinessRequest) {
  const fields = requestFields(request);
  const wrong: string[] = [];
  if (request.template !== example.template) wrong.push(`template ${request.template} (expected ${example.template})`);
  for (const [key, value] of Object.entries(example.expect ?? {})) {
    if (fields[key] !== value) wrong.push(`${key} ${String(fields[key])} (expected ${String(value)})`);
  }
  return { exact: wrong.length === 0, wrong };
}

/** Job 3: the right property type and exactly the features the lister mentioned. */
export function scoreWritingCase(example: WritingCase, writing: ListingWriting) {
  const expected = new Set(example.features);
  const got = new Set(writing.features);
  const missing = [...expected].filter((key) => !got.has(key));
  const extra = [...got].filter((key) => !expected.has(key));
  const typeRight = writing.propertyType === example.propertyType;
  return { exact: typeRight && !missing.length && !extra.length, typeRight, missing, extra };
}
