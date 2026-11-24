import "server-only";

import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

import { combineRulesAndAi, getAssistantAiConfig, interpretSearchWithAi } from "./ai-search";
import { stripContactDetails } from "./privacy";
import {
  applyChipsToParams,
  chipLabel,
  chipsFromParams,
  parseSearchText,
  type SearchGap,
} from "./search-intent";

/**
 * Allowances (proposal, "AI provider and limits"). One OpenRouter limit is shared by all of
 * Pinpoint, so per-person daily allowances share it out. Only AI calls count: anything the
 * rules understand, and every chip tap, is free and unlimited.
 */
export const ASSISTANT_LIMITS = {
  global: { requests: 18, window: "60 s" },
  guest: { requests: 3, window: "1 d" },
  signedIn: { requests: 10, window: "1 d" },
} as const;

const searchInputSchema = z.object({
  text: z.string().trim().min(1).max(300),
  /** The current discovery query string. Chips are read from it; nothing else is used. */
  current: z.string().max(2000),
  /** A random ID kept on the device, used only to share out the guest allowance. */
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

export type AssistantSearchNotice = "allowance_used" | "busy" | "ai_unavailable";

export type AssistantSearchResponse = {
  /** The discovery query string to apply. */
  query: string;
  gaps: SearchGap[];
  source: "rules" | "ai";
  notEnglish: boolean;
  notice?: AssistantSearchNotice;
  /** AI searches left today, when the AI was asked. */
  remaining?: number;
};

export async function assistantSearch(request: Request) {
  const requestId = getRequestId(request);
  const parsed = searchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "That request could not be read." }, 422, { requestId });
  }

  const text = stripContactDetails(parsed.data.text);
  const currentParams = new URLSearchParams(parsed.data.current);
  const currentChips = chipsFromParams(currentParams);
  const rules = parseSearchText(text, currentChips);

  const respond = (body: AssistantSearchResponse) =>
    apiSuccess(body, { requestId, headers: { "cache-control": "private, no-store" } });
  const rulesAnswer = (notice?: AssistantSearchNotice): AssistantSearchResponse => ({
    query: applyChipsToParams(currentParams, rules.chips).toString(),
    gaps: rules.gaps,
    source: "rules",
    notEnglish: rules.notEnglish,
    ...(notice ? { notice } : {}),
  });

  if (rules.notEnglish || !rules.needsAi) return respond(rulesAnswer());

  const config = getAssistantAiConfig();
  if (!config) return respond(rulesAnswer("ai_unavailable"));

  // The shared limit first, so a busy minute doesn't spend anyone's daily allowance.
  const global = await consumeRateLimit({ key: "assistant:global", ...ASSISTANT_LIMITS.global });
  if (!global.success) return respond(rulesAnswer("busy"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The account ID only keys the allowance. It is never sent to the AI.
  const allowances = user
    ? [consumeRateLimit({ key: `assistant:user:${user.id}`, ...ASSISTANT_LIMITS.signedIn })]
    : [
        consumeRateLimit({ key: `assistant:guest-ip:${getClientIp(request)}`, ...ASSISTANT_LIMITS.guest }),
        consumeRateLimit({ key: `assistant:guest-device:${parsed.data.deviceId}`, ...ASSISTANT_LIMITS.guest }),
      ];
  const results = await Promise.all(allowances);
  if (results.some((result) => !result.success)) return respond(rulesAnswer("allowance_used"));
  const remaining = Math.min(...results.map((result) => result.remaining ?? 0));

  const outcome = await interpretSearchWithAi({ text, currentChipLabels: currentChips.map(chipLabel) }, config);
  if (!outcome.ok) {
    logger.warn("assistant.search.ai_unavailable", { requestId });
    return respond({ ...rulesAnswer("ai_unavailable"), remaining });
  }

  const combined = combineRulesAndAi(text, currentChips, outcome.result);
  if (combined.notEnglish) return respond({ ...rulesAnswer(), notEnglish: true, remaining });
  const { chips, gaps } = combined;

  logger.info("assistant.search.ai_answer", { requestId, model: outcome.model, chipCount: chips.length, gapKeys: gaps.map((gap) => gap.key) });
  return respond({
    query: applyChipsToParams(currentParams, chips).toString(),
    gaps,
    source: "ai",
    notEnglish: false,
    remaining,
  });
}
