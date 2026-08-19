import { describe, expect, it } from "vitest";

import {
  canUseSoundInEditor,
  defaultCreateSoundState,
  isPubliclyReusableSound,
  mapSoundRow,
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
});
