import { beforeEach, describe, expect, it, vi } from "vitest";

import { WATCH_HIDE_STORAGE_KEY } from "./watchHidePolicy";
import {
  readLocalWatchHideEntries,
  rememberLocalWatchHide,
} from "./watchHideStorage";

const memory = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
  },
}));

describe("watch hide local storage", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("writes and reads the same guest key the website uses", async () => {
    const now = Date.now();
    await rememberLocalWatchHide(42, now);
    expect(memory.has(WATCH_HIDE_STORAGE_KEY)).toBe(true);
    expect(WATCH_HIDE_STORAGE_KEY).toBe("umtuba.watchHide.v1");
    expect(await readLocalWatchHideEntries(now)).toEqual([
      { postId: 42, watchedAt: now },
    ]);
  });
});
