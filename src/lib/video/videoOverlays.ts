/**
 * Video Pre-Publish Overlays V1 — pure model + helpers (client + server safe).
 *
 * A polished social pre-publish editor (not a professional NLE). Overlays are
 * stored as normalized composition data so they render identically at any
 * player size. Coordinates are fractions of the video frame:
 *   - `x` / `y`   → center of the element, 0..1 (0 = top/left, 1 = bottom/right)
 *   - `scale`     → size relative to the frame's smaller edge, clamped
 *   - `rotation`  → degrees, normalized to (-180, 180]
 *
 * Persisted inside the existing `posts.media_pipeline` JSONB column under the
 * `overlays` key — no schema migration required.
 */

export const OVERLAY_KINDS = ["text", "sticker"] as const;
export type VideoOverlayKind = (typeof OVERLAY_KINDS)[number];

export const OVERLAY_COMPOSITION_VERSION = 1 as const;

/** Guardrails keep a pre-publish editor honest — not an unbounded canvas. */
export const MAX_OVERLAYS = 20;
export const MAX_OVERLAY_TEXT_LENGTH = 120;

export const MIN_OVERLAY_SCALE = 0.04;
export const MAX_OVERLAY_SCALE = 0.6;
export const DEFAULT_TEXT_SCALE = 0.09;
export const DEFAULT_STICKER_SCALE = 0.16;

export const DEFAULT_OVERLAY_TEXT = "Your text";

/** Curated high-contrast palette for text overlays. */
export const OVERLAY_TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#ff2d55",
  "#ffcc00",
  "#34c759",
  "#0a84ff",
  "#af52de",
] as const;

export type OverlayTextColor = (typeof OVERLAY_TEXT_COLORS)[number];

/** Curated emoji / sticker-style palette for the pre-publish editor. */
export const STICKER_EMOJIS = [
  "😀",
  "😍",
  "🔥",
  "✨",
  "❤️",
  "👍",
  "🎉",
  "😂",
  "😎",
  "🥳",
  "💯",
  "🌟",
  "👀",
  "🙌",
  "📍",
  "⚡",
] as const;

export type VideoOverlayElement = {
  id: string;
  kind: VideoOverlayKind;
  /** Normalized center X (0..1). */
  x: number;
  /** Normalized center Y (0..1). */
  y: number;
  /** Size relative to the frame's smaller edge (clamped). */
  scale: number;
  /** Degrees, normalized to (-180, 180]. */
  rotation: number;
  /** Text content (text overlays only). */
  text?: string;
  /** Text color hex (text overlays only). */
  color?: string;
  /** Emoji glyph (sticker overlays only). */
  emoji?: string;
};

export type VideoOverlayComposition = {
  version: typeof OVERLAY_COMPOSITION_VERSION;
  elements: VideoOverlayElement[];
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TEXT_SCALE;
  }
  return Math.max(MIN_OVERLAY_SCALE, Math.min(MAX_OVERLAY_SCALE, value));
}

/** Normalize rotation to the half-open interval (-180, 180]. */
export function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let deg = value % 360;
  if (deg > 180) {
    deg -= 360;
  }
  if (deg <= -180) {
    deg += 360;
  }
  // Keep integers clean; avoid -0.
  return Object.is(deg, -0) ? 0 : Math.round(deg * 100) / 100;
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_OVERLAY_TEXT_LENGTH);
}

function sanitizeColor(value: unknown): OverlayTextColor {
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    const match = OVERLAY_TEXT_COLORS.find((c) => c.toLowerCase() === lower);
    if (match) {
      return match;
    }
  }
  return OVERLAY_TEXT_COLORS[0];
}

function sanitizeEmoji(value: unknown): string {
  if (typeof value !== "string") {
    return STICKER_EMOJIS[0];
  }
  const trimmed = Array.from(value.trim()).slice(0, 4).join("");
  return trimmed || STICKER_EMOJIS[0];
}

let idCounter = 0;

