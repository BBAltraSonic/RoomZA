import type { Database, Json } from "@/lib/supabase/types";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export function buildApplicationStatusChangedNotification({
  applicationId,
  status,
  actorId,
}: {
  applicationId: string;
  status: ApplicationStatus;
  actorId: string;
}) {
  return {
    type: "application_status_changed" as const,
    idempotency_key: `application_status_changed:${applicationId}:${status}`,
    payload: {
      applicationId,
      status,
      actorId,
      message: "Your rental application status changed.",
    } satisfies Json,
  };
}
