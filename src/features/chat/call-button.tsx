"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { toast } from "sonner";
import { PendingGlyph } from "@/lib/motion/primitives";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getActiveCall, startCall, type CallSession } from "./call-actions";
import { useConversationCallController } from "./conversation-call-provider";

const CALL_IN_PROGRESS_ERROR = "A call is already active in this conversation.";

export function CallButton({
  conversationId,
  hasActiveCall,
  onCallStarted,
  label,
  className,
}: {
  /** Conversation the call belongs to. */
  conversationId: string;
  /**
   * Whether a non-terminal call already exists for this conversation. When
   * true the button shows a disabled/in-progress state. When omitted, the
   * nearest `ConversationCallProvider` supplies the live value.
   */
  hasActiveCall?: boolean;
  /**
   * Called with the live session once a call is started or restored, so the
   * host can render the call surface. When omitted, the nearest provider owns
   * the update.
   */
  onCallStarted?: (session: CallSession) => void;
  /** Optional visible label for contextual action surfaces. */
  label?: string;
  className?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const callController = useConversationCallController();
  const resolvedHasActiveCall =
    hasActiveCall ??
    (callController?.session?.status === "ringing" ||
      callController?.session?.status === "active");
  const publishSession = onCallStarted ?? callController?.setSession;

  /** Restores the database's existing call into the shared page state. */
  async function restoreExistingCall() {
    setIsPending(true);
    const active = await getActiveCall(conversationId);
    if (!active.success || !active.data.session) {
      toast.error("That call is no longer available.");
      setIsPending(false);
      return;
    }

    const session = active.data.session;
    publishSession?.(session);
    toast.info(
      session.status === "ringing"
        ? "The call is still ringing."
        : "Active call restored.",
    );
    setIsPending(false);
  }

  async function handleStartCall() {
    if (isPending || resolvedHasActiveCall) return;

    setIsPending(true);
    const result = await startCall(conversationId);

    if (result.success) {
      publishSession?.(result.data.session);
      setIsPending(false);
      return;
    }

    // A call already exists: reconcile it directly into the shared page state.
    if (result.error === CALL_IN_PROGRESS_ERROR) {
      await restoreExistingCall();
      return;
    }

    toast.error(result.error);
    setIsPending(false);
  }

  const disabled = isPending || resolvedHasActiveCall;
  const accessibleLabel = resolvedHasActiveCall ? "Call in progress" : label ?? "Start video call";

  return (
    <Button
      type="button"
      variant="outline"
      size={label ? "default" : "icon-sm"}
      onClick={handleStartCall}
      disabled={disabled}
      aria-label={accessibleLabel}
      aria-busy={isPending}
      className={cn(
        "shrink-0 text-forest",
        label ? "rounded-lg" : "rounded-full sm:rounded-md",
        className,
      )}
    >
      {isPending ? <PendingGlyph label="Starting call" /> : <Video className="size-4" />}
      {label ? (resolvedHasActiveCall ? "Call in progress" : label) : null}
    </Button>
  );
}
