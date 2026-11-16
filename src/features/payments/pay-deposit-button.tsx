"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AlertCircle, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import { startDepositCheckout } from "./actions";
import { isPaystackCheckoutUrl, sendBrowserToCheckout } from "./checkout-redirect";

const COULD_NOT_OPEN = "We could not open the payment page. Try again in a moment.";

/** Opens Paystack's checkout for the application's deposit. The amount is decided on the server. */
export function PayDepositButton({
  applicationId,
  children,
  className,
}: {
  applicationId: string;
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await startDepositCheckout(applicationId);
        if (!result.success) {
          setError(result.error);
          return;
        }
        if (!isPaystackCheckoutUrl(result.data.checkoutUrl)) {
          setError(COULD_NOT_OPEN);
          return;
        }
        sendBrowserToCheckout(result.data.checkoutUrl);
      } catch {
        setError(COULD_NOT_OPEN);
      }
    });
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        onClick={pay}
        disabled={pending}
        aria-busy={pending || undefined}
        className={cn("h-10 w-full bg-forest text-primary-foreground hover:bg-forest/90 sm:w-auto", className)}
      >
        {pending ? <PendingGlyph label="Opening the payment page" /> : <Lock className="size-4" aria-hidden="true" />}
        {children}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
