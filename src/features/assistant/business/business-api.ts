import "server-only";

import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";

import { stripContactDetails } from "../privacy";
import { aiResultToRequest, routeListerRequestWithAi } from "./ai-lister";
import { consumeListerAi, type AiNotice } from "./business-allowance";
import { getListerContext, loadListerData } from "./business-data";
import { buildViewFromData, type BusinessView } from "./business-view";
import { parseBusinessText, type BusinessRequest } from "./request-intent";
import { businessRequestSchema } from "./request-schema";

/**
 * POST /api/assistant/business: what a lister typed -> one filled template (proposal,
 * "Business mode"). Rules first. Only what they can't place goes to the AI, as the typed
 * words with contact details stripped and the lister's people's names masked; it never sees
 * a record. The answer is checked, and anything doubtful falls back to Today. This route
 * reads only: changes come back as a preview and reminders as a draft.
 */

const inputSchema = z.object({ text: z.string().trim().min(1).max(300) }).strict();
const noStore = { "cache-control": "private, no-store" };

export type BusinessAssistantResponse = {
  request: BusinessRequest;
  view: BusinessView;
  source: "rules" | "ai";
  notice?: AiNotice;
  /** AI requests left today, when the AI was asked. */
  remaining?: number;
};

export async function assistantBusiness(request: Request) {
  const requestId = getRequestId(request);
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiFailure({ code: "validation_failed", message: "That request could not be read." }, 422, { requestId, headers: noStore });

  const lister = await getListerContext();
  if (!lister) return apiFailure({ code: "unauthorized", message: "Sign in to use the assistant." }, 401, { requestId, headers: noStore });

  const text = stripContactDetails(parsed.data.text);
  const data = await loadListerData(lister);
  const rules = parseBusinessText(text, {
    people: data.people.map((person) => ({ key: person.key, name: person.name })),
    listings: data.listings.map((listing) => ({ id: listing.id, title: listing.title })),
  });

  let remaining: number | undefined;
  let notice: AiNotice | undefined;
  // The notice is about routing what was typed. A screen that uses the AI itself (writing a
  // listing) says so on the screen, so its allowance never sets the routing notice.
  const viewAllowance = async () => {
    const grant = await consumeListerAi(lister.userId);
    if (grant.config) remaining = grant.remaining;
    return grant.config;
  };
  const respond = async (businessRequest: BusinessRequest, source: "rules" | "ai") => {
    const view = await buildViewFromData(businessRequest, lister, data, { ai: viewAllowance });
    const body: BusinessAssistantResponse = { request: businessRequest, view, source, ...(notice ? { notice } : {}), ...(remaining !== undefined ? { remaining } : {}) };
    return apiSuccess(body, { requestId, headers: noStore });
  };

  if (rules.request) return respond(rules.request, "rules");

  const grant = await consumeListerAi(lister.userId);
  if (!grant.config) {
    notice = grant.notice;
    return respond({ template: "today" }, "rules");
  }
  remaining = grant.remaining;
  const config = grant.config;
  const outcome = await routeListerRequestWithAi(rules.textForAi, config);
  if (!outcome.ok) {
    logger.warn("assistant.business.ai_unavailable", { requestId });
    notice = "ai_unavailable";
    return respond({ template: "today" }, "rules");
  }
  // The masked text, never the original, becomes a new listing's notes for the writing job.
  const routed = businessRequestSchema.safeParse(aiResultToRequest(outcome.result, rules.textForAi));
  logger.info("assistant.business.ai_answer", { requestId, model: outcome.model, template: routed.success ? routed.data.template : "rejected" });
  return respond(routed.success ? routed.data : { template: "today" }, "ai");
}
