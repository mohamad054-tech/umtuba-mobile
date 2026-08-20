import { describe, expect, it } from "vitest";

import { createInitialEditState } from "@/src/lib/video/videoEditState";
import { serializeEditIntoMediaPipeline } from "@/src/lib/video/videoEditState";
import {
  watchAddedSoundScale,
  watchEditAudioScale,
  watchEditFromPipeline,
} from "@/src/lib/video/watchEditPlayback";

import {
  applySelectedSoundToEditState,
  closeLibraryKeepingSelectedSound,
  commitSoundSelection,
  createSocialSoundSignedUrl,
  INTENDED_ORIGINAL_AUDIO_BEHAVIOR,
  publishedMediaUsesCompositeSound,
  resolveEditorAddedSoundAudio,
  resolveEditorOriginalAudio,
  resolveSelectedSoundWatchAudio,
  resolveSocialSoundPlaybackUri,
  selectedSoundUriFromSound,
  SOCIAL_SOUNDS_BUCKET,
  socialSoundObjectPath,
} from "./socialSoundPlayback";
import type { SocialSound } from "./socialSounds";

const SOUND: SocialSound = {
  id: "11111111-1111-4111-8111-111111111111",
  ownerUserId: "22222222-2222-4222-8222-222222222222",
  sourceType: "platform",
  sourceVideoId: null,
  parentSoundId: null,
  title: "UMTUBA Pulse",
  storagePath: "sounds/pulse/umtuba-pulse.m4a",
  durationMs: 8000,
  createdAt: "2026-08-20T00:00:00Z",
  visibility: "public_reusable",
  reusePermission: "public",
  rightsStatus: "platform_licensed",
  rightsConfirmedAt: "2026-08-01T00:00:00Z",
  moderationStatus: "clean",
  usageCount: 1,
};

describe("SOUND_SELECTION_CALLBACK + SELECTED_SOUND_STATE", () => {
  it("commits id, title, and storage path into editor state without muting original", () => {
    const draft = createInitialEditState(8_000);
    const next = commitSoundSelection({ draft, sound: SOUND });
    expect(next.selectedSound.id).toBe(SOUND.id);
    expect(next.selectedSound.title).toBe("UMTUBA Pulse");
    expect(next.draft.soundId).toBe(SOUND.id);
    expect(next.storagePath).toBe("sounds/pulse/umtuba-pulse.m4a");
    expect(next.draft.mix.originalAudioEnabled).toBe(true);
    expect(next.draft.mix.originalAudioVolume).toBe(1);
    expect(next.draft.mix.addedSoundVolume).toBe(1);
    expect(INTENDED_ORIGINAL_AUDIO_BEHAVIOR).toBe(
      "MIX_PRESERVE_EXISTING_ORIGINAL_CONTROLS"
    );
  });

  it("applySelectedSoundToEditState keeps overlays and trim", () => {
    const draft = {
      ...createInitialEditState(8_000),
      trimStartMs: 500,
      trimEndMs: 4_000,
    };
    const next = applySelectedSoundToEditState(draft, SOUND);
    expect(next.trimStartMs).toBe(500);
    expect(next.trimEndMs).toBe(4_000);
    expect(next.soundId).toBe(SOUND.id);
  });
});

describe("SELECTED_SOUND_URI + URI persists", () => {
  it("keeps the catalog storage path and never invents a fake URI", () => {
    expect(socialSoundObjectPath(SOUND.storagePath)).toBe(
      "sounds/pulse/umtuba-pulse.m4a"
    );
    expect(selectedSoundUriFromSound(SOUND)).toBe(
      "sounds/pulse/umtuba-pulse.m4a"
    );
    expect(socialSoundObjectPath("../secret")).toBeNull();
    expect(socialSoundObjectPath("")).toBeNull();
    expect(selectedSoundUriFromSound({ storagePath: null })).toBeNull();
    expect(SOCIAL_SOUNDS_BUCKET).toBe("social-sounds");
  });

  it("signs the private social-sounds object and does not invent catalog rows", async () => {
    const supabase = {
      storage: {
        from(bucket: string) {
          expect(bucket).toBe("social-sounds");
          return {
            createSignedUrl: async (path: string) => ({
              data: {
                signedUrl: `https://signed.example/${path}`,
              },
              error: null,
            }),
          };
        },
      },
    };
    const uri = await resolveSocialSoundPlaybackUri(supabase as never, SOUND);
    expect(uri).toBe(
      "https://signed.example/sounds/pulse/umtuba-pulse.m4a"
    );
    expect(
      await createSocialSoundSignedUrl(supabase as never, null)
    ).toBeNull();
  });
});

