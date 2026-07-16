import "server-only";

import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";
import { sanitizeAuditMetadata } from "./audit-sanitize";

type AuditInput = {
  actorId: string | null;
  actionKey: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function appendAdminAudit(input: AuditInput) {
  const admin = createUntypedClient();
  const { error } = await admin.from("admin_audit_events").insert({
    actor_id: input.actorId,
    action_key: input.actionKey,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    reason: input.reason ?? null,
    request_id: input.requestId ?? null,
    metadata: sanitizeAuditMetadata(input.metadata),
  });

  if (error) {
    logger.error("Admin audit insert failed", {
      requestId: input.requestId,
      actorId: input.actorId,
      targetId: input.targetId,
      actionKey: input.actionKey,
      error,
    });
    throw new Error("The privileged action could not be audited.");
  }
}
