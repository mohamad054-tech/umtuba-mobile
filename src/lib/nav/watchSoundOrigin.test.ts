import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyGlobalBackDecision,
  hasValidWatchOriginUnderneath,
  resolveGlobalBack,
  shouldPopToMountedWatch,
  shouldTrustHistoryBack,
} from "./globalBack";
import {
  registerMountedWatchInstance,
  rememberProfileBackContext,
  resetProfileBackContextForTests,
} from "./profileBackContext";
import {
  buildWatchSoundHref,
  isWatchSoundPath,
  parseWatchSoundOrigin,
} from "./watchSoundOrigin";

const SOUND_ID = "11111111-1111-4111-8111-111111111111";

function watchOriginSoundBack(extra: Record<string, unknown> = {}) {
  return {
    canGoBack: true,
    currentPath: `/sound/${SOUND_ID}`,
    segments: ["sound", SOUND_ID],
    previousRouteName: "(tabs)",
    previousTabName: "watch",
    profileOrigin: "watch",
    ...extra,
  };
}

beforeEach(() => {
  resetProfileBackContextForTests();
});

describe("buildWatchSoundHref", () => {
  it("adds from=watch and rejects empty ids", () => {
    expect(buildWatchSoundHref(SOUND_ID)).toBe(
      `/sound/${SOUND_ID}?from=watch`
    );
    expect(buildWatchSoundHref("  ")).toBeNull();
    expect(parseWatchSoundOrigin("watch")).toBe("watch");
    expect(parseWatchSoundOrigin("create")).toBeNull();
    expect(isWatchSoundPath(`/sound/${SOUND_ID}?from=watch`)).toBe(true);
    expect(isWatchSoundPath("/profile/user", ["profile", "user"])).toBe(false);
  });
});

describe("Watch → sound → Back pops the mounted Watch", () => {
  it("history-backs when Watch is live underneath", () => {
    registerMountedWatchInstance();
    const input = watchOriginSoundBack({ watchOriginUnderneath: true });
    expect(hasValidWatchOriginUnderneath(input)).toBe(true);
    expect(shouldPopToMountedWatch(input)).toBe(true);
    expect(shouldTrustHistoryBack(input)).toBe(true);
    const decision = resolveGlobalBack(input);
    expect(decision).toEqual({ action: "history-back" });
    expect(decision).not.toEqual({ action: "replace", href: "/(tabs)/watch" });
    const nav = { back: vi.fn(), replace: vi.fn() };
    applyGlobalBackDecision(decision, nav);
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("does not remount Watch 5x when the instance stays live", () => {
    registerMountedWatchInstance();
    for (let i = 0; i < 5; i += 1) {
      const decision = resolveGlobalBack(
        watchOriginSoundBack({ watchOriginUnderneath: true })
      );
      expect(decision).toEqual({ action: "history-back" });
    }
  });

  it("replaces to Watch only when the instance cannot be popped", () => {
    expect(
      resolveGlobalBack(
        watchOriginSoundBack({
          canGoBack: false,
          watchOriginUnderneath: false,
        })
      )
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });

    expect(
      resolveGlobalBack(
        watchOriginSoundBack({
          previousTabName: "profile",
          watchOriginUnderneath: false,
        })
      )
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });

  it("still returns to Watch when from=watch is dropped but origin was remembered", () => {
    rememberProfileBackContext({
      origin: "watch",
      via: null,
      listId: null,
      listUsername: null,
      ownerId: null,
      ownerUsername: null,
    });
    expect(
      resolveGlobalBack({
        canGoBack: false,
        currentPath: `/sound/${SOUND_ID}`,
        segments: ["sound", SOUND_ID],
      })
    ).toEqual({ action: "replace", href: "/(tabs)/watch" });
  });

  it("does not steal non-Watch sound Back onto a Watch remount", () => {
    registerMountedWatchInstance();
    expect(
      resolveGlobalBack({
        canGoBack: true,
        currentPath: `/sound/${SOUND_ID}`,
        segments: ["sound", SOUND_ID],
        previousRouteName: "(tabs)",
        previousTabName: "create",
        watchOriginUnderneath: true,
      })
    ).toEqual({ action: "history-back" });
    expect(
      shouldPopToMountedWatch({
        canGoBack: true,
        currentPath: `/sound/${SOUND_ID}`,
        segments: ["sound", SOUND_ID],
        previousTabName: "watch",
        watchOriginUnderneath: true,
      })
    ).toBe(false);
  });
});
