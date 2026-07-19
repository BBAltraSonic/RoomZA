import { createAdminClient, findUserByEmail, getArg } from "./shared";

async function main() {
  const email = getArg("--email")?.trim();
  if (!email) throw new Error("Usage: npm run admin:bootstrap -- --email <verified-account>");

  const user = await findUserByEmail(email);
  if (!user) throw new Error("No existing account matches that email.");
  if (!user.email_confirmed_at) throw new Error("The account must verify its email before becoming owner.");

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_bootstrap_owner", { target_user: user.id, audit_request_id: `admin-bootstrap-${Date.now()}` });
  if (error) throw error;

  process.stdout.write(`Owner membership is active for user ${user.id}.\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Owner bootstrap failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
