import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { resolveProgressRatio } from "@/src/lib/watch/playbackPolicy";
import { WATCH_VIDEO_CONTENT_FIT } from "@/src/lib/watch/watchVideoFit";

import {
  watchEnginePlayerSource,
  watchEnginePlayerSourceEquals,
} from "./playerSource";
import { shouldStartWatchEnginePlayback } from "./readiness";
import {
  resolveWatchEngineSeekSeconds,
  type WatchEngineSeekCommand,
} from "./seek";

const TIME_UPDATE_INTERVAL_SEC = 0.25;

export type WatchEngineTimeline = {
  currentTime: number;
  duration: number;
  ratio: number;
};

export type WatchEnginePlayerProps = {
  src: string;
  mediaId: string;
  shouldPlay: boolean;
  audible: boolean;
  muted: boolean;
  volume: number;
  onSurfaceReady?: (mediaId: string) => void;
  onFirstFrame?: (mediaId: string) => void;
  onEnded?: (mediaId: string) => void;
  onError?: (mediaId: string, message: string) => void;
  onTimeline?: (mediaId: string, timeline: WatchEngineTimeline) => void;
  seekRequest?: WatchEngineSeekCommand | null;
};

export function WatchEnginePlayer({
  src,
  mediaId,
  shouldPlay,
  audible,
  muted,
  volume,
  onSurfaceReady,
  onFirstFrame,
  onEnded,
  onError,
  onTimeline,
  seekRequest = null,
}: WatchEnginePlayerProps) {
  const [surfaceAttached, setSurfaceAttached] = useState(false);
  const lastSeekTokenRef = useRef<number | null>(null);
  const sourceRef = useRef(watchEnginePlayerSource(src));
  const playerSource = useMemo(() => {
    const next = watchEnginePlayerSource(src);
    if (watchEnginePlayerSourceEquals(sourceRef.current, next)) {
      return sourceRef.current;
    }
    sourceRef.current = next;
    return next;
  }, [src]);
  const player = useVideoPlayer(playerSource, (instance) => {
    instance.loop = false;
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = "mixWithOthers";
    instance.staysActiveInBackground = false;
    instance.showNowPlayingNotification = false;
    instance.keepScreenOnWhilePlaying = true;
    instance.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SEC;
  });

  const sourcePlayable = playerSource.uri.length > 0;
  const canPlay = shouldStartWatchEnginePlayback({
    wantsPlay: shouldPlay,
    sourcePlayable,
    surfaceAttached,
  });

  useEffect(() => {
    player.muted = !audible || muted;
    player.volume = audible && !muted ? volume : 0;
    if (canPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [audible, canPlay, muted, player, volume]);

  useEffect(() => {
    if (!seekRequest) return;
    if (lastSeekTokenRef.current === seekRequest.token) return;
    const duration =
      typeof player.duration === "number" && Number.isFinite(player.duration)
        ? player.duration
        : 0;
    const seconds = resolveWatchEngineSeekSeconds({
      ratio: seekRequest.ratio,
      duration,
    });
    if (seconds == null) return;
    lastSeekTokenRef.current = seekRequest.token;
    player.currentTime = seconds;
    if (canPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [canPlay, player, seekRequest]);

  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "error") {
      onError?.(
        mediaId,
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Unable to play this video. Try again."
      );
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const rawDuration = player.duration;
    const safeDuration =
      typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0
        ? rawDuration
        : 0;
    const safeTime =
      typeof currentTime === "number" && Number.isFinite(currentTime)
        ? currentTime
        : 0;
    onTimeline?.(mediaId, {
      currentTime: safeTime,
      duration: safeDuration,
      ratio: resolveProgressRatio(safeTime, safeDuration),
    });
  });

  useEventListener(player, "playToEnd", () => {
    onEnded?.(mediaId);
  });

  const bindVisibleSurface = (readyMediaId: string) => {
    if (!surfaceAttached) {
      setSurfaceAttached(true);
    }
    onSurfaceReady?.(readyMediaId);
  };

  return (
    <View style={styles.fill} pointerEvents="none" collapsable={false}>
      <VideoView
        player={player}
        style={styles.fill}
        contentFit={WATCH_VIDEO_CONTENT_FIT}
        nativeControls={false}
        allowsPictureInPicture={false}
        surfaceType="textureView"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) {
            bindVisibleSurface(mediaId);
          }
        }}
        onFirstFrameRender={() => {
          bindVisibleSurface(mediaId);
          onFirstFrame?.(mediaId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
});
