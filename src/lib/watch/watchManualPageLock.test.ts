import { describe, expect, it } from "vitest";

import {
  resolveWatchScrollOffset,
  shouldAcceptViewableIndexUpdate,
} from "./playbackPolicy";
import {
  reconcileWatchActiveIndex,
  resolveWatchNativePage,
  resolveWatchPagingMetrics,
} from "./watchViewport";
import {
  resolveManualWatchNativePin,
  WATCH_MANUAL_FIRST_PAGE_LOCK_MS,
} from "./watchManualPageLock";

const FROZEN_HEIGHT = 1720;
const AUTO_ADVANCE_LOCK_MS = 750;

type WatchPagerState = {
  activeIndex: number;
  nativeOffset: number;
  lockUntilMs: number;
  itemHeight: number;
  itemCount: number;
  nowMs: number;
};

function applyManualScrollCommit(
  state: WatchPagerState,
  settleOffset: number
): WatchPagerState {
  if (
    !shouldAcceptViewableIndexUpdate({
      nowMs: state.nowMs,
      lockUntilMs: state.lockUntilMs,
    })
  ) {
    return state;
  }
  const nativePage = resolveWatchNativePage(
    settleOffset,
    state.itemHeight,
    state.itemCount
  );
  const index = reconcileWatchActiveIndex({
    nativePage,
    activeIndex: state.activeIndex,
    itemCount: state.itemCount,
  });
  if (index == null) return state;
  const pin = resolveManualWatchNativePin({
    previousIndex: state.activeIndex,
    claimedIndex: index,
    itemHeight: state.itemHeight,
  });
  return {
    ...state,
    activeIndex: index,
    nativeOffset: pin.pin ? pin.offset : settleOffset,
    lockUntilMs: pin.pin ? state.nowMs + pin.lockMs : state.lockUntilMs,
  };
}

function applyAutoAdvance(
  state: WatchPagerState,
  nextIndex: number
): WatchPagerState {
  const offset = resolveWatchScrollOffset(nextIndex, state.itemHeight);
  if (offset == null) return state;
  return {
    ...state,
    activeIndex: nextIndex,
    nativeOffset: offset,
    lockUntilMs: state.nowMs + AUTO_ADVANCE_LOCK_MS,
  };
}

function startState(): WatchPagerState {
  return {
    activeIndex: 0,
    nativeOffset: 0,
    lockUntilMs: 0,
    itemHeight: FROZEN_HEIGHT,
    itemCount: 5,
    nowMs: 10_000,
  };
}

describe("manual 0→1 native page lock", () => {
  it("pins native offset to page 1 after a genuine 0→1 claim", () => {
    const metrics = resolveWatchPagingMetrics(FROZEN_HEIGHT);
    expect(metrics?.getItemLayout(1).offset).toBe(FROZEN_HEIGHT);
    const pin = resolveManualWatchNativePin({
      previousIndex: 0,
      claimedIndex: 1,
      itemHeight: FROZEN_HEIGHT,
    });
    expect(pin).toEqual({
      pin: true,
      offset: FROZEN_HEIGHT,
      lockMs: WATCH_MANUAL_FIRST_PAGE_LOCK_MS,
    });
    expect(pin.pin && pin.offset).toBe(
      resolveWatchScrollOffset(1, FROZEN_HEIGHT)
    );
    expect(resolveWatchNativePage(pin.pin ? pin.offset : 0, FROZEN_HEIGHT, 5)).toBe(
      1
    );

    const after = applyManualScrollCommit(startState(), FROZEN_HEIGHT);
    expect(after.activeIndex).toBe(1);
    expect(after.nativeOffset).toBe(FROZEN_HEIGHT);
    expect(after.lockUntilMs).toBe(10_000 + WATCH_MANUAL_FIRST_PAGE_LOCK_MS);
    expect(after.activeIndex).not.toBe(0);
    expect(after.nativeOffset).not.toBe(0);
  });

  it("blocks stale settle/viewability from reclaiming or retaining page 0", () => {
    const claimed = applyManualScrollCommit(startState(), FROZEN_HEIGHT);
    expect(claimed.activeIndex).toBe(1);
    expect(claimed.nativeOffset).toBe(FROZEN_HEIGHT);

    const duringLock = { ...claimed, nowMs: claimed.nowMs + 100 };
    expect(
      shouldAcceptViewableIndexUpdate({
        nowMs: duringLock.nowMs,
        lockUntilMs: duringLock.lockUntilMs,
      })
    ).toBe(false);

    const stale = applyManualScrollCommit(duringLock, 0);
    expect(stale.activeIndex).toBe(1);
    expect(stale.nativeOffset).toBe(FROZEN_HEIGHT);
    expect(stale.lockUntilMs).toBe(claimed.lockUntilMs);
    expect(resolveWatchNativePage(stale.nativeOffset, FROZEN_HEIGHT, 5)).toBe(1);
    expect(stale.activeIndex).not.toBe(0);
  });

  it("leaves 1→2 and later manual transitions without an extra pin or lock", () => {
    expect(
      resolveManualWatchNativePin({
        previousIndex: 1,
        claimedIndex: 2,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toEqual({ pin: false });
    expect(
      resolveManualWatchNativePin({
        previousIndex: 2,
        claimedIndex: 3,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toEqual({ pin: false });
    expect(
      resolveManualWatchNativePin({
        previousIndex: 0,
        claimedIndex: 0,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toEqual({ pin: false });
    expect(
      resolveManualWatchNativePin({
        previousIndex: 1,
        claimedIndex: 0,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toEqual({ pin: false });

    const onPage1: WatchPagerState = {
      ...startState(),
      activeIndex: 1,
      nativeOffset: FROZEN_HEIGHT,
    };
    const after12 = applyManualScrollCommit(onPage1, FROZEN_HEIGHT * 2);
    expect(after12.activeIndex).toBe(2);
    expect(after12.nativeOffset).toBe(FROZEN_HEIGHT * 2);
    expect(after12.lockUntilMs).toBe(0);

    const after23 = applyManualScrollCommit(
      { ...after12, nativeOffset: FROZEN_HEIGHT * 2 },
      FROZEN_HEIGHT * 3
    );
    expect(after23.activeIndex).toBe(3);
    expect(after23.nativeOffset).toBe(FROZEN_HEIGHT * 3);
    expect(after23.lockUntilMs).toBe(0);
  });

  it("keeps auto-advance as claim-first then scrollToOffset", () => {
    const from0 = applyAutoAdvance(startState(), 1);
    expect(from0.activeIndex).toBe(1);
    expect(from0.nativeOffset).toBe(resolveWatchScrollOffset(1, FROZEN_HEIGHT));
    expect(from0.lockUntilMs).toBe(10_000 + AUTO_ADVANCE_LOCK_MS);
    expect(AUTO_ADVANCE_LOCK_MS).toBe(WATCH_MANUAL_FIRST_PAGE_LOCK_MS);

    const from1 = applyAutoAdvance(
      { ...startState(), activeIndex: 1, nativeOffset: FROZEN_HEIGHT },
      2
    );
    expect(from1.activeIndex).toBe(2);
    expect(from1.nativeOffset).toBe(resolveWatchScrollOffset(2, FROZEN_HEIGHT));
    expect(from1.lockUntilMs).toBe(10_000 + AUTO_ADVANCE_LOCK_MS);

    expect(
      resolveManualWatchNativePin({
        previousIndex: 1,
        claimedIndex: 2,
        itemHeight: FROZEN_HEIGHT,
      })
    ).toEqual({ pin: false });
  });
});
