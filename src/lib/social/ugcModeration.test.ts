import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockUserLocally,
  isUgcBlockBackendConfigured,
  isUgcReportBackendConfigured,
  reportWatchPost,
} from "./ugcModeration";
import {
  filterWatchItemsForViewer,
  isAllowedUgcReportReason,
  UGC_MODERATION_ERRORS,
  viewerMaySeeBlockControl,
  viewerMaySeeReportControl,
} from "./ugcModerationShared";

const VIEWER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const memory = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => memory.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    memory.set(key, value);
  }),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

describe("UGC report/block contracts", () => {
  beforeEach(() => {
    memory.clear();
    vi.clearAllMocks();
  });

  it("keeps the 20260928 backend adapter unbound", () => {
    expect(isUgcReportBackendConfigured()).toBe(false);
    expect(isUgcBlockBackendConfigured()).toBe(false);
  });

  it("shows report/block only for other people's content", () => {
    expect(viewerMaySeeReportControl(VIEWER, OTHER)).toBe(true);
    expect(viewerMaySeeReportControl(VIEWER, VIEWER)).toBe(false);
    expect(viewerMaySeeReportControl(null, OTHER)).toBe(false);
    expect(viewerMaySeeBlockControl(VIEWER, OTHER)).toBe(true);
    expect(viewerMaySeeBlockControl(VIEWER, VIEWER)).toBe(false);
  });

  it("accepts only closed report reasons", () => {
    expect(isAllowedUgcReportReason("spam")).toBe(true);
    expect(isAllowedUgcReportReason("hate")).toBe(true);
    expect(isAllowedUgcReportReason("not-a-reason")).toBe(false);
  });

  it("fails closed when reporting because no backend is bound", async () => {
    const result = await reportWatchPost({
      viewerId: VIEWER,
      ownerUserId: OTHER,
      postId: 42,
      reason: "spam",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("backend_unavailable");
      expect(result.message).toBe(UGC_MODERATION_ERRORS.backendUnavailable);
    }
  });

  it("rejects reporting your own post", async () => {
    const result = await reportWatchPost({
      viewerId: VIEWER,
      ownerUserId: VIEWER,
      postId: 42,
      reason: "spam",
    });
    expect(result).toEqual({
      ok: false,
      code: "own_content",
      message: UGC_MODERATION_ERRORS.ownContent,
    });
  });

  it("blocks another user locally without inventing a backend", async () => {
    const result = await blockUserLocally({
      viewerId: VIEWER,
      targetUserId: OTHER,
      username: "other",
    });
    expect(result).toEqual({
      ok: true,
      userId: OTHER,
      blocked: true,
      backendAccepted: false,
      localOnly: true,
    });
  });

  it("filters hidden posts and blocked authors from the feed", () => {
    const items = [
      { postId: 1, author: { id: OTHER } },
      { postId: 2, author: { id: VIEWER } },
      { postId: 3, author: { id: OTHER } },
    ];
    expect(
      filterWatchItemsForViewer(items, {
        blockedUserIds: new Set([OTHER]),
        hiddenPostIds: new Set([2]),
      })
    ).toEqual([]);
    expect(
      filterWatchItemsForViewer(items, {
        blockedUserIds: new Set(),
        hiddenPostIds: new Set([1]),
      })
    ).toEqual([
      { postId: 2, author: { id: VIEWER } },
      { postId: 3, author: { id: OTHER } },
    ]);
  });
});
