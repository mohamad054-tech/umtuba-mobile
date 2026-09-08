export type WatchEngineVisualLayer = "outgoing" | "incoming" | "empty";

export function resolveWatchEngineVisualLayer(input: {
  targetIndex: number;
  settledIndex: number;
  incomingFirstFrame: boolean;
  incomingSurfaceReady: boolean;
}): WatchEngineVisualLayer {
  if (input.incomingFirstFrame && input.incomingSurfaceReady) {
    return "incoming";
  }
  if (input.targetIndex !== input.settledIndex) {
    return "outgoing";
  }
  if (input.incomingFirstFrame) return "incoming";
  return "outgoing";
}

export function watchEngineAllowsEmptyTexture(layer: WatchEngineVisualLayer): boolean {
  return layer === "empty";
}

export function watchEngineTargetIsDrawable(input: {
  targetMediaId: string | null;
  firstFrameMediaId: string | null;
}): boolean {
  return Boolean(
    input.targetMediaId &&
      input.firstFrameMediaId &&
      input.targetMediaId === input.firstFrameMediaId
  );
}
