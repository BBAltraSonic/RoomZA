export type ScrollDirection = "idle" | "up" | "down";

export type AdaptiveChromeState = "expanded" | "compact" | "minimal" | "hidden";

export type ScrollAdaptationInput = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  previousScrollTop?: number;
  deltaTimeMs?: number;
  focusLocked?: boolean;
  openLocked?: boolean;
  reducedMotion?: boolean;
  neverHidden?: boolean;
  thresholds?: Partial<ScrollAdaptationThresholds>;
};

export type ScrollAdaptationThresholds = {
  jitterPx: number;
  compactAfterPx: number;
  minimalAfterPx: number;
  hiddenAfterPx: number;
  fastVelocityPxPerMs: number;
};

export type ScrollAdaptationState = {
  chrome: AdaptiveChromeState;
  direction: ScrollDirection;
  progress: number;
  scrollTop: number;
  velocity: number;
  atStart: boolean;
  atEnd: boolean;
};

const DEFAULT_THRESHOLDS: ScrollAdaptationThresholds = {
  jitterPx: 4,
  compactAfterPx: 48,
  minimalAfterPx: 180,
  hiddenAfterPx: 420,
  fastVelocityPxPerMs: 0.8,
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function scrollProgress(scrollTop: number, scrollHeight: number, clientHeight: number) {
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  return maxScroll <= 0 ? 0 : clamp01(scrollTop / maxScroll);
}

export function deriveScrollAdaptation(input: ScrollAdaptationInput): ScrollAdaptationState {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const scrollTop = Math.max(0, input.scrollTop || 0);
  const previousScrollTop = Math.max(0, input.previousScrollTop ?? scrollTop);
  const delta = scrollTop - previousScrollTop;
  const absDelta = Math.abs(delta);
  const direction: ScrollDirection =
    absDelta < thresholds.jitterPx ? "idle" : delta > 0 ? "down" : "up";
  const velocity = input.deltaTimeMs && input.deltaTimeMs > 0 ? delta / input.deltaTimeMs : 0;
  const progress = scrollProgress(scrollTop, input.scrollHeight, input.clientHeight);
  const atStart = scrollTop <= thresholds.jitterPx;
  const maxScroll = Math.max(0, input.scrollHeight - input.clientHeight);
  const atEnd = maxScroll <= 0 || maxScroll - scrollTop <= thresholds.jitterPx;
  const locked = input.focusLocked || input.openLocked;

  let chrome: AdaptiveChromeState = "expanded";

  if (locked || atStart) {
    chrome = "expanded";
  } else if (direction === "up") {
    chrome = scrollTop > thresholds.minimalAfterPx ? "compact" : "expanded";
  } else if (scrollTop >= thresholds.hiddenAfterPx && Math.abs(velocity) >= thresholds.fastVelocityPxPerMs) {
    chrome = "hidden";
  } else if (scrollTop >= thresholds.minimalAfterPx) {
    chrome = "minimal";
  } else if (scrollTop >= thresholds.compactAfterPx) {
    chrome = "compact";
  }

  if (input.neverHidden && chrome === "hidden") {
    chrome = "minimal";
  }

  if (input.reducedMotion && chrome === "hidden") {
    chrome = input.neverHidden ? "minimal" : "compact";
  }

  return {
    chrome,
    direction,
    progress,
    scrollTop,
    velocity,
    atStart,
    atEnd,
  };
}
