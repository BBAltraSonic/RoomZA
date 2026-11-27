"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateApplicationStatus } from "@/features/applications/actions";
import { changeListingDescription, changeListingPrice, unpublishListing } from "@/features/listings/actions";
import { acceptShowing, declineShowing } from "@/features/showings/actions";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";

import { consumeListerAi } from "./business-allowance";
import { stripContactDetails } from "../privacy";
import { canManageListing, getListerContext, loadListerData, previewInputFrom, type ListerContext } from "./business-data";
import { buildViewFromData, type BusinessView } from "./business-view";
import { buildChangePreview, loggedAction, NEEDS_OWNER_OR_ADMIN, selectForApproval, type ChangeItem, type ChangeStep } from "./change-preview";
import { checkAiWriting, writingInputFromListing, type WritableListing } from "./listing-writer";
import { reminderDueAt, snoozedUntil } from "./reminder-times";
import { businessRequestSchema, changeRequestSchema, personKeySchema } from "./request-schema";

/**
 * Business mode's server functions. Each one checks the session itself (they can be called
 * directly), reads through the lister's own login, and changes something only when the lister
 * tapped Approve, Done, Snooze or Save. Approve runs Pinpoint's existing actions, which keep
 * their own permission checks, and records who approved what.
 */

const SIGN_IN = "Sign in to use the assistant.";

/** Fills a template for a chip or button tap. Only `new_listing` may use the AI allowance. */
export async function getBusinessView(request: unknown): Promise<ActionResult<BusinessView>> {
  const parsed = businessRequestSchema.safeParse(request);
  if (!parsed.success) return actionFailure("That request could not be read.");
  const lister = await getListerContext();
  if (!lister) return actionFailure(SIGN_IN);
  const data = await loadListerData(lister);
  const view = await buildViewFromData(parsed.data, lister, data, {
    ai: async () => {
      const grant = await consumeListerAi(lister.userId);
      return grant.config;
    },
  });
  return actionSuccess(view);
}

// Reminders ------------------------------------------------------------------------------------

const reminderInputSchema = z.object({
  note: z.string().trim().min(1).max(200),
  due: z.enum(["today", "tomorrow", "next-week", "friday"]).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  personKey: personKeySchema.optional(),
}).strict().refine((value) => (value.due === undefined) !== (value.dueAt === undefined), "Choose when.");

export type SavedReminder = { id: string; note: string; dueAt: string };

export async function createReminder(input: unknown): Promise<ActionResult<SavedReminder>> {
  const parsed = reminderInputSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Write what to be reminded about and when.");
  const lister = await getListerContext();
  if (!lister) return actionFailure(SIGN_IN);
  const now = new Date();
  const dueAt = parsed.data.due ? reminderDueAt(parsed.data.due, now) : new Date(parsed.data.dueAt!);
  if (dueAt.getTime() > now.getTime() + 366 * 86_400_000) return actionFailure("Choose a time within the next year.");

  let subject: { customer_id: string; listing_id: string } | null = null;
  if (parsed.data.personKey) {
    const [customerId, listingId] = parsed.data.personKey.split(":") as [string, string];
    subject = { customer_id: customerId, listing_id: listingId };
  }
  const { data, error } = await lister.supabase
    .from("assistant_reminders")
    .insert({ note: parsed.data.note, due_at: dueAt.toISOString(), ...(subject ?? {}) })
    .select("id,note,due_at")
    .single();
  if (error || !data) {
    logger.warn("assistant.business.reminder_create_failed", { error: error?.message });
    return actionFailure("The reminder couldn't be saved. Try again.");
  }
  return actionSuccess({ id: data.id, note: data.note, dueAt: data.due_at });
}

const reminderIdSchema = z.string().uuid();

async function changeReminder(id: unknown, change: { due_at?: string; done_at?: string }): Promise<ActionResult<SavedReminder>> {
  const parsed = reminderIdSchema.safeParse(id);
  if (!parsed.success) return actionFailure("That reminder could not be found.");
  const lister = await getListerContext();
  if (!lister) return actionFailure(SIGN_IN);
  // Row security limits this to the member's own reminders.
  const { data, error } = await lister.supabase.from("assistant_reminders").update(change).eq("id", parsed.data).select("id,note,due_at").maybeSingle();
  if (error) return actionFailure("The reminder couldn't be changed. Try again.");
  if (!data) return actionFailure("That reminder could not be found.");
  return actionSuccess({ id: data.id, note: data.note, dueAt: data.due_at });
}

export async function snoozeReminder(id: unknown, choice: unknown): Promise<ActionResult<SavedReminder>> {
  const parsed = z.enum(["tomorrow", "next-week"]).safeParse(choice);
  if (!parsed.success) return actionFailure("Choose tomorrow or next week.");
  return changeReminder(id, { due_at: snoozedUntil(parsed.data, new Date()).toISOString() });
}

export async function completeReminder(id: unknown): Promise<ActionResult<SavedReminder>> {
  return changeReminder(id, { done_at: new Date().toISOString() });
}

