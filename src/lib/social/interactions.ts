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
      const current = state.get(row.post_id);
      if (current) current.likedByMe = true;
    }
  }

  if (!savesResult.error) {
    for (const row of savesResult.data ?? []) {
      const current = state.get(row.post_id);
      if (current) current.savedByMe = true;
    }
  }

  return state;
}

export async function togglePostLike(
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

  return {
    ok: true,
    liked: asBoolean(payload.liked),
    likes: asNumber(payload.likes),
  };
}

export async function togglePostSave(
  supabase: SupabaseClient,
  postId: number
): Promise<ActionResult<ToggleSaveResult>> {
  const { data, error } = await supabase.rpc("toggle_post_save", {
    p_post_id: postId,
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    if (message.includes("authentication required")) {
      return {
        ok: false,
        message: "Please sign in to save posts.",
        requiresAuth: true,
      };
    }
    return { ok: false, message: "Unable to update save. Please try again." };
  }

  const payload = parseRpcJson(data);
  if (!payload) {
    return { ok: false, message: "Unable to update save. Please try again." };
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
