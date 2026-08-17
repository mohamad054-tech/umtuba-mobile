import { describe, expect, it } from "vitest";

import {
  resolveVerticalVolumeRatio,
  resolveWatchVolumeIcon,
  resolveWatchVolumeLeft,
  resolveWatchVolumeSide,
  resolveWatchVolumeTop,
  watchChromeRects,
  watchVolumeAvoidsChrome,
  watchVolumeFrame,
  watchVolumeIconGlyph,
  watchVolumeSliderVisible,
  WATCH_VOLUME_AUTO_HIDE_MS,
  WATCH_VOLUME_EXPANDED_HEIGHT,
  WATCH_VOLUME_SIDE,
  WATCH_VOLUME_SLIDER_LENGTH,
  WATCH_VOLUME_TOUCH_TARGET,
  WATCH_VOLUME_USES_TOP_BAR,
} from "./volumeLayout";

const IPHONE_SE3 = {
  cellWidth: 375,
  cellHeight: 667 - 83,
  topInset: 20 + 44,
  bottomInset: 34,
  leftInset: 0,
};

const IPHONE_DYNAMIC_ISLAND = {
  cellWidth: 393,
  cellHeight: 852 - 83,
  topInset: 59 + 44,
  bottomInset: 34,
  leftInset: 0,
};

const ANDROID_PORTRAIT = {
  cellWidth: 360,
  cellHeight: 800,
  topInset: 24 + 44,
  bottomInset: 0,
  leftInset: 0,
};

const ANDROID_CUTOUT = {
  cellWidth: 412,
  cellHeight: 915,
  topInset: 32 + 44,
  bottomInset: 24,
  leftInset: 28,
};

const FOLD6_FOLDED = {
  cellWidth: 968,
  cellHeight: 2376 - 96,
  topInset: 36 + 44,
  bottomInset: 32,
  leftInset: 0,
};

const FOLD6_UNFOLDED = {
  cellWidth: 1856,
  cellHeight: 2160 - 96,
  topInset: 36 + 44,
  bottomInset: 32,
  leftInset: 0,
};

describe("watch side volume layout", () => {
  it("uses a short vertical slider on the left, not a top bar", () => {
    expect(WATCH_VOLUME_USES_TOP_BAR).toBe(false);
    expect(WATCH_VOLUME_SIDE).toBe("left");
    expect(WATCH_VOLUME_SLIDER_LENGTH).toBe(112);
    expect(WATCH_VOLUME_SLIDER_LENGTH).toBeLessThan(140);
    expect(WATCH_VOLUME_EXPANDED_HEIGHT).toBeLessThan(200);
    expect(WATCH_VOLUME_TOUCH_TARGET).toBe(44);
  });

  it("keeps volume on the physical left in LTR and RTL", () => {
    expect(resolveWatchVolumeSide(false)).toBe("left");
    expect(resolveWatchVolumeSide(true)).toBe("left");
  });

  it("maps vertical pageY so the top of the track is full volume", () => {
    expect(resolveVerticalVolumeRatio(100, 100, 100)).toBe(1);
    expect(resolveVerticalVolumeRatio(150, 100, 100)).toBe(0.5);
    expect(resolveVerticalVolumeRatio(200, 100, 100)).toBe(0);
    expect(resolveVerticalVolumeRatio(40, 100, 100)).toBe(1);
    expect(resolveVerticalVolumeRatio(260, 100, 100)).toBe(0);
    expect(resolveVerticalVolumeRatio(150, 100, 0)).toBe(0);
  });

  it("clears Android / fold cutouts without eating the overlay gutter", () => {
    expect(resolveWatchVolumeLeft({ leftInset: 0 })).toBe(4);
    expect(resolveWatchVolumeLeft({ leftInset: 28 })).toBe(16);
  });

  it("sits below the header/back band and above captions", () => {
    const top = resolveWatchVolumeTop({
      ...IPHONE_DYNAMIC_ISLAND,
      expanded: true,
    });
    expect(top).toBeGreaterThanOrEqual(IPHONE_DYNAMIC_ISLAND.topInset + 10);
    expect(top + WATCH_VOLUME_EXPANDED_HEIGHT).toBeLessThanOrEqual(
      IPHONE_DYNAMIC_ISLAND.cellHeight - 168
    );
  });

  it("auto-hides the slider after inactivity unless a drag is active", () => {
    expect(
      watchVolumeSliderVisible({
        expanded: true,
        lastInteractAt: 1000,
        now: 1000 + WATCH_VOLUME_AUTO_HIDE_MS - 1,
      })
    ).toBe(true);
    expect(
      watchVolumeSliderVisible({
        expanded: true,
        lastInteractAt: 1000,
        now: 1000 + WATCH_VOLUME_AUTO_HIDE_MS,
      })
    ).toBe(false);
    expect(
      watchVolumeSliderVisible({
        expanded: true,
        lastInteractAt: 1000,
        now: 1000 + WATCH_VOLUME_AUTO_HIDE_MS + 50,
        gestureActive: true,
      })
    ).toBe(true);
    expect(
      watchVolumeSliderVisible({
        expanded: false,
        lastInteractAt: 1000,
        now: 1001,
      })
    ).toBe(false);
  });

  it("picks a compact speaker glyph from mute + level", () => {
    expect(resolveWatchVolumeIcon({ muted: true, volume: 1 })).toBe("muted");
    expect(resolveWatchVolumeIcon({ muted: false, volume: 0 })).toBe("muted");
    expect(resolveWatchVolumeIcon({ muted: false, volume: 0.25 })).toBe("low");
    expect(resolveWatchVolumeIcon({ muted: false, volume: 0.8 })).toBe("high");
    expect(watchVolumeIconGlyph("muted")).toBe("🔇");
  });
});

describe("watch side volume collision", () => {
  const devices = [
    ["iPhone SE 3", IPHONE_SE3],
    ["iPhone Dynamic Island", IPHONE_DYNAMIC_ISLAND],
    ["Android portrait", ANDROID_PORTRAIT],
    ["Android cutout", ANDROID_CUTOUT],
    ["Fold6 folded", FOLD6_FOLDED],
    ["Fold6 unfolded", FOLD6_UNFOLDED],
  ] as const;

  it.each(devices)(
    "avoids Back, rail, captions, and progress on %s (LTR + RTL)",
    (_name, device) => {
      for (const isRtl of [false, true]) {
        for (const expanded of [false, true]) {
          const frame = watchVolumeFrame({ ...device, expanded, isRtl });
          expect(frame.x).toBeLessThan(device.cellWidth / 2);
          expect(
            watchVolumeAvoidsChrome({
              ...device,
              expanded,
              isRtl,
              actionCount: 6,
            })
          ).toBe(true);
        }
      }
    }
  );

  it("does not occupy the top horizontal band like the old slider", () => {
    const frame = watchVolumeFrame({
      ...IPHONE_DYNAMIC_ISLAND,
      expanded: true,
      isRtl: false,
    });
    expect(frame.width).toBe(WATCH_VOLUME_TOUCH_TARGET);
    expect(frame.width).toBeLessThan(80);
    expect(frame.y).toBeGreaterThan(IPHONE_DYNAMIC_ISLAND.topInset);
    const chrome = watchChromeRects(IPHONE_DYNAMIC_ISLAND);
    expect(frame.x + frame.width).toBeLessThan(chrome.rail.x);
  });
});
