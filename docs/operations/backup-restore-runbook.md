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
