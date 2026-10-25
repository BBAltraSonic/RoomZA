import "server-only";

import { publishJsonJob } from "@/lib/qstash";

import type { ImportJobMessage } from "./types";

export async function enqueueImportJob(
  message: ImportJobMessage,
  organizationId: string,
  options: { imageTask?: boolean } = {},
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const delivery = await publishJsonJob(
    `${baseUrl}/api/jobs/imports/process`,
    message,
    `listing-import:${message.jobId}:${message.stage}:${message.cursor}:${message.version}`,
    {
      flowControl: {
        key: `listing-imports:${organizationId}:${options.imageTask ? "images" : "rows"}`,
        parallelism: options.imageTask ? 4 : 1,
      },
    },
  );
  if (delivery.skipped) throw new Error("Listing import processing queue is unavailable.");
  return delivery;
}
