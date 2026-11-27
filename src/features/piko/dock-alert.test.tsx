// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import type { NotificationItem } from "@/features/notifications/inbox-contract";
import { NotificationContext } from "@/features/notifications/notification-provider";

import { PikoDockAlert, pickSearchMatchAlert, pikoAnnouncesNotification } from "./dock-alert";

const LISTING = "/listing/9175bc86-f808-4aae-bc1b-fe9f2e9f2cae";

function item(id: string, overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id,
    title: "Saved search match",
    message: "A new home matches your saved search.",
    createdAt: "2026-11-24T10:00:00Z",
    unread: true,
    href: LISTING,
    category: "saved_searches",
    ...overrides,
  };
}

function withItems(items: NotificationItem[], enabled = true) {
  const value = {
    userId: "user-1", items, unreadCount: items.length, serverNow: "", enabled,
    error: null, refresh: async () => {}, change: async () => true,
  };
  return render(<NotificationContext.Provider value={value}><PikoDockAlert /></NotificationContext.Provider>);
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("pickSearchMatchAlert", () => {
  it("should_pick_the_newest_unread_saved_search_match", () => {
    const alert = pickSearchMatchAlert([item("b"), item("a")], new Set());
    expect(alert).toEqual({ item: expect.objectContaining({ id: "b" }), count: 2, ids: ["b", "a"] });
  });

  it("should_ignore_read_matches_other_categories_and_matches_already_shown", () => {
    const items = [item("read", { unread: false }), item("msg", { category: "messages" }), item("seen"), item("new")];
    const alert = pickSearchMatchAlert(items, new Set(["seen"]));
    expect(alert).toEqual({ item: expect.objectContaining({ id: "new" }), count: 1, ids: ["new"] });
  });

  it("should_return_null_when_nothing_new_matches", () => {
    expect(pickSearchMatchAlert([item("a", { unread: false })], new Set())).toBeNull();
  });
});

describe("PikoDockAlert", () => {
  it("should_pop_up_with_the_line_and_a_link_to_the_match", () => {
    withItems([item("a")]);
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("Something interesting just popped up!");
    expect(alert.querySelector("[data-piko-animate='pop']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "See the match" })).toHaveAttribute("href", LISTING);
  });

  it("should_link_to_notifications_when_several_matches_are_new", () => {
    withItems([item("a"), item("b")]);
    expect(screen.getByRole("status")).toHaveTextContent("2 new homes match your saved searches.");
    expect(screen.getByRole("link", { name: "See all 2" })).toHaveAttribute("href", "/profile/notifications");
  });

  it("should_hide_when_dismissed", () => {
    withItems([item("a")]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should_pop_up_only_once_per_match", () => {
    withItems([item("a")]);
    cleanup();
    withItems([item("a")]);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should_pop_up_again_for_a_later_match", () => {
    const { rerender } = withItems([item("a")]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    const value = {
      userId: "user-1", items: [item("b"), item("a")], unreadCount: 2, serverNow: "", enabled: true,
      error: null, refresh: async () => {}, change: async () => true,
    };
    act(() => { rerender(<NotificationContext.Provider value={value}><PikoDockAlert /></NotificationContext.Provider>); });
    expect(screen.getByRole("status")).toHaveTextContent("Something interesting just popped up!");
    expect(screen.getByRole("link", { name: "See the match" })).toBeInTheDocument();
  });

  it("should_remember_a_shown_match_on_the_device", () => {
    withItems([item("a")]);
    expect(JSON.parse(localStorage.getItem("pinpoint:piko-alerts-seen") ?? "[]")).toEqual(["a"]);
  });

  it("should_keep_the_pop_up_when_a_refresh_brings_nothing_new", () => {
    const { rerender } = withItems([item("a")]);
    const value = {
      userId: "user-1", items: [item("a")], unreadCount: 1, serverNow: "", enabled: true,
      error: null, refresh: async () => {}, change: async () => true,
    };
    act(() => { rerender(<NotificationContext.Provider value={value}><PikoDockAlert /></NotificationContext.Provider>); });
    expect(screen.getByRole("link", { name: "See the match" })).toBeInTheDocument();
  });

  it("should_stay_quiet_when_notifications_are_off", () => {
    withItems([item("a")], false);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("pikoAnnouncesNotification", () => {
  it("should_claim_saved_search_matches_only_while_the_dock_alert_is_mounted", () => {
    expect(pikoAnnouncesNotification(item("a"))).toBe(false);
    withItems([]);
    expect(pikoAnnouncesNotification(item("a"))).toBe(true);
    expect(pikoAnnouncesNotification(item("m", { category: "messages" }))).toBe(false);
    cleanup();
    expect(pikoAnnouncesNotification(item("a"))).toBe(false);
  });
});
