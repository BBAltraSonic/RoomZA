"use client";

import { useId, useState, useTransition } from "react";
import { AlertCircle, Landmark } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingGlyph } from "@/lib/motion/primitives";

import { saveOwnerPayoutAccount } from "./actions";
import { SOUTH_AFRICAN_BANKS, type PayoutAccountInput, type PayoutAccountSummary } from "./payout-account";

type Field = keyof PayoutAccountInput;

const EMPTY: PayoutAccountInput = { accountHolder: "", bankName: "", branchCode: "", accountNumber: "" };

const savedDate = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg",
});

/** Owner settings: the bank account RoomZA pays deposits into. */
export function PayoutAccountForm({ initial }: { initial: PayoutAccountSummary | null }) {
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(initial === null);
  const [values, setValues] = useState<PayoutAccountInput>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveOwnerPayoutAccount(values);
        if (!result.success) {
          const errors = result.details?.fieldErrors ?? {};
          setFieldErrors(Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0]])));
          setError(result.error);
          return;
        }
        setSaved(result.data);
        setValues(EMPTY);
        setFieldErrors({});
        setEditing(false);
        toast.success("Bank details saved");
      } catch {
        setError("We could not save your bank details. Try again.");
      }
    });
  }

  function field(name: Field, label: string, props: React.ComponentProps<typeof Input> = {}) {
    const inputId = `${id}-${name}`;
    const message = fieldErrors[name];
    return (
      <div className="space-y-2">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          name={name}
          value={values[name]}
          onChange={(event) => update(name, event.target.value)}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${inputId}-error` : undefined}
          required
          className="h-11"
          {...props}
        />
        {message ? (
          <p id={`${inputId}-error`} className="text-xs text-destructive">{message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)] sm:p-6">
      {saved ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-forest">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-ink">{saved.bankName} · account ending {saved.accountLast4}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {saved.accountHolder} · branch {saved.branchCode} · saved {savedDate.format(new Date(saved.updatedAt))}
              </p>
            </div>
          </div>
          {!editing ? (
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => setEditing(true)}>
              Replace bank details
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          No bank details yet. Renters can pay your listings&apos; deposits through RoomZA once you add them.
        </p>
      )}

      {editing ? (
        <form onSubmit={submit} noValidate className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("accountHolder", "Account holder", { autoComplete: "name", maxLength: 120 })}</div>
          {field("bankName", "Bank", { list: `${id}-banks`, autoComplete: "off", maxLength: 80 })}
          <datalist id={`${id}-banks`}>
            {SOUTH_AFRICAN_BANKS.map((bank) => <option key={bank} value={bank} />)}
          </datalist>
          {field("branchCode", "Branch code", { inputMode: "numeric", autoComplete: "off", maxLength: 7 })}
          <div className="sm:col-span-2">
            {field("accountNumber", "Account number", { inputMode: "numeric", autoComplete: "off", maxLength: 24 })}
          </div>

          {error ? (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive sm:col-span-2">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <Button type="submit" disabled={pending} className="h-11 sm:h-9">
              {pending ? <PendingGlyph label="Saving bank details" /> : null}
              Save bank details
            </Button>
            {saved ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 sm:h-9"
                disabled={pending}
                onClick={() => { setEditing(false); setValues(EMPTY); setFieldErrors({}); setError(null); }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
