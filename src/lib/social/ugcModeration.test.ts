import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockUserLocally,
  isUgcBlockBackendConfigured,
  isUgcReportBackendConfigured,
  loadBlockedUsers,
  reportWatchPost,
  reportWatchUser,
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
const rpc = vi.fn();

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

vi.mock("@/src/lib/supabase/client", () => ({
  getSupabase: () => ({ rpc }),
}));

describe("UGC report/block contracts", () => {
  beforeEach(() => {
    memory.clear();
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", error: null });
  });

  it("marks the 20260928 backend adapter as bound", () => {
    expect(isUgcReportBackendConfigured()).toBe(true);
    expect(isUgcBlockBackendConfigured()).toBe(true);
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
    expect(isAllowedUgcReportReason("illegal")).toBe(true);
    expect(isAllowedUgcReportReason("impersonation")).toBe(true);
    expect(isAllowedUgcReportReason("not-a-reason")).toBe(false);
  });

  it("submits content reports through report_ugc_content", async () => {
    const result = await reportWatchPost({
      viewerId: VIEWER,
      ownerUserId: OTHER,
      postId: 42,
      reason: "spam",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backendAccepted).toBe(true);
      expect(result.hiddenLocally).toBe(true);
    }
    expect(rpc).toHaveBeenCalledWith("report_ugc_content", {
      p_post_id: 42,
      p_reason_code: "spam",
    });
  });

  it("submits user reports through report_ugc_user", async () => {
    const result = await reportWatchUser({
      viewerId: VIEWER,
      targetUserId: OTHER,
      reason: "harassment",
    });
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("report_ugc_user", {
      p_user_id: OTHER,
      p_reason_code: "harassment",
    });
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
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks another user through block_ugc_user", async () => {
    const result = await blockUserLocally({
      viewerId: VIEWER,
      targetUserId: OTHER,
      username: "other",
    });
    expect(result).toEqual({
      ok: true,
      userId: OTHER,
      blocked: true,
      backendAccepted: true,
      localOnly: false,
    });
    expect(rpc).toHaveBeenCalledWith("block_ugc_user", {
      p_user_id: OTHER,
    });
  });

  it("loads blocked users through list_my_blocked_users", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          user_id: OTHER,
          username: "other",
          display_name: "Other",
          created_at: "2026-08-14T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const users = await loadBlockedUsers();
    expect(rpc).toHaveBeenCalledWith("list_my_blocked_users");
    expect(users).toEqual([
      {
        userId: OTHER,
        username: "other",
        blockedAt: Date.parse("2026-08-14T10:00:00.000Z"),
      },
    ]);
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
