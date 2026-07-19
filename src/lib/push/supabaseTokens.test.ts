import { describe, expect, it, vi } from "vitest";

import {
  deletePushToken,
  upsertPushToken,
} from "@/src/lib/push/supabaseTokens";
import { PUSH_TOKENS_TABLE } from "@/src/lib/push/types";

function mockClient(result: { error: { message: string } | null }) {
  const upsert = vi.fn(async () => result);
  const del = vi.fn(async () => result);
  const eq2 = vi.fn(() => Promise.resolve(result));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  return {
    client: {
      from: vi.fn((table: string) => {
        expect(table).toBe(PUSH_TOKENS_TABLE);
        return {
          upsert,
          delete: () => ({ eq: eq1 }),
        };
      }),
    } as never,
    upsert,
    del,
    eq1,
    eq2,
  };
}

describe("supabase push token lifecycle", () => {
  it("upserts tokens for the authenticated user", async () => {
    const { client, upsert } = mockClient({ error: null });
    const result = await upsertPushToken(client, {
      user_id: "user-1",
      token: "ExponentPushToken[abc]",
      platform: "android",
      device_id: "pixel",
    });
    expect(result).toEqual({ ok: true });
    expect(upsert).toHaveBeenCalled();
  });

  it("deletes tokens on logout/revoke", async () => {
    const { client, eq2 } = mockClient({ error: null });
    const result = await deletePushToken(client, {
      userId: "user-1",
      token: "ExponentPushToken[abc]",
    });
    expect(result).toEqual({ ok: true });
    expect(eq2).toHaveBeenCalled();
  });

  it("soft-fails when push_tokens table is missing", async () => {
    const { client } = mockClient({
      error: { message: "Could not find the table 'public.push_tokens'" },
    });
    const result = await upsertPushToken(client, {
      user_id: "user-1",
      token: "ExponentPushToken[abc]",
      platform: "ios",
      device_id: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingTable).toBe(true);
    }
  });
});
