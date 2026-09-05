import {
  sanitizeWatchListIndex,
  shouldLoadPlayer,
} from "./playbackPolicy";

/** The only reasons that may write Watch activeIndex. */
export type WatchIndexClaimReason =
  | "handoff-commit"
  | "native-settle"
  | "programmatic"
  | "bootstrap";

export type WatchActiveIndexArbiter = {
  activeIndex: number | null;
  navigationGeneration: number;
  lastSettledNativePage: number | null;
  userInteracted: boolean;
  pageClaimed: boolean;
};

export type WatchActiveIndexDecision = {
  accept: boolean;
  next: WatchActiveIndexArbiter;
  rejectReason?: string;
};

export function createWatchActiveIndexArbiter(): WatchActiveIndexArbiter {
  return {
    activeIndex: null,
    navigationGeneration: 0,
    lastSettledNativePage: null,
    userInteracted: false,
    pageClaimed: false,
  };
}

/**
 * Viewability never writes activeIndex. It is an INTENT input to the
 * handoff machine. The machine may later commit via handoff-commit.
 */
export function decideWatchViewabilityEvidence(): {
  mayClaimActiveIndex: false;
} {
  return { mayClaimActiveIndex: false };
}

/**
 * Reject a delayed index-0 claim after a confirmed settle on page 1+
 * unless a new native offset proves the user returned to page 0.
 */
export function shouldRejectStaleIndexZero(input: {
  requestedIndex: number;
  lastSettledNativePage: number | null;
  provenNativePage: number | null;
}): boolean {
  if (input.requestedIndex !== 0) return false;
  const last = input.lastSettledNativePage;
  if (last == null || last < 1) return false;
  return input.provenNativePage !== 0;
}

/** Keep the visible settled cell mounted while JS and native disagree. */
export function shouldRetainWatchSurface(input: {
  itemIndex: number;
  activeIndex: number;
  lastSettledNativePage: number | null;
}): boolean {
  const native = input.lastSettledNativePage;
  if (native == null) return false;
  if (native === input.activeIndex) return false;
  return (
    input.itemIndex === native || input.itemIndex === input.activeIndex
  );
}

export function shouldLoadOwnedWatchPlayer(input: {
  index: number;
  activeIndex: number;
  platform?: string | null;
  lastSettledNativePage?: number | null;
  warmedTargetIndex?: number | null;
  prepareAdjacentNeighbors?: boolean;
}): boolean {
  if (shouldLoadPlayer(input.index, input.activeIndex, input.platform)) {
    return true;
  }
  if (shouldRetainWatchSurface({
    itemIndex: input.index,
    activeIndex: input.activeIndex,
    lastSettledNativePage: input.lastSettledNativePage ?? null,
  })) {
    return true;
  }
  const warmed = sanitizeWatchListIndex(input.warmedTargetIndex ?? Number.NaN);
  if (warmed != null && input.index === warmed) {
    return true;
  }
  if (input.prepareAdjacentNeighbors === true) {
    return Math.abs(input.index - input.activeIndex) === 1;
  }
  return false;
}

export function isIndependentWatchIndexWriter(
  reason: WatchIndexClaimReason
): boolean {
  return reason === "native-settle" || reason === "programmatic";
}

/**
 * Single writer for activeIndex. Watch transitions commit only through
 * handoff-commit. Bootstrap is the initial mount. Settle / programmatic /
 * viewability / first_frame / scrollToIndex are not writers.
 */
export function decideWatchActiveIndexClaim(input: {
  arbiter: WatchActiveIndexArbiter;
  reason: WatchIndexClaimReason;
  requestedIndex: number;
  navigationGeneration: number;
  nativeSettledPage?: number | null;
}): WatchActiveIndexDecision {
  const requested = sanitizeWatchListIndex(input.requestedIndex);
  if (requested == null) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "invalid-index",
    };
  }
  if (input.navigationGeneration !== input.arbiter.navigationGeneration) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "stale-generation",
    };
  }

  if (isIndependentWatchIndexWriter(input.reason)) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "independent-writer-forbidden",
    };
  }

  if (input.reason === "bootstrap") {
    if (
      input.arbiter.pageClaimed ||
      input.arbiter.userInteracted ||
      input.arbiter.lastSettledNativePage != null
    ) {
      return {
        accept: false,
        next: input.arbiter,
        rejectReason: "bootstrap-after-claim",
      };
    }
    return {
      accept: true,
      next: {
        ...input.arbiter,
        activeIndex: requested,
        pageClaimed: true,
      },
    };
  }

  if (
    shouldRejectStaleIndexZero({
      requestedIndex: requested,
      lastSettledNativePage: input.arbiter.lastSettledNativePage,
      provenNativePage: input.nativeSettledPage ?? null,
    })
  ) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "stale-index-zero",
    };
  }

  if (requested === input.arbiter.activeIndex) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "already-committed",
    };
  }

  return {
    accept: true,
    next: {
      activeIndex: requested,
      navigationGeneration: input.arbiter.navigationGeneration + 1,
      lastSettledNativePage:
        sanitizeWatchListIndex(input.nativeSettledPage ?? Number.NaN) ??
        input.arbiter.lastSettledNativePage,
      userInteracted: true,
      pageClaimed: true,
    },
  };
}
