import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string; requiresAuth?: boolean };

export type PostViewerState = {
  likedByMe: boolean;
  savedByMe: boolean;
};

export type ToggleLikeResult = {
  liked: boolean;
  likes: number;
};

export type ToggleSaveResult = {
  saved: boolean;
  saves: number;
};

export type ShareResult = {
  counted: boolean;
  shares: number;
};

export type ViewResult = {
  counted: boolean;
  views: number;
};

type RpcJson = Record<string, unknown> | null;

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Accept bigint-as-string post ids from PostgREST without leaking across keys. */
export function normalizePostId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Viewer like is explicit boolean only. Global like_count / undefined / "true"
 * must never render the heart as liked.
 */
export function viewerLikedFromState(likedByMe: unknown): boolean {
  return likedByMe === true;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseRpcJson(data: unknown): RpcJson {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return data as Record<string, unknown>;
}

export async function loadViewerInteractionState(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  postIds: number[]
): Promise<Map<number, PostViewerState>> {
  const state = new Map<number, PostViewerState>();

  for (const postId of postIds) {
    state.set(postId, { likedByMe: false, savedByMe: false });
  }

  if (!userId || postIds.length === 0) {
    return state;
  }

  const [likesResult, savesResult] = await Promise.all([
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    supabase
      .from("post_saves")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
  ]);

  if (!likesResult.error) {
    for (const row of likesResult.data ?? []) {
      const postId = normalizePostId(row.post_id);
      if (postId == null) continue;
      const current = state.get(postId);
      if (current) current.likedByMe = true;
    }
  }

  if (!savesResult.error) {
    for (const row of savesResult.data ?? []) {
      const postId = normalizePostId(row.post_id);
      if (postId == null) continue;
      const current = state.get(postId);
      if (current) current.savedByMe = true;
    }
  }

  return state;
}

export type EnsureLikeResult = {
  liked: true;
  likes: number;
  noop: boolean;
};

const ensureLikeInflight = new Map<
  number,
  Promise<ActionResult<EnsureLikeResult>>
>();

export function resetEnsurePostLikeInflightForTests(): void {
  ensureLikeInflight.clear();
}

export function isEnsurePostLikeInFlight(postId: number): boolean {
  return ensureLikeInflight.has(postId);
}

export function previewEnsureLike(input: {
  likedByMe?: unknown;
  likes?: number;
}): { liked: true; likes: number; noop: boolean } {
  const likes = asNumber(input.likes, 0);
  if (viewerLikedFromState(input.likedByMe)) {
    return { liked: true, likes, noop: true };
  }
  return { liked: true, likes: likes + 1, noop: false };
}

export function previewToggleLike(input: {
  likedByMe?: unknown;
  likes?: number;
}): { liked: boolean; likes: number } {
  const liked = viewerLikedFromState(input.likedByMe);
  const likes = asNumber(input.likes, 0);
  return liked
    ? { liked: false, likes: Math.max(0, likes - 1) }
    : { liked: true, likes: likes + 1 };
}

export function previewToggleSave(input: {
  savedByMe?: unknown;
  saves?: number;
}): { saved: boolean; saves: number } {
  const saved = input.savedByMe === true;
  const saves = asNumber(input.saves, 0);
  return saved
    ? { saved: false, saves: Math.max(0, saves - 1) }
    : { saved: true, saves: saves + 1 };
}

const saveInflight = new Map<number, Promise<ActionResult<ToggleSaveResult>>>();

export function resetTogglePostSaveInflightForTests(): void {
  saveInflight.clear();
}

export function isTogglePostSaveInFlight(postId: number): boolean {
  return saveInflight.has(postId);
}

/**
 * Double-tap Like. Never unlikes. Unlike stays on the explicit heart
 * (`togglePostLike`). Callers must not invoke toggle from the video tap.
 */
export function ensurePostLike(
  supabase: SupabaseClient,
  postId: number,
  input: { likedByMe?: unknown; likes?: number } = {}
): Promise<ActionResult<EnsureLikeResult>> {
  if (!Number.isInteger(postId) || postId <= 0) {
    return Promise.resolve({
      ok: false,
      message: "Unable to update like. Please try again.",
    });
  }

  const likes = asNumber(input.likes, 0);
  if (viewerLikedFromState(input.likedByMe)) {
    return Promise.resolve({
      ok: true,
      liked: true,
      likes,
      noop: true,
    });
  }

  const pending = ensureLikeInflight.get(postId);
  if (pending) return pending;

  const work = performEnsurePostLike(supabase, postId, likes).finally(() => {
    if (ensureLikeInflight.get(postId) === work) {
      ensureLikeInflight.delete(postId);
    }
  });
  ensureLikeInflight.set(postId, work);
  return work;
}

async function performEnsurePostLike(
  supabase: SupabaseClient,
  postId: number,
  likes: number
): Promise<ActionResult<EnsureLikeResult>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return {
      ok: false,
      message: "Please sign in to like posts.",
      requiresAuth: true,
    };
  }

  const existing = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing.error) {
    return { ok: false, message: "Unable to update like. Please try again." };
  }

  if (existing.data) {
    return {
      ok: true,
      liked: true,
      likes: likes > 0 ? likes : 1,
      noop: true,
    };
  }

  const toggled = await togglePostLike(supabase, postId);
  if (!toggled.ok) return toggled;
  if (toggled.liked !== true) {
    return { ok: false, message: "Unable to update like. Please try again." };
  }
  return {
    ok: true,
    liked: true,
    likes: toggled.likes,
    noop: false,
  };
}

