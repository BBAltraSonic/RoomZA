import { createAdminClient, findUserByEmail, getArg, hasArg } from "./shared";

async function main() {
  const email = getArg("--email")?.trim();
  if (!email || !hasArg("--reset-mfa") || !hasArg("--confirm")) {
    throw new Error("Usage: npm run admin:recover -- --email <owner> --reset-mfa --confirm");
  }

  const user = await findUserByEmail(email);
  if (!user) throw new Error("No existing account matches that email.");

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("admin_memberships")
    .select("level, revoked_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || membership.level !== "owner" || membership.revoked_at) throw new Error("The account is not an active owner.");

  const { data: factors, error: factorsError } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (factorsError) throw factorsError;
  for (const factor of factors?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
    if (error) throw error;
  }

  const { error: auditError } = await admin.from("admin_audit_events").insert({
    actor_id: user.id,
    action_key: "mfa.owner_recovered",
    target_type: "user",
    target_id: user.id,
    reason: "Trusted owner MFA recovery command",
    metadata: { removedFactorCount: factors?.factors.length ?? 0 },
  });
  if (auditError) throw auditError;

  process.stdout.write(`Removed ${factors?.factors.length ?? 0} MFA factors for owner ${user.id}.\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Owner recovery failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
