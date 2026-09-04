import {
  sanitizeWatchListIndex,
  shouldLoadPlayer,
} from "./playbackPolicy";

/** The only reasons that may write Watch activeIndex. */
export type WatchIndexClaimReason =
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
 * Delayed viewability / find() on index 0 must never write activeIndex.
 * Visibility is evidence only.
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
}): boolean {
  if (shouldLoadPlayer(input.index, input.activeIndex, input.platform)) {
    return true;
  }
  return shouldRetainWatchSurface({
    itemIndex: input.index,
    activeIndex: input.activeIndex,
    lastSettledNativePage: input.lastSettledNativePage ?? null,
  });
}

/**
 * Single writer for activeIndex. Stale generations and delayed bootstrap
 * / index-0 claims are rejected.
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

  if (input.reason === "programmatic") {
    const native = sanitizeWatchListIndex(
      input.nativeSettledPage ?? requested
    );
    return {
      accept: true,
      next: {
        activeIndex: requested,
        navigationGeneration: input.arbiter.navigationGeneration + 1,
        lastSettledNativePage: native,
        userInteracted: true,
        pageClaimed: true,
      },
    };
  }

  const proven = sanitizeWatchListIndex(input.nativeSettledPage ?? Number.NaN);
  if (proven == null) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "missing-native-page",
    };
  }
  if (
    shouldRejectStaleIndexZero({
      requestedIndex: proven,
      lastSettledNativePage: input.arbiter.lastSettledNativePage,
      provenNativePage: proven,
    })
  ) {
    return {
      accept: false,
      next: input.arbiter,
      rejectReason: "stale-index-zero",
    };
  }
  return {
    accept: true,
    next: {
      activeIndex: proven,
      navigationGeneration: input.arbiter.navigationGeneration,
      lastSettledNativePage: proven,
      userInteracted: input.arbiter.userInteracted || proven > 0,
      pageClaimed: true,
    },
  };
}
