import "server-only";

import type { z } from "zod";

/**
 * One way to ask OpenRouter for a short structured answer, shared by every AI job. Each job
 * pins its models (main plus at most two fallbacks), asks for strict JSON, forbids providers
 * that train on prompts unless configured otherwise, and checks the answer with a schema.
 * Any failure ends in "unavailable", never an exception, so every feature can fall back.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "nvidia/nemotron-3.5-super-vl:free";
const ATTEMPT_TIMEOUT_MS = 7_000;

export type AssistantAiConfig = {
  apiKey: string;
  models: string[];
  dataCollection: "deny" | "allow";
};

export function getAssistantAiConfig(): AssistantAiConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  const models = (process.env.ASSISTANT_AI_MODELS ?? DEFAULT_MODEL)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)
    .slice(0, 3);
  return {
    apiKey,
    models: models.length ? models : [DEFAULT_MODEL],
    dataCollection: process.env.OPENROUTER_DATA_COLLECTION === "allow" ? "allow" : "deny",
  };
}

export type StructuredOutcome<T> = { ok: true; model: string; result: T } | { ok: false; reason: "unavailable" };

function parseCompletion<T>(payload: unknown, schema: z.ZodType<T>): T | null {
  const content = (payload as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return null;
  // Some models wrap JSON in a code fence despite structured output.
  const json = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function askStructured<T>(
  request: { system: string; user: string; name: string; jsonSchema: object; schema: z.ZodType<T>; maxTokens: number; temperature?: number },
  config: AssistantAiConfig,
): Promise<StructuredOutcome<T>> {
  for (const model of config.models) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "Pinpoint",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: { type: "json_schema", json_schema: { name: request.name, strict: true, schema: request.jsonSchema } },
          provider: { require_parameters: true, data_collection: config.dataCollection },
          temperature: request.temperature ?? 0,
          max_tokens: request.maxTokens,
        }),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const result = parseCompletion(await response.json().catch(() => null), request.schema);
      if (result !== null) return { ok: true, model, result };
    } catch {
      // Timeout or network failure: try the next model.
    }
  }
  return { ok: false, reason: "unavailable" };
}
