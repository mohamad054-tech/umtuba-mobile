import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Share: {
    share: vi.fn(),
    dismissedAction: "dismissedAction",
    sharedAction: "sharedAction",
  },
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));

import { resolveWatchRootBack } from "@/src/lib/nav/watchRootExit";
import { shouldPlayVideo } from "@/src/lib/watch/playbackPolicy";
import { openWatchShareEntry } from "./shareEntry";
import {
  isWatchInPlaceOverlayOpen,
  isWatchShareSheetOpen,
  resolveWatchInPlaceOverlayClose,
  shouldDismissWatchShareOnHardwareBack,
  shouldMountWatchShareOverlay,
  watchShareDismissPreservesActiveItem,
  watchShareOverlayPausesPlayback,
  watchShareOverlayUsesHostWindow,
  watchShareSheetRemountsWatch,
  type WatchShareSheetSnapshot,
} from "./watchShareSheet";

const SNAPSHOT: WatchShareSheetSnapshot = {
  postId: 88,
  title: "UMTUBA",
  text: "UMTUBA",
  activeItemId: "post-88",
};

describe("Watch in-place share sheet", () => {
  it("opens from the existing share entry without leaving Watch", () => {
    const entry = openWatchShareEntry({ postId: 88, platform: "android" });
    expect(entry?.attempt.postId).toBe(88);
    expect(isWatchShareSheetOpen(SNAPSHOT)).toBe(true);
    expect(isWatchShareSheetOpen(null)).toBe(false);
    expect(watchShareSheetRemountsWatch()).toBe(false);
  });

  it("dismisses on Cancel, backdrop, and Android Back without remounting", () => {
    expect(shouldDismissWatchShareOnHardwareBack(true)).toBe(true);
    expect(shouldDismissWatchShareOnHardwareBack(false)).toBe(false);
    expect(watchShareDismissPreservesActiveItem()).toBe(true);
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(
      resolveWatchInPlaceOverlayClose({
        commentsOpen: false,
        shareSheetOpen: true,
      })
    ).toBe("share");
  });

  it("closes the share overlay before Watch exit and keeps the active item", () => {
    const nested = isWatchInPlaceOverlayOpen({
      commentsOpen: false,
      shareSheetOpen: true,
    });
    expect(nested).toBe(true);
    expect(
      resolveWatchRootBack({
        nowMs: 1_000,
        armedUntilMs: 5_000,
        nestedOverlayOpen: nested,
        atWatchRoot: true,
      })
    ).toEqual({ action: "close-nested" });
    expect(watchShareDismissPreservesActiveItem()).toBe(true);
    expect(SNAPSHOT.activeItemId).toBe("post-88");
  });

  it("does not steal comments overlay or pause playback while open", () => {
    expect(
      resolveWatchInPlaceOverlayClose({
        commentsOpen: true,
        shareSheetOpen: true,
      })
    ).toBe("comments");
    expect(watchShareOverlayPausesPlayback()).toBe(false);
    expect(
      shouldPlayVideo({
        isActive: true,
        appState: "active",
        screenFocused: true,
      })
    ).toBe(true);
  });

  it("mounts only while open and stays in the Watch host window", () => {
    expect(shouldMountWatchShareOverlay(null)).toBe(false);
    expect(shouldMountWatchShareOverlay(SNAPSHOT)).toBe(true);
    expect(watchShareOverlayUsesHostWindow()).toBe(true);
    expect(watchShareSheetRemountsWatch()).toBe(false);
    expect(watchShareDismissPreservesActiveItem()).toBe(true);
    expect(SNAPSHOT.activeItemId).toBe("post-88");
  });
});
