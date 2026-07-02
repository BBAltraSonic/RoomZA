import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import {
  buildEmailVerificationEmail,
  createEmailVerificationExpiry,
  isEmailVerificationTokenUsable,
  normalizeVerificationEmail,
  type EmailVerificationTokenRecord,
} from "@/features/auth/email-verification";
import { sendEmail } from "@/features/notifications/send";
import { logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/redirects";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type EmailVerificationRow = Database["public"]["Tables"]["auth_email_verification_tokens"]["Row"];

function tokenRecordFromRow(row: EmailVerificationRow): EmailVerificationTokenRecord {
  return {
    expiresAt: new Date(row.expires_at),
    usedAt: row.used_at ? new Date(row.used_at) : null,
  };
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashEmailVerificationToken(token: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is required to hash email verification tokens.");
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

export function createEmailVerificationToken() {
  return randomBytes(32).toString("base64url");
}

function appBaseUrl() {
  const localUrl = ["http:", "", "localhost:3000"].join("/");
  return process.env.NEXT_PUBLIC_APP_URL ?? localUrl;
}

function verificationUrl(token: string, redirectPath: string) {
  const url = new URL("/auth/verify-email", appBaseUrl());
  url.searchParams.set("token", token);
  url.searchParams.set("redirect", safeRedirectPath(redirectPath, "/"));
  return url;
}

export async function requestEmailVerificationForUser(userId: string, email: string, redirectPath = "/", now = new Date()) {
  const normalizedEmail = normalizeVerificationEmail(email);
  if (!userId || !normalizedEmail) {
    return;
  }

  const admin = createAdminClient();
  const token = createEmailVerificationToken();
  const tokenHash = await hashEmailVerificationToken(token);
  const expiresAt = createEmailVerificationExpiry(now).toISOString();

  const { error: insertError } = await admin.from("auth_email_verification_tokens").insert({
    id: randomUUID(),
    user_id: userId,
    email: normalizedEmail,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    logger.error("Email verification token insert failed", { userId, error: insertError });
    return;
  }

  const result = await sendEmail(
    normalizedEmail,
    "Verify your RoomZA email",
    buildEmailVerificationEmail(verificationUrl(token, redirectPath).toString()),
  );
  if ("error" in result && result.error) {
    logger.error("Email verification email send failed", { userId, error: result.error });
  }
}

export async function requestEmailVerificationByEmail(email: string, redirectPath = "/") {
  const normalizedEmail = normalizeVerificationEmail(email);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();

  if (error) {
    logger.error("Email verification user lookup failed", { email: normalizedEmail, error });
    return;
  }

  const user = data.users.find((candidate) => normalizeVerificationEmail(candidate.email ?? "") === normalizedEmail);
  if (!user?.id || !user.email) {
    return;
  }

  await requestEmailVerificationForUser(user.id, user.email, redirectPath);
}

export async function consumeEmailVerificationToken(token: string, now = new Date()) {
  if (!token) {
    return { ok: false as const };
  }

  const tokenHash = await hashEmailVerificationToken(token);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auth_email_verification_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || !isEmailVerificationTokenUsable(tokenRecordFromRow(data), now)) {
    if (error) {
      logger.warn("Email verification token lookup failed", { error });
    }
    return { ok: false as const };
  }

  const verifiedAt = now.toISOString();
  const { error: consumeError } = await admin
    .from("auth_email_verification_tokens")
    .update({ used_at: verifiedAt })
    .eq("id", data.id)
    .is("used_at", null)
    .select("id")
    .single();

  if (consumeError) {
    logger.warn("Email verification token consume failed", { userId: data.user_id, error: consumeError });
    return { ok: false as const };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      email_verified_at: verifiedAt,
      updated_at: verifiedAt,
    })
    .eq("id", data.user_id);

  if (profileError) {
    logger.error("Email verification profile update failed", { userId: data.user_id, error: profileError });
    return { ok: false as const };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(data.user_id, { email_confirm: true });
  if (authError) {
    logger.error("Email verification auth update failed", { userId: data.user_id, error: authError });
    return { ok: false as const };
  }

  return {
    ok: true as const,
    userId: data.user_id,
    email: data.email,
    verifiedAt,
  };
}
