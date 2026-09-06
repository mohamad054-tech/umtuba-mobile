import type { VisualExpirationPolicy } from "./types";

export const KEEP_IN_CONVERSATION_POLICY = "keep_in_conversation" as const;

export function resolveVisualExpirationPolicy(
  value: string | null | undefined
): VisualExpirationPolicy {
  if (value === "keep_in_conversation") return "keep_in_conversation";
  if (value === "disappear_after_view") return "disappear_after_view";
  return "view_once";
}

export function isKeepInConversationPolicy(
  value: string | null | undefined
): boolean {
  return resolveVisualExpirationPolicy(value) === "keep_in_conversation";
}

export function isViewOncePolicy(value: string | null | undefined): boolean {
  return resolveVisualExpirationPolicy(value) === "view_once";
}

export function visualSignedUrlTtlSeconds(
  policy: VisualExpirationPolicy
): number {
  return policy === "keep_in_conversation" ? 3600 : 90;
}

export function toCameraViewFacing(
  facing: "user" | "environment"
): "front" | "back" {
  return facing === "user" ? "front" : "back";
}

export function isPlayableVisualPreviewUrl(
  url: string | null | undefined
): url is string {
  const trimmed = url?.trim() ?? "";
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("file://") ||
    trimmed.startsWith("content://")
  );
}

export function shouldClearSiblingVisualPreview(
  policy: string | null | undefined
): boolean {
  return !isKeepInConversationPolicy(policy);
}

export function preserveKeepVisualPreviews<
  T extends {
    id: string;
    visual?: {
      expirationPolicy?: string | null;
      previewUrl?: string | null;
    } | null;
  },
>(previous: T[], next: T[]): T[] {
  const prevById = new Map(previous.map((item) => [item.id, item]));
  return next.map((item) => {
    const prev = prevById.get(item.id);
    const keptUrl = prev?.visual?.previewUrl;
    if (
      !item.visual ||
      !isKeepInConversationPolicy(item.visual.expirationPolicy) ||
      isPlayableVisualPreviewUrl(item.visual.previewUrl) ||
      !isPlayableVisualPreviewUrl(keptUrl)
    ) {
      return item;
    }
    return {
      ...item,
      visual: {
        ...item.visual,
        previewUrl: keptUrl,
      },
    };
  });
}
