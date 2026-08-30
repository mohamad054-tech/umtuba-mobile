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

type SaveRow = { user_id: string; post_id: number };

function createSaveClient(options: {
  userId?: string | null;
  existing?: SaveRow | null;
  savesCount?: number;
  insertError?: { message: string; code?: string } | null;
  deleteError?: { message: string } | null;
  selectError?: { message: string } | null;
  countError?: { message: string } | null;
}) {
  const saves: SaveRow[] = options.existing ? [options.existing] : [];
  const rpc = vi.fn();
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];

  const from = vi.fn((table: string) => {
    if (table === "post_saves") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                calls.push({ table, op: "select" });
                if (options.selectError) {
                  return { data: null, error: options.selectError };
                }
                return { data: saves[0] ?? null, error: null };
              }),
            })),
          })),
        })),
        insert: vi.fn(async (payload: SaveRow) => {
          calls.push({ table, op: "insert", payload });
          if (options.insertError) {
            return { data: null, error: options.insertError };
          }
          saves.push(payload);
          return { data: payload, error: null };
        }),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => {
              calls.push({ table, op: "delete" });
              if (options.deleteError) {
                return { data: null, error: options.deleteError };
              }
              saves.splice(0, saves.length);
              return { data: null, error: null };
            }),
          })),
        })),
      };
    }

    if (table === "posts") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              calls.push({ table, op: "select-count" });
              if (options.countError) {
                return { data: null, error: options.countError };
              }
              return {
                data: { saves: options.savesCount ?? (saves.length > 0 ? 1 : 0) },
                error: null,
              };
            }),
          })),
        })),
      };
    }

    throw new Error(`unexpected table ${table}`);
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

describe("togglePostSave — other-user Watch bookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call toggle_post_save (INVOKER + revoked award helpers)", async () => {
    const supabase = createSaveClient({ userId: VIEWER, savesCount: 4 });
    await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("guest is auth-gated without writing post_saves", async () => {
    const supabase = createSaveClient({ userId: null });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Please sign in to save posts.",
      requiresAuth: true,
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("saves another user's video via the viewer's post_saves row", async () => {
    const supabase = createSaveClient({ userId: VIEWER, savesCount: 4 });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: true, saves: 4 });
    expect(supabase.calls).toContainEqual({
      table: "post_saves",
      op: "insert",
      payload: { user_id: VIEWER, post_id: OTHER_POST_ID },
    });
  });

  it("unsaves an existing bookmark without rejecting own-or-other owner", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      existing: { user_id: VIEWER, post_id: OTHER_POST_ID },
      savesCount: 3,
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: false, saves: 3 });
    expect(supabase.calls.some((call) => call.op === "delete")).toBe(true);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("treats a unique-violation insert as already saved", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      insertError: { message: "duplicate key value", code: "23505" },
      savesCount: 1,
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: true, saves: 1 });
  });

  it("rejects a non-positive post id before touching the session", async () => {
    const supabase = createSaveClient({ userId: VIEWER });
    const result = await togglePostSave(supabase as never, 0);
    expect(result.ok).toBe(false);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("does not report success when the post_saves insert fails", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      insertError: { message: "permission denied", code: "42501" },
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Unable to update save. Please try again.",
    });
  });

  it("does not report success when unsave delete fails", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      existing: { user_id: VIEWER, post_id: OTHER_POST_ID },
      deleteError: { message: "permission denied" },
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Unable to update save. Please try again.",
    });
  });

  it("does not report success when the existing-save lookup fails", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      selectError: { message: "network" },
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({
      ok: false,
      message: "Unable to update save. Please try again.",
    });
    expect(supabase.calls.some((call) => call.op === "insert")).toBe(false);
    expect(supabase.calls.some((call) => call.op === "delete")).toBe(false);
  });

  it("keeps the bookmark when award/notification RPCs would throw", async () => {
    const supabase = createSaveClient({ userId: VIEWER, savesCount: 4 });
    supabase.rpc.mockImplementation(async (name: string) => {
      throw new Error(`side effect ${name} must not run`);
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: true, saves: 4 });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.calls).toContainEqual({
      table: "post_saves",
      op: "insert",
      payload: { user_id: VIEWER, post_id: OTHER_POST_ID },
    });
  });

  it("treats a failed posts.saves count read as optional after a successful save", async () => {
    const supabase = createSaveClient({
      userId: VIEWER,
      countError: { message: "timeout" },
    });
    const result = await togglePostSave(supabase as never, OTHER_POST_ID);
    expect(result).toEqual({ ok: true, saved: true, saves: 1 });
    expect(supabase.calls).toContainEqual({
      table: "post_saves",
      op: "insert",
      payload: { user_id: VIEWER, post_id: OTHER_POST_ID },
    });
  });

  it("shares one save write while in flight", async () => {
    resetTogglePostSaveInflightForTests();
    const supabase = createSaveClient({ userId: VIEWER, savesCount: 3 });
    const first = togglePostSave(supabase as never, OTHER_POST_ID);
    const second = togglePostSave(supabase as never, OTHER_POST_ID);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(
      supabase.calls.filter((call) => call.op === "insert")
    ).toHaveLength(1);
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
