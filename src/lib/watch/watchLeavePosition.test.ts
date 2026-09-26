import { describe, expect, it } from "vitest";

import {
  armWatchReading,
  attachWatchReading,
  consumeWatchReturn,
  rememberWatchLeave,
  resetWatchLeaveForTests,
} from "./watchLeavePosition";

describe("watch leave position", () => {
  it("returns to the same second once, and opens the text only when asked", () => {
    resetWatchLeaveForTests();
    rememberWatchLeave({ postId: 9, positionSec: 12.44 });
    attachWatchReading(9, { title: "عنوان", body: "نص طويل" });

    expect(consumeWatchReturn(9)).toEqual({
      positionSec: 12.4,
      reading: null,
    });
    expect(consumeWatchReturn(9)).toBeNull();

    rememberWatchLeave({ postId: 9, positionSec: 4 });
    attachWatchReading(9, { title: "عنوان", body: "نص طويل" });
    armWatchReading();
    expect(consumeWatchReturn(9)).toEqual({
      positionSec: 4,
      reading: { title: "عنوان", body: "نص طويل" },
    });
    expect(consumeWatchReturn(8)).toBeNull();
  });
});
