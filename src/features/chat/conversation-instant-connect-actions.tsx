"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProposeViewingModal } from "@/features/viewings/components/propose-viewing-modal";

import { CallButton } from "./call-button";

type ConversationInstantConnectActionsProps = {
  conversationId: string;
  listingId: string;
  applicationId?: string | null;
};

export function ConversationInstantConnectActions({
  conversationId,
  listingId,
  applicationId,
}: ConversationInstantConnectActionsProps) {
  return (
    <section className="border-t border-border px-5 py-5" aria-labelledby="instant-connect-actions-title">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-forest">
        Instant Connect
      </p>
      <h3 id="instant-connect-actions-title" className="mt-2 text-sm font-semibold text-ink">
        Move this renter forward
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Start a private video call now, or send viewing times they can choose.
      </p>

      <div className="mt-4 grid gap-2">
        <CallButton
          conversationId={conversationId}
          label="Start video call"
          className="min-h-11 w-full justify-center border-forest/30"
        />
        {applicationId ? (
          <ProposeViewingModal listingId={listingId} applicantIds={[applicationId]} />
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            Viewing proposals unlock when this renter submits an application.
          </p>
        )}
      </div>

      <Button
        render={<Link href="/settings#profile" />}
        variant="ghost"
        size="sm"
        className="mt-3 w-full justify-center text-muted-foreground"
      >
        <Settings2 className="size-3.5" aria-hidden="true" />
        Manage availability
      </Button>
    </section>
  );
}
