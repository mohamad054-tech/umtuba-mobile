import type { WatchVideo } from "@/src/contracts/watch";

export const WATCH_PUBLISH_TX = "WATCH_PUBLISH_TX";

export type OptimisticPublishPhase =
  | "uploading"
  | "publishing"
  | "ready"
  | "failed";

export type OptimisticPublishMark =
  | "T0"
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "T5"
  | "T6";

export type OptimisticPublishTimestamps = {
  t0: number | null;
  t1: number | null;
  t2: number | null;
  t3: number | null;
  t4: number | null;
  t5: number | null;
  t6: number | null;
};

export type OptimisticPublishAsset = {
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
};

export type OptimisticPublishAuthor = {
  id: string;
  name: string;
  username: string;
  avatar: string;
};

export type OptimisticPublishSoundMix = {
  originalAudioEnabled: boolean;
  originalAudioVolume: number;
  addedSoundVolume: number;
  soundStartOffsetMs: number;
};

export type OptimisticWatchRecord = {
  clientId: string;
  phase: OptimisticPublishPhase;
  video: WatchVideo;
  localUri: string;
  remoteSrc: string | null;
  videoPath: string | null;
  serverPostId: number | null;
  handoffComplete: boolean;
  playerRecreatedOnHandoff: false;
  error: string | null;
  uploadPercent: number;
  inFlight: boolean;
  timestamps: OptimisticPublishTimestamps;
  caption: string;
  asset: OptimisticPublishAsset;
  author: OptimisticPublishAuthor;
  soundId: string | null;
  soundMix: OptimisticPublishSoundMix | null;
  mediaPipeline: Record<string, unknown> | null;
};

export type CreateOptimisticWatchInput = {
  localUri: string;
  caption: string;
  asset: OptimisticPublishAsset;
  author: OptimisticPublishAuthor;
  soundId?: string | null;
  soundMix?: OptimisticPublishSoundMix | null;
  mediaPipeline?: Record<string, unknown> | null;
  now?: number;
  clientId?: string;
};

const CLIENT_PREFIX = "optimistic-";

let records: OptimisticWatchRecord[] = [];
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeOptimisticWatchPublish(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getOptimisticWatchPublishVersion(): number {
  return version;
}

export function listOptimisticWatchRecords(): OptimisticWatchRecord[] {
  return records;
}

export function getOptimisticWatchRecord(
  clientId: string
): OptimisticWatchRecord | null {
  return records.find((row) => row.clientId === clientId) ?? null;
}

export function resetOptimisticWatchPublishForTests(): void {
  records = [];
  version = 0;
}

export function isOptimisticWatchClientId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(CLIENT_PREFIX);
}

