import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { resolveProgressRatio } from "@/src/lib/watch/playbackPolicy";

import { watchEnginePlayerSource } from "./playerSource";

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
  onFirstFrame?: (mediaId: string) => void;
  onEnded?: (mediaId: string) => void;
  onError?: (mediaId: string, message: string) => void;
  onTimeline?: (mediaId: string, timeline: WatchEngineTimeline) => void;
};

export function WatchEnginePlayer({
  src,
  mediaId,
  shouldPlay,
  audible,
  muted,
  volume,
  onFirstFrame,
  onEnded,
  onError,
  onTimeline,
}: WatchEnginePlayerProps) {
  const playerSource = useMemo(() => watchEnginePlayerSource(src), [src]);
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

  useEffect(() => {
    player.muted = !audible || muted;
    player.volume = audible && !muted ? volume : 0;
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [audible, muted, player, shouldPlay, volume]);

  useEventListener(player, "statusChange", ({ status, error }) => {
    if (status === "readyToPlay") onFirstFrame?.(mediaId);
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

  return (
    <View style={styles.fill} pointerEvents="none" collapsable={false}>
      <VideoView
        player={player}
        style={styles.fill}
        contentFit="cover"
        nativeControls={false}
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
