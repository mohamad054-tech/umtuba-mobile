/**
 * Social Sound Library V1 — canonical SOUND entity + video mix.
 * Server/RLS is the authority. Upload is not redistribution permission.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SOUND_RIGHTS_CONFIRMATION_MIN = 8;

export type SocialSoundVisibility = "private" | "owner_only" | "public_reusable";
export type SocialSoundRightsStatus =
  | "unverified"
  | "owner_confirmed"
  | "platform_licensed"
  | "blocked"
  | "takedown";
export type SocialSoundReusePermission = "none" | "owner_only" | "public";
export type SocialSoundSourceType = "uploaded" | "original_video" | "platform";

export type SocialSound = {
  id: string;
  ownerUserId: string;
  sourceType: SocialSoundSourceType;
  sourceVideoId: number | null;
  parentSoundId: string | null;
  title: string;
  storagePath: string | null;
  durationMs: number | null;
  createdAt: string;
  visibility: SocialSoundVisibility;
  reusePermission: SocialSoundReusePermission;
  rightsStatus: SocialSoundRightsStatus;
  rightsConfirmedAt: string | null;
  moderationStatus: "pending" | "clean" | "flagged" | "blocked";
  usageCount: number;
};

export type VideoSoundMix = {
  originalAudioEnabled: boolean;
  originalAudioVolume: number;
  addedSoundVolume: number;
  soundStartOffsetMs: number;
};

export const DEFAULT_VIDEO_SOUND_MIX: VideoSoundMix = {
  originalAudioEnabled: true,
  originalAudioVolume: 1,
  addedSoundVolume: 1,
  soundStartOffsetMs: 0,
};

export function isPubliclyReusableSound(sound: {
  visibility: string;
  reusePermission: string;
  rightsStatus: string;
  moderationStatus: string;
  rightsConfirmedAt: string | null;
}): boolean {
  return (
    sound.visibility === "public_reusable" &&
    sound.reusePermission === "public" &&
    (sound.rightsStatus === "owner_confirmed" ||
      sound.rightsStatus === "platform_licensed") &&
    sound.moderationStatus !== "blocked" &&
    sound.rightsConfirmedAt != null
  );
}

export function defaultCreateSoundState(): {
  visibility: SocialSoundVisibility;
  reusePermission: SocialSoundReusePermission;
  rightsStatus: SocialSoundRightsStatus;
} {
  return {
    visibility: "private",
    reusePermission: "none",
    rightsStatus: "unverified",
  };
}

export function canUseSoundInEditor(sound: {
  visibility: string;
  reusePermission: string;
  rightsStatus: string;
  moderationStatus: string;
  rightsConfirmedAt: string | null;
  ownerUserId: string;
  viewerUserId: string | null;
}): boolean {
  if (sound.rightsStatus === "blocked" || sound.rightsStatus === "takedown") {
    return false;
  }
  if (sound.moderationStatus === "blocked") {
    return false;
  }
  if (sound.viewerUserId && sound.ownerUserId === sound.viewerUserId) {
    return true;
  }
  return isPubliclyReusableSound(sound);
}

export function clampMixVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export function sanitizeVideoSoundMix(input: unknown): VideoSoundMix {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_VIDEO_SOUND_MIX };
  }
  const raw = input as Record<string, unknown>;
  return {
    originalAudioEnabled: raw.originalAudioEnabled !== false,
    originalAudioVolume: clampMixVolume(Number(raw.originalAudioVolume)),
    addedSoundVolume: clampMixVolume(Number(raw.addedSoundVolume)),
    soundStartOffsetMs: Math.max(
      0,
      Number.isFinite(Number(raw.soundStartOffsetMs))
        ? Math.round(Number(raw.soundStartOffsetMs))
        : 0
    ),
  };
}

export function mapSoundRow(row: Record<string, unknown> | null): SocialSound | null {
  if (!row || typeof row.id !== "string") return null;
  const owner =
    typeof row.owner_user_id === "string"
      ? row.owner_user_id
      : typeof row.ownerUserId === "string"
        ? row.ownerUserId
        : "";
  if (!owner) return null;
  return {
    id: row.id,
    ownerUserId: owner,
    sourceType: (row.source_type as SocialSoundSourceType) || "uploaded",
    sourceVideoId:
      typeof row.source_video_id === "number" ? row.source_video_id : null,
    parentSoundId:
      typeof row.parent_sound_id === "string" ? row.parent_sound_id : null,
    title: typeof row.title === "string" ? row.title : "",
    storagePath: typeof row.storage_path === "string" ? row.storage_path : null,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    visibility: (row.visibility as SocialSoundVisibility) || "private",
    reusePermission: (row.reuse_permission as SocialSoundReusePermission) || "none",
    rightsStatus: (row.rights_status as SocialSoundRightsStatus) || "unverified",
    rightsConfirmedAt:
      typeof row.rights_confirmed_at === "string" ? row.rights_confirmed_at : null,
    moderationStatus:
      (row.moderation_status as SocialSound["moderationStatus"]) || "pending",
    usageCount: typeof row.usage_count === "number" ? row.usage_count : 0,
  };
}

const SOUND_SELECT =
  "id,owner_user_id,source_type,source_video_id,parent_sound_id,title,storage_path,duration_ms,created_at,visibility,reuse_permission,rights_status,rights_confirmed_at,moderation_status,usage_count";

function mapSoundRows(data: unknown): SocialSound[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => mapSoundRow(row as Record<string, unknown>))
    .filter((row): row is SocialSound => row != null);
}

export async function fetchSocialSoundById(
  supabase: SupabaseClient,
  soundId: string,
  viewerUserId: string | null
): Promise<SocialSound | null> {
  const id = soundId.trim();
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from("social_sounds")
      .select(SOUND_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const sound = mapSoundRow(data as Record<string, unknown>);
    if (!sound) return null;
    if (
      !canUseSoundInEditor({
        ...sound,
        viewerUserId,
      })
    ) {
      return null;
    }
    return sound;
  } catch {
    return null;
  }
}

export async function searchPublicSocialSounds(
  supabase: SupabaseClient,
  query: string,
  limit = 20
): Promise<{ sounds: SocialSound[]; unavailable: boolean }> {
  try {
    const { data, error } = await supabase.rpc("search_social_sounds", {
      p_query: query,
      p_limit: limit,
    });
    if (error) return { sounds: [], unavailable: true };
    return { sounds: mapSoundRows(data), unavailable: false };
  } catch {
    return { sounds: [], unavailable: true };
  }
}

export async function listOwnedSocialSounds(
  supabase: SupabaseClient,
  userId: string
): Promise<SocialSound[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("social_sounds")
      .select(SOUND_SELECT)
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return [];
    return mapSoundRows(data);
  } catch {
    return [];
  }
}

export async function listSavedSocialSounds(
  supabase: SupabaseClient,
  userId: string
): Promise<SocialSound[]> {
  if (!userId) return [];
  try {
    const { data: saves, error: saveError } = await supabase
      .from("social_sound_saves")
      .select("sound_id")
      .eq("user_id", userId)
      .limit(30);
    if (saveError || !Array.isArray(saves) || saves.length === 0) return [];
    const ids = saves
      .map((row) =>
        row && typeof row === "object" && typeof (row as { sound_id?: unknown }).sound_id === "string"
          ? (row as { sound_id: string }).sound_id
          : null
      )
      .filter((id): id is string => !!id);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("social_sounds")
      .select(SOUND_SELECT)
      .in("id", ids);
    if (error) return [];
    return mapSoundRows(data);
  } catch {
    return [];
  }
}
