import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import { sendEmail } from "@/features/notifications/send";
import {
  buildPasswordResetEmail,
  createPasswordResetExpiry,
  isPasswordResetTokenUsable,
  normalizeResetEmail,
  type PasswordResetTokenRecord,
} from "@/features/auth/password-reset";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type PasswordResetRow = Database["public"]["Tables"]["auth_password_reset_tokens"]["Row"];

function tokenRecordFromRow(row: PasswordResetRow): PasswordResetTokenRecord {
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

export async function hashPasswordResetToken(token: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is required to hash password reset tokens.");
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

export function createPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

function passwordResetBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function requestPasswordReset(email: string, _origin: string, now = new Date()) {
  const normalizedEmail = normalizeResetEmail(email);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();

  if (error) {
    logger.error("Password reset user lookup failed", { email: normalizedEmail, error });
    return;
  }

  const user = data.users.find((candidate) => normalizeResetEmail(candidate.email ?? "") === normalizedEmail);
  if (!user?.email) {
    return;
  }

  const token = createPasswordResetToken();
  const tokenHash = await hashPasswordResetToken(token);
  const expiresAt = createPasswordResetExpiry(now).toISOString();
  const resetUrl = new URL("/auth/reset-password", passwordResetBaseUrl());
  resetUrl.searchParams.set("token", token);

  const { error: insertError } = await admin.from("auth_password_reset_tokens").insert({
    id: randomUUID(),
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    logger.error("Password reset token insert failed", { userId: user.id, error: insertError });
    return;
  }

  const result = await sendEmail(user.email, "Reset your RoomZA password", buildPasswordResetEmail(resetUrl.toString()));
  if ("error" in result && result.error) {
    logger.error("Password reset email send failed", { userId: user.id, error: result.error });
  }
}

export async function consumePasswordResetToken(token: string, password: string, now = new Date()) {
  if (!token) {
    return { ok: false as const };
  }

  const tokenHash = await hashPasswordResetToken(token);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auth_password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || !isPasswordResetTokenUsable(tokenRecordFromRow(data), now)) {
    if (error) {
      logger.warn("Password reset token lookup failed", { error });
    }
    return { ok: false as const };
  }

  const { error: consumeError } = await admin
    .from("auth_password_reset_tokens")
    .update({ used_at: now.toISOString() })
    .eq("id", data.id)
    .is("used_at", null)
    .select("id")
    .single();

  if (consumeError) {
    logger.warn("Password reset token consume failed", { userId: data.user_id, error: consumeError });
    return { ok: false as const };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(data.user_id, { password });
  if (updateError) {
    logger.error("Password reset update failed", { userId: data.user_id, error: updateError });
    return { ok: false as const };
  }

  return { ok: true as const };
}
