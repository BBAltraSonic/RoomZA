import type { RenterApplicationListItem, ViewingSlotRef } from "./application-types";

/**
 * The Rental Journey derives a rich, human progress narrative from the real
 * application state machine. The database only tracks six application statuses
 * (submitted / under_review / shortlisted / approved / rejected / withdrawn)
 * plus viewings, documents, slot offers, and conversations — so every journey
 * step below is grounded in an actual signal. Nothing here is fabricated.
 */

export type JourneyStepId =
  | "submitted"
  | "documents"
  | "reviewing"
  | "shortlisted"
  | "viewing_scheduled"
  | "viewing_completed"
  | "approved"
  | "move_in";

export type StepState = "complete" | "current" | "upcoming" | "blocked";

export type JourneyStep = {
  id: JourneyStepId;
  label: string;
  /** Short past-tense summary shown once the step is complete. */
  doneCaption: string;
  /** Forward-looking hint shown while the step is current/upcoming. */
  pendingCaption: string;
  icon: string;
  state: StepState;
  /** ISO timestamp when the step was reached, when we can attribute one. */
  at: string | null;
};

/** Who the journey is currently waiting on to move forward. */
export type JourneyWaitingOn = "renter" | "landlord" | "none";

export type JourneyOutcome = "active" | "approved" | "rejected" | "withdrawn";

export type NextAction = {
  /** Primary label, e.g. "Choose a viewing time". */
  label: string;
  /** What happened / what's next in one sentence. */
  detail: string;
  waitingOn: JourneyWaitingOn;
  /**
   * A route the renter can act on, when the ball is in their court.
   * `null` when they are waiting on the landlord.
   */
  href: string | null;
  cta: string | null;
};

export type Achievement = {
  id: string;
  label: string;
  icon: string;
};

export type DerivedJourney = {
  applicationId: string;
  listingId: string;
  listingTitle: string;
  listingAddress: string;
  listingPrice: number;
  outcome: JourneyOutcome;
  /** 0–100, rounded. */
  percent: number;
  steps: JourneyStep[];
  /** Index into `steps` of the active step, or -1 for terminal journeys. */
  currentStepIndex: number;
  nextAction: NextAction;
  achievements: Achievement[];
  /** ISO timestamp of the most recent meaningful change. */
  lastActivityAt: string;
};

// The ordered spine of a successful journey. Terminal negatives (rejected /
// withdrawn) branch off this spine at whatever point they occurred.
const STEP_ORDER: JourneyStepId[] = [
  "submitted",
  "documents",
  "reviewing",
  "shortlisted",
  "viewing_scheduled",
  "viewing_completed",
  "approved",
  "move_in",
];

const STEP_META: Record<
  JourneyStepId,
  { label: string; doneCaption: string; pendingCaption: string; icon: string }
> = {
  submitted: {
    label: "Application submitted",
    doneCaption: "We've received your application.",
    pendingCaption: "Send your application to get started.",
    icon: "send",
  },
  documents: {
    label: "Documents ready",
    doneCaption: "Your documents are attached and ready.",
    pendingCaption: "Add your ID and payslip to stand out.",
    icon: "file",
  },
  reviewing: {
    label: "Landlord reviewing",
    doneCaption: "The landlord has started reviewing you.",
    pendingCaption: "The landlord will review your application soon.",
    icon: "eye",
  },
  shortlisted: {
    label: "Shortlisted",
    doneCaption: "You made the shortlist. Great sign.",
    pendingCaption: "Strong applicants get shortlisted here.",
    icon: "star",
  },
  viewing_scheduled: {
    label: "Viewing scheduled",
    doneCaption: "Your viewing is booked in.",
    pendingCaption: "A viewing gets you one step closer.",
    icon: "calendar",
  },
  viewing_completed: {
    label: "Viewing completed",
    doneCaption: "You've seen the place in person.",
    pendingCaption: "Attend your viewing to continue.",
    icon: "home",
  },
  approved: {
    label: "Approved",
    doneCaption: "You're approved for this home.",
    pendingCaption: "The final decision is on its way.",
    icon: "handshake",
  },
  move_in: {
    label: "Move in",
    doneCaption: "Welcome home.",
    pendingCaption: "The keys to your new home await.",
    icon: "party",
  },
};

