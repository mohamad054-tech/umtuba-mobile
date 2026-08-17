import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
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

import {
  WATCH_SHARE_ENTRY_PLATFORMS,
  isWatchShareEntryEnabled,
  listWatchShareChoices,
  openWatchShareEntry,
  resolveWatchShareRailAction,
} from "./shareEntry";

describe("Watch Share entry parity", () => {
  it("keeps the Share rail visible and enabled on android and ios", () => {
    expect([...WATCH_SHARE_ENTRY_PLATFORMS]).toEqual(["ios", "android"]);
    for (const platform of WATCH_SHARE_ENTRY_PLATFORMS) {
      const rail = resolveWatchShareRailAction({ postId: 42, platform });
      expect(rail).toEqual({ visible: true, enabled: true, disabled: false });
      expect(isWatchShareEntryEnabled({ postId: 42, platform })).toBe(true);
    }
  });

  it("opens the same two share choices on both platforms for the current post", () => {
    expect(listWatchShareChoices()).toEqual([
      { mode: "link", key: "watch.shareVideoLink" },
      { mode: "file", key: "watch.shareVideoFile" },
    ]);
    for (const platform of WATCH_SHARE_ENTRY_PLATFORMS) {
      const entry = openWatchShareEntry({ postId: 88, platform });
      expect(entry?.attempt.postId).toBe(88);
      expect(entry?.choices.map((choice) => choice.mode)).toEqual([
        "link",
        "file",
      ]);
      expect(entry?.choices.map((choice) => choice.key)).toEqual([
        "watch.shareVideoLink",
        "watch.shareVideoFile",
      ]);
    }
  });

  it("does not disable Share when the OS is android or expo-sharing is unavailable", () => {
    expect(
      isWatchShareEntryEnabled({ postId: 1, platform: "android" })
    ).toBe(true);
    const androidEntry = openWatchShareEntry({
      postId: 1,
      platform: "android",
    });
    expect(androidEntry?.choices).toHaveLength(2);
    expect(androidEntry?.attempt.postId).toBe(1);
  });

  it("disables the rail only when the current post id is missing", () => {
    expect(isWatchShareEntryEnabled({ postId: null, platform: "android" })).toBe(
      false
    );
    expect(isWatchShareEntryEnabled({ postId: 0, platform: "ios" })).toBe(false);
    expect(openWatchShareEntry({ postId: null, platform: "android" })).toBeNull();
  });
});