describe("EDITOR_PLAYBACK + ORIGINAL_AUDIO_BEHAVIOR", () => {
  it("mixes original and selected at existing mix levels", () => {
    const original = resolveEditorOriginalAudio({
      originalAudioEnabled: true,
      originalAudioVolume: 0.5,
      addedSoundVolume: 1,
      soundStartOffsetMs: 0,
    });
    const added = resolveEditorAddedSoundAudio({
      originalAudioEnabled: true,
      originalAudioVolume: 0.5,
      addedSoundVolume: 1,
      soundStartOffsetMs: 0,
    });
    expect(original).toEqual({ muted: false, volume: 0.5 });
    expect(added).toEqual({ muted: false, volume: 1 });
  });

  it("mutes original only when the existing original control is off", () => {
    expect(
      resolveEditorOriginalAudio({
        originalAudioEnabled: false,
        originalAudioVolume: 0,
        addedSoundVolume: 1,
        soundStartOffsetMs: 0,
      })
    ).toEqual({ muted: true, volume: 0 });
    expect(
      resolveEditorAddedSoundAudio({
        originalAudioEnabled: false,
        originalAudioVolume: 0,
        addedSoundVolume: 1,
        soundStartOffsetMs: 0,
      })
    ).toEqual({ muted: false, volume: 1 });
  });
});

describe("MODAL_CLOSE_STATE_PRESERVED", () => {
  it("keeps selected sound and URI path after library close", () => {
    const draft = applySelectedSoundToEditState(
      createInitialEditState(8_000),
      SOUND
    );
    const next = closeLibraryKeepingSelectedSound({
      draft,
      selectedSound: SOUND,
    });
    expect(next.soundLibraryOpen).toBe(false);
    expect(next.editorOpen).toBe(true);
    expect(next.draft.soundId).toBe(SOUND.id);
    expect(next.selectedSound.storagePath).toBe(SOUND.storagePath);
    expect(selectedSoundUriFromSound(next.selectedSound)).toBe(
      "sounds/pulse/umtuba-pulse.m4a"
    );
  });
});

describe("PUBLISH_AUDIO_PATH", () => {
  it("writes soundId + mix into media_pipeline for Watch composite", () => {
    const draft = applySelectedSoundToEditState(
      {
        ...createInitialEditState(8_000),
        originalAudioVolume: 0.25,
        mix: {
          originalAudioEnabled: true,
          originalAudioVolume: 0.25,
          addedSoundVolume: 1,
          soundStartOffsetMs: 0,
        },
      },
      SOUND
    );
    const pipeline = serializeEditIntoMediaPipeline(null, draft);
    const edit = watchEditFromPipeline(pipeline, 8_000);
    expect(publishedMediaUsesCompositeSound()).toBe(true);
    expect(edit.soundId).toBe(SOUND.id);
    expect(watchEditAudioScale(edit)).toBe(0.25);
    expect(watchAddedSoundScale(edit)).toBe(1);
    expect(
      resolveSelectedSoundWatchAudio({
        isActive: true,
        shouldPlay: true,
        watchMuted: false,
        watchVolume: 1,
        addedSoundVolume: edit.mix.addedSoundVolume,
      })
    ).toEqual({ shouldPlay: true, muted: false, volume: 1 });
  });

  it("Watch mute silences selected sound; editor original-mute does not", () => {
    expect(
      resolveSelectedSoundWatchAudio({
        isActive: true,
        shouldPlay: true,
        watchMuted: true,
        watchVolume: 1,
        addedSoundVolume: 1,
      })
    ).toEqual({ shouldPlay: true, muted: true, volume: 0 });
    expect(
      resolveSelectedSoundWatchAudio({
        isActive: false,
        shouldPlay: true,
        watchMuted: false,
        watchVolume: 1,
        addedSoundVolume: 1,
      }).shouldPlay
    ).toBe(false);
  });
});
