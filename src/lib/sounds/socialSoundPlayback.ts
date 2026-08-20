/**
 * Selected-sound apply + composite playback.
 * Catalog rows stay the source of truth; this only resolves a signed AAC URI
 * and applies existing VIDEO_EDIT_STATE mix levels. Architecture is metadata
 * composite (media_pipeline), not a baked file.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clampMixVolume,
  fetchSocialSoundById,
  type SocialSound,
  type VideoSoundMix,
} from "@/src/lib/sounds/socialSounds";
import { closeSoundLibraryPreservingEditor } from "@/src/lib/sounds/soundLibraryEscape";
import type { VideoEditState } from "@/src/lib/video/videoEditState";

export const SOCIAL_SOUNDS_BUCKET = "social-sounds";
export const SOUND_SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Existing Video Editor V1 mix: original stays unless the user muted/scaled it. */
export const INTENDED_ORIGINAL_AUDIO_BEHAVIOR = "MIX_PRESERVE_EXISTING_ORIGINAL_CONTROLS";

export function socialSoundObjectPath(
  storagePath: string | null | undefined
): string | null {
  const trimmed = (storagePath ?? "").trim().replace(/^\/+/, "");
  if (!trimmed) return null;
  if (trimmed.includes("..") || trimmed.includes("\\")) return null;
  return trimmed;
}

export function selectedSoundUriFromSound(
  sound: Pick<SocialSound, "storagePath"> | null | undefined
): string | null {
  return socialSoundObjectPath(sound?.storagePath ?? null);
}

export function applySelectedSoundToEditState(
  draft: VideoEditState,
  sound: Pick<SocialSound, "id">
): VideoEditState {
  const added = draft.mix.addedSoundVolume || 1;
  return {
    ...draft,
    soundId: sound.id,
    soundVolume: added,
    mix: {
      ...draft.mix,
      addedSoundVolume: added,
    },
  };
}

export function commitSoundSelection(input: {
  draft: VideoEditState;
  sound: SocialSound;
}): {
  selectedSound: SocialSound;
  draft: VideoEditState;
  storagePath: string | null;
} {
  return {
    selectedSound: input.sound,
    draft: applySelectedSoundToEditState(input.draft, input.sound),
    storagePath: selectedSoundUriFromSound(input.sound),
  };
}

export function closeLibraryKeepingSelectedSound<TDraft, TSound>(input: {
  draft: TDraft;
  selectedSound: TSound;
}): {
  soundLibraryOpen: false;
  editorOpen: true;
  draft: TDraft;
  selectedSound: TSound;
} {
  return closeSoundLibraryPreservingEditor(input);
}

export function resolveEditorOriginalAudio(mix: VideoSoundMix): {
  muted: boolean;
  volume: number;
} {
  if (mix.originalAudioEnabled === false) {
    return { muted: true, volume: 0 };
  }
  const volume = clampMixVolume(mix.originalAudioVolume);
  return { muted: volume <= 0, volume };
}

export function resolveEditorAddedSoundAudio(mix: VideoSoundMix): {
  muted: boolean;
  volume: number;
} {
  const volume = clampMixVolume(mix.addedSoundVolume);
  return { muted: volume <= 0, volume };
}

export function resolveSelectedSoundWatchAudio(input: {
  isActive: boolean;
  shouldPlay: boolean;
  watchMuted: boolean;
  watchVolume: number;
  addedSoundVolume: number;
}): { shouldPlay: boolean; muted: boolean; volume: number } {
  const added = clampMixVolume(input.addedSoundVolume);
  if (!input.isActive || !input.shouldPlay || added <= 0.001) {
    return { shouldPlay: false, muted: true, volume: 0 };
  }
  const volume = clampMixVolume(input.watchVolume * added);
  return {
    shouldPlay: true,
    muted: input.watchMuted || volume <= 0,
    volume: input.watchMuted ? 0 : volume,
  };
}

export function publishedMediaUsesCompositeSound(): true {
  return true;
}

export async function createSocialSoundSignedUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  const path = socialSoundObjectPath(storagePath);
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(SOCIAL_SOUNDS_BUCKET)
      .createSignedUrl(path, SOUND_SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function resolveSocialSoundPlaybackUri(
  supabase: SupabaseClient,
  sound: Pick<SocialSound, "storagePath"> | null | undefined
): Promise<string | null> {
  return createSocialSoundSignedUrl(supabase, sound?.storagePath ?? null);
}

export async function resolveSocialSoundPlaybackUriById(
  supabase: SupabaseClient,
  soundId: string | null | undefined,
  viewerUserId: string | null
): Promise<string | null> {
  const id = (soundId ?? "").trim();
  if (!id) return null;
  const sound = await fetchSocialSoundById(supabase, id, viewerUserId);
  if (!sound) return null;
  return createSocialSoundSignedUrl(supabase, sound.storagePath);
}