/** Stable-ish unique id; crypto.randomUUID when available. */
export function createOverlayId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `ov-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function createTextOverlay(
  partial?: Partial<VideoOverlayElement>
): VideoOverlayElement {
  return {
    id: partial?.id ?? createOverlayId(),
    kind: "text",
    x: clamp01(partial?.x ?? 0.5),
    y: clamp01(partial?.y ?? 0.5),
    scale: clampScale(partial?.scale ?? DEFAULT_TEXT_SCALE),
    rotation: normalizeRotation(partial?.rotation ?? 0),
    text: sanitizeText(partial?.text ?? DEFAULT_OVERLAY_TEXT) || DEFAULT_OVERLAY_TEXT,
    color: sanitizeColor(partial?.color),
  };
}

export function createStickerOverlay(
  emoji: string,
  partial?: Partial<VideoOverlayElement>
): VideoOverlayElement {
  return {
    id: partial?.id ?? createOverlayId(),
    kind: "sticker",
    x: clamp01(partial?.x ?? 0.5),
    y: clamp01(partial?.y ?? 0.5),
    scale: clampScale(partial?.scale ?? DEFAULT_STICKER_SCALE),
    rotation: normalizeRotation(partial?.rotation ?? 0),
    emoji: sanitizeEmoji(emoji),
  };
}

/**
 * Normalize a single element to a valid shape, or null when it cannot be
 * repaired (unknown kind / empty content). Never throws.
 */
export function sanitizeOverlayElement(
  input: unknown
): VideoOverlayElement | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const raw = input as Record<string, unknown>;
  const kind = raw.kind;
  const id =
    typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 64) : createOverlayId();

  if (kind === "text") {
    const text = sanitizeText(raw.text);
    if (!text) {
      return null;
    }
    return {
      id,
      kind: "text",
      x: clamp01(Number(raw.x)),
      y: clamp01(Number(raw.y)),
      scale: clampScale(Number(raw.scale)),
      rotation: normalizeRotation(Number(raw.rotation)),
      text,
      color: sanitizeColor(raw.color),
    };
  }

  if (kind === "sticker") {
    const emoji = sanitizeEmoji(raw.emoji);
    if (!emoji) {
      return null;
    }
    return {
      id,
      kind: "sticker",
      x: clamp01(Number(raw.x)),
      y: clamp01(Number(raw.y)),
      scale: clampScale(Number(raw.scale)),
      rotation: normalizeRotation(Number(raw.rotation)),
      emoji,
    };
  }

  return null;
}

/** Cap and normalize an array of elements. */
export function sanitizeOverlayElements(
  input: unknown
): VideoOverlayElement[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const out: VideoOverlayElement[] = [];
  for (const item of input) {
    const el = sanitizeOverlayElement(item);
    if (el) {
      out.push(el);
    }
    if (out.length >= MAX_OVERLAYS) {
      break;
    }
  }
  return out;
}

export function addOverlay(
  list: VideoOverlayElement[],
  element: VideoOverlayElement
): VideoOverlayElement[] {
  if (list.length >= MAX_OVERLAYS) {
    return list;
  }
  return [...list, element];
}

export function updateOverlay(
  list: VideoOverlayElement[],
  id: string,
  patch: Partial<VideoOverlayElement>
): VideoOverlayElement[] {
  return list.map((el) => {
    if (el.id !== id) {
      return el;
    }
    const next: VideoOverlayElement = { ...el };
    if (patch.x !== undefined) next.x = clamp01(patch.x);
    if (patch.y !== undefined) next.y = clamp01(patch.y);
    if (patch.scale !== undefined) next.scale = clampScale(patch.scale);
    if (patch.rotation !== undefined) next.rotation = normalizeRotation(patch.rotation);
    if (el.kind === "text") {
      if (patch.text !== undefined) {
        next.text = sanitizeText(patch.text) || el.text || DEFAULT_OVERLAY_TEXT;
      }
      if (patch.color !== undefined) next.color = sanitizeColor(patch.color);
    }
    if (el.kind === "sticker" && patch.emoji !== undefined) {
      next.emoji = sanitizeEmoji(patch.emoji);
    }
    return next;
  });
}

export function moveOverlay(
  list: VideoOverlayElement[],
  id: string,
  x: number,
  y: number
): VideoOverlayElement[] {
  return updateOverlay(list, id, { x, y });
}

export function removeOverlay(
  list: VideoOverlayElement[],
  id: string
): VideoOverlayElement[] {
  return list.filter((el) => el.id !== id);
}

export function clearOverlays(): VideoOverlayElement[] {
  return [];
}

export function hasOverlays(list: VideoOverlayElement[] | null | undefined): boolean {
  return Array.isArray(list) && list.length > 0;
}

export function countByKind(
  list: VideoOverlayElement[]
): { text: number; sticker: number } {
  let text = 0;
  let sticker = 0;
  for (const el of list) {
    if (el.kind === "text") text += 1;
    else if (el.kind === "sticker") sticker += 1;
  }
  return { text, sticker };
}

/** Wrap elements in the versioned composition envelope for storage. */
export function serializeOverlays(
  list: VideoOverlayElement[]
): VideoOverlayComposition {
  return {
    version: OVERLAY_COMPOSITION_VERSION,
    elements: sanitizeOverlayElements(list),
  };
}

/**
 * Read overlays back from persisted data. Accepts either the versioned
 * composition envelope, a bare elements array, or nested under
 * `media_pipeline.overlays`. Always returns a safe array (never throws).
 */
export function parseOverlays(input: unknown): VideoOverlayElement[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return sanitizeOverlayElements(input);
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.elements)) {
      return sanitizeOverlayElements(obj.elements);
    }
    if (Array.isArray(obj.overlays)) {
      return sanitizeOverlayElements(obj.overlays);
    }
    if (obj.overlays && typeof obj.overlays === "object") {
      const nested = obj.overlays as Record<string, unknown>;
      if (Array.isArray(nested.elements)) {
        return sanitizeOverlayElements(nested.elements);
      }
    }
  }
  return [];
}

/**
 * Extract overlays stored in a `posts.media_pipeline` JSONB blob.
 * Safe against nulls and legacy rows that never had overlays.
 */
export function overlaysFromMediaPipeline(
  mediaPipeline: unknown
): VideoOverlayElement[] {
  if (!mediaPipeline || typeof mediaPipeline !== "object") {
    return [];
  }
  return parseOverlays((mediaPipeline as Record<string, unknown>).overlays);
}