export async function deleteReminder(id: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = reminderIdSchema.safeParse(id);
  if (!parsed.success) return actionFailure("That reminder could not be found.");
  const lister = await getListerContext();
  if (!lister) return actionFailure(SIGN_IN);
  const { data, error } = await lister.supabase.from("assistant_reminders").delete().eq("id", parsed.data).select("id").maybeSingle();
  if (error) return actionFailure("The reminder couldn't be deleted. Try again.");
  if (!data) return actionFailure("That reminder could not be found.");
  return actionSuccess({ id: data.id });
}

// Approve --------------------------------------------------------------------------------------

export type ApprovalResult = { id: string; label: string; ok: boolean; message: string };

async function runStep(step: ChangeStep): Promise<ActionResult<unknown>> {
  switch (step.type) {
    case "accept_showing":
      return acceptShowing(step.showingId);
    case "decline_showing":
      return declineShowing(step.showingId);
    case "application_status":
      return updateApplicationStatus(step.applicationId, step.to);
    case "archive_person":
      // Archiving is the log entry itself: the person just leaves the assistant's lists.
      return actionSuccess(undefined);
    case "mark_let":
      return unpublishListing(step.listingId, step.expectedUpdatedAt);
    case "change_price":
      return changeListingPrice(step.listingId, step.expectedUpdatedAt, step.to);
  }
}

async function logApproval(lister: ListerContext, item: ChangeItem) {
  const action = loggedAction(item.step);
  if (!action || !item.personKey) return true;
  const [customerId, listingId] = item.personKey.split(":") as [string, string];
  const { error } = await lister.supabase
    .from("assistant_action_log")
    .insert({ customer_id: customerId, action, listing_id: listingId });
  if (error) logger.warn("assistant.business.log_failed", { action, error: error.message });
  return !error;
}

/**
 * Runs the approved items of a change. The preview is built again from fresh data and only
 * items found there run, so the browser can't add, alter or replay an item. Items run one
 * after another and each reports its own outcome.
 */
export async function approveChange(change: unknown, itemIds: unknown): Promise<ActionResult<{ results: ApprovalResult[] }>> {
  const parsedChange = changeRequestSchema.safeParse(change);
  const parsedIds = z.array(z.string().min(1).max(200)).max(50).safeParse(itemIds);
  if (!parsedChange.success || !parsedIds.success) return actionFailure("That change could not be read.");
  const lister = await getListerContext();
  if (!lister) return actionFailure(SIGN_IN);

  const data = await loadListerData(lister);
  const preview = buildChangePreview(parsedChange.data, previewInputFrom(lister, data));
  const selection = selectForApproval(preview, parsedIds.data);
  if (!selection.ok) return actionFailure(selection.reason);

  const results: ApprovalResult[] = [];
  for (const item of selection.items) {
    const outcome = await runStep(item.step);
    if (!outcome.success) {
      results.push({ id: item.id, label: item.label, ok: false, message: outcome.error });
      continue;
    }
    const logged = await logApproval(lister, item);
    // For an archive the log is the change, so a failed write means nothing happened.
    if (!logged && item.step.type === "archive_person") results.push({ id: item.id, label: item.label, ok: false, message: "Couldn't archive. Try again." });
    else results.push({ id: item.id, label: item.label, ok: true, message: "Done" });
  }
  logger.info("assistant.business.approved", { kind: parsedChange.data.kind, items: results.length, failed: results.filter((result) => !result.ok).length });
  revalidatePath("/post/listings");
  return actionSuccess({ results });
}

// Improve a description -------------------------------------------------------------------------

const improveSchema = z.object({
  listingId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  description: z.string().trim().min(20).max(2000),
}).strict();

/**
 * Applies a suggested description after the lister tapped Approve. The text is checked again
 * against the listing's current public details, so it can't carry a number the listing doesn't
 * give or any contact details, and the save is version-checked like the edit form.
 */
export async function applyImprovedDescription(input: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  const parsed = improveSchema.safeParse(input);
  if (!parsed.success) return actionFailure("That description could not be read.");
  const lister = await getListerContext();
  if (!lister) return actionFailure(SIGN_IN);

  const { data: listing } = await lister.supabase
    .from("listings")
    .select("title,description,property_type,listing_type,bedrooms,bathrooms,price,sale_price,metadata,landlord_id,organization_id")
    .eq("id", parsed.data.listingId)
    .maybeSingle();
  if (!listing) return actionFailure("That listing could not be found.");
  if (!canManageListing(lister, listing)) return actionFailure(NEEDS_OWNER_OR_ADMIN);
  if (stripContactDetails(parsed.data.description) !== parsed.data.description) return actionFailure("Descriptions can't include contact details.");
  const writable = listing as unknown as WritableListing;
  if (!checkAiWriting({ title: writable.title, description: parsed.data.description, features: [], propertyType: null }, writingInputFromListing(writable))) {
    return actionFailure("That description mentions a detail the listing doesn't give. Edit it in the listing form.");
  }
  const saved = await changeListingDescription(parsed.data.listingId, parsed.data.expectedUpdatedAt, parsed.data.description);
  if (!saved.success) return saved;
  logger.info("assistant.business.description_applied", { listingId: parsed.data.listingId });
  revalidatePath("/post/listings");
  return actionSuccess({ updatedAt: saved.data.updatedAt });
}
