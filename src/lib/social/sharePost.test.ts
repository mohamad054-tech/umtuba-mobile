import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Share: {
    share: vi.fn(),
    dismissedAction: "dismissedAction",
    sharedAction: "sharedAction",
  },
}));

import { Share } from "react-native";

import { buildMobilePostShareUrl, shareWatchPost } from "./sharePost";

describe("buildMobilePostShareUrl", () => {
  it("builds the canonical watch URL for the given post only", () => {
    expect(buildMobilePostShareUrl(42)).toBe("https://umtuba.com/watch?post=42");
    expect(buildMobilePostShareUrl(7)).toBe("https://umtuba.com/watch?post=7");
    expect(buildMobilePostShareUrl(0)).toBeNull();
    expect(buildMobilePostShareUrl(-1)).toBeNull();
    expect(buildMobilePostShareUrl(1.5)).toBeNull();
  });
});

describe("shareWatchPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares the current post URL and records that post id", async () => {
    vi.mocked(Share.share).mockResolvedValue({
      action: Share.sharedAction,
    } as never);
    const rpc = vi.fn(async () => ({
      data: { counted: true, shares: 4 },
      error: null,
    }));
    const result = await shareWatchPost({ rpc } as never, {
      postId: 88,
      title: "Clip",
      text: "Hello",
    });
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://umtuba.com/watch?post=88",
        message: expect.stringContaining("https://umtuba.com/watch?post=88"),
      }),
      expect.any(Object)
    );
    expect(rpc).toHaveBeenCalledWith("record_post_share", {
      p_post_id: 88,
      p_viewer_key: expect.stringMatching(/^d:[0-9a-f-]+$/),
    });
    expect(result).toEqual({
      ok: true,
      shared: true,
      shares: 4,
      url: "https://umtuba.com/watch?post=88",
    });
  });

  it("does not record a share when the sheet is dismissed", async () => {
    vi.mocked(Share.share).mockResolvedValue({
      action: Share.dismissedAction,
    } as never);
    const rpc = vi.fn();
    const result = await shareWatchPost({ rpc } as never, { postId: 3 });
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      shared: false,
      shares: 0,
      url: "https://umtuba.com/watch?post=3",
    });
  });
});
