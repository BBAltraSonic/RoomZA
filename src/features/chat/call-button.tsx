"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { toast } from "sonner";
import { PendingGlyph } from "@/lib/motion/primitives";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getActiveCall, joinCall, startCall, type CallSession } from "./call-actions";

const CALL_IN_PROGRESS_ERROR = "A call is already active in this conversation.";

export function CallButton({
  conversationId,
  hasActiveCall = false,
  onCallStarted,
  className,
}: {
  /** Conversation the call belongs to. */
  conversationId: string;
  /**
   * Whether a non-terminal call already exists for this conversation. When
   * true the button shows a disabled/in-progress state. Wired by
   * `ConversationCallProvider` (task 7.4); defaults to false.
   */
  hasActiveCall?: boolean;
  /**
   * Called with the live session once a call is started or the existing call
   * is joined, so the host can render the call surface. Optional; wired by the
   * provider later.
   */
  onCallStarted?: (session: CallSession) => void;
  className?: string;
}) {
  const [isPending, setIsPending] = useState(false);

  /** Resolves the existing active call and joins it (the `call_in_progress` affordance). */
  async function joinExistingCall() {
    setIsPending(true);
    const active = await getActiveCall(conversationId);
    if (!active.success || !active.data.session) {
      toast.error("That call is no longer available.");
      setIsPending(false);
      return;
    }

    const session = active.data.session;
    const joined = await joinCall(session.id);
    if (!joined.success) {
      toast.error(joined.error);
      setIsPending(false);
      return;
    }

    onCallStarted?.(session);
    setIsPending(false);
  }

  async function handleStartCall() {
    if (isPending || hasActiveCall) return;

    setIsPending(true);
    const result = await startCall(conversationId);

    if (result.success) {
      onCallStarted?.(result.data.session);
      setIsPending(false);
      return;
    }

    // A call already exists: offer to join it instead (Req 1.6).
    if (result.error === CALL_IN_PROGRESS_ERROR) {
      setIsPending(false);
      toast.error(result.error, {
        action: {
          label: "Join",
          onClick: () => {
            void joinExistingCall();
          },
        },
      });
      return;
    }

    toast.error(result.error);
    setIsPending(false);
  }

  const disabled = isPending || hasActiveCall;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={handleStartCall}
      disabled={disabled}
      aria-label={hasActiveCall ? "Call in progress" : "Start video call"}
      aria-busy={isPending}
      className={cn(
        "shrink-0 rounded-full text-forest sm:rounded-md",
        className,
      )}
    >
      {isPending ? <PendingGlyph label="Starting call" /> : <Video className="size-4" />}
    </Button>
  );
}
