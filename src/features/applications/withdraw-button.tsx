"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withdrawApplication } from "./actions";

export function WithdrawButton({ applicationId }: { applicationId: string }) {
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleWithdraw = () => {
        setError(null);
        startTransition(async () => {
            const result = await withdrawApplication(applicationId);
            if (!result.success && result.error) {
                setError(result.error);
            } else {
                setOpen(false);
            }
        });
    };

    return (
        <>
            <Button
                variant="destructive"
                size="sm"
                className="h-10 text-xs font-semibold sm:h-8"
                onClick={() => setOpen(true)}
                disabled={isPending}
            >
                Withdraw
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="border-border bg-panel sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-ink">
                            <AlertTriangle className="size-5 text-destructive" />
                            Withdraw application?
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm leading-6 text-muted-foreground">
                        This closes the application and frees one of your 5 active application slots.
                    </p>
                    {error ? (
                        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    ) : null}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            Keep application
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleWithdraw} disabled={isPending}>
                            {isPending ? <PendingGlyph label="Withdrawing application" /> : null}
                            Withdraw
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
