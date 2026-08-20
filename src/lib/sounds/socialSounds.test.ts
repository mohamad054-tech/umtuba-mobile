import { describe, expect, it } from "vitest";

import {
  canUseSoundInEditor,
  defaultCreateSoundState,
  isPubliclyReusableSound,
  mapSoundRow,
  publicSoundSearchQuery,
  searchPublicSocialSounds,
} from "./socialSounds";

describe("social sound rights gate", () => {
  it("defaults new sounds to private", () => {
    expect(defaultCreateSoundState().visibility).toBe("private");
    expect(defaultCreateSoundState().rightsStatus).toBe("unverified");
  });

  it("never treats unverified uploads as reusable", () => {
    expect(
      isPubliclyReusableSound({
        visibility: "private",
        reusePermission: "none",
        rightsStatus: "unverified",
        moderationStatus: "pending",
        rightsConfirmedAt: null,
      })
    ).toBe(false);
  });

  it("blocks takedown from editor reuse", () => {
    expect(
      canUseSoundInEditor({
        visibility: "public_reusable",
        reusePermission: "public",
        rightsStatus: "takedown",
        moderationStatus: "blocked",
        rightsConfirmedAt: "2026-08-19T00:00:00Z",
        ownerUserId: "a",
        viewerUserId: "b",
      })
    ).toBe(false);
  });

  it("maps a server row without inventing usage", () => {
    const sound = mapSoundRow({
      id: "11111111-1111-4111-8111-111111111111",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
      source_type: "platform",
      title: "UMTUBA Pulse",
      usage_count: 4,
      visibility: "public_reusable",
      reuse_permission: "public",
      rights_status: "platform_licensed",
      rights_confirmed_at: "2026-08-01T00:00:00Z",
      moderation_status: "clean",
    });
    expect(sound?.usageCount).toBe(4);
    expect(sound?.title).toBe("UMTUBA Pulse");
  });

  it("SOUND_LIBRARY_QUERY: searches public reusable rows only", () => {
    const spec = publicSoundSearchQuery("  pulse  ", 20);
    expect(spec.query).toBe("pulse");
    expect(spec.visibility).toBe("public_reusable");
    expect(spec.rightsStatuses).toEqual(["owner_confirmed", "platform_licensed"]);
    expect(spec.limit).toBe(20);
  });

  it("falls back to the rights-gated table when search RPC is missing", async () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_user_id: "22222222-2222-4222-8222-222222222222",
      title: "UMTUBA Pulse",
      usage_count: 2,
      visibility: "public_reusable",
      reuse_permission: "public",
      rights_status: "platform_licensed",
      rights_confirmed_at: "2026-08-01T00:00:00Z",
      moderation_status: "clean",
    };
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "function not found" } }),
      from() {
        const query = {
          select() {
            return query;
          },
          eq() {
            return query;
          },
          in() {
            return query;
          },
          neq() {
            return query;
          },
          not() {
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          ilike() {
            return query;
          },
          then(resolve: (value: { data: unknown; error: null }) => unknown) {
            return Promise.resolve({ data: [row], error: null }).then(resolve);
          },
        };
        return query;
      },
    };
    const result = await searchPublicSocialSounds(
      supabase as never,
      "pulse",
      20
    );
    expect(result.unavailable).toBe(false);
    expect(result.sounds).toHaveLength(1);
    expect(result.sounds[0]?.title).toBe("UMTUBA Pulse");
  });

  it("does not invent catalog rows when the server returns none", async () => {
    const supabase = {
      rpc: async () => ({ data: [], error: null }),
    };
    const result = await searchPublicSocialSounds(supabase as never, "", 20);
    expect(result.unavailable).toBe(false);
    expect(result.sounds).toEqual([]);
  });
});
