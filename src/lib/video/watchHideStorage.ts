import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  sanitizeWatchHideEntries,
  WATCH_HIDE_STORAGE_KEY,
  type WatchHideEntry,
} from "./watchHidePolicy";

export async function readLocalWatchHideEntries(
  now = Date.now()
): Promise<WatchHideEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_HIDE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return sanitizeWatchHideEntries(JSON.parse(raw), now);
  } catch {
    return [];
  }
}

export async function writeLocalWatchHideEntries(
  entries: WatchHideEntry[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      WATCH_HIDE_STORAGE_KEY,
      JSON.stringify(sanitizeWatchHideEntries(entries))
    );
  } catch {
    // Guest hide is best-effort.
  }
}

export async function rememberLocalWatchHide(
  postId: number,
  now = Date.now()
): Promise<WatchHideEntry[]> {
  const next = sanitizeWatchHideEntries(
    [...(await readLocalWatchHideEntries(now)), { postId, watchedAt: now }],
    now
  );
  await writeLocalWatchHideEntries(next);
  return next;
}
