/**
 * The swipe feed's queue: which listing is on screen, what was passed this
 * session, and what Undo can reverse. Pure, so the feed's rules live here and
 * the components only render and dispatch.
 */

export type FeedAction = { type: "pass" | "save"; id: string };

export type FeedState = {
  /** Listing ids from the current result set (viewport, chips, filters, sort). */
  order: readonly string[];
  /** The listing on screen; null at the end of the feed or with no results. */
  cursor: string | null;
  /** Passed this browser session (requirement 3.5). */
  passed: ReadonlySet<string>;
  /** Most recent last; capped at HISTORY_LIMIT. */
  history: readonly FeedAction[];
};

export type FeedEvent =
  | FeedAction
  | { type: "undo" }
  | { type: "results"; order: readonly string[] }
  | { type: "open"; id: string }
  | { type: "restorePassed" };

export const HISTORY_LIMIT = 20;

export function createFeedState(
  order: readonly string[],
  { passed = [], cursor }: { passed?: Iterable<string>; cursor?: string } = {},
): FeedState {
  const state: FeedState = { order, cursor: null, passed: new Set(passed), history: [] };
  if (cursor) return feedReducer(state, { type: "open", id: cursor });
  return { ...state, cursor: firstVisible(state) };
}

export function feedReducer(state: FeedState, event: FeedEvent): FeedState {
  switch (event.type) {
    case "pass":
    case "save": {
      const index = state.order.indexOf(event.id);
      if (index === -1) return state;
      const passed = event.type === "pass" ? withItem(state.passed, event.id) : state.passed;
      const next = { ...state, passed, history: [...state.history, event].slice(-HISTORY_LIMIT) };
      return { ...next, cursor: firstVisible(next, index + 1) };
    }
    case "undo": {
      const last = state.history.at(-1);
      if (!last) return state;
      return {
        ...state,
        cursor: last.id,
        passed: last.type === "pass" ? withoutItem(state.passed, last.id) : state.passed,
        history: state.history.slice(0, -1),
      };
    }
    case "results": {
      const present = new Set(event.order);
      const next = { ...state, order: event.order, history: state.history.filter((action) => present.has(action.id)) };
      const keep = state.cursor !== null && present.has(state.cursor) && !state.passed.has(state.cursor);
      return { ...next, cursor: keep ? state.cursor : firstVisible(next) };
    }
    case "open": {
      const order = state.order.includes(event.id) ? state.order : [event.id, ...state.order];
      return { ...state, order, cursor: event.id, passed: withoutItem(state.passed, event.id) };
    }
    case "restorePassed": {
      const next = { ...state, passed: new Set<string>(), history: state.history.filter((action) => action.type !== "pass") };
      return { ...next, cursor: firstVisible(next) };
    }
  }
}

export function currentId(state: FeedState) {
  return state.cursor;
}

export function visibleIds(state: FeedState) {
  return state.order.filter((id) => !state.passed.has(id));
}

/** The next listings after the current one, for prefetching their media. */
export function upcomingIds(state: FeedState, count: number) {
  if (state.cursor === null) return [];
  const visible = visibleIds(state);
  const index = visible.indexOf(state.cursor);
  return visible.slice(index + 1, index + 1 + count);
}

/** 1-based position of the current listing among visible ones; 0 when there is none. */
export function feedPosition(state: FeedState) {
  const visible = visibleIds(state);
  return { index: state.cursor === null ? 0 : visible.indexOf(state.cursor) + 1, total: visible.length };
}

function firstVisible(state: Pick<FeedState, "order" | "passed">, from = 0) {
  for (let index = from; index < state.order.length; index += 1) {
    const id = state.order[index]!;
    if (!state.passed.has(id)) return id;
  }
  return null;
}

function withItem(set: ReadonlySet<string>, id: string) {
  return set.has(id) ? set : new Set(set).add(id);
}

function withoutItem(set: ReadonlySet<string>, id: string) {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}
