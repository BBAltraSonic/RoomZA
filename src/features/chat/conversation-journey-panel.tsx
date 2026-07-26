import {
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Eye,
  FileText,
  Handshake,
  Home,
  MessageCircle,
  PartyPopper,
  Send,
  Star,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { DerivedJourney, JourneyStep } from "@/features/applications/journey";
import { cn } from "@/lib/utils";

import { ConversationInstantConnectActions } from "./conversation-instant-connect-actions";

type DisplayStep = {
  id: string;
  label: string;
  caption: string;
  state: JourneyStep["state"];
  icon: LucideIcon;
};

const JOURNEY_ICONS: Record<string, LucideIcon> = {
  send: Send,
  file: FileText,
  eye: Eye,
  star: Star,
  calendar: Calendar,
  home: Home,
  handshake: Handshake,
  party: PartyPopper,
};

function inquirySteps(isLandlord: boolean): DisplayStep[] {
  return [
    {
      id: "conversation",
      label: "Conversation started",
      caption: "You are connected about this home.",
      state: "complete",
      icon: MessageCircle,
    },
    {
      id: "application",
      label: isLandlord ? "Application received" : "Apply for this home",
      caption: isLandlord
        ? "Progress continues when the renter applies."
        : "Submit an application when you are ready.",
      state: "current",
      icon: Send,
    },
    {
      id: "review",
      label: "Application review",
      caption: "The application and documents are reviewed.",
      state: "upcoming",
      icon: Eye,
    },
    {
      id: "viewing",
      label: "Viewing",
      caption: "Choose and attend a viewing time.",
      state: "upcoming",
      icon: Calendar,
    },
    {
      id: "decision",
      label: "Decision",
      caption: "The landlord shares the final decision.",
      state: "upcoming",
      icon: Handshake,
    },
  ];
}

function applicationSteps(journey: DerivedJourney): DisplayStep[] {
  return journey.steps.map((step) => ({
    id: step.id,
    label: step.label,
    caption: step.state === "complete" ? step.doneCaption : step.pendingCaption,
    state: step.state,
    icon: JOURNEY_ICONS[step.icon] ?? Circle,
  }));
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label="Rental journey progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className="h-full rounded-full bg-forest transition-transform duration-200 ease-out"
        style={{ transform: `scaleX(${percent / 100})`, transformOrigin: "left" }}
      />
    </div>
  );
}

function Timeline({ steps }: { steps: DisplayStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isComplete = step.state === "complete";
        const isCurrent = step.state === "current";

        return (
          <li key={step.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px",
                  isComplete ? "bg-forest/40" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-panel",
                isComplete && "border-forest bg-forest text-primary-foreground",
                isCurrent && "border-forest text-forest ring-4 ring-forest/10",
                (step.state === "upcoming" || step.state === "blocked") &&
                  "border-border text-muted-foreground",
              )}
            >
              {isComplete ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-3.5" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <p className={cn("text-sm font-semibold text-ink", isCurrent && "text-forest")}>
                  {step.label}
                </p>
                {isCurrent ? (
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-forest">
                    Now
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.caption}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function JourneyContent({
  journey,
  listingId,
  listingTitle,
  isLandlord,
}: ConversationJourneyPanelProps) {
  const steps = journey ? applicationSteps(journey) : inquirySteps(isLandlord);
  const current = steps.find((step) => step.state === "current");
  const percent = journey ? journey.percent : 20;
  const statusLabel =
    journey?.outcome === "approved"
      ? "Application approved"
      : journey?.outcome === "rejected"
        ? "Application closed"
        : journey?.outcome === "withdrawn"
          ? "Application withdrawn"
          : current?.label ?? "Journey started";

  return (
    <>
      <div className="px-5 pb-5 pt-6">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Rental journey
        </p>
        <Link
          href={`/listing/${listingId}`}
          className="mt-2 block truncate text-base font-bold tracking-tight text-ink hover:text-forest"
        >
          {listingTitle}
        </Link>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{statusLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {journey ? `${percent}% complete` : "Your next steps, in one place"}
            </p>
          </div>
          <span className="text-lg font-bold tabular-nums text-forest">{percent}%</span>
        </div>
        <div className="mt-3">
          <ProgressBar percent={percent} />
        </div>
      </div>
      <div className="border-t border-border px-5 py-5">
        <Timeline steps={steps} />
      </div>
    </>
  );
}

type ConversationJourneyPanelProps = {
  journey: DerivedJourney | null;
  conversationId: string;
  applicationId?: string | null;
  listingId: string;
  listingTitle: string;
  isLandlord: boolean;
};

export function ConversationJourneyPanel(props: ConversationJourneyPanelProps) {
  const steps = props.journey ? applicationSteps(props.journey) : inquirySteps(props.isLandlord);
  const current = steps.find((step) => step.state === "current");
  const percent = props.journey?.percent ?? 20;

  return (
    <>
      <section className="shrink-0 border-b border-border bg-panel lg:hidden" aria-label="Rental journey">
        <details className="group">
          <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Rental journey
                </p>
                <span className="text-xs font-bold tabular-nums text-forest">{percent}%</span>
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-ink">
                {current?.label ?? "Journey complete"}
              </p>
              <div className="mt-2">
                <ProgressBar percent={percent} />
              </div>
            </div>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="max-h-[42vh] overflow-y-auto border-t border-border">
            <JourneyContent {...props} />
            {props.isLandlord ? (
              <ConversationInstantConnectActions
                conversationId={props.conversationId}
                listingId={props.listingId}
                applicationId={props.applicationId}
              />
            ) : null}
          </div>
        </details>
      </section>

      <aside
        className="hidden min-h-0 flex-col overflow-y-auto border-r border-border bg-panel lg:flex"
        aria-label="Rental journey"
      >
        <JourneyContent {...props} />
        {props.isLandlord ? (
          <ConversationInstantConnectActions
            conversationId={props.conversationId}
            listingId={props.listingId}
            applicationId={props.applicationId}
          />
        ) : null}
      </aside>
    </>
  );
}
