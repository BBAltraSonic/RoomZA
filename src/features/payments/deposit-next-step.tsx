import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NextAction } from "@/features/applications/journey";

import { DepositChoiceButtons } from "./deposit-buttons";
import { PayDepositButton } from "./pay-deposit-button";

/** The deposit step on an approved application in the applications list. */
export function DepositNextStep({ applicationId, nextAction }: { applicationId: string; nextAction: NextAction }) {
  return (
    <div className="mt-5 rounded-lg border border-forest/20 bg-accent p-4 text-sm text-forest">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{nextAction.label}</p>
          <p className="mt-1 text-xs leading-5 text-forest/80">{nextAction.detail}</p>
          {nextAction.depositChoices ? (
            <DepositChoiceButtons paymentId={nextAction.depositChoices.paymentId} choices={nextAction.depositChoices.choices} />
          ) : null}
          {nextAction.action === "pay_deposit" && nextAction.cta ? (
            <PayDepositButton applicationId={applicationId}>{nextAction.cta}</PayDepositButton>
          ) : nextAction.href && nextAction.cta ? (
            <Button
              render={<Link href={nextAction.href} />}
              variant="outline"
              className="mt-3 h-10 w-full sm:w-auto"
            >
              {nextAction.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
