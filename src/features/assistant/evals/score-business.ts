import type { BusinessRequest } from "../business/request-intent";

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
