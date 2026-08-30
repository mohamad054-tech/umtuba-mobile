import { isValidUsername, normalizeUsername } from "@/src/contracts/validation";
import { extractHashtags } from "@/src/contracts/video";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";

/** Compact Watch caption. Expand is explicit, not a hard clamp-only. */
export const WATCH_CAPTION_COMPACT_LINES = 2;
export const WATCH_CAPTION_EXPANDED_LINES = 8;
export const WATCH_CAPTION_COMPACT_CHARS = 72;
export const WATCH_CAPTION_TOGGLE_MIN_HEIGHT = 44;
export const WATCH_FOLLOW_CHIP_MIN_HEIGHT = 44;

export const WATCH_HASHTAG_ROUTE = "blocked-existing-route" as const;

export type WatchCaptionToken =
  | { type: "text"; value: string }
  | { type: "hashtag"; value: string; tag: string }
  | { type: "mention"; value: string; username: string };

const TOKEN_RE =
  /#([\p{L}\p{N}_]{1,47})|(?<![\w.])@([A-Za-z0-9._]{3,24})/gu;

export function watchCaptionText(caption?: string | null, title?: string | null): string {
  const value = (caption || title || "").trim();
  return value;
}

export function shouldOfferWatchCaptionToggle(text: string): boolean {
  if (!text) return false;
  if (text.length > WATCH_CAPTION_COMPACT_CHARS) return true;
  return text.split(/\n/).length > WATCH_CAPTION_COMPACT_LINES;
}

export function watchCaptionLineLimit(expanded: boolean): number {
  return expanded ? WATCH_CAPTION_EXPANDED_LINES : WATCH_CAPTION_COMPACT_LINES;
}

export function parseWatchCaptionTokens(text: string): WatchCaptionToken[] {
  if (!text) return [];
  const tokens: WatchCaptionToken[] = [];
  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text))) {
    if (match.index > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    if (match[1]) {
      tokens.push({
        type: "hashtag",
        value: match[0],
        tag: match[0].slice(0, 48),
      });
    } else if (match[2]) {
      const username = normalizeUsername(match[2]);
      if (isValidUsername(username)) {
        tokens.push({ type: "mention", value: match[0], username });
      } else {
        tokens.push({ type: "text", value: match[0] });
      }
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }
  return tokens;
}

export function extractWatchMentions(text: string): string[] {
  const unique = new Set<string>();
  for (const token of parseWatchCaptionTokens(text)) {
    if (token.type === "mention") unique.add(token.username);
  }
  return [...unique];
}

export function extractWatchHashtags(text: string): string[] {
  return extractHashtags(text);
}

/** Discover hashtags is a placeholder Alert, not a topic route. */
export function resolveWatchHashtagRoute(): typeof WATCH_HASHTAG_ROUTE {
  return WATCH_HASHTAG_ROUTE;
}

export function resolveWatchMentionHref(username: string): string | null {
  return buildWatchCreatorProfileHref({ username, id: null });
}

export function shouldShowWatchFollowChip(input: {
  viewerId?: string | null;
  authorId?: string | null;
}): boolean {
  return Boolean(
    input.viewerId &&
      input.authorId &&
      input.viewerId !== input.authorId
  );
}

export function watchFollowChipState(following: boolean): {
  kind: "follow" | "following";
  disabled: boolean;
  selected: boolean;
} {
  return following
    ? { kind: "following", disabled: true, selected: true }
    : { kind: "follow", disabled: false, selected: false };
}
