"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 3_000;
const MAX_REFRESHES = 40;

/**
 * Shown while a renter is back from Paystack but the webhook has not marked
 * the deposit held yet. The payments tables are not on Realtime, so the page
 * re-reads itself until the server stops rendering this component, or for two
 * minutes at most.
 */
export function DepositConfirmationRefresher() {
  const router = useRouter();

  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= MAX_REFRESHES) clearInterval(timer);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
