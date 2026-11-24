import "server-only";

import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

import { emptyMemory, isMemoryEmpty, memoryToJson, sanitizeMemory, type AssistantMemory } from "./memory";

/**
 * Account memory for signed-in customers. Reads and writes go through the person's own
 * session, so row security keeps each account to its own row. Nothing here reaches the AI.
 */

const noStore = { "cache-control": "private, no-store" };
const putSchema = z.object({ memory: z.unknown() });

export type AccountMemoryResponse = { memory: ReturnType<typeof memoryToJson> };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

function respond(requestId: string, memory: AssistantMemory) {
  return apiSuccess<AccountMemoryResponse>({ memory: memoryToJson(memory) }, { requestId, headers: noStore });
}

function signedOut(requestId: string) {
  return apiFailure({ code: "unauthorized", message: "Sign in to keep memory in your account." }, 401, { requestId, headers: noStore });
}

export async function readAccountMemory(request: Request) {
  const requestId = getRequestId(request);
  const session = await signedIn();
  if (!session) return signedOut(requestId);
  const { data, error } = await session.supabase.from("assistant_memory").select("memory").eq("user_id", session.user.id).maybeSingle();
  if (error) {
    logger.warn("assistant.memory.read_failed", { requestId });
    return apiFailure({ code: "server_error", message: "Memory could not be loaded." }, 503, { requestId, headers: noStore });
  }
  return respond(requestId, data ? sanitizeMemory(data.memory) : emptyMemory());
}

export async function writeAccountMemory(request: Request) {
  const requestId = getRequestId(request);
  const body = putSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiFailure({ code: "validation_failed", message: "That memory could not be read." }, 422, { requestId, headers: noStore });
  const session = await signedIn();
  if (!session) return signedOut(requestId);
  const memory = sanitizeMemory(body.data.memory);
  const { error } = isMemoryEmpty(memory)
    ? await session.supabase.from("assistant_memory").delete().eq("user_id", session.user.id)
    : await session.supabase
        .from("assistant_memory")
        .upsert({ user_id: session.user.id, memory: memoryToJson(memory) as unknown as Json }, { onConflict: "user_id" });
  if (error) {
    logger.warn("assistant.memory.write_failed", { requestId });
    return apiFailure({ code: "server_error", message: "Memory could not be saved." }, 503, { requestId, headers: noStore });
  }
  return respond(requestId, memory);
}

export async function forgetAccountMemory(request: Request) {
  const requestId = getRequestId(request);
  const session = await signedIn();
  if (!session) return signedOut(requestId);
  const { error } = await session.supabase.from("assistant_memory").delete().eq("user_id", session.user.id);
  if (error) return apiFailure({ code: "server_error", message: "Memory could not be cleared." }, 503, { requestId, headers: noStore });
  return respond(requestId, emptyMemory());
}
