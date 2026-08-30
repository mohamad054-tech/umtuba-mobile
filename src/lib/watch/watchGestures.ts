/**
 * Watch P0 interaction: one tap classifier + refresh gate.
 * Does not own paging, scrub, volume, or player lifecycle.
 */

/** Short enough that play/pause still feels immediate. */
export const WATCH_DOUBLE_TAP_WINDOW_MS = 240;

export const WATCH_LIKE_ACK_MS = 320;

export type WatchGestureSurface =
  | "video"
  | "rail"
  | "comments"
  | "share"
  | "save"
  | "like-control"
  | "sound"
  | "profile"
  | "caption"
  | "timeline"
  | "volume"
  | "retry"
  | "quick-actions"
  | "header";

export type WatchTapAction = "schedule-single" | "double";

export type WatchTapResolution = {
  action: WatchTapAction;
  nextLastTapAt: number | null;
  cancelPendingSingle: boolean;
};

export function resolveWatchTapAction(input: {
  nowMs: number;
  lastTapAt: number | null;
  windowMs?: number;
}): WatchTapResolution {
  const windowMs =
    typeof input.windowMs === "number" && input.windowMs > 0
      ? input.windowMs
      : WATCH_DOUBLE_TAP_WINDOW_MS;
  if (
    input.lastTapAt != null &&
    Number.isFinite(input.lastTapAt) &&
    Number.isFinite(input.nowMs) &&
    input.nowMs >= input.lastTapAt &&
    input.nowMs - input.lastTapAt <= windowMs
  ) {
    return {
      action: "double",
      nextLastTapAt: null,
      cancelPendingSingle: true,
    };
  }
  return {
    action: "schedule-single",
    nextLastTapAt: input.nowMs,
    cancelPendingSingle: true,
  };
}

/** Only the safe video area may play/pause or double-tap like. */
export function shouldDispatchWatchVideoTap(
  surface: WatchGestureSurface
): boolean {
  return surface === "video";
}

export function shouldMountWatchVideoTapLayer(input: {
  paneStatus: "idle" | "loading" | "ready" | "error";
}): boolean {
  return input.paneStatus !== "error";
}

/**
 * Pull-to-refresh only at the first item. Index > 0 keeps downward
 * paging as the only vertical gesture.
 */
export function shouldEnableWatchPullToRefresh(activeIndex: number): boolean {
  return Number.isFinite(activeIndex) && activeIndex === 0;
}

export type WatchTapHandlers = {
  onSingle: () => void;
  onDouble: () => void;
};

type TimerId = ReturnType<typeof setTimeout>;

/**
 * One shared classifier. A second tap inside the window cancels the
 * pending single-tap play/pause and emits Like.
 */
export class WatchTapClassifier {
  private lastTapAt: number | null = null;
  private timer: TimerId | null = null;

  constructor(
    private readonly nowMs: () => number = Date.now,
    private readonly windowMs: number = WATCH_DOUBLE_TAP_WINDOW_MS,
    private readonly schedule: (
      fn: () => void,
      ms: number
    ) => TimerId = setTimeout,
    private readonly unschedule: (id: TimerId) => void = clearTimeout
  ) {}

  tap(handlers: WatchTapHandlers): "single-pending" | "double" | "ignored" {
    const resolved = resolveWatchTapAction({
      nowMs: this.nowMs(),
      lastTapAt: this.lastTapAt,
      windowMs: this.windowMs,
    });
    this.clearTimer();
    if (resolved.action === "double") {
      this.lastTapAt = null;
      handlers.onDouble();
      return "double";
    }
    this.lastTapAt = resolved.nextLastTapAt;
    this.timer = this.schedule(() => {
      this.timer = null;
      this.lastTapAt = null;
      handlers.onSingle();
    }, this.windowMs);
    return "single-pending";
  }

  cancel(): void {
    this.clearTimer();
    this.lastTapAt = null;
  }

  private clearTimer(): void {
    if (this.timer == null) return;
    this.unschedule(this.timer);
    this.timer = null;
  }
}

export function createWatchTapClassifier(options?: {
  nowMs?: () => number;
  windowMs?: number;
  schedule?: (fn: () => void, ms: number) => TimerId;
  unschedule?: (id: TimerId) => void;
}): WatchTapClassifier {
  return new WatchTapClassifier(
    options?.nowMs,
    options?.windowMs,
    options?.schedule,
    options?.unschedule
  );
}
