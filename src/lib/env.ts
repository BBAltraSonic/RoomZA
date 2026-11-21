import * as z from "@/lib/zod";

const optionalEnv = (schema: z.ZodString) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MAPTILER_API_KEY: optionalEnv(z.string()),
  NEXT_PUBLIC_SENTRY_DSN: optionalEnv(z.string()),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalEnv(z.string()),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optionalEnv(z.string().min(1)),
  RESEND_API_KEY: optionalEnv(z.string().min(1)),
  RESEND_FROM_EMAIL: optionalEnv(z.string().email()),
  CRON_SECRET: optionalEnv(z.string().min(16)),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
  SENTRY_DSN: optionalEnv(z.string()),
  UPSTASH_REDIS_REST_URL: optionalEnv(z.string().url()),
  UPSTASH_REDIS_REST_TOKEN: optionalEnv(z.string().min(1)),
  QSTASH_TOKEN: optionalEnv(z.string().min(1)),
  QSTASH_CURRENT_SIGNING_KEY: optionalEnv(z.string().min(1)),
  QSTASH_NEXT_SIGNING_KEY: optionalEnv(z.string().min(1)),
  TURNSTILE_SECRET_KEY: optionalEnv(z.string().min(1)),
  // Also signs Paystack webhooks. Deposits stay off while it is unset.
  PAYSTACK_SECRET_KEY: optionalEnv(z.string().min(1)),
  // "enabled" lets a live (sk_live_) key take real deposits. Anything else keeps live keys refused.
  PAYSTACK_LIVE_PAYMENTS: optionalEnv(z.string()),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseEnv<T>(schema: z.ZodType<T>, env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${missing}`);
  }

  return result.data;
}

export function getPublicEnv() {
  return parseEnv(publicEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  } as unknown as NodeJS.ProcessEnv);
}

export function getServerEnv() {
  // Build the object with static `process.env.X` accesses rather than passing
  // `process.env` directly. Next.js only inlines statically-referenced
  // `NEXT_PUBLIC_*` values at build time; passing the whole object would leave
  // them undefined at runtime on edge/worker runtimes (where `process.env` is
  // backed only by configured vars/secrets), causing validation to throw.
  return parseEnv(serverEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_LIVE_PAYMENTS: process.env.PAYSTACK_LIVE_PAYMENTS,
  } as unknown as NodeJS.ProcessEnv);
}

export { getSupabaseEnv } from "@/lib/supabase-env";

export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[key];
  if (!value) {
    throw new Error(`Missing required server environment value: ${String(key)}`);
  }

  return value as NonNullable<ServerEnv[K]>;
}
