import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Transactional email configuration diagnostic.
 *
 * Answers the "success banner but no email arrived" question directly: it
 * checks whether the Resend credentials the app relies on are actually present
 * in a given environment file, and can send a real test email end-to-end so you
 * can confirm delivery (and sender-domain verification) before trusting the
 * password-reset / email-verification flows.
 *
 * Usage:
 *   node scripts/ops/check-email.mjs                       # check .env.local
 *   node scripts/ops/check-email.mjs --env .env.production.local
 *   node scripts/ops/check-email.mjs --send you@example.com
 *
 * Secrets are never printed — the API key is shown masked.
 */

const FALLBACK_FROM_EMAIL = "notifications@roomza.app";

function parseArgs(argv) {
  const args = { envFile: ".env.local", sendTo: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env") {
      args.envFile = argv[i + 1];
      i += 1;
    } else if (arg === "--send") {
      args.sendTo = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

/**
 * Minimal .env parser: `KEY=value`, ignores comments/blank lines, strips quotes.
 * @param {string} contents
 * @returns {Record<string, string>}
 */
export function parseEnvFile(contents) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function maskSecret(value) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "set (****)";
  return `set (${value.slice(0, 4)}…${value.slice(-2)})`;
}

/** Pure evaluation of email config so it can be unit tested. */
export function evaluateEmailConfig(env) {
  const hasApiKey = Boolean(env.RESEND_API_KEY);
  const hasFromEmail = Boolean(env.RESEND_FROM_EMAIL);
  const fromEmail = env.RESEND_FROM_EMAIL || FALLBACK_FROM_EMAIL;

  const problems = [];
  if (!hasApiKey) {
    problems.push(
      "RESEND_API_KEY is not set — sendEmail() short-circuits and no email is ever sent.",
    );
  }
  if (!hasFromEmail) {
    problems.push(
      `RESEND_FROM_EMAIL is not set — falling back to ${FALLBACK_FROM_EMAIL}, which must be a verified Resend sender domain or delivery will fail.`,
    );
  }

  return {
    hasApiKey,
    hasFromEmail,
    fromEmail,
    usingFallbackFrom: !hasFromEmail,
    ready: hasApiKey,
    problems,
  };
}

async function sendTestEmail(env, to) {
  const { Resend } = await import("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  const from = env.RESEND_FROM_EMAIL || FALLBACK_FROM_EMAIL;
  const html =
    '<div style="font-family:sans-serif;line-height:1.5;">' +
    "<h1>RoomZA email test</h1>" +
    "<p>If you can read this, transactional email delivery is working.</p>" +
    "</div>";

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: "RoomZA email delivery test",
    html,
  });

  if (error) {
    throw new Error(`Resend rejected the send: ${JSON.stringify(error)}`);
  }
  return data;
}

async function runCli() {
  const { envFile, sendTo } = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const envPath = path.resolve(root, envFile);

  console.log(`\nRoomZA email config check — ${envFile}\n${"=".repeat(40)}`);

  if (!existsSync(envPath)) {
    console.error(`✗ Env file not found: ${envPath}`);
    process.exitCode = 1;
    return;
  }

  const env = parseEnvFile(readFileSync(envPath, "utf8"));
  const result = evaluateEmailConfig(env);

  console.log(`RESEND_API_KEY:      ${maskSecret(env.RESEND_API_KEY)}`);
  console.log(`RESEND_FROM_EMAIL:   ${env.RESEND_FROM_EMAIL || `(missing → ${FALLBACK_FROM_EMAIL})`}`);
  console.log(`NEXT_PUBLIC_APP_URL: ${env.NEXT_PUBLIC_APP_URL || "(missing → http://localhost:3000)"}`);
  console.log("");

  if (result.problems.length > 0) {
    for (const problem of result.problems) {
      console.error(`✗ ${problem}`);
    }
  } else {
    console.log("✓ Resend credentials are present.");
  }

  if (sendTo) {
    if (!result.ready) {
      console.error("\n✗ Cannot send test email: fix the config problems above first.");
      process.exitCode = 1;
      return;
    }
    console.log(`\nSending test email to ${sendTo} ...`);
    try {
      const data = await sendTestEmail(env, sendTo);
      console.log(`✓ Test email accepted by Resend (id: ${data?.id ?? "unknown"}).`);
      console.log("  Check the inbox (and spam). If it never arrives, verify the sender domain in Resend.");
    } catch (error) {
      console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }
  } else if (result.ready) {
    console.log("\nTip: run with `--send you@example.com` to confirm real delivery.");
  }

  if (!result.ready) {
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly || import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli();
}
