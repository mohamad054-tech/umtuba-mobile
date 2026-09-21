import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  rememberQualifiedWatch,
  resetRememberedQualifiedWatchesForTests,
} from "./rememberQualifiedWatch";

const { rememberLocalWatchHide, recordWatchCompletion } = vi.hoisted(() => ({
  rememberLocalWatchHide: vi.fn(
    async (_postId: number, _now?: number) => []
  ),
  recordWatchCompletion: vi.fn(
    async (_supabase: unknown, _postId: number) => ({ ok: true as const })
  ),
}));

vi.mock("./watchHideStorage", () => ({
  rememberLocalWatchHide,
}));

vi.mock("@/src/lib/supabase/watchCompletions", () => ({
  recordWatchCompletion,
}));

describe("rememberQualifiedWatch", () => {
  beforeEach(() => {
    resetRememberedQualifiedWatchesForTests();
    rememberLocalWatchHide.mockClear();
    recordWatchCompletion.mockClear();
  });

  it("writes the device list for guests and skips the server", async () => {
    const rpc = vi.fn();
    await rememberQualifiedWatch({ rpc } as never, 11, null);
    expect(rememberLocalWatchHide).toHaveBeenCalledWith(11);
    expect(recordWatchCompletion).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("also records a signed-in completion without touching views", async () => {
    const supabase = { rpc: vi.fn() };
    await rememberQualifiedWatch(supabase as never, 11, "user-1");
    expect(rememberLocalWatchHide).toHaveBeenCalledWith(11);
    expect(recordWatchCompletion).toHaveBeenCalledWith(supabase, 11);
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "record_post_view",
      expect.anything()
    );
  });
});
