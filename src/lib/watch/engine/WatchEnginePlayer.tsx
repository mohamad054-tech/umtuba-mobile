import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { isLocalWatchPlaybackUri } from "@/src/lib/feed/videoStoragePath";

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
}: WatchEnginePlayerProps) {
  const player = useVideoPlayer(
    isLocalWatchPlaybackUri(src)
      ? { uri: src, useCaching: false }
      : { uri: src, useCaching: true },
    (instance) => {
      instance.loop = false;
      instance.muted = true;
      instance.volume = 0;
      instance.audioMixingMode = "mixWithOthers";
      instance.staysActiveInBackground = false;
      instance.showNowPlayingNotification = false;
      instance.keepScreenOnWhilePlaying = true;
    }
  );

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

  useEventListener(player, "playToEnd", () => {
    onEnded?.(mediaId);
  });

  return (
    <View style={styles.fill} pointerEvents="none">
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
    backgroundColor: "#000",
  },
});
