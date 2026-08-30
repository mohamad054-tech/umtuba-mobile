import { describe, expect, it } from "vitest";

import { isRtlLocale } from "@/src/lib/i18n/locales";
import { profileOriginFallbackHref } from "@/src/lib/profile/profileNav";

import { WATCH_SCRUB_MIN_DURATION_SEC } from "./playbackPolicy";
import {
  DEFAULT_WATCH_PLAYBACK_SPEED,
  resetWatchPlaybackSpeedOnPageChange,
} from "./watchQuickActions";
import { WATCH_LONG_PRESS_MS, shouldOpenWatchQuickActions } from "./watchGestures";
import {
  WATCH_CAPTION_COMPACT_LINES,
  WATCH_FOLLOW_CHIP_MIN_HEIGHT,
  WATCH_HASHTAG_ROUTE,
  extractWatchHashtags,
  extractWatchMentions,
  parseWatchCaptionTokens,
  resolveWatchHashtagRoute,
  resolveWatchMentionHref,
  shouldOfferWatchCaptionToggle,
  shouldShowWatchFollowChip,
  watchCaptionLineLimit,
  watchCaptionText,
  watchFollowChipState,
} from "./watchCaption";

describe("Watch caption expand/collapse", () => {
  it("keeps short captions compact without a toggle", () => {
    expect(watchCaptionText("Hi", "Title")).toBe("Hi");
    expect(shouldOfferWatchCaptionToggle("Short clip")).toBe(false);
    expect(watchCaptionLineLimit(false)).toBe(WATCH_CAPTION_COMPACT_LINES);
    expect(watchCaptionLineLimit(true)).toBeGreaterThan(WATCH_CAPTION_COMPACT_LINES);
  });

  it("offers expand for long or multiline captions", () => {
    expect(shouldOfferWatchCaptionToggle("a".repeat(80))).toBe(true);
    expect(shouldOfferWatchCaptionToggle("one\ntwo\nthree")).toBe(true);
  });
});

describe("Watch hashtags and mentions", () => {
  it("parses hashtags without inventing a topic route", () => {
    expect(extractWatchHashtags("Hello #Travel #UMTUBA_rocks")).toEqual([
      "#Travel",
      "#UMTUBA_rocks",
    ]);
    expect(resolveWatchHashtagRoute()).toBe(WATCH_HASHTAG_ROUTE);
    expect(WATCH_HASHTAG_ROUTE).toBe("blocked-existing-route");
  });

  it("parses @mentions and builds the stacked Watch profile href", () => {
    expect(extractWatchMentions("hi @Eman and @mohamad")).toEqual([
      "eman",
      "mohamad",
    ]);
    const href = resolveWatchMentionHref("eman");
    expect(href).toContain("/profile/user");
    expect(href).toContain("u=eman");
    expect(href).toContain("from=watch");
    expect(profileOriginFallbackHref("watch")).toBe("/(tabs)/watch");
  });

  it("aligns caption start for RTL and LTR", () => {
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });

  it("does not treat emails as mentions", () => {
    const tokens = parseWatchCaptionTokens("mail me user@example.com then @valid_name");
    expect(tokens.some((token) => token.type === "mention" && token.username === "example.com")).toBe(
      false
    );
    expect(extractWatchMentions("mail me user@example.com then @valid_name")).toEqual([
      "valid_name",
    ]);
  });
});

describe("Watch follow polish", () => {
  it("hides Follow on own posts and never exposes Unfollow", () => {
    expect(
      shouldShowWatchFollowChip({ viewerId: "a", authorId: "a" })
    ).toBe(false);
    expect(
      shouldShowWatchFollowChip({ viewerId: "a", authorId: "b" })
    ).toBe(true);
    expect(watchFollowChipState(true)).toEqual({
      kind: "following",
      disabled: true,
      selected: true,
    });
    expect(watchFollowChipState(false).kind).toBe("follow");
    expect(WATCH_FOLLOW_CHIP_MIN_HEIGHT).toBe(44);
  });
});

describe("P0/P1 locks", () => {
  it("keeps long-press, speed reset, and 8s scrub", () => {
    expect(shouldOpenWatchQuickActions("video")).toBe(true);
    expect(WATCH_LONG_PRESS_MS).toBe(450);
    expect(resetWatchPlaybackSpeedOnPageChange()).toBe(DEFAULT_WATCH_PLAYBACK_SPEED);
    expect(WATCH_SCRUB_MIN_DURATION_SEC).toBe(8);
  });
});
