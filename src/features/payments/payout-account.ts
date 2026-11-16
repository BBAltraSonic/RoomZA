import { z } from "zod";

/**
 * The bank account an owner is paid into. The same limits are enforced by
 * public.owner_payout_accounts; keep the two in step.
 */
const digitsOnly = (value: string) => value.replace(/[\s-]/g, "");

export const payoutAccountSchema = z.object({
  accountHolder: z.string().trim()
    .min(2, "Enter the name on the account.")
    .max(120, "Use 120 characters or fewer."),
  bankName: z.string().trim()
    .min(2, "Enter your bank.")
    .max(80, "Use 80 characters or fewer."),
  branchCode: z.string().transform(digitsOnly)
    .pipe(z.string().regex(/^[0-9]{6}$/, "A branch code is six digits.")),
  accountNumber: z.string().transform(digitsOnly)
    .pipe(z.string().regex(/^[0-9]{6,16}$/, "An account number is 6 to 16 digits.")),
});

export type PayoutAccountInput = z.input<typeof payoutAccountSchema>;

/** What the server returns about a saved account. The full number never leaves the database. */
export const payoutAccountSummarySchema = z.object({
  accountHolder: z.string(),
  bankName: z.string(),
  branchCode: z.string().regex(/^[0-9]{6}$/),
  accountLast4: z.string().regex(/^[0-9]{4}$/),
  updatedAt: z.string(),
}).strict();

export type PayoutAccountSummary = z.infer<typeof payoutAccountSummarySchema>;

/** Banks offered as suggestions; any other name is still accepted. */
export const SOUTH_AFRICAN_BANKS = [
  "Absa",
  "African Bank",
  "Bidvest Bank",
  "Capitec",
  "Discovery Bank",
  "FNB",
  "Investec",
  "Nedbank",
  "Old Mutual",
  "Standard Bank",
  "TymeBank",
] as const;
