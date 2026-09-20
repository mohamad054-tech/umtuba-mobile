import { describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_EVENTS,
  assertSafeAnalyticsProps,
  captureAnalyticsEvent,
} from "./events";

describe("typed analytics helper", () => {
  it("exposes the website-overlapping event names as literals", () => {
    expect(Object.values(ANALYTICS_EVENTS)).toEqual([
      "app_opened",
      "sign_up_started",
      "sign_up_completed",
      "login",
      "video_view",
      "video_like",
      "video_share",
      "comment_posted",
      "post_published",
      "search_performed",
      "report_submitted",
    ]);
  });

  it("strips email, name, phone, and typed text keys", () => {
    expect(
      assertSafeAnalyticsProps({
        post_id: 9,
        email: "a@b.com",
        query: "secret typed",
        body: "comment text",
        surface: "watch",
      })
    ).toEqual({ post_id: 9, surface: "watch" });
  });

  it("forwards only the typed event name to the sink", () => {
    const sink = vi.fn();
    captureAnalyticsEvent(
      ANALYTICS_EVENTS.video_view,
      { post_id: 44, surface: "watch" },
      sink
    );
    expect(sink).toHaveBeenCalledWith("video_view", {
      post_id: 44,
      surface: "watch",
    });
  });
});
