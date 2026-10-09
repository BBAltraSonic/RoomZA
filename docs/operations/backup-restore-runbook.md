# Backup And Restore Runbook

## Targets

- Recovery point objective: 24 hours for MVP launch, tighten after paid transactions.
- Recovery time objective: 4 hours for database restore, 24 hours for private document recovery.

## Required Backups

- Supabase automated Postgres backups.
- Supabase Storage bucket backups for `application-documents`.
- Exported Terraform state and Vercel environment metadata.

## Quarterly Restore Drill

1. Restore latest production backup into an isolated staging Supabase project.
2. Run all migrations and RLS checks against the restored database.
3. Verify a renter application, private document signed URL, landlord applicant review, chat, and viewing booking.
4. Confirm no production emails or webhooks are sent from the restored environment.
5. Record restore duration, gaps, and corrective actions.

## Pinpoint schema correction and rollback

Before applying the `discovery_places` migration outside local development, record the target's migration version, backup point, place row count, grants, and RLS policies. Apply and check it in isolated staging first, including anonymous read, authenticated read, and denied client insert. Keep external notification delivery disabled during a restore drill.

If the application release fails while the schema remains healthy, roll back the application release and retain `discovery_places` and its data. If the schema or policy is wrong, stop the affected write path, take a fresh backup, and apply a reviewed forward corrective migration in staging before production. Do not drop the table, rewrite an applied migration, or delete its history to roll back: shared Property URLs may already contain app-owned `areaId` values. Restore from backup only in an isolated project after checking the recovery point and downstream side effects. Record the decision, validation results, and any data reconciliation before reopening writes.

This is a procedure, not evidence of a completed staging restore or production rollback drill.
