export const WATCHED_VIDEO_LONG_TEXT_CHARS = 180;

export type WatchedVideoReading = {
  title: string;
  body: string;
};

export function watchedVideoFirstLine(text: string): string {
  const line =
    text
      .split(/\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? "";
  if (!line) return "";
  if (line.length <= 120) return line;
  return `${line.slice(0, 119)}…`;
}

/** A linked article, or a caption long enough to read as its own text. */
export function watchedVideoReadingOffer(input: {
  caption: string;
  article: { title: string; body: string } | null;
}): WatchedVideoReading | null {
  const articleBody = input.article?.body.trim() ?? "";
  if (articleBody) {
    const title =
      input.article?.title.trim() || watchedVideoFirstLine(articleBody);
    return { title, body: articleBody };
  }
  const caption = input.caption.trim();
  const lines = caption.split(/\n/).filter((part) => part.trim().length > 0);
  if (
    caption.length >= WATCHED_VIDEO_LONG_TEXT_CHARS ||
    lines.length >= 4
  ) {
    return { title: watchedVideoFirstLine(caption), body: caption };
  }
  return null;
}

export function shouldShowWatchedVideoCard(postId: number | null): boolean {
  return postId != null && Number.isInteger(postId) && postId > 0;
}
