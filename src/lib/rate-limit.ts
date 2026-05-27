import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitOptions = {
  key: string;
  requests: number;
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`;
};

let redis: Redis | null | undefined;

function getRedis() {
  if (redis !== undefined) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

export async function consumeRateLimit({ key, requests, window }: LimitOptions) {
  const client = getRedis();
  if (!client) {
    return {
      success: true,
      limit: requests,
      remaining: requests,
      reset: Date.now(),
      pending: Promise.resolve(),
      reason: "not_configured" as const,
    };
  }

  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix: "roomza",
  });

  return limiter.limit(key);
}
