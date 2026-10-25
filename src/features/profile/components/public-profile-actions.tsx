"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, BellOff, MessageCircle, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { contactProfileAction } from "@/features/profile/actions";
import { useProfileRelationship } from "./use-profile-relationship";

type PublicProfileActionsProps = {
  profileId: string;
  username: string;
  signedIn: boolean;
  canMessage: boolean;
  isMuted: boolean;
  listings: Array<{ id: string; title: string }>;
};

export function PublicProfileActions(props: PublicProfileActionsProps) {
  return <PublicProfileActionsContent key={props.profileId} {...props} />;
}

function PublicProfileActionsContent({ profileId, username, signedIn, canMessage, isMuted, listings }: PublicProfileActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contactOpen, setContactOpen] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const { change, pending: relationshipPending, error: relationshipError } = useProfileRelationship();

  function relationship(relationship: "block" | "mute", enabled: boolean) {
    change(
      { profileId, relationship, enabled },
      relationship === "block" ? "Profile blocked" : enabled ? "Notifications muted" : "Notifications restored",
      () => { if (relationship === "mute") setMuted(enabled); },
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canMessage ? (
          <Button onClick={() => setContactOpen(true)}>
            <MessageCircle className="size-4" />
            Contact
          </Button>
        ) : !signedIn ? (
          <Button onClick={() => router.push(`/auth?redirect=/u/${username}`)}>
            <MessageCircle className="size-4" />
            Sign in to contact
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() =>
            void navigator.clipboard
              .writeText(window.location.href)
              .then(() => toast.success("Profile link copied"))
          }
        >
          <Share2 className="size-4" />
          Share
        </Button>
        {signedIn ? (
          <>
            <Button
              variant="ghost"
              disabled={pending || relationshipPending}
              onClick={() => relationship("mute", !muted)}
            >
              <BellOff className="size-4" />
              {muted ? "Unmute" : "Mute"}
            </Button>
            <Button
              variant="ghost"
              disabled={pending || relationshipPending}
              onClick={() => relationship("block", true)}
            >
              <Ban className="size-4" />
              Block
            </Button>
          </>
        ) : null}
      </div>
      {relationshipError ? <p role="alert" className="mt-3 text-sm leading-5 text-destructive">{relationshipError}</p> : null}

      {contactOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/45 p-0 sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setContactOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-profile-title"
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-panel p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                  Structured contact
                </p>
                <h2
                  id="contact-profile-title"
                  className="mt-2 text-xl font-semibold text-ink"
                >
                  What would you like to do?
                </h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Close contact sheet"
                onClick={() => setContactOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <form
              className="mt-5 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                startTransition(async () => {
                  const listingId = String(data.get("listingId") ?? "");
                  const result = await contactProfileAction({
                    recipientId: profileId,
                    intent: data.get("intent"),
                    listingId: listingId || null,
                    message: data.get("message"),
                  });
                  if (!result.success) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Contact request sent");
                  setContactOpen(false);
                  if (result.data.conversationId)
                    router.push(`/messages/${result.data.conversationId}`);
                });
              }}
            >
              <label className="grid gap-2 text-sm font-semibold text-ink">
                Intent
                <select
                  name="intent"
                  className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="rent">Rent a home</option>
                  <option value="buy">Buy a home</option>
                  <option value="list">List a property</option>
                  <option value="sell">Sell a property</option>
                  <option value="general">General question</option>
                </select>
              </label>
              {listings.length ? (
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  Listing
                  <select
                    name="listingId"
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No specific listing</option>
                    {listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-2 text-sm font-semibold text-ink">
                Message
                <Textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={1000}
                  className="min-h-28"
                  placeholder="Include the next step you would like to take."
                />
              </label>
              <Button type="submit" disabled={pending} className="min-h-11">
                {pending ? "Sending…" : "Send request"}
              </Button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