const ACTIVE_STATUSES = new Set(["submitted", "under_review", "shortlisted", "approved"]);

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

type ViewingRecord = NonNullable<RenterApplicationListItem["viewings"]>[number];

function slotOf(record: { slot: ViewingSlotRef | ViewingSlotRef[] | null }): ViewingSlotRef | null {
  return firstOf(record.slot);
}

/**
 * Compute which journey steps are complete from the raw application signals.
 * Returns a set of completed step ids plus the timestamp we attribute to each.
 */
function computeCompletion(app: RenterApplicationListItem) {
  const status = app.status;
  const documents = app.documents ?? [];
  const viewings: ViewingRecord[] = Array.isArray(app.viewings) ? app.viewings : [];

  const bookedViewing = viewings.find((v) => v.status === "booked");
  const completedViewing = viewings.find((v) => v.status === "completed");

  const statusReached = (target: string) => {
    // A later status implies earlier positive milestones were passed.
    const ladder = ["submitted", "under_review", "shortlisted", "approved"];
    const current = ladder.indexOf(status);
    const wanted = ladder.indexOf(target);
    if (current === -1 || wanted === -1) return status === target;
    return current >= wanted;
  };

  const bookedSlot = bookedViewing ? slotOf(bookedViewing) : null;
  const completedSlot = completedViewing ? slotOf(completedViewing) : null;

  const done = new Map<JourneyStepId, string | null>();

  // 1. Submitted — true the moment the application row exists.
  done.set("submitted", app.created_at);

  // 2. Documents — real: at least one document uploaded.
  if (documents.length > 0) done.set("documents", app.created_at);

  // 3. Reviewing — landlord moved the app off "submitted".
  if (statusReached("under_review")) done.set("reviewing", app.updated_at);

  // 4. Shortlisted.
  if (statusReached("shortlisted")) done.set("shortlisted", app.updated_at);

  // 5. Viewing scheduled — a booked viewing (or a completed one) exists.
  if (bookedViewing || completedViewing) {
    done.set("viewing_scheduled", bookedSlot?.start_time ?? completedSlot?.start_time ?? app.updated_at);
  }

  // 6. Viewing completed.
  if (completedViewing) {
    done.set("viewing_completed", completedSlot?.end_time ?? app.updated_at);
  }

  // 7. Approved.
  if (status === "approved") done.set("approved", app.updated_at);

  // Move-in is aspirational and has no backing signal yet, so it never
  // completes automatically — it stays as the shining final destination.

  return { done, bookedViewing, bookedSlot, completedViewing };
}

function buildNextAction(
  app: RenterApplicationListItem,
  outcome: JourneyOutcome,
  ctx: ReturnType<typeof computeCompletion>,
): NextAction {
  if (outcome === "approved") {
    return {
      label: "You're approved",
      detail: "Congratulations. Message the landlord to arrange your lease and deposit.",
      waitingOn: "renter",
      href: app.conversations?.[0]?.id ? `/messages/${app.conversations[0].id}` : "/messages",
      cta: "Message landlord",
    };
  }

  if (outcome === "rejected") {
    return {
      label: "Not this time",
      detail: "This application wasn't successful. Plenty more homes are waiting for you.",
      waitingOn: "none",
      href: "/",
      cta: "Browse homes",
    };
  }

  if (outcome === "withdrawn") {
    return {
      label: "Withdrawn",
      detail: "You withdrew this application. Start a fresh journey any time.",
      waitingOn: "none",
      href: "/",
      cta: "Browse homes",
    };
  }

  // Active journeys — surface the single most useful next step.
  const offers = Array.isArray(app.viewing_slot_offers) ? app.viewing_slot_offers : [];
  const openOffers = offers
    .map((offer) => firstOf(offer.slot))
    .filter((slot): slot is ViewingSlotRef => Boolean(slot && !slot.is_booked));

  if (ctx.bookedViewing && ctx.bookedSlot) {
    return {
      label: "Viewing booked",
      detail: "Your viewing is confirmed. Get your questions ready and plan your route.",
      waitingOn: "renter",
      href: "/applications",
      cta: "View details",
    };
  }

  if (openOffers.length > 0) {
    return {
      label: "Choose a viewing time",
      detail: "The landlord offered viewing slots. Pick the one that suits you.",
      waitingOn: "renter",
      href: "/applications",
      cta: "Pick a time",
    };
  }

  if (app.status === "shortlisted") {
    return {
      label: "You're shortlisted",
      detail: "The landlord is deciding between shortlisted applicants. Hang tight.",
      waitingOn: "landlord",
      href: null,
      cta: null,
    };
  }

  const hasDocuments = (app.documents ?? []).length > 0;
  if (!hasDocuments) {
    return {
      label: "Add your documents",
      detail: "Applications with an ID and payslip get reviewed faster.",
      waitingOn: "renter",
      href: `/listing/${app.listing_id}`,
      cta: "Upload documents",
    };
  }

  // submitted / under_review with documents present.
  return {
    label: "Landlord reviewing",
    detail: "The landlord has your application. We'll nudge things forward the moment they respond.",
    waitingOn: "landlord",
    href: null,
    cta: null,
  };
}

