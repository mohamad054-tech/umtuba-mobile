import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  clampWatchVolume,
  formatPlaybackClock,
  resolveAutoNextButtonText,
  resolveEffectiveAudio,
  resolveMuteButtonText,
  resolveMuteLabel,
  resolvePlayPauseFeedbackLabel,
  resolveProgressRatio,
  resolveSeekTime,
  sanitizePlaybackError,
  shouldLoopCurrentVideo,
  shouldPlayVideo,
  shouldPlayWithUserPause,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import {
  applyPlaybackIntent,
  applySeekTime,
} from "@/src/lib/watch/playerSession";
import { colors } from "@/src/theme/colors";

const PLAY_PAUSE_FEEDBACK_MS = 700;
const TIME_UPDATE_INTERVAL_SEC = 0.25;

export type WatchVideoCardProps = {
  video: WatchVideo;
  isActive: boolean;
  /** Mount native player only for current + adjacent cards. */
  shouldLoadPlayer: boolean;
  muted: boolean;
  /** In-app VideoPlayer.volume 0–1. */
  volume: number;
  autoNext: boolean;
  /** Last feed item — loop safely when auto-next cannot advance. */
  isLastItem: boolean;
  appState: AppLifecycleState;
  screenFocused: boolean;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleAutoNext: () => void;
  onEnded?: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onOpenProfile?: () => void;
  onRefreshSrc?: () => Promise<string | null>;
  style?: StyleProp<ViewStyle>;
  topInset?: number;
  bottomInset?: number;
};

type TimelineState = {
  currentTime: number;
  duration: number;
  ratio: number;
};

type PlayerPaneProps = {
  src: string;
  isActive: boolean;
  shouldPlay: boolean;
  muted: boolean;
  volume: number;
  loop: boolean;
  seekRequest: { token: number; ratio: number } | null;
  onTimeline: (state: TimelineState) => void;
  onEnded?: () => void;
  onRefreshSrc?: () => Promise<string | null>;
};

type ScrubBarProps = {
  ratio: number;
  accessibilityLabel: string;
  onSeekRatio: (ratio: number) => void;
  trackColor?: string;
  fillColor?: string;
  /** Larger hit target for timeline seeking. */
  tall?: boolean;
};

