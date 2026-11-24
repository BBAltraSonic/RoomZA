"use client";

import { AlertTriangle, ArrowRight, CalendarClock, Check, Clock, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { amenityLabels } from "@/features/listings/schema";
import { formatSlotRequest } from "@/features/showings/viewing-availability";
import { cn } from "@/lib/utils";

import { chipButton } from "../assistant-templates";
import type { ApprovalResult } from "./business-actions";
import type { BusinessView, PersonAction, ReminderView } from "./business-view";
import type { ChangeItem } from "./change-preview";
import { saveListingHandoff } from "./listing-handoff";
import type { Person } from "./people";
import type { BusinessRequest, ChangeRequest } from "./request-intent";
import type { TodayKey } from "./today";

/**
 * Business mode's templates (proposal, "Templates"). Each one only shows a view the server
 * built from the lister's own data. Buttons either open another template or call a server
 * function; the only ones that change anything are Approve, Save, Done and Snooze.
 */

const card = "rounded-2xl border border-border/70 bg-background p-3";
const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const primaryChip = cn(chipButton, "border-primary bg-primary text-primary-foreground disabled:opacity-50");
const plainChip = cn(chipButton, "border-border bg-background text-ink hover:border-forest/40 disabled:opacity-50");

export type ReminderActions = {
  save: (input: { note: string; due: "today" | "tomorrow" | "next-week" | "friday"; personKey?: string }) => Promise<string | null>;
  done: (id: string) => Promise<string | null>;
  snooze: (id: string, choice: "tomorrow" | "next-week") => Promise<string | null>;
};

export type TemplateProps = {
  onRequest: (request: BusinessRequest) => void;
  onApprove: (change: ChangeRequest, itemIds: string[]) => Promise<{ results: ApprovalResult[] } | { error: string }>;
  /** Applies a suggested description; resolves to an error message, or null when saved. */
  onApplyDescription: (input: { listingId: string; expectedUpdatedAt: string; description: string }) => Promise<string | null>;
  reminders: ReminderActions;
};

const timeFormat = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
function when(value: string) {
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? timeFormat.format(at) : "";
}

function Notes({ notes }: { notes: readonly string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="mt-3 space-y-1">
      {notes.map((note) => (
        <li key={note} role="status" className="flex items-start gap-2 text-sm text-status-warning-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {note}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm text-muted-foreground">{children}</p>;
}

// Today ----------------------------------------------------------------------------------------

const TODAY_TARGET: Record<TodayKey, BusinessRequest | { href: string }> = {
  enquiriesWaiting: { template: "people_list", filters: { waitingOnYou: true } },
  applicationsToReview: { template: "change_preview", change: { kind: "review_applications" } },
  viewingRequests: { template: "change_preview", change: { kind: "accept_viewings" } },
  bookingRequests: { template: "change_preview", change: { kind: "confirm_bookings" } },
  followUps: { template: "people_list", filters: { stage: "ready-to-apply" } },
  listingsNeedingInfo: { template: "quality_check" },
  expiringSpecials: { href: "/post/listings?category=offers" },
};

function TodayTemplate({ view, onRequest, reminders }: TemplateProps & { view: Extract<BusinessView, { template: "today" }> }) {
  return (
    <section aria-label="Today" className="mt-3">
      {view.items.length || view.reminders.length ? (
        <ul className="divide-y divide-border/70 rounded-2xl border border-border/70 bg-background">
          {view.items.map((item) => {
            const target = TODAY_TARGET[item.key];
            return (
              <li key={item.key} className="flex min-h-14 items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm font-semibold">{item.label}</span>
                {"href" in target ? (
                  <Link href={target.href} className={plainChip}>{item.action}</Link>
                ) : (
                  <button type="button" onClick={() => onRequest(target)} className={plainChip} aria-label={`${item.action}: ${item.label}`}>{item.action}</button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>Nothing needs you right now.</Empty>
      )}
      {view.reminders.length ? (
        <>
          <h3 className={cn(sectionTitle, "mt-4")}>Due today</h3>
          <ReminderList reminders={view.reminders} actions={reminders} />
        </>
      ) : null}
      <Notes notes={view.notes.map((note) => note.message)} />
    </section>
  );
}

// People ---------------------------------------------------------------------------------------

function ReasonTags({ reasons }: { reasons: readonly string[] }) {
  if (!reasons.length) return null;
  return (
    <ul aria-label="Reasons" className="mt-1.5 flex flex-wrap gap-1">
      {reasons.map((reason) => (
        <li key={reason} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-ink">{reason}</li>
      ))}
    </ul>
  );
}

function LastAction({ person }: { person: Person }) {
  if (!person.lastAction) return null;
  return <p className="mt-1 text-xs text-muted-foreground">{`${person.lastAction.label} by ${person.lastAction.actorName}, ${when(person.lastAction.at)}`}</p>;
}

function PersonCard({ person, onOpen }: { person: Person; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn(card, "w-full text-left hover:border-forest/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold">{person.name}</span>
          {person.waitingOnYou ? <span className="rounded-full bg-selection px-2 py-0.5 text-xs font-semibold text-selection-foreground">Waiting on you</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{person.subjectTitle}</span>
        <ReasonTags reasons={person.reasons} />
        <LastAction person={person} />
      </button>
    </li>
  );
}

function PeopleTemplate({ view, onRequest }: TemplateProps & { view: Extract<BusinessView, { template: "people_list" }> }) {
  return (
    <section aria-label="People" className="mt-3">
      <p className="text-sm text-muted-foreground">{view.total === 1 ? "1 person" : `${view.total} people`}, most promising first.</p>
      {view.groups.map((group) => (
        <div key={group.stage} className="mt-3">
          <h3 className={sectionTitle}>{group.label} · {group.people.length}</h3>
          <ul className="mt-2 space-y-2">
            {group.people.map((person) => <PersonCard key={person.key} person={person} onOpen={() => onRequest({ template: "person_detail", personKey: person.key })} />)}
          </ul>
        </div>
      ))}
      {!view.total ? <Empty>Nobody matches that yet.</Empty> : null}
      <Notes notes={view.notes} />
    </section>
  );
}

function ActionButton({ action, onRequest }: { action: PersonAction; onRequest: TemplateProps["onRequest"] }) {
  if ("href" in action) return <Link href={action.href} className={plainChip}>{action.label}</Link>;
  return <button type="button" onClick={() => onRequest(action.request)} className={plainChip}>{action.label}</button>;
}

function PersonDetailTemplate({ view, onRequest }: TemplateProps & { view: Extract<BusinessView, { template: "person_detail" }> }) {
  const { person } = view;
  if (!person) return <Notes notes={view.notes} />;
  return (
    <section aria-label="Person" className="mt-3">
      <div className={card}>
        <h3 className="text-base font-semibold">{person.name}</h3>
        <p className="text-sm text-muted-foreground">{person.subjectTitle}</p>
        <ReasonTags reasons={person.reasons} />
        <LastAction person={person} />
      </div>
      {view.actions.length ? (
        <ul aria-label="Next steps" className="mt-3 flex flex-wrap gap-2">
          {view.actions.map((action) => <li key={action.label}><ActionButton action={action} onRequest={onRequest} /></li>)}
        </ul>
      ) : null}
      <h3 className={cn(sectionTitle, "mt-4")}>Activity</h3>
      <ol className="mt-2 space-y-1.5">
        {person.timeline.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex gap-3 text-sm">
            <span className="w-28 shrink-0 text-xs text-muted-foreground">{when(entry.at)}</span>
            <span>{entry.label}</span>
          </li>
        ))}
      </ol>
      <Notes notes={view.notes} />
    </section>
  );
}

// Listings -------------------------------------------------------------------------------------

function InsightsTemplate({ view }: { view: Extract<BusinessView, { template: "question_insights" }> }) {
  return (
    <section aria-label="What people ask about" className="mt-3">
      <p className="text-xs text-muted-foreground">Counted from enquiries by Pinpoint. Messages are never sent to the AI.</p>
      <ul className="mt-2 space-y-2">
        {view.insights.map((insight) => (
          <li key={`${insight.listingId}-${insight.topic}`} className={cn(card, "flex items-center gap-3")}>
            <span className="min-w-0 flex-1 text-sm">{insight.message}</span>
            {!insight.onListing ? <Link href={insight.href} className={plainChip}>Add to listing</Link> : null}
          </li>
        ))}
      </ul>
      {!view.insights.length && !view.notes.length ? <Empty>No common questions in the last 30 days.</Empty> : null}
      <Notes notes={view.notes} />
    </section>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));
      }}
      className={plainChip}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function NewListingTemplate({ view }: { view: Extract<BusinessView, { template: "new_listing" }> }) {
  return (
    <section aria-label="New listing" className="mt-3">
      {view.missing.length ? (
        <div className={card}>
          <h3 className={sectionTitle}>Still needed</h3>
          <ul className="mt-1 list-inside list-disc text-sm">{view.missing.map((field) => <li key={field}>{field}</li>)}</ul>
        </div>
      ) : null}
      <div className={cn(card, "mt-2")}>
        <h3 className={sectionTitle}>Suggested title</h3>
        <p className="mt-1 text-sm font-semibold">{view.writing.title}</p>
        <h3 className={cn(sectionTitle, "mt-3")}>Suggested description</h3>
        <p className="mt-1 whitespace-pre-line text-sm">{view.writing.description}</p>
        {view.writing.features.length ? <p className="mt-2 text-xs text-muted-foreground">Features you mentioned: {view.writing.features.map((key) => amenityLabels[key] ?? key).join(", ")}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">{view.source === "ai" ? "Written from what you typed. Nothing was added." : "A plain version from what you typed."} The form opens filled in; nothing is saved until you create the draft there. Photos and contact details come next.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <CopyButton text={view.writing.title} label="Copy title" />
          <CopyButton text={view.writing.description} label="Copy description" />
          <Link
            href="/dashboard/listings/new"
            onClick={() => saveListingHandoff({
              title: view.writing.title,
              description: view.writing.description,
              propertyType: view.writing.propertyType,
              listingType: view.draft.listingType ?? "rent",
              price: view.draft.price ?? null,
              features: view.writing.features,
            })}
            className={primaryChip}
          >
            Fill in the listing form<ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <Notes notes={view.notes} />
    </section>
  );
}

function QualityTemplate({ view, onRequest }: TemplateProps & { view: Extract<BusinessView, { template: "quality_check" }> }) {
  return (
    <section aria-label="Quality check" className="mt-3">
      <ul className="space-y-2">
        {view.listings.map((listing) => (
          <li key={listing.id} className={card}>
            <h3 className="text-sm font-semibold">{listing.title}</h3>
            <ul className="mt-2 space-y-1.5">
              {listing.issues.map((issue) => (
                <li key={issue.key} className="flex items-center gap-3 text-sm">
                  <span className={cn("min-w-0 flex-1", issue.severity === "important" && "font-semibold")}>{issue.message}</span>
                  {issue.key === "short-description" ? (
                    <button type="button" onClick={() => onRequest({ template: "improve_listing", listingId: listing.id })} className={plainChip}>Write it for me</button>
                  ) : (
                    <Link href={issue.href} className={plainChip}>{issue.fix}</Link>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {!view.listings.length && !view.notes.length ? <Empty>Your listings have everything important.</Empty> : null}
      <Notes notes={view.notes} />
    </section>
  );
}

const SINGULAR: Record<string, string> = { Views: "view", Enquiries: "enquiry", Viewings: "viewing", Applications: "application" };

function PerformanceTemplate({ view }: { view: Extract<BusinessView, { template: "performance" }> }) {
  const nearby = new Map(view.nearby.map((entry) => [entry.listingId, entry]));
  return (
    <section aria-label="Performance" className="mt-3">
      <dl className="grid grid-cols-2 gap-2">
        {view.tiles.map((tile) => (
          <div key={tile.label} className={card}>
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{tile.value}</dd>
            {tile.note ? <dd className="text-xs text-muted-foreground">{tile.note}</dd> : null}
          </div>
        ))}
      </dl>
      {view.suggestions.length ? (
        <>
          <h3 className={cn(sectionTitle, "mt-4")}>Suggestions</h3>
          <ul className="mt-2 space-y-2">
            {view.suggestions.map((suggestion) => (
              <li key={`${suggestion.listingId}-${suggestion.action}`} className={cn(card, "flex items-center gap-3")}>
                <span className="min-w-0 flex-1 text-sm"><span className="font-semibold">{suggestion.title}:</span> {suggestion.message}</span>
                <Link href={suggestion.href} className={plainChip}>{suggestion.action}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3 className={cn(sectionTitle, "mt-4")}>Per listing</h3>
      <ul className="mt-2 space-y-2">
        {view.funnels.map((funnel) => {
          const comparison = nearby.get(funnel.listingId);
          return (
            <li key={funnel.listingId} className={card}>
              <h4 className="text-sm font-semibold">{funnel.title}</h4>
              <p className="mt-1 text-sm tabular-nums">{funnel.steps.map((step) => `${step.value ?? "—"} ${step.value === 1 ? SINGULAR[step.label] ?? step.label.toLowerCase() : step.label.toLowerCase()}`).join(" → ")}</p>
              {comparison && comparison.similarCount ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {comparison.similarCount} similar nearby
                  {comparison.medianPrice ? ` · typical price R${comparison.medianPrice.toLocaleString("en-US")}` : ""}
                  {comparison.medianPhotos !== null ? ` · about ${comparison.medianPhotos} photos` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Notes notes={view.notes} />
    </section>
  );
}

function ImproveListingTemplate({ view, onApplyDescription }: TemplateProps & { view: Extract<BusinessView, { template: "improve_listing" }> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const { proposed, expectedUpdatedAt } = view;
  async function approve() {
    if (!proposed || !expectedUpdatedAt) return;
    setState("saving");
    const failure = await onApplyDescription({ listingId: view.listingId, expectedUpdatedAt, description: proposed });
    setError(failure);
    setState(failure ? "idle" : "saved");
  }
  return (
    <section aria-label="Improve listing" className="mt-3">
      {view.listingTitle ? <h3 className="text-base font-semibold">{view.listingTitle}</h3> : null}
      {view.current ? (
        <div className={cn(card, "mt-2")}>
          <h4 className={sectionTitle}>Now</h4>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{view.current}</p>
        </div>
      ) : null}
      {proposed ? (
        <div className={cn(card, "mt-2 border-forest/40")}>
          <h4 className={sectionTitle}>Suggested</h4>
          <p className="mt-1 whitespace-pre-line text-sm">{proposed}</p>
          <p className="mt-2 text-xs text-muted-foreground">{view.source === "ai" ? "Written from the listing's own details. Nothing was added." : "A plain version from the listing's details."} Nothing changes until you tap Approve.</p>
          {state === "saved" ? (
            <p role="status" className="mt-2 text-sm font-semibold text-forest">Description updated.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={approve} disabled={!view.canApprove || state === "saving"} className={primaryChip}>
                {state === "saving" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                Approve
              </button>
              <CopyButton text={proposed} label="Copy" />
              {view.approveNote ? <span className="text-sm text-muted-foreground">{view.approveNote}</span> : null}
            </div>
          )}
          {error ? <p role="alert" className="mt-2 text-sm text-status-warning-text">{error}</p> : null}
        </div>
      ) : null}
      {view.editHref ? <Link href={view.editHref} className={cn(plainChip, "mt-2")}>Open the listing form</Link> : null}
      <Notes notes={view.notes} />
    </section>
  );
}

// Change preview -------------------------------------------------------------------------------

function ChangePreviewTemplate({ view, onApprove }: TemplateProps & { view: Extract<BusinessView, { template: "change_preview" }> }) {
  const { preview } = view;
  const groupName = useId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(preview.items.filter((item) => item.preselected && item.canApprove && !item.oneAtATime).map((item) => item.id)));
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ results: ApprovalResult[] } | { error: string } | null>(null);
  const anyApprovable = preview.items.some((item) => item.canApprove);

  function toggle(item: ChangeItem) {
    setSelected((current) => {
      // A decision about a person is approved on its own, so it replaces any other choice.
      if (item.oneAtATime) return current.has(item.id) ? new Set() : new Set([item.id]);
      const next = new Set([...current].filter((id) => !preview.items.find((candidate) => candidate.id === id)?.oneAtATime));
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  async function approve() {
    setBusy(true);
    setOutcome(await onApprove(view.change, [...selected]));
    setBusy(false);
  }

  const results = outcome && "results" in outcome ? new Map(outcome.results.map((result) => [result.id, result])) : null;
  return (
    <section aria-label="Change preview" className="mt-3">
      <h3 className="text-base font-semibold">{preview.title}</h3>
      {preview.empty ? <Empty>{preview.empty}</Empty> : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">Nothing changes until you tap Approve.{preview.items.some((item) => item.oneAtATime) ? " Decisions about a person are approved one at a time." : ""}</p>
          <ul className="mt-2 space-y-2">
            {preview.items.map((item) => {
              const result = results?.get(item.id);
              return (
                <li key={item.id} className={card}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type={item.oneAtATime ? "radio" : "checkbox"}
                      name={item.oneAtATime ? groupName : undefined}
                      checked={selected.has(item.id)}
                      disabled={!item.canApprove || busy || Boolean(result?.ok)}
                      onChange={() => toggle(item)}
                      onClick={(event) => {
                        // Radios can't be unticked by the browser; let a second tap clear it.
                        if (item.oneAtATime && selected.has(item.id)) {
                          event.preventDefault();
                          toggle(item);
                        }
                      }}
                      className="mt-1 size-5 shrink-0 accent-[var(--color-forest,currentColor)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.detail}</span>
                      {result ? <span role="status" className={cn("mt-1 block text-xs font-semibold", result.ok ? "text-forest" : "text-status-warning-text")}>{result.message}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={approve} disabled={!anyApprovable || !selected.size || busy} className={primaryChip}>
              {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              Approve{selected.size > 1 ? ` ${selected.size}` : ""}
            </button>
            {preview.approveNote ? <span className="text-sm text-muted-foreground">{preview.approveNote}</span> : null}
          </div>
          {outcome && "error" in outcome ? <p role="alert" className="mt-2 text-sm text-status-warning-text">{outcome.error}</p> : null}
        </>
      )}
    </section>
  );
}

// Viewing slots --------------------------------------------------------------------------------

function ViewingSlotsTemplate({ view }: { view: Extract<BusinessView, { template: "viewing_slots" }> }) {
  return (
    <section aria-label="Viewing slots" className="mt-3">
      {view.listingTitle ? <p className="text-sm text-muted-foreground">Open times for <span className="font-semibold text-ink">{view.listingTitle}</span>, from your viewing hours.</p> : null}
      {view.slots.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {view.slots.map((slot) => (
            <li key={slot.start} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-semibold">
              <CalendarClock className="size-4" aria-hidden="true" />
              {formatSlotRequest(slot.start)}
            </li>
          ))}
        </ul>
      ) : null}
      {view.slots.length ? <p className="mt-2 text-xs text-muted-foreground">People can book these times themselves from your listing&apos;s Contact sheet.</p> : null}
      <Notes notes={view.notes} />
      {view.fixHref ? <Link href={view.fixHref} className={cn(plainChip, "mt-2")}>Set viewing hours</Link> : null}
    </section>
  );
}

// Reminders ------------------------------------------------------------------------------------

function ReminderList({ reminders, actions }: { reminders: readonly ReminderView[]; actions: ReminderActions }) {
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const run = async (id: string, task: () => Promise<string | null>) => {
    const failure = await task();
    setError(failure);
    if (!failure) setGone((current) => new Set([...current, id]));
  };
  const visible = reminders.filter((reminder) => !gone.has(reminder.id));
  if (!visible.length) return <Empty>No reminders.</Empty>;
  return (
    <>
      <ul className="mt-2 space-y-2">
        {visible.map((reminder) => (
          <li key={reminder.id} className={card}>
            <p className="text-sm font-semibold">{reminder.note}</p>
            <p className={cn("mt-0.5 flex items-center gap-1 text-xs", reminder.due ? "font-semibold text-status-warning-text" : "text-muted-foreground")}>
              <Clock className="size-3.5" aria-hidden="true" />
              {reminder.due ? "Due " : ""}{when(reminder.dueAt)}{reminder.personName ? ` · ${reminder.personName}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => run(reminder.id, () => actions.done(reminder.id))} className={plainChip} aria-label={`Done: ${reminder.note}`}>Done</button>
              <button type="button" onClick={() => run(reminder.id, () => actions.snooze(reminder.id, "tomorrow"))} className={plainChip}>Tomorrow</button>
              <button type="button" onClick={() => run(reminder.id, () => actions.snooze(reminder.id, "next-week"))} className={plainChip}>Next week</button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-sm text-status-warning-text">{error}</p> : null}
    </>
  );
}

const DUE_CHOICES = [
  { value: "today", label: "Later today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "friday", label: "Friday" },
  { value: "next-week", label: "Next week" },
] as const;

function ReminderDraft({ draft, actions }: { draft: NonNullable<Extract<BusinessView, { template: "reminders" }>["draft"]>; actions: ReminderActions }) {
  const [note, setNote] = useState(draft.note);
  const [due, setDue] = useState<(typeof DUE_CHOICES)[number]["value"]>("tomorrow");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  if (state === "saved") return <p role="status" className="text-sm font-semibold text-forest">Reminder saved. Only you can see it.</p>;
  return (
    <form
      aria-label="New reminder"
      className={card}
      onSubmit={async (event) => {
        event.preventDefault();
        setState("saving");
        const failure = await actions.save({ note, due, ...(draft.personKey ? { personKey: draft.personKey } : {}) });
        setError(failure);
        setState(failure ? "idle" : "saved");
      }}
    >
      <label htmlFor={noteId} className={sectionTitle}>Remind me to</label>
      <input id={noteId} value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-panel px-3 text-sm outline-none focus:border-forest focus:ring-1 focus:ring-forest" />
      <fieldset className="mt-2">
        <legend className="sr-only">When</legend>
        <div className="flex flex-wrap gap-2">
          {DUE_CHOICES.map((choice) => (
            <button key={choice.value} type="button" aria-pressed={due === choice.value} onClick={() => setDue(choice.value)} className={cn(chipButton, due === choice.value ? "border-transparent bg-selection text-selection-foreground" : "border-border bg-background text-ink")}>
              {choice.label}
            </button>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={!note.trim() || state === "saving"} className={cn(primaryChip, "mt-3")}>
        {state === "saving" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        Save reminder
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-status-warning-text">{error}</p> : null}
    </form>
  );
}

function RemindersTemplate({ view, reminders }: TemplateProps & { view: Extract<BusinessView, { template: "reminders" }> }) {
  return (
    <section aria-label="Reminders" className="mt-3">
      {view.draft ? <ReminderDraft draft={view.draft} actions={reminders} /> : null}
      <h3 className={cn(sectionTitle, "mt-4")}>Your reminders</h3>
      <ReminderList reminders={view.reminders} actions={reminders} />
      <p className="mt-2 text-xs text-muted-foreground">Reminders show here only. They aren&apos;t sent as notifications, and other team members never see them.</p>
      <Notes notes={view.notes} />
    </section>
  );
}

export const TEMPLATE_TITLES: Record<BusinessView["template"], string> = {
  today: "Today",
  people_list: "People",
  person_detail: "Person",
  question_insights: "What people ask about",
  new_listing: "New listing",
  quality_check: "Quality check",
  improve_listing: "Improve a description",
  performance: "How your listings are doing",
  change_preview: "Check before approving",
  viewing_slots: "Viewing times",
  reminders: "Reminders",
};

export function BusinessTemplate({ view, ...props }: TemplateProps & { view: BusinessView }) {
  switch (view.template) {
    case "today":
      return <TodayTemplate view={view} {...props} />;
    case "people_list":
      return <PeopleTemplate view={view} {...props} />;
    case "person_detail":
      return <PersonDetailTemplate view={view} {...props} />;
    case "question_insights":
      return <InsightsTemplate view={view} />;
    case "new_listing":
      return <NewListingTemplate view={view} />;
    case "quality_check":
      return <QualityTemplate view={view} {...props} />;
    case "improve_listing":
      return <ImproveListingTemplate view={view} {...props} />;
    case "performance":
      return <PerformanceTemplate view={view} />;
    case "change_preview":
      return <ChangePreviewTemplate view={view} {...props} />;
    case "viewing_slots":
      return <ViewingSlotsTemplate view={view} />;
    case "reminders":
      return <RemindersTemplate view={view} {...props} />;
  }
}
