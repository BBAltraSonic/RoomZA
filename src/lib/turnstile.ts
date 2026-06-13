import { logger } from "@/lib/logger";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  if (!token) return false;

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const result = (await response.json()) as TurnstileResponse;

    if (!result.success) {
      logger.warn("Turnstile verification failed", { errors: result["error-codes"] });
    }

    return result.success;
  } catch (error) {
    logger.error("Turnstile verification errored", { error });
    return false;
  }
}
