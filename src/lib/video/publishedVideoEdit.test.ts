import { describe, expect, it } from "vitest";

import type { WatchVideo } from "@/src/contracts/watch";
import { createTextOverlay } from "@/src/lib/video/videoOverlays";
import {
  createInitialEditState,
  serializeEditIntoMediaPipeline,
} from "@/src/lib/video/videoEditState";
import {
  applySavedPipelineToWatchVideo,
  buildPublishedSavePipeline,
  loadPublishedEditorDraft,
  publishedEditKeepsOriginalSrc,
  shouldPersistPublishedEditOnCancel,
} from "./publishedVideoEdit";

const VIDEO: WatchVideo = {
  id: "v-1",
  postId: 42,
  videoPath: "11111111-1111-4111-8111-111111111111/live.mp4",
  src: "https://signed.example/live.mp4",
  title: "Owned",
  caption: "",
  location: { city: "", country: "" },
  music: "",
  aiSummary: "",
  translation: "",
  author: { id: "owner", name: "Owner", username: "owner", avatar: "" },
  stats: { likes: 1, comments: 0, shares: 0, saves: 0, views: 2 },
  likedByMe: false,
  savedByMe: false,
  source: "supabase",
  durationMs: 8000,
  mediaPipeline: null,
};

describe("published video edit session", () => {
  it("loads existing trim, segments, overlays, and sound", () => {
    const overlay = createTextOverlay({ text: "hello" });
    const draft = {
      ...createInitialEditState(8000),
      trimStartMs: 500,
      trimEndMs: 4000,
      segments: [
        { startMs: 500, endMs: 2000 },
        { startMs: 3000, endMs: 4000 },
      ],
      overlays: [overlay],
      soundId: "11111111-1111-4111-8111-111111111111",
    };
    const pipeline = serializeEditIntoMediaPipeline({ hls: null }, draft);
    const loaded = loadPublishedEditorDraft(pipeline, 8000);
    expect(loaded.trimStartMs).toBe(500);
    expect(loaded.segments).toHaveLength(2);
    expect(loaded.overlays[0]?.text).toBe("hello");
    expect(loaded.soundId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("cancel writes nothing and keeps the original media path", () => {
    expect(shouldPersistPublishedEditOnCancel()).toBe(false);
    expect(publishedEditKeepsOriginalSrc(VIDEO)).toBe(true);
  });

  it("save patches only local media_pipeline and keeps src/path", () => {
    const draft = {
      ...createInitialEditState(8000),
      trimStartMs: 1000,
      trimEndMs: 5000,
    };
    const pipeline = buildPublishedSavePipeline(VIDEO.mediaPipeline, draft);
    const next = applySavedPipelineToWatchVideo(VIDEO, pipeline);
    expect(next.src).toBe(VIDEO.src);
    expect(next.videoPath).toBe(VIDEO.videoPath);
    expect((next.mediaPipeline as { edit?: { trimStartMs?: number } }).edit?.trimStartMs).toBe(
      1000
    );
  });
});
