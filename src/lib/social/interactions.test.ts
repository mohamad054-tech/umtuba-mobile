import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensurePostLike,
  isEnsurePostLikeInFlight,
  loadViewerInteractionState,
  normalizePostId,
  previewEnsureLike,
  previewToggleLike,
  previewToggleSave,
  resetEnsurePostLikeInflightForTests,
  resetTogglePostLikeInflightForTests,
  resetTogglePostSaveInflightForTests,
  togglePostLike,
  togglePostSave,
  viewerLikedFromState,
} from "./interactions";

const VIEWER = "11111111-1111-4111-8111-111111111111";
const OTHER_POST_ID = 99;

function createSaveClient(options: {
  userId?: string | null;
  saved?: boolean;
  saves?: number;
  rpcError?: { message: string } | null;
  rpcDelayMs?: number;
}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const rpc = vi.fn(async (name: string, args: { p_post_id: number }) => {
    calls.push({ table: "rpc", op: name, payload: args });
    if (options.rpcDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.rpcDelayMs));
    }
    if (options.rpcError) {
      return { data: null, error: options.rpcError };
    }
    return {
      data: {
        saved: options.saved ?? true,
        saves: options.saves ?? 1,
      },
      error: null,
    };
  });
  const from = vi.fn(() => {
    throw new Error("togglePostSave must use toggle_post_save, not table writes");
  });

  return {
    calls,
    rpc,
    from,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.userId ? { id: options.userId } : null },
        error: null,
      })),
    },
  };
}

describe("togglePostSave — website toggle_post_save RPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTogglePostSaveInflightForTests();
  });

  it("guest is auth-gated without calling toggle_post_save", async () => {
    const supabase = createSaveClient({ userId: null });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Please sign in to save this video.",
      requiresAuth: true,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("saves through toggle_post_save", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      saved: true,
      saves: 4,
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: true, saves: 4 });
    expect(supabase.rpc).toHaveBeenCalledWith("toggle_post_save", {
      p_post_id: OTHER_POST_ID,
    });
  });

  it("unsaves through toggle_post_save", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      saved: false,
      saves: 3,
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: false, saves: 3 });
  });

  it("rejects a non-positive post id before touching the session", async () => {
    const supabase = createSaveClient({ userId: VIEWER });
    const result = await togglePostSave(supabase as never, 0);
    expect(result.ok).toBe(false);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("maps an expired session to a sign-in request", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      rpcError: { message: "Authentication required" },
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Please sign in to save this video.",
      requiresAuth: true,
    });
  });

  it("does not report success when toggle_post_save fails", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      rpcError: { message: "permission denied" },
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Unable to save this video. Please try again.",
    });
  });

  it("shares one save RPC while in flight", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      saved: true,
      saves: 3,
    });
    const first = togglePostSave(supabase as never, OTHER_POST_ID);
    const second = togglePostSave(supabase as never, OTHER_POST_ID);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});

function createViewerStateClient(options: {
  likedPostIds?: number[];
  savedPostIds?: number[];
  savesError?: { message: string } | null;
}) {
  const from = vi.fn((table: string) => {
    const ids =
      table === "post_likes"
        ? (options.likedPostIds ?? [])
        : table === "post_saves"
          ? (options.savedPostIds ?? [])
          : [];
    const error = table === "post_saves" ? (options.savesError ?? null) : null;
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: error ? null : ids.map((post_id) => ({ post_id })),
            error,
          })),
        })),
      })),
    };
  });
  return { from };
}

describe("loadViewerInteractionState — save persistence after reload", () => {
  it("restores other-user saved state from post_saves", async () => {
    const supabase = createViewerStateClient({
      savedPostIds: [OTHER_POST_ID],
    });
    const state = await loadViewerInteractionState(
      supabase as never,
      VIEWER,
      [OTHER_POST_ID, 7]
    );
    expect(state.get(OTHER_POST_ID)).toEqual({
      likedByMe: false,
      savedByMe: true,
    });
    expect(state.get(7)).toEqual({ likedByMe: false, savedByMe: false });
  });

  it("does not invent a saved bookmark when post_saves read fails", async () => {
    const supabase = createViewerStateClient({
      savedPostIds: [OTHER_POST_ID],
      savesError: { message: "timeout" },
    });
    const state = await loadViewerInteractionState(
      supabase as never,
      VIEWER,
      [OTHER_POST_ID]
    );
    expect(state.get(OTHER_POST_ID)).toEqual({
      likedByMe: false,
      savedByMe: false,
    });
  });
});

