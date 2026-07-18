import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  resolveMuteLabel,
  sanitizePlaybackError,
  shouldPlayVideo,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import { applyPlaybackIntent } from "@/src/lib/watch/playerSession";
import { colors } from "@/src/theme/colors";

export type WatchVideoCardProps = {
  video: WatchVideo;
  isActive: boolean;
  /** Mount native player only for current + adjacent cards. */
  shouldLoadPlayer: boolean;
  muted: boolean;
  appState: AppLifecycleState;
  screenFocused: boolean;
  onToggleMute: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onOpenProfile?: () => void;
  onRefreshSrc?: () => Promise<string | null>;
  style?: StyleProp<ViewStyle>;
  topInset?: number;
  bottomInset?: number;
};

type PlayerPaneProps = {
  src: string;
  isActive: boolean;
  shouldPlay: boolean;
  muted: boolean;
  onRefreshSrc?: () => Promise<string | null>;
};

function WatchPlayerPane({
  src,
  isActive,
  shouldPlay,
  muted,
  onRefreshSrc,
}: PlayerPaneProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const player = useVideoPlayer(src, (p) => {
    p.loop = true;
    p.muted = muted;
    p.audioMixingMode = "auto";
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.keepScreenOnWhilePlaying = true;
  });

  useEventListener(player, "statusChange", ({ status: next, error }) => {
    if (next === "loading") {
      setStatus("loading");
      setErrorMessage(null);
      return;
    }
    if (next === "readyToPlay") {
      setStatus("ready");
      setErrorMessage(null);
      return;
    }
    if (next === "error") {
      setStatus("error");
      setErrorMessage(
        sanitizePlaybackError(error ?? { message: "Playback failed." })
      );
    }
  });

  useEffect(() => {
    applyPlaybackIntent(player, {
      shouldPlay,
      muted,
      resetPosition: !isActive,
    });
  }, [player, shouldPlay, muted, isActive, retryToken]);

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  const onRetry = useCallback(async () => {
    setRefreshing(true);
    setErrorMessage(null);
    setStatus("loading");
    try {
      let nextSrc = src;
      if (onRefreshSrc) {
        const refreshed = await onRefreshSrc();
        if (refreshed) {
          nextSrc = refreshed;
        }
      }
      await player.replaceAsync(nextSrc);
      setRetryToken((n) => n + 1);
      if (shouldPlay) {
        player.play();
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(sanitizePlaybackError(err));
    } finally {
      setRefreshing(false);
    }
  }, [onRefreshSrc, player, shouldPlay, src]);

  return (
    <View
      style={styles.playerWrap}
      importantForAccessibility="no-hide-descendants"
    >
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        surfaceType="textureView"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {(status === "loading" || refreshing) && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator
            color={colors.accentCyan}
            accessibilityLabel="Loading video"
          />
        </View>
      )}

      {status === "error" && (
        <View style={styles.centerOverlay} accessibilityRole="alert">
          <Text style={styles.errorText}>
            {errorMessage ?? "Unable to play this video. Try again."}
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => void onRetry()}
            disabled={refreshing}
            accessibilityRole="button"
            accessibilityLabel="Retry playback"
            accessibilityState={{ busy: refreshing, disabled: refreshing }}
          >
            <Text style={styles.retryText}>
              {refreshing ? "Retrying…" : "Retry"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function WatchVideoCardComponent({
  video,
  isActive,
  shouldLoadPlayer: loadPlayer,
  muted,
  appState,
  screenFocused,
  onToggleMute,
  onToggleLike,
  onToggleSave,
  onOpenProfile,
  onRefreshSrc,
  style,
  topInset = 0,
  bottomInset = 0,
}: WatchVideoCardProps) {
  const shouldPlay = shouldPlayVideo({
    isActive,
    appState,
    screenFocused,
  });

  const a11ySummary = [
    video.author.username,
    video.caption || video.title,
    muted ? "Muted" : "Unmuted",
    isActive ? "Now playing" : "Paused",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View
      style={[styles.cell, style]}
      accessibilityLabel={a11ySummary}
      accessibilityRole="text"
    >
      {loadPlayer ? (
        <WatchPlayerPane
          src={video.src}
          isActive={isActive}
          shouldPlay={shouldPlay}
          muted={muted}
          onRefreshSrc={onRefreshSrc}
        />
      ) : (
        <View style={styles.placeholder} accessibilityElementsHidden>
          <View />
        </View>
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          style={[styles.muteBtn, { top: Math.max(16, topInset + 8) }]}
          onPress={onToggleMute}
          accessibilityRole="button"
          accessibilityLabel={resolveMuteLabel(muted)}
          accessibilityState={{ selected: muted }}
        >
          <Text style={styles.muteText}>{muted ? "Unmute" : "Mute"}</Text>
        </Pressable>

        <View style={[styles.meta, { marginBottom: Math.max(8, bottomInset) }]}>
          <Pressable
            onPress={onOpenProfile}
            disabled={!onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={`Profile ${video.author.username}`}
            accessibilityState={{ disabled: !onOpenProfile }}
            hitSlop={8}
          >
            <Text style={styles.username} numberOfLines={1}>
              {video.author.username}
            </Text>
          </Pressable>
          <Text style={styles.caption} numberOfLines={3}>
            {video.caption || video.title}
          </Text>
        </View>

        <View style={[styles.rail, { bottom: 80 + bottomInset }]}>
          <Pressable
            style={styles.action}
            onPress={onToggleLike}
            accessibilityRole="button"
            accessibilityLabel={video.likedByMe ? "Unlike" : "Like"}
            accessibilityState={{ selected: video.likedByMe }}
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
            accessibilityState={{ selected: video.savedByMe }}
          >
            <Text style={[styles.actionIcon, video.savedByMe && styles.on]}>
              ★
            </Text>
            <Text style={styles.actionCount}>{video.stats.saves}</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            disabled
            accessibilityRole="button"
            accessibilityLabel="Comments, coming soon"
            accessibilityState={{ disabled: true }}
          >
            <Text style={[styles.actionIcon, styles.disabledIcon]}>◌</Text>
            <Text style={styles.actionCount}>{video.stats.comments}</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            disabled
            accessibilityRole="button"
            accessibilityLabel="Share, coming soon"
            accessibilityState={{ disabled: true }}
          >
            <Text style={[styles.actionIcon, styles.disabledIcon]}>↗</Text>
            <Text style={styles.actionCount}>{video.stats.shares}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const WatchVideoCard = memo(WatchVideoCardComponent);

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  playerWrap: {
    ...StyleSheet.absoluteFill,
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,5,16,0.45)",
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    color: colors.text,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  retryBtn: {
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.bg,
    fontWeight: "700",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    padding: 16,
  },
  muteBtn: {
    position: "absolute",
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
    minWidth: 72,
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
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
  },
  actionIcon: {
    color: colors.text,
    fontSize: 28,
  },
  disabledIcon: {
    opacity: 0.45,
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