const likeInflight = new Map<number, Promise<ActionResult<ToggleLikeResult>>>();

export function resetTogglePostLikeInflightForTests(): void {
  likeInflight.clear();
}

export function isTogglePostLikeInFlight(postId: number): boolean {
  return likeInflight.has(postId);
}

export function togglePostLike(
  supabase: SupabaseClient,
  postId: number
): Promise<ActionResult<ToggleLikeResult>> {
  if (!Number.isInteger(postId) || postId <= 0) {
    return Promise.resolve({
      ok: false,
      message: "Unable to update like. Please try again.",
    });
  }
  const pending = likeInflight.get(postId);
  if (pending) return pending;
  const work = performTogglePostLike(supabase, postId).finally(() => {
    if (likeInflight.get(postId) === work) {
      likeInflight.delete(postId);
    }
  });
  likeInflight.set(postId, work);
  return work;
}

async function performTogglePostLike(
  supabase: SupabaseClient,
  postId: number
): Promise<ActionResult<ToggleLikeResult>> {
  const { data, error } = await supabase.rpc("toggle_post_like", {
    p_post_id: postId,
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    if (message.includes("authentication required")) {
      return {
        ok: false,
        message: "Please sign in to like posts.",
        requiresAuth: true,
      };
    }
    return { ok: false, message: "Unable to update like. Please try again." };
  }

  const payload = parseRpcJson(data);
  if (!payload) {
    return { ok: false, message: "Unable to update like. Please try again." };
  }

  const liked = asBoolean(payload.liked);
  if (liked) {
    const { ANALYTICS_EVENTS, track } = await import("@/src/lib/analytics/client");
    track(ANALYTICS_EVENTS.video_like, { post_id: postId });
  }

  return {
    ok: true,
    liked,
    likes: asNumber(payload.likes),
  };
}

/**
 * Persist Watch saves through `toggle_post_save`, same as the website.
 * Saved state is loaded separately from `post_saves` so it survives relaunch.
 */
export function togglePostSave(
  supabase: SupabaseClient,
  postId: number
): Promise<ActionResult<ToggleSaveResult>> {
  if (!Number.isInteger(postId) || postId <= 0) {
    return Promise.resolve({
      ok: false,
      message: "Unable to update save. Please try again.",
    });
  }
  const pending = saveInflight.get(postId);
  if (pending) return pending;
  const work = performTogglePostSave(supabase, postId).finally(() => {
    if (saveInflight.get(postId) === work) {
      saveInflight.delete(postId);
    }
  });
  saveInflight.set(postId, work);
  return work;
}

function mapToggleSaveRpcError(message: string): ActionResult<ToggleSaveResult> {
  const lower = message.toLowerCase();
  if (lower.includes("authentication required")) {
    return {
      ok: false,
      message: "Please sign in to save this video.",
      requiresAuth: true,
    };
  }
  if (lower.includes("post not found")) {
    return { ok: false, message: "This video cannot be saved." };
  }
  return { ok: false, message: "Unable to save this video. Please try again." };
}

async function performTogglePostSave(
  supabase: SupabaseClient,
  postId: number
): Promise<ActionResult<ToggleSaveResult>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    return {
      ok: false,
      message: "Please sign in to save this video.",
      requiresAuth: true,
    };
  }

  const { data, error } = await supabase.rpc("toggle_post_save", {
    p_post_id: postId,
  });

  if (error) {
    return mapToggleSaveRpcError(error.message || "");
  }

  const payload = parseRpcJson(data);
  if (!payload) {
    return { ok: false, message: "Unable to save this video. Please try again." };
  }

  return {
    ok: true,
    saved: asBoolean(payload.saved),
    saves: asNumber(payload.saves),
  };
}

export async function recordPostShare(
  supabase: SupabaseClient,
  postId: number,
  viewerKey: string | null
): Promise<ActionResult<ShareResult>> {
  const { data, error } = await supabase.rpc("record_post_share", {
    p_post_id: postId,
    p_viewer_key: viewerKey,
  });

  if (error) {
    return { ok: false, message: "Unable to record share. Please try again." };
  }

  const payload = parseRpcJson(data);
  if (!payload) {
    return { ok: false, message: "Unable to record share. Please try again." };
  }

  const { ANALYTICS_EVENTS, track } = await import("@/src/lib/analytics/client");
  track(ANALYTICS_EVENTS.video_share, { post_id: postId });

  return {
    ok: true,
    counted: asBoolean(payload.counted),
    shares: asNumber(payload.shares),
  };
}

export async function recordPostView(
  supabase: SupabaseClient,
  postId: number,
  viewerKey: string | null,
  geo?: {
    countryCode?: string | null;
    countryName?: string | null;
    city?: string | null;
    qualified?: boolean;
  }
): Promise<ActionResult<ViewResult>> {
  const { data, error } = await supabase.rpc("record_post_view", {
    p_post_id: postId,
    p_viewer_key: viewerKey,
    p_country_code: geo?.countryCode ?? null,
    p_country_name: geo?.countryName ?? null,
    p_city: geo?.city ?? null,
    p_qualified: geo?.qualified ?? true,
  });

  if (error) {
    return { ok: false, message: "Unable to record view." };
  }

  const payload = parseRpcJson(data);
  if (!payload) {
    return { ok: false, message: "Unable to record view." };
  }

  return {
    ok: true,
    counted: asBoolean(payload.counted),
    views: asNumber(payload.views),
  };
}
