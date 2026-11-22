import { config, type core } from "zod";

/**
 * The app's zod. Use `import * as z from "@/lib/zod"` instead of importing
 * "zod" directly, so every schema gets the plain-language default messages
 * below.
 *
 * zod 4's built-in defaults are written for developers ("Too small: expected
 * string to have >=1 characters"). Schemas that pass their own message keep
 * it: a schema-level message always wins over this fallback.
 *
 * This module re-exports zod's named exports (`export *`) rather than the `z`
 * namespace object: re-exporting the object stops webpack tree-shaking and
 * ships every zod locale to the browser (~450 KB).
 */

const ITEM_ORIGINS = new Set(["array", "set"]);

function isMissing(input: unknown) {
  return input === undefined || input === null || input === "";
}

function plural(count: number | bigint, word: string) {
  return `${count} ${word}${Number(count) === 1 ? "" : "s"}`;
}

const FORMAT_MESSAGES: Record<string, string> = {
  email: "Enter a valid email address",
  url: "Enter a valid URL",
  uuid: "Invalid ID",
  guid: "Invalid ID",
  datetime: "Enter a valid date and time",
  date: "Enter a valid date",
  time: "Enter a valid time",
};

export const friendlyZodMessage: core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (isMissing(issue.input)) return "Required";
      if (issue.expected === "int" && typeof issue.input === "number" && Number.isFinite(issue.input)) {
        return "Must be a whole number";
      }
      if (issue.expected === "number" || issue.expected === "int") return "Enter a number";
      return `Expected ${issue.expected}`;

    case "too_small": {
      const { origin, minimum, inclusive } = issue;
      if (origin === "string") {
        return Number(minimum) <= 1 ? "Required" : `Must be at least ${plural(minimum, "character")}`;
      }
      if (ITEM_ORIGINS.has(origin)) {
        return Number(minimum) <= 1 ? "Select at least one" : `Select at least ${minimum}`;
      }
      if (origin === "number" || origin === "int" || origin === "bigint") {
        return inclusive ? `Must be ${minimum} or more` : `Must be more than ${minimum}`;
      }
      return undefined;
    }

    case "too_big": {
      const { origin, maximum, inclusive } = issue;
      if (origin === "string") return `Must be at most ${plural(maximum, "character")}`;
      if (ITEM_ORIGINS.has(origin)) return `Select no more than ${maximum}`;
      if (origin === "number" || origin === "int" || origin === "bigint") {
        return inclusive ? `Must be ${maximum} or less` : `Must be less than ${maximum}`;
      }
      return undefined;
    }

    case "invalid_format":
      return FORMAT_MESSAGES[issue.format] ?? "Invalid format";

    case "invalid_value":
      return "Select a valid option";

    case "not_multiple_of":
      return issue.divisor === 1 ? "Must be a whole number" : `Must be a multiple of ${issue.divisor}`;

    default:
      return undefined;
  }
};

config({ customError: friendlyZodMessage });

export * from "zod";
