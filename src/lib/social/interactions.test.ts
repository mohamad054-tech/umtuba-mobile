import { beforeEach, describe, expect, it, vi } from "vitest";

import { togglePostLike, togglePostSave } from "./interactions";

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
});