describe("viewer like contract", () => {
  it("normalizes numeric and string post ids and rejects junk", () => {
    expect(normalizePostId(12)).toBe(12);
    expect(normalizePostId("12")).toBe(12);
    expect(normalizePostId(" 9 ")).toBe(9);
    expect(normalizePostId(0)).toBeNull();
    expect(normalizePostId("abc")).toBeNull();
  });

  it("never treats like_count or stale truthy values as liked", () => {
    expect(viewerLikedFromState(true)).toBe(true);
    expect(viewerLikedFromState(false)).toBe(false);
    expect(viewerLikedFromState(undefined)).toBe(false);
    expect(viewerLikedFromState(1)).toBe(false);
    expect(viewerLikedFromState("true")).toBe(false);
    expect(viewerLikedFromState({ likes: 99 })).toBe(false);
  });

  it("hydrates only the viewer's liked rows, including string post_id", async () => {
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({
            data:
              table === "post_likes"
                ? [{ post_id: "7" }]
                : [],
            error: null,
          })),
        })),
      })),
    }));
    const state = await loadViewerInteractionState(
      { from } as never,
      VIEWER,
      [7, 8]
    );
    expect(state.get(7)).toEqual({ likedByMe: true, savedByMe: false });
    expect(state.get(8)).toEqual({ likedByMe: false, savedByMe: false });
  });
});

describe("togglePostLike — still RPC", () => {
  it("keeps likes on toggle_post_like", async () => {
    const rpc = vi.fn(async () => ({
      data: { liked: true, likes: 8 },
      error: null,
    }));
    const result = await togglePostLike({ rpc } as never, OTHER_POST_ID);
    expect(rpc).toHaveBeenCalledWith("toggle_post_like", {
      p_post_id: OTHER_POST_ID,
    });
    expect(result).toEqual({ ok: true, liked: true, likes: 8 });
  });

  it("does not block liking the viewer’s own post", async () => {
    const rpc = vi.fn(async () => ({
      data: { liked: true, likes: 1 },
      error: null,
    }));
    const result = await togglePostLike({ rpc } as never, OTHER_POST_ID);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("toggle_post_like", {
      p_post_id: OTHER_POST_ID,
    });
    expect(result.ok).toBe(true);
  });

  it("shares one like write while in flight", async () => {
    resetTogglePostLikeInflightForTests();
    vi.useFakeTimers();
    const rpc = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ data: { liked: true, likes: 8 }, error: null }),
            40
          );
        })
    );
    const first = togglePostLike({ rpc } as never, OTHER_POST_ID);
    const second = togglePostLike({ rpc } as never, OTHER_POST_ID);
    await vi.advanceTimersByTimeAsync(40);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(rpc).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

function createEnsureLikeClient(options: {
  userId?: string | null;
  alreadyLikedOnServer?: boolean;
  rpcLiked?: boolean;
  rpcLikes?: number;
  selectError?: { message: string } | null;
  rpcDelayMs?: number;
}) {
  const rpc = vi.fn(
    () =>
      new Promise<{ data: { liked: boolean; likes: number } | null; error: null }>(
        (resolve) => {
          const finish = () =>
            resolve({
              data: {
                liked: options.rpcLiked ?? true,
                likes: options.rpcLikes ?? 4,
              },
              error: null,
            });
          if (options.rpcDelayMs && options.rpcDelayMs > 0) {
            setTimeout(finish, options.rpcDelayMs);
          } else {
            finish();
          }
        }
      )
  );

  const from = vi.fn((table: string) => {
    if (table !== "post_likes") {
      throw new Error(`unexpected table ${table}`);
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (options.selectError) {
                return { data: null, error: options.selectError };
              }
              return {
                data: options.alreadyLikedOnServer
                  ? { post_id: OTHER_POST_ID }
                  : null,
                error: null,
              };
            }),
          })),
        })),
      })),
    };
  });

  return {
    rpc,
    from,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.userId ? { id: options.userId } : null },
        error: null,
      })),
    },
  };
}

