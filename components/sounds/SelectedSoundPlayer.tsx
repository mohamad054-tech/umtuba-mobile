import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import {
  applyInactiveAudioTeardown,
  applyPlaybackIntent,
  isPlayerAlive,
} from "@/src/lib/watch/playerSession";

type SelectedSoundPlayerProps = {
  uri: string;
  shouldPlay: boolean;
  muted: boolean;
  volume: number;
  loop?: boolean;
  startOffsetMs?: number;
};

/**
 * Second expo-video player for the selected AAC. Original VideoView keeps
 * the camera/media track; this player only mixes the catalog sound.
 */
export function SelectedSoundPlayer({
  uri,
  shouldPlay,
  muted,
  volume,
  loop = true,
  startOffsetMs = 0,
}: SelectedSoundPlayerProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "mixWithOthers";
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.keepScreenOnWhilePlaying = false;
  });

  useEffect(() => {
    if (!isPlayerAlive(player)) return;
    try {
      player.audioMixingMode = "mixWithOthers";
    } catch {
      return;
    }
    if (!shouldPlay) {
      applyInactiveAudioTeardown(player, { resetPosition: false });
      return;
    }
    applyPlaybackIntent(player, {
      shouldPlay: true,
      muted,
      volume,
      loop,
      resetPosition: false,
    });
  }, [loop, muted, player, shouldPlay, volume]);

  useEffect(() => {
    if (!isPlayerAlive(player)) return;
    if (!Number.isFinite(startOffsetMs) || startOffsetMs <= 0) return;
    try {
      player.currentTime = startOffsetMs / 1000;
    } catch {
      // Released SharedObject — ignore.
    }
  }, [player, startOffsetMs, uri]);

  return (
    <View
      pointerEvents="none"
      style={styles.host}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <VideoView
        player={player}
        style={styles.hidden}
        nativeControls={false}
        contentFit="contain"
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  hidden: {
    width: 1,
    height: 1,
  },
});