function buildAchievements(done: Map<JourneyStepId, string | null>, outcome: JourneyOutcome): Achievement[] {
  const earned: Achievement[] = [];
  if (done.has("submitted")) earned.push({ id: "started", label: "Journey Started", icon: "rocket" });
  if (done.has("documents")) earned.push({ id: "docs", label: "Documents Ready", icon: "file" });
  if (done.has("shortlisted")) earned.push({ id: "shortlist", label: "Shortlisted", icon: "star" });
  if (done.has("viewing_scheduled")) earned.push({ id: "viewing", label: "First Viewing", icon: "calendar" });
  if (outcome === "approved") earned.push({ id: "approved", label: "Approved", icon: "trophy" });
  return earned;
}

export function deriveJourney(app: RenterApplicationListItem): DerivedJourney {
  const listing = firstOf(app.listing);
  const ctx = computeCompletion(app);
  const { done } = ctx;

  const outcome: JourneyOutcome =
    app.status === "approved"
      ? "approved"
      : app.status === "rejected"
        ? "rejected"
        : app.status === "withdrawn"
          ? "withdrawn"
          : "active";

  // Build the ordered step list with resolved states.
  const isTerminalNegative = outcome === "rejected" || outcome === "withdrawn";

  // The current step is the first spine step that isn't done yet.
  let currentStepIndex = -1;
  if (!isTerminalNegative) {
    currentStepIndex = STEP_ORDER.findIndex((id) => !done.has(id));
    if (currentStepIndex === -1) currentStepIndex = STEP_ORDER.length - 1; // all done → move_in
  }

  const steps: JourneyStep[] = STEP_ORDER.map((id, index) => {
    const meta = STEP_META[id];
    const isDone = done.has(id);
    let state: StepState;
    if (isDone) {
      state = "complete";
    } else if (isTerminalNegative) {
      state = "blocked";
    } else if (index === currentStepIndex) {
      state = "current";
    } else {
      state = "upcoming";
    }
    return {
      id,
      label: meta.label,
      doneCaption: meta.doneCaption,
      pendingCaption: meta.pendingCaption,
      icon: meta.icon,
      state,
      at: done.get(id) ?? null,
    };
  });

  // Progress: share of the spine completed. Approved journeys read as 100%.
  const completedCount = STEP_ORDER.filter((id) => done.has(id)).length;
  const percent =
    outcome === "approved"
      ? 100
      : Math.round((completedCount / STEP_ORDER.length) * 100);

  const nextAction = buildNextAction(app, outcome, ctx);
  const achievements = buildAchievements(done, outcome);

  return {
    applicationId: app.id,
    listingId: app.listing_id,
    listingTitle: listing?.title ?? "Your application",
    listingAddress: listing?.address ?? "",
    listingPrice: listing?.price ?? 0,
    outcome,
    percent,
    steps,
    currentStepIndex,
    nextAction,
    achievements,
    lastActivityAt: app.updated_at ?? app.created_at,
  };
}

/** Sort helper: active journeys first, then approved, then closed; freshest first. */
export function sortJourneys(a: DerivedJourney, b: DerivedJourney): number {
  const rank: Record<JourneyOutcome, number> = { active: 0, approved: 1, rejected: 2, withdrawn: 2 };
  if (rank[a.outcome] !== rank[b.outcome]) return rank[a.outcome] - rank[b.outcome];
  return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
}

export { ACTIVE_STATUSES };
