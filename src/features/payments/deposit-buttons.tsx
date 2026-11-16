"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { PendingGlyph } from "@/lib/motion/primitives";

import {
  cancelDepositAsOwner,
  confirmMoveIn,
  contestDepositRefund,
  requestDepositRefund,
} from "./deposit-actions";
import type { DepositChoice, OwnerDepositAction } from "./deposit-view";

/** "I've moved in" becomes "Yes, I've moved in"; "Cancel the deposit" becomes "Yes, cancel the deposit". */
function yesLabel(label: string) {
  return /^I['’ ]/.test(label) ? `Yes, ${label}` : `Yes, ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

type Option = {
  key: string;
  label: string;
  confirm: string;
  run: () => Promise<ActionResult<{ state: string }>>;
  primary?: boolean;
};

/** Buttons that each ask once before acting, then refresh the page on success. */
function ConfirmingButtons({ options }: { options: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = options.find((option) => option.key === open);

  if (options.length === 0) return null;

  function run(option: Option) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await option.run();
        if (!result.success) {
          setError(result.error);
          return;
        }
        setOpen(null);
        router.refresh();
      } catch {
        setError("Something went wrong. Try again in a moment.");
      }
    });
  }

  return (
    <div className="mt-3">
      {chosen ? (
        <div className="rounded-md border border-border bg-background p-3 text-xs leading-5 text-ink">
          <p>{chosen.confirm}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(chosen)}
              className="h-10 bg-forest text-primary-foreground hover:bg-forest/90"
            >
              {pending ? <PendingGlyph label="Working" /> : null}
              {yesLabel(chosen.label)}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => { setOpen(null); setError(null); }} className="h-10">
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {options.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={option.primary ? "default" : "outline"}
              onClick={() => setOpen(option.key)}
              className={option.primary ? "h-10 bg-forest text-primary-foreground hover:bg-forest/90" : "h-10"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Renter: "I've moved in" and "I'm not satisfied" (or "Cancel" before the move-in date). */
export function DepositChoiceButtons({ paymentId, choices }: { paymentId: string; choices: DepositChoice[] }) {
  return (
    <ConfirmingButtons
      options={choices.map((choice) => ({
        key: choice.kind,
        label: choice.label,
        confirm: choice.confirm,
        primary: choice.kind === "confirm_move_in",
        run: () => (choice.kind === "confirm_move_in" ? confirmMoveIn(paymentId) : requestDepositRefund(paymentId)),
      }))}
    />
  );
}

const ownerOptions: Record<OwnerDepositAction, Omit<Option, "run" | "key">> = {
  contest: {
    label: "They moved in",
    confirm: "The deposit stays held and RoomZA reviews what happened before deciding who it goes to.",
    primary: true,
  },
  cancel: {
    label: "Cancel the deposit",
    confirm: "If the renter has paid, they get the full deposit back and you receive nothing for it. If not, their payment link stops working. This can't be undone.",
  },
};

/** Owner: contest a refund request, or cancel and refund in full. */
export function OwnerDepositActions({ paymentId, actions }: { paymentId: string; actions: OwnerDepositAction[] }) {
  return (
    <ConfirmingButtons
      options={actions.map((action) => ({
        key: action,
        ...ownerOptions[action],
        run: () => (action === "contest" ? contestDepositRefund(paymentId) : cancelDepositAsOwner(paymentId)),
      }))}
    />
  );
}
