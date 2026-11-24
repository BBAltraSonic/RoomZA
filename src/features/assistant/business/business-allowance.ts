import "server-only";

import { consumeRateLimit } from "@/lib/rate-limit";

import { getAssistantAiConfig, type AssistantAiConfig } from "../openrouter";
import { ASSISTANT_LIMITS } from "../search-api";

/**
 * Listers get 20 AI requests a day (proposal, "AI provider and limits"), drawn from the same
 * Pinpoint-wide limit as customer search. Only AI calls count: rules answers and every tap
 * on a chip or button are free.
 */
export const LISTER_AI_LIMIT = { requests: 20, window: "1 d" } as const;

export type AiNotice = "allowance_used" | "busy" | "ai_unavailable";

export type AiGrant = { config: AssistantAiConfig; remaining: number } | { config: null; notice: AiNotice };

export async function consumeListerAi(userId: string): Promise<AiGrant> {
  const config = getAssistantAiConfig();
  if (!config) return { config: null, notice: "ai_unavailable" };
  // The shared limit first, so a busy minute doesn't spend the lister's daily allowance.
  const global = await consumeRateLimit({ key: "assistant:global", ...ASSISTANT_LIMITS.global });
  if (!global.success) return { config: null, notice: "busy" };
  // The account ID only keys the allowance. It is never sent to the AI.
  const own = await consumeRateLimit({ key: `assistant:lister:${userId}`, ...LISTER_AI_LIMIT });
  if (!own.success) return { config: null, notice: "allowance_used" };
  return { config, remaining: own.remaining ?? 0 };
}
