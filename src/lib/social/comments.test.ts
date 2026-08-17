import { describe, expect, it, vi } from "vitest";

import {
  createPostComment,
  listPostComments,
  validateCommentBody,
} from "./comments";

describe("validateCommentBody", () => {
  it("rejects empty and oversized bodies", () => {
    expect(validateCommentBody("   ").ok).toBe(false);
    expect(validateCommentBody("x".repeat(501)).ok).toBe(false);
    expect(validateCommentBody("  hello  ")).toEqual({
      ok: true,
      body: "hello",
    });
  });
});

describe("listPostComments", () => {
  it("reads comments for the requested post only", async () => {
    const commentsEq = vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(async () => ({
          data: [
            {
              id: 1,
              post_id: 9,
              user_id: "u1",
              body: "Nice",
              created_at: "2026-08-17T00:00:00Z",
            },
          ],
          error: null,
        })),
      })),
    }));
    const profilesIn = vi.fn(async () => ({
      data: [
        {
          id: "u1",
          username: "ada",
          display_name: "Ada",
          full_name: "Ada",
          avatar_initial: "A",
        },
      ],
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "post_comments") {
        return {
          select: vi.fn(() => ({ eq: commentsEq })),
        };
      }
      return {
        select: vi.fn(() => ({ in: profilesIn })),
      };
    });
    const result = await listPostComments({ from } as never, 9, "u1");
    expect(commentsEq).toHaveBeenCalledWith("post_id", 9);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]?.postId).toBe(9);
      expect(result.comments[0]?.isMine).toBe(true);
    }
  });

  it("rejects an invalid post id without querying", async () => {
    const from = vi.fn();
    const result = await listPostComments({ from } as never, 0, null);
    expect(from).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });
});

describe("createPostComment", () => {
  it("inserts onto the requested post", async () => {
    const from = vi.fn((table: string) => {
      if (table === "posts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: table === "posts" ? { id: 4, comments: 2 } : { comments: 2 },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "post_comments") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 11,
                  post_id: 4,
                  user_id: "u1",
                  body: "Great clip",
                  created_at: "2026-08-17T00:00:00Z",
                },
                error: null,
              })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [
              {
                id: "u1",
                username: "ada",
                display_name: "Ada",
                full_name: "Ada",
                avatar_initial: "A",
              },
            ],
            error: null,
          })),
        })),
      };
    });
    const result = await createPostComment(
      { from } as never,
      4,
      "u1",
      "Great clip"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.comment.postId).toBe(4);
      expect(result.comment.body).toBe("Great clip");
    }
  });
});