describe("ensurePostLike — double-tap never unlikes", () => {
  beforeEach(() => {
    resetEnsurePostLikeInflightForTests();
    vi.useRealTimers();
  });

  it("likes an unliked post exactly once", async () => {
    const supabase = createEnsureLikeClient({
      userId: VIEWER,
      rpcLikes: 5,
    });
    const result = await ensurePostLike(supabase as never, OTHER_POST_ID, {
      likedByMe: false,
      likes: 4,
    });
    expect(result).toEqual({ ok: true, liked: true, likes: 5, noop: false });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("toggle_post_like", {
      p_post_id: OTHER_POST_ID,
    });
  });

  it("no-ops when already liked and never calls toggle", async () => {
    const supabase = createEnsureLikeClient({ userId: VIEWER });
    const result = await ensurePostLike(supabase as never, OTHER_POST_ID, {
      likedByMe: true,
      likes: 9,
    });
    expect(result).toEqual({ ok: true, liked: true, likes: 9, noop: true });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("no-ops when the server already has the like row", async () => {
    const supabase = createEnsureLikeClient({
      userId: VIEWER,
      alreadyLikedOnServer: true,
    });
    const result = await ensurePostLike(supabase as never, OTHER_POST_ID, {
      likedByMe: false,
      likes: 3,
    });
    expect(result).toEqual({ ok: true, liked: true, likes: 3, noop: true });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("shares one in-flight like RPC across rapid callers", async () => {
    vi.useFakeTimers();
    const supabase = createEnsureLikeClient({
      userId: VIEWER,
      rpcLikes: 6,
      rpcDelayMs: 50,
    });
    const first = ensurePostLike(supabase as never, OTHER_POST_ID, {
      likedByMe: false,
      likes: 5,
    });
    expect(isEnsurePostLikeInFlight(OTHER_POST_ID)).toBe(true);
    const second = ensurePostLike(supabase as never, OTHER_POST_ID, {
      likedByMe: false,
      likes: 5,
    });
    await vi.advanceTimersByTimeAsync(50);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual({ ok: true, liked: true, likes: 6, noop: false });
    expect(b).toEqual(a);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(isEnsurePostLikeInFlight(OTHER_POST_ID)).toBe(false);
    vi.useRealTimers();
  });

  it("previews optimistic like without unliking on double-tap", () => {
    expect(previewEnsureLike({ likedByMe: false, likes: 4 })).toEqual({
      liked: true,
      likes: 5,
      noop: false,
    });
    expect(previewEnsureLike({ likedByMe: true, likes: 4 })).toEqual({
      liked: true,
      likes: 4,
      noop: true,
    });
  });

  it("previews rail unlike and save rollback snapshots", () => {
    expect(previewToggleLike({ likedByMe: true, likes: 4 })).toEqual({
      liked: false,
      likes: 3,
    });
    expect(previewToggleSave({ savedByMe: false, saves: 1 })).toEqual({
      saved: true,
      saves: 2,
    });
    expect(previewToggleSave({ savedByMe: true, saves: 1 })).toEqual({
      saved: false,
      saves: 0,
    });
  });

  it("refuses to apply unlike if toggle unexpectedly returns liked:false", async () => {
    const supabase = createEnsureLikeClient({
      userId: VIEWER,
      rpcLiked: false,
      rpcLikes: 2,
    });
    const result = await ensurePostLike(supabase as never, OTHER_POST_ID, {
      likedByMe: false,
      likes: 3,
    });
    expect(result.ok).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
