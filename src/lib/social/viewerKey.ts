import AsyncStorage from "@react-native-async-storage/async-storage";

const VIEWER_KEY_STORAGE = "umtuba.viewer.key";
const DEVICE_VIEWER_KEY_RE =
  /^d:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let memoryViewerKey: string | null = null;

function newDeviceViewerKey(): string {
  const hex = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  return `d:${hex}`;
}

export function normalizeDeviceViewerKey(viewerKey: string): string | null {
  const trimmed = viewerKey.trim().toLowerCase();
  return DEVICE_VIEWER_KEY_RE.test(trimmed) ? trimmed : null;
}

/** Stable anonymous device key for share/view RPCs (auth.uid() still wins server-side). */
export async function getOrCreateDeviceViewerKey(): Promise<string> {
  if (memoryViewerKey && DEVICE_VIEWER_KEY_RE.test(memoryViewerKey)) {
    return memoryViewerKey;
  }
  try {
    const existing = await AsyncStorage.getItem(VIEWER_KEY_STORAGE);
    const normalized = existing ? normalizeDeviceViewerKey(existing) : null;
    if (normalized) {
      memoryViewerKey = normalized;
      return normalized;
    }
    const next = newDeviceViewerKey();
    await AsyncStorage.setItem(VIEWER_KEY_STORAGE, next);
    memoryViewerKey = next;
    return next;
  } catch {
    if (!memoryViewerKey) {
      memoryViewerKey = newDeviceViewerKey();
    }
    return memoryViewerKey;
  }
}

export function resetDeviceViewerKeyForTests(): void {
  memoryViewerKey = null;
}
