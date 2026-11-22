"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Bell, BellOff, MessageCircle, PencilLine, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { contactProfileAction } from "@/features/profile/actions";
import { authPathForRedirect } from "@/lib/redirects";
import { useProfileRelationship } from "./use-profile-relationship";

type PublicProfileActionsProps = {
  profileId: string;
  username: string;
  displayName?: string;
  signedIn: boolean;
  canMessage: boolean;
  isOwner?: boolean;
  listings: Array<{ id: string; title: string }>;
};

/** The primary row of the identity card: one clear next step, plus Share. */
export function PublicProfileActions(props: PublicProfileActionsProps) {
  return <PublicProfileActionsContent key={props.profileId} {...props} />;
}

function firstName(name?: string) {
  return name?.trim().split(/\s+/)[0] || "this member";
}

function PublicProfileActionsContent({
  profileId,
  username,
  displayName,
  signedIn,
  canMessage,
  isOwner = false,
  listings,
}: PublicProfileActionsProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const profilePath = `/u/${username}`;

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: displayName ? `${displayName} on Pinpoint` : "Pinpoint profile", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("The link couldn't be copied. Copy it from the address bar instead.");
    }
  }

  const shareButton = (
    <Button variant="outline" size="lg" className="rounded-full px-4" onClick={() => void share()}>
      <Share2 className="size-4" aria-hidden="true" />
      Share
    </Button>
  );

  let primary: ReactNode = null;
  if (isOwner) {
    primary = (
      <Button size="lg" className="w-full" render={<Link href="/profile/edit" />}>
        <PencilLine className="size-4" aria-hidden="true" />
        Edit profile
      </Button>
    );
  } else if (canMessage) {
    primary = (
      <Button size="lg" className="w-full" onClick={() => setContactOpen(true)}>
        <MessageCircle className="size-4" aria-hidden="true" />
        Message {firstName(displayName)}
      </Button>
    );
  } else if (!signedIn) {
    primary = (
      <Button size="lg" className="w-full" render={<Link href={authPathForRedirect(profilePath)} prefetch={false} />}>
        <MessageCircle className="size-4" aria-hidden="true" />
        Sign in to message
      </Button>
    );
  }

  return (
    <>
      {primary ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          {primary}
          {shareButton}
        </div>
      ) : (
        <div className="grid gap-3">
          {shareButton}
          <p className="text-center text-xs leading-5 text-muted-foreground">
            {firstName(displayName)} isn&apos;t taking messages from new contacts right now.
          </p>
        </div>
      )}
      {contactOpen ? (
        <ContactSheet
          profileId={profileId}
          recipientName={firstName(displayName)}
          listings={listings}
          onClose={() => setContactOpen(false)}
        />
      ) : null}
    </>
  );
}

function ContactSheet({
  profileId,
  recipientName,
  listings,
  onClose,
}: {
  profileId: string;
  recipientName: string;
  listings: Array<{ id: string; title: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-profile-title"
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[24px] border border-border bg-panel p-5 shadow-[var(--elevation-3)] sm:max-w-lg sm:rounded-[24px] sm:p-6"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="contact-profile-title" className="text-xl font-semibold tracking-tight text-ink">
              Message {recipientName}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Say what you&apos;re after so {recipientName} can reply with the right next step.
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
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
              toast.success(`Message sent to ${recipientName}`);
              onClose();
              if (result.data.conversationId) router.push(`/messages/${result.data.conversationId}`);
            });
          }}
        >
          <label className="grid gap-2 text-sm font-semibold text-ink">
            What is this about?
            <select
              name="intent"
              className="h-11 rounded-[12px] border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="general">A general question</option>
              <option value="rent">Renting a home</option>
              <option value="buy">Buying a home</option>
              <option value="list">Listing a property</option>
              <option value="sell">Selling a property</option>
            </select>
          </label>
          {listings.length ? (
            <label className="grid gap-2 text-sm font-semibold text-ink">
              Home
              <select
                name="listingId"
                className="h-11 rounded-[12px] border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="">Not about a specific home</option>
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
              className="min-h-28 font-normal"
              placeholder="For example: Is the cottage still available from 1 February? I'd like to book a viewing."
            />
            <span className="text-xs font-normal text-muted-foreground">
              At least 10 characters. Your phone and email stay private unless you share them.
            </span>
          </label>
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
            {pending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </section>
    </div>
  );
}

type SafetyControlsProps = {
  profileId: string;
  displayName?: string;
  signedIn: boolean;
  isMuted: boolean;
};

/** Quiet, deliberate controls. Blocking asks for confirmation first. */
export function ProfileSafetyControls(props: SafetyControlsProps) {
  return <ProfileSafetyControlsContent key={props.profileId} {...props} />;
}

function ProfileSafetyControlsContent({ profileId, displayName, signedIn, isMuted }: SafetyControlsProps) {
  const router = useRouter();
  const [muted, setMuted] = useState(isMuted);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const { change, pending, error } = useProfileRelationship();
  const name = firstName(displayName);

  if (!signedIn) return null;

  const quiet =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:min-h-9";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          className={quiet}
          disabled={pending}
          onClick={() =>
            change(
              { profileId, relationship: "mute", enabled: !muted },
              muted ? "Notifications restored" : "Notifications muted",
              () => setMuted(!muted),
            )
          }
        >
          {muted ? <Bell className="size-3.5" aria-hidden="true" /> : <BellOff className="size-3.5" aria-hidden="true" />}
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className={quiet}
          disabled={pending}
          aria-expanded={confirmingBlock}
          onClick={() => setConfirmingBlock((value) => !value)}
        >
          <Ban className="size-3.5" aria-hidden="true" />
          Block
        </button>
        <ReportPanel reportedUserId={profileId} label="Report" popover compact className="[&_button]:rounded-full [&_button]:text-xs" />
      </div>
      {confirmingBlock ? (
        <div className="mt-2 rounded-[16px] border border-status-error-border bg-status-error-surface p-4 text-left">
          <p className="text-sm font-semibold text-status-error-text">Block {name}?</p>
          <p className="mt-1 text-xs leading-5 text-status-error-text/90">
            You won&apos;t see each other&apos;s profiles or be able to message. You can unblock in Settings → Privacy.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() =>
                change({ profileId, relationship: "block", enabled: true }, `${name} is blocked`, () => router.push("/"))
              }
            >
              Yes, block
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmingBlock(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-center text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
