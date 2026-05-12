"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withdrawApplication } from "./actions";

export function WithdrawButton({ applicationId }: { applicationId: string }) {
    const [isPending, startTransition] = useTransition();

    const handleWithdraw = () => {
        if (!confirm("Are you sure you want to withdraw this application? This action cannot be undone and will free up an application slot.")) {
            return;
        }

        startTransition(async () => {
            const result = await withdrawApplication(applicationId);
            if (!result.success && result.error) {
                alert(result.error);
            }
        });
    };

    return (
        <Button
            variant="destructive"
            size="sm"
            className="text-xs font-semibold h-8"
            onClick={handleWithdraw}
            disabled={isPending}
        >
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Withdraw
        </Button>
    );
}
