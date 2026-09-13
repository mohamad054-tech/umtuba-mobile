import { describe, expect, it, vi } from "vitest";

import { reportUgcContent, reportUgcUser } from "./reports";

function mockClient(rpcImpl: (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>) {
  return {
    rpc: vi.fn(rpcImpl),
  } as never;
}

describe("reportUgcContent", () => {
  it("rejects invalid post ids and reasons before RPC", async () => {
    const supabase = mockClient(async () => ({ data: null, error: null }));
    const badId = await reportUgcContent(supabase, {
      postId: 0,
      reasonCode: "spam",
    });
    expect(badId.ok).toBe(false);
    const badReason = await reportUgcContent(supabase, {
      postId: 12,
      reasonCode: "nope",
    });
    expect(badReason.ok).toBe(false);
    expect((supabase as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("submits a content report through the existing RPC contract", async () => {
    const supabase = mockClient(async (name, args) => {
      expect(name).toBe("report_ugc_content");
      expect(args).toEqual({
        p_post_id: 44,
        p_reason_code: "harassment",
        p_reason_detail: "mean comments",
      });
      return { data: "rep-1", error: null };
    });
    const result = await reportUgcContent(supabase, {
      postId: 44,
      reasonCode: "harassment",
      detail: "mean comments",
    });
    expect(result).toEqual({ ok: true, reportId: "rep-1" });
  });

  it("treats duplicate reports as a confirmation, not a crash", async () => {
    const supabase = mockClient(async () => ({
      data: null,
      error: { message: "Already reported" },
    }));
    const result = await reportUgcContent(supabase, {
      postId: 9,
      reasonCode: "spam",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.duplicate).toBe(true);
    }
  });
});

describe("reportUgcUser", () => {
  it("submits a user report through the existing RPC contract", async () => {
    const supabase = mockClient(async (name, args) => {
      expect(name).toBe("report_ugc_user");
      expect(args.p_user_id).toBe("user-2");
      expect(args.p_reason_code).toBe("spam");
      return { data: "rep-user", error: null };
    });
    const result = await reportUgcUser(supabase, {
      userId: "user-2",
      reasonCode: "spam",
    });
    expect(result).toEqual({ ok: true, reportId: "rep-user" });
  });
});
