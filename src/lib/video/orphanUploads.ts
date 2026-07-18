import AsyncStorage from "@react-native-async-storage/async-storage";

const ORPHAN_KEY = "umtuba_pending_video_uploads";

export type PendingVideoUpload = {
  path: string;
  createdAt: string;
};

export async function listPendingVideoUploads(): Promise<PendingVideoUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(ORPHAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingVideoUpload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function queuePendingVideoUpload(path: string): Promise<void> {
  const trimmed = path.trim();
  if (!trimmed) return;
  const existing = await listPendingVideoUploads();
  if (existing.some((item) => item.path === trimmed)) return;
  const next = [
    ...existing,
    { path: trimmed, createdAt: new Date().toISOString() },
  ].slice(-20);
  await AsyncStorage.setItem(ORPHAN_KEY, JSON.stringify(next));
}

export async function clearPendingVideoUpload(path: string): Promise<void> {
  const existing = await listPendingVideoUploads();
  const next = existing.filter((item) => item.path !== path);
  await AsyncStorage.setItem(ORPHAN_KEY, JSON.stringify(next));
}
