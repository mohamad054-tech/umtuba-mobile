import { describe, expect, it } from "vitest";

import { clientWriteOmitsPublishClock } from "@/src/lib/time/publishedAt";
import {
  createInitialEditState,
  serializeEditIntoMediaPipeline,
} from "@/src/lib/video/videoEditState";

describe("publish timestamp governance", () => {
  it("does not write created_at or published_at into edit metadata", () => {
    const pipeline = serializeEditIntoMediaPipeline(
      null,
      createInitialEditState(4_000)
    );
    expect(clientWriteOmitsPublishClock(pipeline)).toBe(true);
    expect("created_at" in pipeline).toBe(false);
    expect("published_at" in pipeline).toBe(false);
  });
});
