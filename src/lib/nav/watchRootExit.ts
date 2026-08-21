/**
 * Watch root exit: DOUBLE_BACK_TO_EXIT.
 * Swiping videos changes the local feed index only — never a history entry.
 */

import {
  classifySurface,
  isInternalRouteName,
  isRedirectOnlyRoute,
  normalizeNavPath,
} from "./globalBack";

export const WATCH_ROOT_EXIT_MODEL = "DOUBLE_BACK_TO_EXIT" as const;
export const WATCH_DOUBLE_BACK_TIMEOUT_MS = 1800;
export const VIDEO_HISTORY_STACK_GROWTH = 0 as const;

export function watchVideoSwipeStackDelta(_swipeCount: number): 0 {
  return VIDEO_HISTORY_STACK_GROWTH;
}

function inferSegments(path: string): string[] {
  const raw = path.trim().split("?")[0] ?? "";
  return raw.split("/").filter(Boolean);
}

function leafFromSegments(segments: readonly string[]): string {
  return segments.filter((s) => !s.startsWith("(")).join("/");
}

export function isWatchRootSurface(
  path: string,
  segments?: readonly string[]
): boolean {
  if (normalizeNavPath(path) === "/watch") return true;
  return leafFromSegments(segments ?? inferSegments(path)) === "watch";
}

function firstParam(
  value: string | string[] | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildWatchEntryHref(input: {
  path: string;
  segments?: readonly string[];
  query?: Record<string, string | string[] | undefined>;
}): string | null {
  if (isWatchRootSurface(input.path, input.segments)) return null;

  const surface = classifySurface({
    path: input.path,
    segments: input.segments,
  });
  if (surface === "redirect" || surface === "auth-root") return null;

  const segments = input.segments ?? inferSegments(input.path);
  const leaf = leafFromSegments(segments);
  const n = normalizeNavPath(input.path);

  if (surface === "root") {
    if (!leaf || leaf === "watch") return null;
    return `/(tabs)/${leaf}`;
  }

  if (n === "/profile" || leaf === "profile" || leaf === "profile/index") {
    const qs = new URLSearchParams();
    const username = firstParam(input.query?.u);
    const id = firstParam(input.query?.id);
    if (username) qs.set("u", username);
    if (id) qs.set("id", id);
    const query = qs.toString();
    return query ? `/profile?${query}` : "/profile";
  }

  if (leaf.startsWith("messages/") || /^\/messages\/[^/]+$/.test(n)) {
    return n.startsWith("/messages/") ? n : `/${leaf}`;
  }

  if (
    n === "/settings" ||
    n === "/language" ||
    n === "/notifications" ||
    n === "/rewards" ||
    n === "/world" ||
    n === "/blocked-users" ||
    n === "/change-password" ||
    /^\/sound\/[^/]+$/.test(n)
  ) {
    return n;
  }

  if (
    n === "/signup" ||
    n === "/forgot-password" ||
    n === "/update-password"
  ) {
    return null;
  }

  if (n && n !== "/" && n !== "/index") return n;
  return null;
}

type EntryState = {
  onWatch: boolean;
  entryHref: string | null;
};

let entryState: EntryState = { onWatch: false, entryHref: null };

export function resetWatchEntryContextForTests(): void {
  entryState = { onWatch: false, entryHref: null };
}

export function peekWatchEntryHref(): string | null {
  return entryState.entryHref;
}

export function noteWatchNavPath(input: {
  path: string;
  segments?: readonly string[];
  query?: Record<string, string | string[] | undefined>;
}): string | null {
  const onWatch = isWatchRootSurface(input.path, input.segments);
  if (onWatch) {
    entryState = { ...entryState, onWatch: true };
    return entryState.entryHref;
  }

  const surface = classifySurface({
    path: input.path,
    segments: input.segments,
  });

  if (entryState.onWatch && surface === "secondary") {
    entryState = { ...entryState, onWatch: false };
    return entryState.entryHref;
  }

  entryState = {
    onWatch: false,
    entryHref: buildWatchEntryHref(input),
  };
  return entryState.entryHref;
}

export type WatchRootBackInput = {
  nowMs: number;
  armedUntilMs: number | null;
  nestedOverlayOpen: boolean;
  atWatchRoot: boolean;
};

export type WatchRootBackDecision =
  | { action: "ignore" }
  | { action: "close-nested" }
  | { action: "arm-exit"; armedUntilMs: number }
  | { action: "exit" };

export function resolveWatchRootBack(
  input: WatchRootBackInput
): WatchRootBackDecision {
  if (!input.atWatchRoot) return { action: "ignore" };
  if (input.nestedOverlayOpen) return { action: "close-nested" };
  const armed =
    input.armedUntilMs != null && input.nowMs < input.armedUntilMs;
  if (!armed) {
    return {
      action: "arm-exit",
      armedUntilMs: input.nowMs + WATCH_DOUBLE_BACK_TIMEOUT_MS,
    };
  }
  return { action: "exit" };
}

export function isWatchExitHistoryPrevious(
  previousRouteName: string | null | undefined
): boolean {
  if (!previousRouteName) return false;
  if (isInternalRouteName(previousRouteName)) return false;
  if (isRedirectOnlyRoute(previousRouteName)) return false;
  const n = normalizeNavPath(previousRouteName);
  return n !== "/watch" && n !== "/" && n !== "/index";
}

export type WatchExitNavDecision =
  | { action: "history-back" }
  | { action: "replace"; href: string }
  | { action: "system-exit" };

export function resolveWatchExitNavigation(input: {
  entryHref: string | null;
  canGoBack: boolean;
  previousRouteName: string | null;
}): WatchExitNavDecision {
  if (
    input.canGoBack &&
    isWatchExitHistoryPrevious(input.previousRouteName)
  ) {
    return { action: "history-back" };
  }
  if (input.entryHref && normalizeNavPath(input.entryHref) !== "/watch") {
    return { action: "replace", href: input.entryHref };
  }
  return { action: "system-exit" };
}

/** Android hardware/system Back only. iOS must not fake a hardware Back. */
export function shouldInterceptWatchRootBack(
  platform: "ios" | "android" | string
): boolean {
  return platform === "android";
}

export function shouldConsumeHardwareBack(
  decision: WatchRootBackDecision,
  exitNav: WatchExitNavDecision | null
): boolean {
  if (decision.action === "ignore") return false;
  if (decision.action === "close-nested" || decision.action === "arm-exit") {
    return true;
  }
  return exitNav?.action !== "system-exit";
}
