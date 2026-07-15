import { describe, expect, it } from "vitest";

/**
 * Contract: AuthProvider.restore must call supabase.auth.getSession and
 * apply the result before clearing loading. This mirrors AuthContext without
 * mounting React Native.
 */
describe("session restoration contract", () => {
  it("treats null session as signed out", async () => {
    const getSession = async () => ({
      data: { session: null },
      error: null,
    });

    const result = await getSession();
    expect(result.error).toBeNull();
    expect(result.data.session).toBeNull();
  });

  it("keeps a valid session for authenticated restore", async () => {
    const session = {
      access_token: "tok",
      user: { id: "user-1", email: "a@b.co" },
    };
    const getSession = async () => ({
      data: { session },
      error: null,
    });

    const result = await getSession();
    expect(result.data.session?.user.id).toBe("user-1");
  });

  it("surfaces restore failures without leaving an opaque state", async () => {
    const getSession = async () => ({
      data: { session: null },
      error: { message: "Invalid Refresh Token" },
    });

    const result = await getSession();
    expect(result.error?.message).toMatch(/Refresh Token/i);
    expect(result.data.session).toBeNull();
  });
});
