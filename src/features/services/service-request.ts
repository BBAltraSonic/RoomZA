import { z } from "zod";
import { serviceSubmissionSchema, type ServiceDraft } from "./schema";

type Submission = z.infer<typeof serviceSubmissionSchema>;
type Input = {
  command: "create" | "save" | "submit" | "withdraw";
  id: string;
  expectedVersion: number;
  draft?: ServiceDraft;
  submittedDraft?: ServiceDraft;
};
const resultSchema = serviceSubmissionSchema.pick({ id: true, version: true, status: true });

export class ServiceRequestError extends Error {
  constructor(message: string, readonly latest?: Submission) { super(message); }
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

function attention(result: { nextPath?: unknown }) {
  if (typeof result?.nextPath === "string" && result.nextPath.startsWith("/") && !result.nextPath.startsWith("//"))
    window.location.assign(result.nextPath);
}

/** Recover only a confirmed owned outcome. A conflict never silently overwrites edits. */
export async function requestService(input: Input, isCurrent = () => true) {
  const { command, id, expectedVersion, draft, submittedDraft } = input;
  const unconfirmed = command === "create"
    ? "Could not confirm this service. Try again to check the saved draft."
    : "Could not confirm this service. Your text is still here. Try again to check the saved version.";
  let failure: Error;
  let recover = true;
  try {
    const response = await fetch("/api/private/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, id, expectedVersion, ...(draft ? { draft } : {}), permissionConfirmed: command === "submit" }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== "object") {
      recover = response.status === 409 || response.status >= 500 || !result || typeof result !== "object";
      if (isCurrent()) attention(result);
      throw new Error(typeof result?.error === "string" ? result.error : unconfirmed);
    }
    const checked = resultSchema.safeParse(result);
    if (!checked.success) throw new Error(unconfirmed);
    const parsed = checked.data;
    const status = command === "submit" ? "submitted" : command === "withdraw" ? "withdrawn" : "draft";
    if (parsed.id !== id || parsed.version !== expectedVersion + 1 || parsed.status !== status)
      throw new Error("The saved service could not be confirmed. Your text is still here.");
    return parsed;
  } catch (error) {
    failure = error instanceof Error ? error : new Error("Could not save this service. Your text is still here.");
  }
  if (!recover || !isCurrent()) throw failure;
  let latest: Submission | undefined;
  try {
    const response = await fetch(`/api/private/services?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (isCurrent()) attention(result);
    if (response.ok && isCurrent()) {
      const parsed = serviceSubmissionSchema.parse(result.item);
      if (parsed.id === id) latest = parsed;
    }
  } catch { /* Keep the original error and all unsaved text if recovery is unavailable. */ }
  if (latest && isCurrent()) {
    if (command === "create") return resultSchema.parse(latest);
    if (latest.version === expectedVersion + 1 && (
      (command === "save" && latest.status === "draft" && canonical(latest.draft) === canonical(draft)) ||
      (command === "submit" && latest.status === "submitted" && canonical(latest.submitted) === canonical(submittedDraft)) ||
      (command === "withdraw" && latest.status === "withdrawn")
    )) return resultSchema.parse(latest);
  }
  throw new ServiceRequestError(failure.message, latest);
}