export function newOptimisticWatchClientId(): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${CLIENT_PREFIX}${suffix}`;
}

export function emptyOptimisticTimestamps(): OptimisticPublishTimestamps {
  return {
    t0: null,
    t1: null,
    t2: null,
    t3: null,
    t4: null,
    t5: null,
    t6: null,
  };
}

function normalizeUsername(username: string): string {
  return username.startsWith("@") ? username : `@${username}`;
}

export function createOptimisticWatchVideo(input: {
  clientId: string;
  localUri: string;
  caption: string;
  author: OptimisticPublishAuthor;
  durationMs: number | null;
}): WatchVideo {
  const caption = input.caption.trim();
  return {
    id: input.clientId,
    postId: null,
    videoPath: null,
    src: input.localUri,
    title: caption.slice(0, 80) || "UMTUBA",
    caption,
    location: { city: "", country: "" },
    music: "",
    aiSummary: "",
    translation: "",
    author: {
      id: input.author.id,
      name: input.author.name,
      username: normalizeUsername(input.author.username),
      avatar: input.author.avatar,
    },
    stats: {
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      views: 0,
    },
    likedByMe: false,
    savedByMe: false,
    source: "supabase",
    publishedAt: null,
    durationMs: input.durationMs,
    mediaPipeline: null,
  };
}

export function createOptimisticWatchRecord(
  input: CreateOptimisticWatchInput
): OptimisticWatchRecord {
  const clientId = input.clientId ?? newOptimisticWatchClientId();
  const now = input.now ?? Date.now();
  const video = createOptimisticWatchVideo({
    clientId,
    localUri: input.localUri,
    caption: input.caption,
    author: input.author,
    durationMs: input.asset.durationMs,
  });
  return {
    clientId,
    phase: "uploading",
    video,
    localUri: input.localUri,
    remoteSrc: null,
    videoPath: null,
    serverPostId: null,
    handoffComplete: false,
    playerRecreatedOnHandoff: false,
    error: null,
    uploadPercent: 0,
    inFlight: false,
    timestamps: { ...emptyOptimisticTimestamps(), t0: now },
    caption: input.caption,
    asset: input.asset,
    author: input.author,
    soundId: input.soundId ?? null,
    soundMix: input.soundMix ?? null,
    mediaPipeline: input.mediaPipeline ?? null,
  };
}

export function insertOptimisticWatchRecord(
  record: OptimisticWatchRecord
): OptimisticWatchRecord {
  records = [record, ...records.filter((row) => row.clientId !== record.clientId)];
  logWatchPublishTx("T0", record.clientId, { at: record.timestamps.t0 });
  emit();
  return record;
}

export function replaceOptimisticWatchRecord(
  next: OptimisticWatchRecord
): OptimisticWatchRecord {
  const index = records.findIndex((row) => row.clientId === next.clientId);
  if (index >= 0 && records[index] === next) {
    return next;
  }
  if (index < 0) {
    records = [next, ...records];
  } else {
    records = records.map((row) => (row.clientId === next.clientId ? next : row));
  }
  emit();
  return next;
}

export function patchOptimisticWatchRecord(
  clientId: string,
  patch: (current: OptimisticWatchRecord) => OptimisticWatchRecord
): OptimisticWatchRecord | null {
  const current = getOptimisticWatchRecord(clientId);
  if (!current) return null;
  const next = patch(current);
  return replaceOptimisticWatchRecord(next);
}

export function markOptimisticLocalVisible(
  clientId: string,
  now = Date.now()
): OptimisticWatchRecord | null {
  return patchOptimisticWatchRecord(clientId, (current) => {
    if (current.timestamps.t1 != null) return current;
    const next = {
      ...current,
      timestamps: { ...current.timestamps, t1: now },
    };
    logWatchPublishTx("T1", clientId, {
      at: now,
      t0_to_t1_ms:
        next.timestamps.t0 != null ? now - next.timestamps.t0 : null,
    });
    return next;
  });
}

export function applyOptimisticUploadProgress(
  clientId: string,
  percent: number
): OptimisticWatchRecord | null {
  return patchOptimisticWatchRecord(clientId, (current) => {
    if (current.phase !== "uploading") return current;
    return {
      ...current,
      uploadPercent: Math.max(0, Math.min(100, Math.round(percent))),
    };
  });
}

export function markOptimisticPublishing(
  clientId: string,
  input: { videoPath: string; now?: number }
): OptimisticWatchRecord | null {
  const now = input.now ?? Date.now();
  return patchOptimisticWatchRecord(clientId, (current) => {
    logWatchPublishTx("T3", clientId, { at: now, videoPath: input.videoPath });
    return {
      ...current,
      phase: "publishing",
      videoPath: input.videoPath,
      uploadPercent: 100,
      error: null,
      timestamps: { ...current.timestamps, t3: now },
    };
  });
}

export function reconcileOptimisticWithServer(
  record: OptimisticWatchRecord,
  input: {
    postId: number;
    videoPath: string;
    remoteSrc?: string | null;
    now?: number;
  }
): OptimisticWatchRecord {
  const now = input.now ?? Date.now();
  const remoteSrc = (input.remoteSrc ?? "").trim() || null;
  logWatchPublishTx("T4", record.clientId, { at: now, postId: input.postId });
  if (remoteSrc) {
    logWatchPublishTx("T5", record.clientId, { at: now, remoteSrc: "set" });
  }
  logWatchPublishTx("T6", record.clientId, {
    at: now,
    handoff: "keep-local-src",
    player_recreate: false,
  });
  return {
    ...record,
    phase: "ready",
    serverPostId: input.postId,
    videoPath: input.videoPath,
    remoteSrc,
    handoffComplete: true,
    playerRecreatedOnHandoff: false,
    error: null,
    inFlight: false,
    uploadPercent: 100,
    timestamps: {
      ...record.timestamps,
      t4: now,
      t5: remoteSrc ? now : record.timestamps.t5,
      t6: now,
    },
    video: {
      ...record.video,
      id: record.clientId,
      postId: null,
      src: record.localUri,
      videoPath: null,
    },
  };
}

export function markOptimisticFailed(
  clientId: string,
  error: string
): OptimisticWatchRecord | null {
  return patchOptimisticWatchRecord(clientId, (current) => ({
    ...current,
    phase: "failed",
    error,
    inFlight: false,
    handoffComplete: false,
  }));
}

export function beginOptimisticRetry(
  clientId: string,
  now = Date.now()
): OptimisticWatchRecord | null {
  return patchOptimisticWatchRecord(clientId, (current) => ({
    ...current,
    phase: "uploading",
    error: null,
    uploadPercent: 0,
    videoPath: null,
    remoteSrc: null,
    serverPostId: null,
    handoffComplete: false,
    playerRecreatedOnHandoff: false,
    inFlight: false,
    timestamps: { ...emptyOptimisticTimestamps(), t0: now },
    video: {
      ...current.video,
      id: current.clientId,
      postId: null,
      src: current.localUri,
      videoPath: null,
    },
  }));
}

export function claimedOptimisticServerPostIds(
  rows: readonly OptimisticWatchRecord[] = records
): Set<number> {
  const claimed = new Set<number>();
  for (const row of rows) {
    if (row.serverPostId != null) claimed.add(row.serverPostId);
  }
  return claimed;
}

export function applyOptimisticWatchRecordsToList(
  current: WatchVideo[],
  optimistic: readonly OptimisticWatchRecord[] = records
): WatchVideo[] {
  const claimed = claimedOptimisticServerPostIds(optimistic);
  const optimisticIds = new Set(optimistic.map((row) => row.clientId));
  const feed = current.filter((video) => {
    if (optimisticIds.has(video.id) || isOptimisticWatchClientId(video.id)) {
      return false;
    }
    if (video.postId != null && claimed.has(video.postId)) {
      return false;
    }
    return true;
  });
  return [...optimistic.map((row) => row.video), ...feed];
}

export function shouldFocusNewOptimisticItem(
  optimistic: readonly OptimisticWatchRecord[],
  currentFirstId: string | null
): boolean {
  const first = optimistic[0];
  if (!first) return false;
  return first.video.id !== currentFirstId;
}

export function optimisticPublishPhaseSignature(
  optimistic: readonly OptimisticWatchRecord[] = records
): string {
  return optimistic
    .map(
      (row) =>
        `${row.clientId}:${row.phase}:${row.uploadPercent}:${row.handoffComplete ? 1 : 0}`
    )
    .join("|");
}

export function logWatchPublishTx(
  mark: OptimisticPublishMark,
  clientId: string,
  extra: Record<string, unknown> = {}
): void {
  const parts = Object.entries(extra)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);
  console.log(
    [WATCH_PUBLISH_TX, mark, `clientId=${clientId}`, ...parts].join(" ")
  );
}