function ScrubBar({
  ratio,
  accessibilityLabel,
  onSeekRatio,
  trackColor = "rgba(255,255,255,0.28)",
  fillColor = colors.accentCyan,
  tall = false,
}: ScrubBarProps) {
  const widthRef = useRef(1);
  const scrubbingRef = useRef(false);
  const [localRatio, setLocalRatio] = useState(ratio);

  useEffect(() => {
    if (!scrubbingRef.current) {
      setLocalRatio(ratio);
    }
  }, [ratio]);

  const ratioFromEvent = useCallback((event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    const width = widthRef.current || 1;
    return Math.min(1, Math.max(0, x / width));
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          scrubbingRef.current = true;
          const next = ratioFromEvent(event);
          setLocalRatio(next);
        },
        onPanResponderMove: (event) => {
          const next = ratioFromEvent(event);
          setLocalRatio(next);
        },
        onPanResponderRelease: (event) => {
          const next = ratioFromEvent(event);
          setLocalRatio(next);
          onSeekRatio(next);
          scrubbingRef.current = false;
        },
        onPanResponderTerminate: () => {
          scrubbingRef.current = false;
        },
      }),
    [onSeekRatio, ratioFromEvent]
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    widthRef.current = Math.max(1, event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      style={[styles.scrubHit, tall && styles.scrubHitTall]}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(localRatio * 100),
      }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.scrubTrack, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.scrubFill,
            { width: `${localRatio * 100}%`, backgroundColor: fillColor },
          ]}
        />
        <View
          style={[
            styles.scrubThumb,
            tall && styles.scrubThumbTall,
            { left: `${localRatio * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

function WatchPlayerPane({
  src,
  isActive,
  shouldPlay,
  muted,
  volume,
  loop,
  seekRequest,
  onTimeline,
  onEnded,
  onRefreshSrc,
}: PlayerPaneProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const lastSeekToken = useRef<number | null>(null);

  const player = useVideoPlayer(src, (p) => {
    p.loop = loop;
    p.muted = muted;
    p.volume = volume;
    p.audioMixingMode = "auto";
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.keepScreenOnWhilePlaying = true;
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SEC;
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

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const duration = player.duration;
    onTimeline({
      currentTime,
      duration: Number.isFinite(duration) ? duration : 0,
      ratio: resolveProgressRatio(currentTime, duration),
    });
  });

  useEventListener(player, "playToEnd", () => {
    if (!isActive || loop) return;
    onEnded?.();
  });

  useEffect(() => {
    applyPlaybackIntent(player, {
      shouldPlay,
      muted,
      volume,
      loop,
      resetPosition: !isActive,
    });
    if (!isActive) {
      onTimeline({ currentTime: 0, duration: 0, ratio: 0 });
    }
  }, [player, shouldPlay, muted, volume, loop, isActive, retryToken, onTimeline]);

  useEffect(() => {
    if (!seekRequest) return;
    if (lastSeekToken.current === seekRequest.token) return;
    lastSeekToken.current = seekRequest.token;
    const duration = player.duration;
    applySeekTime(player, resolveSeekTime(seekRequest.ratio, duration));
    onTimeline({
      currentTime: player.currentTime,
      duration: Number.isFinite(duration) ? duration : 0,
      ratio: resolveProgressRatio(player.currentTime, duration),
    });
  }, [seekRequest, player, onTimeline]);

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
  volume,
  autoNext,
  isLastItem,
  appState,
  screenFocused,
  onToggleMute,
  onVolumeChange,
  onToggleAutoNext,
  onEnded,
  onToggleLike,
  onToggleSave,
  onOpenProfile,
  onRefreshSrc,
  style,
  topInset = 0,
  bottomInset = 0,
}: WatchVideoCardProps) {
  const [userPaused, setUserPaused] = useState(false);
  const [timeline, setTimeline] = useState<TimelineState>({
    currentTime: 0,
    duration: 0,
    ratio: 0,
  });
  const [seekRequest, setSeekRequest] = useState<{
    token: number;
    ratio: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<"play" | "pause" | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekTokenRef = useRef(0);

  const feedShouldPlay = shouldPlayVideo({
    isActive,
    appState,
    screenFocused,
  });

  const shouldPlay = shouldPlayWithUserPause({
    feedShouldPlay,
    userPaused,
    isActive,
  });

  const loop = shouldLoopCurrentVideo({ autoNext, isLastItem });
  const audio = resolveEffectiveAudio({ isActive, muted, volume });

  useEffect(() => {
    if (!isActive) {
      setUserPaused(false);
      setFeedback(null);
      setTimeline({ currentTime: 0, duration: 0, ratio: 0 });
      setSeekRequest(null);
    }
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const showFeedback = useCallback((kind: "play" | "pause") => {
    setFeedback(kind);
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, PLAY_PAUSE_FEEDBACK_MS);
  }, []);

  const onTogglePlayPause = useCallback(() => {
    if (!isActive || !feedShouldPlay) return;
    setUserPaused((paused) => {
      const next = !paused;
      showFeedback(next ? "pause" : "play");
      return next;
    });
  }, [feedShouldPlay, isActive, showFeedback]);

  const onTimeline = useCallback((state: TimelineState) => {
    setTimeline(state);
  }, []);

  const onSeekRatio = useCallback((ratio: number) => {
    seekTokenRef.current += 1;
    setSeekRequest({ token: seekTokenRef.current, ratio });
    setTimeline((prev) => ({
      ...prev,
      ratio,
      currentTime: resolveSeekTime(ratio, prev.duration),
    }));
  }, []);

  const onVolumeSeek = useCallback(
    (ratio: number) => {
      onVolumeChange(clampWatchVolume(ratio));
    },
    [onVolumeChange]
  );

  const a11ySummary = [
    video.author.username,
    video.caption || video.title,
    muted ? "Muted" : "Sound on",
    `Volume ${Math.round(volume * 100)} percent`,
    autoNext ? "Auto-next on" : "Auto-next off",
    userPaused ? "Paused" : isActive ? "Now playing" : "Paused",
  ]
    .filter(Boolean)
    .join(". ");

  const timelineBottom = Math.max(12, bottomInset + 10);

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
          muted={audio.muted}
          volume={audio.volume}
          loop={loop}
          seekRequest={isActive ? seekRequest : null}
          onTimeline={onTimeline}
          onEnded={onEnded}
          onRefreshSrc={onRefreshSrc}
        />
      ) : (
        <View style={styles.placeholder} accessibilityElementsHidden>
          <View />
        </View>
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable
          style={styles.tapLayer}
          onPress={onTogglePlayPause}
          accessibilityRole="button"
          accessibilityLabel={userPaused ? "Play video" : "Pause video"}
          accessibilityHint="Toggles play and pause"
        />

        {feedback ? (
          <View
            style={styles.feedbackBadge}
            pointerEvents="none"
            accessibilityElementsHidden
          >
            <Text style={styles.feedbackIcon}>
              {feedback === "pause" ? "❚❚" : "▶"}
            </Text>
            <Text style={styles.feedbackText}>
              {resolvePlayPauseFeedbackLabel(feedback === "pause")}
            </Text>
          </View>
        ) : null}

        <View
          style={[styles.topControls, { top: Math.max(16, topInset + 8) }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={[styles.chipBtn, autoNext && styles.chipBtnOn]}
            onPress={onToggleAutoNext}
            accessibilityRole="switch"
            accessibilityLabel="Auto-next"
            accessibilityState={{ checked: autoNext }}
          >
            <Text style={styles.chipText}>
              {resolveAutoNextButtonText(autoNext)}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chipBtn, muted && styles.chipBtnMuted]}
            onPress={onToggleMute}
            accessibilityRole="button"
            accessibilityLabel={resolveMuteLabel(muted)}
            accessibilityState={{ selected: muted }}
          >
            <Text style={styles.chipText}>{resolveMuteButtonText(muted)}</Text>
          </Pressable>
        </View>

        <View
          style={[styles.volumeBlock, { top: Math.max(72, topInset + 64) }]}
          pointerEvents="box-none"
        >
          <Text style={styles.volumeLabel}>
            Volume {Math.round(volume * 100)}%
          </Text>
          <ScrubBar
            ratio={volume}
            accessibilityLabel="In-app volume"
            onSeekRatio={onVolumeSeek}
          />
        </View>

        <View
          style={[styles.meta, { marginBottom: timelineBottom + 36 }]}
          pointerEvents="box-none"
        >
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

        <View style={[styles.rail, { bottom: timelineBottom + 52 }]}>
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

        {/*
          Timeline lives in the overlay (not under VideoView siblings).
          V1's 3px bar sat inside the player layer at bottom:0 and was covered /
          clipped by the overlay + tab/safe-area on Android.
        */}
        <View
          style={[styles.timeline, { bottom: timelineBottom }]}
          collapsable={false}
          pointerEvents="box-none"
        >
          <View style={styles.timelineTimes}>
            <Text style={styles.timeText}>
              {formatPlaybackClock(timeline.currentTime)}
            </Text>
            <Text style={styles.timeText}>
              {formatPlaybackClock(timeline.duration)}
            </Text>
          </View>
          <ScrubBar
            ratio={isActive ? timeline.ratio : 0}
            accessibilityLabel="Seek timeline"
            onSeekRatio={onSeekRatio}
            tall
          />
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
    paddingHorizontal: 16,
    zIndex: 4,
    elevation: 4,
  },
  tapLayer: {
    ...StyleSheet.absoluteFill,
  },
  feedbackBadge: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(5,5,16,0.72)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 4,
    zIndex: 6,
  },
  feedbackIcon: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  feedbackText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  topControls: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    gap: 8,
    zIndex: 6,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipBtnOn: {
    borderColor: colors.accentCyan,
  },
  chipBtnMuted: {
    borderColor: colors.danger,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  volumeBlock: {
    position: "absolute",
    right: 16,
    width: 148,
    gap: 6,
    zIndex: 6,
  },
  volumeLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  meta: {
    maxWidth: "72%",
    zIndex: 5,
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
    alignItems: "center",
    gap: 18,
    zIndex: 5,
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
  timeline: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 8,
    elevation: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  timelineTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  scrubHit: {
    justifyContent: "center",
    minHeight: 28,
    paddingVertical: 8,
  },
  scrubHitTall: {
    minHeight: 36,
    paddingVertical: 10,
  },
  scrubTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "visible",
    justifyContent: "center",
  },
  scrubFill: {
    height: 4,
    borderRadius: 999,
  },
  scrubThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.accentCyan,
  },
  scrubThumbTall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
  },
});
