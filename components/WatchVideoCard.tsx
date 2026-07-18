import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { WatchVideo } from "@/src/contracts/watch";
import { colors } from "@/src/theme/colors";

type WatchVideoCardProps = {
  video: WatchVideo;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  style?: StyleProp<ViewStyle>;
};

export function WatchVideoCard({
  video,
  isActive,
  muted,
  onToggleMute,
  onToggleLike,
  onToggleSave,
  style,
}: WatchVideoCardProps) {
  const ref = useRef<Video>(null);

  useEffect(() => {
    const player = ref.current;
    if (!player) return;

    if (isActive) {
      void player.playAsync();
    } else {
      void player.pauseAsync();
      void player.setPositionAsync(0);
    }
  }, [isActive, video.src]);

  useEffect(() => {
    void ref.current?.setIsMutedAsync(muted);
  }, [muted]);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish && isActive) {
      void ref.current?.replayAsync();
    }
  };

  return (
    <View style={[styles.cell, style]}>
      <Video
        ref={ref}
        style={styles.video}
        source={{ uri: video.src }}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={isActive}
        isMuted={muted}
        onPlaybackStatusUpdate={onStatus}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          style={styles.muteBtn}
          onPress={onToggleMute}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute video" : "Mute video"}
        >
          <Text style={styles.muteText}>{muted ? "Unmute" : "Mute"}</Text>
        </Pressable>

        <View style={styles.meta}>
          <Text style={styles.username} numberOfLines={1}>
            {video.author.username}
          </Text>
          <Text style={styles.caption} numberOfLines={3}>
            {video.caption || video.title}
          </Text>
        </View>

        <View style={styles.rail}>
          <Pressable
            style={styles.action}
            onPress={onToggleLike}
            accessibilityRole="button"
            accessibilityLabel={video.likedByMe ? "Unlike" : "Like"}
          >
            <Text style={[styles.actionIcon, video.likedByMe && styles.on]}>
              ♥
            </Text>
            <Text style={styles.actionCount}>{video.stats.likes}</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={onToggleSave}
            accessibilityRole="button"
            accessibilityLabel={video.savedByMe ? "Unsave" : "Save"}
          >
            <Text style={[styles.actionIcon, video.savedByMe && styles.on]}>
              ★
            </Text>
            <Text style={styles.actionCount}>{video.stats.saves}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: 16,
  },
  muteBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muteText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  meta: {
    maxWidth: "72%",
    marginBottom: 8,
  },
  username: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rail: {
    position: "absolute",
    right: 12,
    bottom: 80,
    alignItems: "center",
    gap: 18,
  },
  action: {
    alignItems: "center",
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  actionIcon: {
    color: colors.text,
    fontSize: 28,
  },
  on: {
    color: colors.accentViolet,
  },
  actionCount: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
  },
});
