import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitOptions = {
  key: string;
  requests: number;
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`;
};

export const AUTH_RATE_LIMIT = {
  requests: 10,
  window: "60 s",
} as const;

export const MUTATION_RATE_LIMIT = {
  requests: 60,
  window: "60 s",
} as const;

type RedisState = {
  url?: string;
  token?: string;
  client: Redis | null;
};

let redisState: RedisState | undefined;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisState && redisState.url === url && redisState.token === token) {
    return redisState.client;
  }

  if (!url || !token) {
    redisState = { url, token, client: null };
    return redisState.client;
  }

  redisState = { url, token, client: new Redis({ url, token }) };
  return redisState.client;
}

function windowToMs(window: LimitOptions["window"]) {
  const [amountText, unit] = window.split(" ");
  const amount = Number(amountText);
  const multiplier = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}

export function getClientIpFromHeaders(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

export function getClientIp(request: Request) {
  return getClientIpFromHeaders(request.headers);
}

export async function consumeRateLimit({ key, requests, window }: LimitOptions) {
  const client = getRedis();
  if (!client) {
    const success = !isProduction();
    return {
      success,
      limit: requests,
      remaining: success ? requests : 0,
      reset: Date.now() + windowToMs(window),
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

  try {
    return await limiter.limit(key);
  } catch (error) {
    if (!isProduction()) {
      throw error;
    }

    return {
      success: false,
      limit: requests,
      remaining: 0,
      reset: Date.now() + windowToMs(window),
      pending: Promise.resolve(),
      reason: "provider_error" as const,
    };
  }
}
