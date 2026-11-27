"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import type { NotificationItem } from "@/features/notifications/inbox-contract";
import { useNotifications } from "@/features/notifications/notification-provider";
import { claimToasts, isToastClaimed } from "@/features/notifications/toast-claims";

import { pikoLine, pikoMood } from "./lines";
import { Piko } from "./piko";

/**
 * Piko pops up from the dock when a saved search has a new match (docs/piko-character-bible.md,
 * Phase 2 step 6). It reads the live notifications, so a match arrives the same way a toast does,
 * and pops up once per match: the ids it has shown are kept on the device.
 */

const SAVED_SEARCHES = "saved_searches";
const SEEN_KEY = "pinpoint:piko-alerts-seen";
/** Enough to cover any unread backlog without the list growing forever. */
const SEEN_LIMIT = 100;
const NOTIFICATIONS_HREF = "/profile/notifications";

export type SearchMatchAlert = { item: NotificationItem; count: number; ids: string[] };

/** The newest unread saved-search match Piko hasn't shown yet, with how many are new. Items come newest first. */
export function pickSearchMatchAlert(items: readonly NotificationItem[], seen: ReadonlySet<string>): SearchMatchAlert | null {
  const fresh = items.filter(item => item.unread && item.category === SAVED_SEARCHES && !seen.has(item.id));
  const [first] = fresh;
  return first ? { item: first, count: fresh.length, ids: fresh.map(item => item.id) } : null;
}

function readSeen(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function rememberSeen(ids: readonly string[]) {
  try {
    const next = [...ids, ...readSeen()].filter((id, index, all) => all.indexOf(id) === index).slice(0, SEEN_LIMIT);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* Storage can be unavailable; Piko may then pop up again on the next visit. */
  }
}

/** Whether Piko will announce this notification, so the live toast doesn't repeat it. */
export const pikoAnnouncesNotification = isToastClaimed;

/** The dock is CSS-hidden on desktop pages other than the map, where Piko can't be seen. */
function dockShown(onDesktop: boolean) {
  if (onDesktop || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(min-width: 1024px)").matches;
}

export function PikoDockAlert({ onDesktop = false }: { onDesktop?: boolean }) {
  const live = useNotifications();
  const [alert, setAlert] = useState<SearchMatchAlert | null>(null);
  const items = live?.enabled ? live.items : null;
  // Starts with no items so the first client render with notifications looks for a match.
  // Notifications are off during server rendering, so the browser-only checks below never run there.
  const [checked, setChecked] = useState<{ items: readonly NotificationItem[] | null; onDesktop: boolean }>({ items: null, onDesktop });

  if (checked.items !== items || checked.onDesktop !== onDesktop) {
    setChecked({ items, onDesktop });
    const next = items && dockShown(onDesktop) ? pickSearchMatchAlert(items, readSeen()) : null;
    if (next) setAlert(next);
  }

  useEffect(() => claimToasts(item => item.category === SAVED_SEARCHES && dockShown(onDesktop)), [onDesktop]);

  // Shown counts as seen straight away: a reload or another tab won't pop the same match again.
  useEffect(() => { if (alert) rememberSeen(alert.ids); }, [alert]);

  if (!alert) return null;
  const several = alert.count > 1;
  const href = several || !alert.item.href ? NOTIFICATIONS_HREF : alert.item.href;
  const dismiss = () => setAlert(null);

  return (
    <div
      role="status"
      data-piko-dock-alert
      className="pointer-events-auto absolute bottom-full right-0 mb-3 flex w-[min(20rem,calc(100vw-2rem))] items-end gap-2"
    >
      <Piko key={alert.item.id} mood={pikoMood("alert_fired")} height={72} animate="pop" className="-mb-1" />
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-bl-sm border border-border/70 bg-panel p-3 pr-8 text-sm text-ink shadow-[var(--elevation-2)]">
        <p className="font-semibold">{pikoLine("alert_fired")}</p>
        <p className="mt-0.5 text-muted-foreground">
          {several ? `${alert.count} new homes match your saved searches.` : alert.item.message}
        </p>
        <Link prefetch={false} href={href} onClick={dismiss}
          className="mt-2 inline-flex rounded-full bg-[var(--brand-amber)] px-3 py-1 text-xs font-semibold text-[var(--brand-charcoal)] outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {several ? `See all ${alert.count}` : "See the match"}
        </Link>
        <button type="button" aria-label="Dismiss" onClick={dismiss}
          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
