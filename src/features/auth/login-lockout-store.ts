import "server-only";

import {
  getLoginLockoutStatus,
  LOGIN_LOCKOUT_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  normalizeLoginIdentifier,
  type LoginAttemptRecord,
  type LoginLockoutStatus,
} from "@/features/auth/login-lockout";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type LoginAttemptRow = Database["public"]["Tables"]["auth_login_attempts"]["Row"];

type LoginLockoutRead =
  | {
      ok: true;
      emailHash: string;
      record: LoginAttemptRecord | null;
      status: LoginLockoutStatus;
    }
  | { ok: false };

function rowToRecord(row: LoginAttemptRow): LoginAttemptRecord {
  return {
    attemptCount: row.attempt_count,
    lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
  };
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashLoginIdentifier(identifier: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is required to hash login identifiers.");
  }

  const bytes = new TextEncoder().encode(normalizeLoginIdentifier(identifier));
  const digest = await subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

export async function readLoginLockout(identifier: string, now = new Date()): Promise<LoginLockoutRead> {
  let emailHash: string;

  try {
    emailHash = await hashLoginIdentifier(identifier);
  } catch (error) {
    logger.error("Login lockout identifier hashing failed", { error });
    return { ok: false };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("auth_login_attempts")
      .select("*")
      .eq("email_hash", emailHash)
      .maybeSingle();

    if (error) {
      logger.error("Login lockout lookup failed", { emailHash, error });
      return { ok: false };
    }

    const record = data ? rowToRecord(data) : null;
    return {
      ok: true,
      emailHash,
      record,
      status: getLoginLockoutStatus(record, now),
    };
  } catch (error) {
    logger.error("Login lockout lookup failed", { emailHash, error });
    return { ok: false };
  }
}

export async function recordFailedLogin(emailHash: string) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("record_auth_login_failure", {
      target_email_hash: emailHash,
      lockout_threshold: MAX_FAILED_LOGIN_ATTEMPTS,
      lockout_seconds: LOGIN_LOCKOUT_DURATION_MS / 1000,
    });

    if (error) {
      logger.error("Login failure recording failed", { emailHash, error });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Login failure recording failed", { emailHash, error });
    return false;
  }
}

export async function clearLoginFailures(emailHash: string) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("auth_login_attempts").delete().eq("email_hash", emailHash);

    if (error) {
      logger.error("Login failure clear failed", { emailHash, error });
    }
  } catch (error) {
    logger.error("Login failure clear failed", { emailHash, error });
  }
}
