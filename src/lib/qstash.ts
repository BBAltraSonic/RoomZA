import { Client } from "@upstash/qstash";

let client: Client | null | undefined;

export function getQstashClient() {
  if (client !== undefined) return client;

  const token = process.env.QSTASH_TOKEN;
  client = token ? new Client({ token }) : null;
  return client;
}

export async function publishJsonJob(url: string, body: unknown, deduplicationId?: string) {
  const qstash = getQstashClient();
  if (!qstash) {
    return { skipped: true as const };
  }

  const result = await qstash.publishJSON({
    url,
    body,
    deduplicationId,
    retries: 3,
  });

  return { skipped: false as const, result };
}
