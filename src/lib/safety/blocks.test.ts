import { describe, expect, it, vi } from "vitest";

import {
  blockUgcUser,
  listMyBlockedUsers,
  listUgcBlockIds,
  toBlockedIdSet,
  unblockUgcUser,
} from "./blocks";

function mockClient(rpcImpl: (name: string, args?: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>) {
  return {
    rpc: vi.fn(rpcImpl),
  } as never;
}

describe("blocks", () => {
  it("lists interaction block ids and own blocked users", async () => {
    const supabase = mockClient(async (name) => {
      if (name === "list_ugc_block_ids") {
        return { data: ["a", "b"], error: null };
      }
      return {
        data: [
          {
            user_id: "a",
            username: "ada",
            display_name: "Ada",
            created_at: "2026-08-13T00:00:00Z",
          },
        ],
        error: null,
      };
    });

    const ids = await listUgcBlockIds(supabase);
    expect(ids).toEqual({ ok: true, ids: ["a", "b"] });
    const users = await listMyBlockedUsers(supabase);
    expect(users.ok).toBe(true);
    if (users.ok) {
      expect(users.users[0]?.username).toBe("ada");
    }
    expect(toBlockedIdSet(["a", ""])).toEqual(new Set(["a"]));
  });

  it("blocks and unblocks through the RPC contract", async () => {
    const supabase = mockClient(async (name, args) => {
      if (name === "block_ugc_user") {
        expect(args?.p_user_id).toBe("user-9");
        return { data: "block-1", error: null };
      }
      expect(name).toBe("unblock_ugc_user");
      return { data: true, error: null };
    });

    const blocked = await blockUgcUser(supabase, "me", "user-9");
    expect(blocked).toEqual({ ok: true, blockId: "block-1" });
    const unblocked = await unblockUgcUser(supabase, "user-9");
    expect(unblocked).toEqual({ ok: true, unblocked: true });
  });

  it("refuses self-block before calling the backend", async () => {
    const supabase = mockClient(async () => ({ data: null, error: null }));
    const result = await blockUgcUser(supabase, "same", "same");
    expect(result.ok).toBe(false);
    expect((supabase as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });
});
