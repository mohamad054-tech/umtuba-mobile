import { useEventListener } from "expo";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { VideoOverlayLayer } from "@/components/create/VideoOverlayLayer";
import { WatchSideVolumeControl } from "@/components/WatchSideVolumeControl";
import type { WatchVideo } from "@/src/contracts/watch";
import { useTranslation } from "@/src/lib/i18n";
import { formatPublishedAt } from "@/src/lib/time/publishedAt";
import {
  resolveWatchTrimBounds,
  shouldEndAtTrim,
  shouldSeekToTrimStart,
  watchEditAudioScale,
  watchEditFromPipeline,
} from "@/src/lib/video/watchEditPlayback";
import {
  canSeekWithDuration,
  formatPlaybackClock,
  resolveEffectiveAudio,
  resolveProgressRatio,
  resolveScrubRatioFromPageX,
  resolveSeekTimeOrNull,
  sanitizePlaybackError,
  scrubFillWidthPercent,
  scrubThumbLeftPercent,
  WATCH_SCRUB_LAYOUT_DIRECTION,
  shouldLoopCurrentVideo,
  shouldPlayVideo,
  shouldPlayWithUserPause,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import {
  canProduceWatchAudio,
  resolveWatchPlaybackIntent,
  shouldApplyWatchPlayerOp,
  shouldHonorLatePlayerEvent,
  shouldTeardownUnexpectedPlay,
} from "@/src/lib/watch/activePlayerOwnership";
import {
  detachWatchPlayerBinding,
  nextPlayerInstanceGeneration,
  resolveRetryTargetPostId,
  resolveWatchNativePlatform,
  shouldApplyWatchTransport,
} from "@/src/lib/watch/playerLifecycle";
import {
  applyInactiveAudioTeardown,
  applyPlaybackIntent,
  applySeekTime,
  isPlayerAlive,
  runAlivePlayerOp,
} from "@/src/lib/watch/playerSession";
import {
  WATCH_RAIL_ACTION_LABEL_MAX_WIDTH,
  WATCH_RAIL_ACTION_MIN_HEIGHT,
  WATCH_RAIL_GAP,
  WATCH_TIMELINE_TRAILING_GUTTER,
  WATCH_VOLUME_RIGHT_CLEARANCE,
  watchRailBottomOffset,
} from "@/src/lib/watch/railLayout";
import { colors } from "@/src/theme/colors";

const PLAY_PAUSE_FEEDBACK_MS = 700;
const TIME_UPDATE_INTERVAL_SEC = 0.25;
const SCRUB_CATCHUP_EPSILON = 0.02;

export type WatchVideoCardProps = {
  video: WatchVideo;
  isActive: boolean;
  /** Mount native player only for current + adjacent cards. */
  shouldLoadPlayer: boolean;
  /** Bumps on every active-index change so late play cannot revive the previous card. */
  ownershipGeneration: number;
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
  /** Disable parent FlatList scrolling while scrubbing seek/volume. */
  onScrubGestureChange?: (active: boolean) => void;
  onEnded?: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onOpenComments?: () => void;
  onShare?: () => void;
  /** Owner-only. Hidden unless the viewer owns this post (UAF-12). */
  onDeleteOwn?: () => void;
  /** Other people's content only — Guideline 1.2 report. */
  onReport?: () => void;
  /** Other accounts only — Guideline 1.2 block. */
  onBlockUser?: () => void;
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
  ownershipGeneration: number;
  muted: boolean;
  volume: number;
  loop: boolean;
  seekRequest: { token: number; ratio: number } | null;
  onTimeline: (state: TimelineState) => void;
  onEnded?: () => void;
  onPlayerStatus?: (
    status: "idle" | "loading" | "ready" | "error",
    message?: string | null
  ) => void;
};

type ScrubBarProps = {
  ratio: number;
  accessibilityLabel: string;
  onSeekRatio: (ratio: number) => void;
  onGestureActiveChange?: (active: boolean) => void;
  trackColor?: string;
  fillColor?: string;
  /** Larger hit target for timeline seeking. */
  tall?: boolean;
};

function ScrubBar({
  ratio,
  accessibilityLabel,
  onSeekRatio,
  onGestureActiveChange,
  trackColor = "rgba(255,255,255,0.28)",
  fillColor = colors.accentCyan,
  tall = false,
}: ScrubBarProps) {
  const trackRef = useRef<View>(null);
  const frameRef = useRef({ x: 0, width: 1 });
  const scrubbingRef = useRef(false);
  const [localRatio, setLocalRatio] = useState(ratio);

  useEffect(() => {
    if (!scrubbingRef.current) {
      setLocalRatio(ratio);
    }
  }, [ratio]);

  const measureTrack = useCallback((after?: () => void) => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      frameRef.current = {
        x,
        width: Math.max(1, width),
      };
      after?.();
    });
  }, []);

  const ratioFromPageX = useCallback((pageX: number) => {
    const { x, width } = frameRef.current;
    return resolveScrubRatioFromPageX(pageX, x, width);
  }, []);

  const applyFromEvent = useCallback(
    (event: GestureResponderEvent, emit: boolean) => {
      const next = ratioFromPageX(event.nativeEvent.pageX);
      setLocalRatio(next);
      if (emit) {
        onSeekRatio(next);
      }
    },
    [onSeekRatio, ratioFromPageX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          scrubbingRef.current = true;
          onGestureActiveChange?.(true);
          const pageX = event.nativeEvent.pageX;
          measureTrack(() => {
            const next = ratioFromPageX(pageX);
            setLocalRatio(next);
            onSeekRatio(next);
          });
          // Optimistic update with last measured frame if callback is delayed.
          applyFromEvent(event, true);
        },
        onPanResponderMove: (event) => {
          applyFromEvent(event, true);
        },
        onPanResponderRelease: (event) => {
          applyFromEvent(event, true);
          scrubbingRef.current = false;
          onGestureActiveChange?.(false);
        },
        onPanResponderTerminate: () => {
          scrubbingRef.current = false;
          onGestureActiveChange?.(false);
        },
      }),
    [
      applyFromEvent,
      measureTrack,
      onGestureActiveChange,
      onSeekRatio,
      ratioFromPageX,
    ]
  );

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      measureTrack();
    },
    [measureTrack]
  );

  return (
    <View
      ref={trackRef}
      style={[
        styles.scrubHit,
        tall && styles.scrubHitTall,
        { direction: WATCH_SCRUB_LAYOUT_DIRECTION },
      ]}
      onLayout={onLayout}
      collapsable={false}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(localRatio * 100),
      }}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.scrubTrack,
          {
            backgroundColor: trackColor,
            direction: WATCH_SCRUB_LAYOUT_DIRECTION,
          },
        ]}
      >
        <View
          style={[
            styles.scrubFill,
            {
              width: scrubFillWidthPercent(localRatio),
              backgroundColor: fillColor,
            },
          ]}
        />
        <View
          style={[
            styles.scrubThumb,
            tall && styles.scrubThumbTall,
            { left: scrubThumbLeftPercent(localRatio) },
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
  ownershipGeneration,
  muted,
  volume,
  loop,
  seekRequest,
  onTimeline,
  onEnded,
  onPlayerStatus,
}: PlayerPaneProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSeekToken = useRef<number | null>(null);
  const nativePlatform = resolveWatchNativePlatform(Platform.OS);
  const statusRef = useRef(status);
  statusRef.current = status;
  const isActiveRef = useRef(isActive);
  const shouldPlayRef = useRef(shouldPlay);
  const ownershipGenerationRef = useRef(ownershipGeneration);
  const playGenerationRef = useRef<number | null>(null);
  const playerAliveRef = useRef(true);
  isActiveRef.current = isActive;
  shouldPlayRef.current = shouldPlay;
  ownershipGenerationRef.current = ownershipGeneration;

  useEffect(() => {
    onPlayerStatus?.(status, errorMessage);
  }, [errorMessage, onPlayerStatus, status]);

  const player = useVideoPlayer(src, (p) => {
    // New SharedObject starts silent. Ownership effect unmutes only the active post.
    p.loop = false;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "auto";
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.keepScreenOnWhilePlaying = true;
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SEC;
  });
  const boundPlayerRef = useRef<typeof player | null>(null);

  const canTouchBoundPlayer = () =>
    playerAliveRef.current &&
    boundPlayerRef.current === player &&
    isPlayerAlive(player);

  useEventListener(player, "statusChange", ({ status: next, error }) => {
    if (!canTouchBoundPlayer()) return;
    if (next === "loading") {
      setStatus("loading");
      setErrorMessage(null);
      return;
    }
    if (next === "readyToPlay") {
      setStatus("ready");
      setErrorMessage(null);
      const allowed = canProduceWatchAudio({
        isActive: isActiveRef.current,
        shouldPlay: shouldPlayRef.current,
        ownerGeneration: ownershipGenerationRef.current,
        commandGeneration: ownershipGenerationRef.current,
      });
      if (allowed) {
        playGenerationRef.current = ownershipGenerationRef.current;
        applyPlaybackIntent(
          player,
          resolveWatchPlaybackIntent({
            isActive: true,
            shouldPlay: true,
            muted,
            volume,
            loop,
          })
        );
      } else {
        playGenerationRef.current = null;
        applyInactiveAudioTeardown(player, { resetPosition: false });
      }
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
    if (!canTouchBoundPlayer()) return;
    let duration = 0;
    const read = runAlivePlayerOp(player, (alive) => {
      duration = Number.isFinite(alive.duration) ? (alive.duration as number) : 0;
    });
    if (!read) return;
    onTimeline({
      currentTime,
      duration,
      ratio: resolveProgressRatio(currentTime, duration),
    });
  });

  useEventListener(player, "playToEnd", () => {
    if (!canTouchBoundPlayer()) return;
    if (
      !shouldHonorLatePlayerEvent({
        isActive: isActiveRef.current,
        shouldPlay: shouldPlayRef.current,
        ownerGeneration: ownershipGenerationRef.current,
        eventGeneration: playGenerationRef.current,
        playerAlive: true,
      })
    ) {
      applyInactiveAudioTeardown(player, { resetPosition: false });
      return;
    }
    if (loop) return;
    onEnded?.();
  });

  useEventListener(player, "playingChange", ({ isPlaying }) => {
    if (!canTouchBoundPlayer()) return;
    if (
      !shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: statusRef.current === "ready",
        kind: "pause",
        platform: nativePlatform,
      })
    ) {
      return;
    }
    if (
      shouldTeardownUnexpectedPlay({
        isPlaying,
        isActive: isActiveRef.current,
        shouldPlay: shouldPlayRef.current,
      })
    ) {
      applyInactiveAudioTeardown(player, { resetPosition: false });
    }
  });

  // Bind this SharedObject only. Unmount/swap: detach JS binding and never
  // call play/pause/mute — useReleasingSharedObject owns native release.
  useLayoutEffect(() => {
    if (boundPlayerRef.current && boundPlayerRef.current !== player) {
      detachWatchPlayerBinding({
        markDead: () => {
          playerAliveRef.current = false;
        },
        clearPlayGeneration: () => {
          playGenerationRef.current = null;
        },
        dropBoundRef: () => {
          boundPlayerRef.current = null;
        },
      });
    }
    boundPlayerRef.current = player;
    playerAliveRef.current = true;
    return () => {
      detachWatchPlayerBinding({
        markDead: () => {
          playerAliveRef.current = false;
        },
        clearPlayGeneration: () => {
          playGenerationRef.current = null;
        },
        dropBoundRef: () => {
          if (boundPlayerRef.current === player) {
            boundPlayerRef.current = null;
          }
        },
      });
    };
  }, [player]);

  useLayoutEffect(() => {
    if (!canTouchBoundPlayer()) return;
    const itemReady = status === "ready";
    const allowed = canProduceWatchAudio({
      isActive,
      shouldPlay,
      ownerGeneration: ownershipGeneration,
      commandGeneration: ownershipGeneration,
    });
    if (
      !shouldApplyWatchTransport({
        playerAlive: true,
        itemReady,
        kind: allowed ? "play" : "pause",
        platform: nativePlatform,
      })
    ) {
      runAlivePlayerOp(player, (alive) => {
        alive.muted = true;
        alive.volume = 0;
        alive.loop = false;
      });
      return;
    }
    if (
      allowed &&
      shouldApplyWatchPlayerOp({
        playerAlive: true,
        ownerGeneration: ownershipGeneration,
        commandGeneration: ownershipGeneration,
        requireOwner: true,
        isActive,
        shouldPlay,
      })
    ) {
      playGenerationRef.current = ownershipGeneration;
      applyPlaybackIntent(
        player,
        resolveWatchPlaybackIntent({
          isActive: true,
          shouldPlay: true,
          muted,
          volume,
          loop,
        })
      );
      return;
    }
    playGenerationRef.current = null;
    applyPlaybackIntent(
      player,
      resolveWatchPlaybackIntent({
        isActive,
        shouldPlay: false,
        muted,
        volume,
        loop,
      })
    );
    if (!isActive) {
      onTimeline({ currentTime: 0, duration: 0, ratio: 0 });
    }
  }, [
    player,
    shouldPlay,
    muted,
    volume,
    loop,
    isActive,
    ownershipGeneration,
    status,
    nativePlatform,
    onTimeline,
  ]);

  useEffect(() => {
    if (!seekRequest) return;
    if (lastSeekToken.current === seekRequest.token) return;
    if (!canTouchBoundPlayer()) return;
    if (
      !shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: statusRef.current === "ready",
        kind: "seek",
        platform: nativePlatform,
      })
    ) {
      return;
    }
    lastSeekToken.current = seekRequest.token;
    let duration = 0;
    const read = runAlivePlayerOp(player, (alive) => {
      duration = Number.isFinite(alive.duration) ? (alive.duration as number) : 0;
    });
    if (!read) return;
    const seconds = resolveSeekTimeOrNull(seekRequest.ratio, duration);
    if (seconds == null) {
      return;
    }
    applySeekTime(player, seconds);
    onTimeline({
      currentTime: seconds,
      duration,
      ratio: seekRequest.ratio,
    });
  }, [seekRequest, player, onTimeline]);

  const { t } = useTranslation();

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

      {status === "loading" && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator
            color={colors.accentCyan}
            accessibilityLabel={t("watch.loadingVideo")}
          />
        </View>
      )}
    </View>
  );
}

function WatchVideoCardComponent({
  video,
  isActive,
  shouldLoadPlayer: loadPlayer,
  ownershipGeneration,
  muted,
  volume,
  autoNext,
  isLastItem,
  appState,
  screenFocused,
  onToggleMute,
  onVolumeChange,
  onToggleAutoNext,
  onScrubGestureChange,
  onEnded,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onShare,
  onDeleteOwn,
  onReport,
  onBlockUser,
  onOpenProfile,
  onRefreshSrc,
  style,
  topInset = 0,
  bottomInset = 0,
}: WatchVideoCardProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
  const [userPaused, setUserPaused] = useState(false);
  const trimEndedRef = useRef(false);
  const edit = useMemo(
    () => watchEditFromPipeline(video.mediaPipeline, video.durationMs ?? null),
    [video.durationMs, video.mediaPipeline]
  );
  const publishedLabel = formatPublishedAt(video.publishedAt, locale);
  const editAudioScale = watchEditAudioScale(edit);
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
  const scrubTargetRatioRef = useRef<number | null>(null);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const [epochSrc, setEpochSrc] = useState(video.src);
  const [paneStatus, setPaneStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [paneError, setPaneError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retryInFlightRef = useRef(false);

  useEffect(() => {
    setEpochSrc(video.src);
  }, [video.src]);

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
  const audio = resolveEffectiveAudio({
    isActive,
    muted: muted || editAudioScale <= 0.001,
    volume: volume * editAudioScale,
  });

  useEffect(() => {
    if (!isActive) {
      setUserPaused(false);
      setFeedback(null);
      setTimeline({ currentTime: 0, duration: 0, ratio: 0 });
      setSeekRequest(null);
      trimEndedRef.current = false;
    }
  }, [isActive]);

  useEffect(() => {
    trimEndedRef.current = false;
  }, [video.id]);

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

  const onPlayerStatus = useCallback(
    (
      next: "idle" | "loading" | "ready" | "error",
      message?: string | null
    ) => {
      setPaneStatus(next);
      setPaneError(message ?? null);
    },
    []
  );

  const onRetryPlayback = useCallback(async () => {
    const target = resolveRetryTargetPostId({
      activePostId: video.postId ?? null,
      overlayPostId: isActive ? video.postId ?? null : null,
    });
    if (target == null && video.postId != null) return;
    if (!isActive || retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setRetrying(true);
    setPaneStatus("loading");
    setPaneError(null);
    try {
      const refreshed = onRefreshSrc ? await onRefreshSrc() : null;
      if (refreshed) {
        setEpochSrc(refreshed);
      }
      setPlayerEpoch((prev) => nextPlayerInstanceGeneration(prev));
    } finally {
      retryInFlightRef.current = false;
      setRetrying(false);
    }
  }, [isActive, onRefreshSrc, video.postId]);

  const onTogglePlayPause = useCallback(() => {
    if (paneStatus === "error") return;
    if (!isActive || !feedShouldPlay) return;
    setUserPaused((paused) => {
      const next = !paused;
      showFeedback(next ? "pause" : "play");
      return next;
    });
  }, [feedShouldPlay, isActive, paneStatus, showFeedback]);

  const onTimeline = useCallback((state: TimelineState) => {
    const durationMs =
      video.durationMs ??
      (state.duration > 0 ? Math.round(state.duration * 1000) : null);
    const bounds = resolveWatchTrimBounds(edit, durationMs);
    if (bounds && shouldSeekToTrimStart(state.currentTime, bounds)) {
      const duration = state.duration || bounds.endSec;
      if (duration > 0) {
        seekTokenRef.current += 1;
        setSeekRequest({
          token: seekTokenRef.current,
          ratio: bounds.startSec / duration,
        });
      }
    }
    if (
      bounds &&
      shouldEndAtTrim(state.currentTime, bounds) &&
      !trimEndedRef.current
    ) {
      trimEndedRef.current = true;
      if (loop) {
        const duration = state.duration || bounds.endSec;
        if (duration > 0) {
          seekTokenRef.current += 1;
          setSeekRequest({
            token: seekTokenRef.current,
            ratio: bounds.startSec / duration,
          });
        }
        trimEndedRef.current = false;
      } else {
        onEnded?.();
      }
    }
    const target = scrubTargetRatioRef.current;
    if (target != null) {
      if (Math.abs(state.ratio - target) > SCRUB_CATCHUP_EPSILON) {
        setTimeline((prev) => ({
          ...prev,
          duration: state.duration || prev.duration,
          currentTime:
            canSeekWithDuration(state.duration || prev.duration)
              ? target * (state.duration || prev.duration)
              : prev.currentTime,
          ratio: target,
        }));
        return;
      }
      scrubTargetRatioRef.current = null;
    }
    setTimeline(state);
  }, [edit, loop, onEnded, video.durationMs]);

  const onSeekRatio = useCallback(
    (ratio: number) => {
      if (!canSeekWithDuration(timeline.duration)) {
        return;
      }
      scrubTargetRatioRef.current = ratio;
      seekTokenRef.current += 1;
      setSeekRequest({ token: seekTokenRef.current, ratio });
      setTimeline((prev) => ({
        ...prev,
        ratio,
        currentTime:
          resolveSeekTimeOrNull(ratio, prev.duration) ?? prev.currentTime,
      }));
    },
    [timeline.duration]
  );

  const onScrubActive = useCallback(
    (active: boolean) => {
      onScrubGestureChange?.(active);
      if (!active) {
        // Keep local scrub target briefly until timeUpdate catches up.
      }
    },
    [onScrubGestureChange]
  );

  const a11ySummary = [
    video.author.username,
    video.caption || video.title,
    muted ? t("watch.muted") : t("watch.soundOn"),
    t("watch.volume", { values: { percent: Math.round(volume * 100) } }),
    autoNext ? t("watch.autoNextOn") : t("watch.autoNextOff"),
    userPaused ? t("watch.paused") : isActive ? t("watch.nowPlaying") : t("watch.paused"),
  ]
    .filter(Boolean)
    .join(". ");

  const timelineBottom = Math.max(12, bottomInset + 10);

  return (
    <View
      style={[styles.cell, style]}
      accessibilityLabel={a11ySummary}
      accessibilityRole="text"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setPaneSize((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height }
        );
      }}
    >
      {loadPlayer ? (
        <WatchPlayerPane
          key={`watch-player-${video.id}-${playerEpoch}`}
          src={epochSrc}
          isActive={isActive}
          shouldPlay={shouldPlay}
          ownershipGeneration={ownershipGeneration}
          muted={audio.muted}
          volume={audio.volume}
          loop={loop}
          seekRequest={isActive ? seekRequest : null}
          onTimeline={onTimeline}
          onEnded={onEnded}
          onPlayerStatus={onPlayerStatus}
        />
      ) : (
        <View style={styles.placeholder} accessibilityElementsHidden>
          <View />
        </View>
      )}

      {edit.overlays.length > 0 ? (
        <VideoOverlayLayer
          elements={edit.overlays}
          width={paneSize.width}
          height={paneSize.height}
        />
      ) : null}

      <View
        style={styles.overlay}
        pointerEvents={paneStatus === "error" ? "none" : "box-none"}
      >
        {paneStatus === "error" ? null : (
          <Pressable
            style={[styles.tapLayer, { right: WATCH_VOLUME_RIGHT_CLEARANCE }]}
            onPress={onTogglePlayPause}
            accessibilityRole="button"
            accessibilityLabel={userPaused ? t("watch.play") : t("watch.pause")}
            accessibilityHint={t("watch.playPauseHint")}
          />
        )}

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
              {feedback === "pause" ? t("watch.paused") : t("watch.playing")}
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
            accessibilityLabel={t("watch.autoNext")}
            accessibilityState={{ checked: autoNext }}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {autoNext ? t("watch.autoNextOn") : t("watch.autoNextOff")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chipBtn, muted && styles.chipBtnMuted]}
            onPress={onToggleMute}
            accessibilityRole="button"
            accessibilityLabel={muted ? t("watch.unmuteVideo") : t("watch.muteVideo")}
            accessibilityState={{ selected: muted }}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {muted ? t("watch.unmute") : t("watch.mute")}
            </Text>
          </Pressable>
        </View>

        <WatchSideVolumeControl
          volume={volume}
          muted={muted}
          topInset={topInset}
          bottomInset={bottomInset}
          onVolumeChange={onVolumeChange}
          onGestureActiveChange={onScrubActive}
        />

        <View
          style={[styles.meta, { marginBottom: timelineBottom + 36 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={onOpenProfile}
            disabled={!onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={t("watch.openProfile", {
              values: { name: video.author.username },
            })}
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
          {publishedLabel ? (
            <Text
              style={styles.publishedAt}
              numberOfLines={1}
              accessibilityRole="text"
              accessibilityLabel={publishedLabel}
            >
              {publishedLabel}
            </Text>
          ) : null}
          {edit.soundId ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/sound/[id]",
                  params: { id: edit.soundId as string },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("sound.original")}
              hitSlop={8}
              style={styles.soundChip}
            >
              <Text style={styles.soundChipText} numberOfLines={1}>
                {t("sound.original")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View
          key={`rail-${video.postId ?? video.id}-${video.likedByMe === true ? 1 : 0}`}
          style={[styles.rail, { bottom: watchRailBottomOffset(bottomInset) }]}
          pointerEvents="box-none"
          collapsable={false}
        >
          <Pressable
            style={styles.action}
            onPress={onToggleLike}
            accessibilityRole="button"
            accessibilityLabel={
              video.likedByMe === true ? t("watch.unlike") : t("watch.like")
            }
            accessibilityState={{ selected: video.likedByMe === true }}
          >
            <Text
              style={[
                styles.actionIcon,
                video.likedByMe === true ? styles.liked : styles.unliked,
              ]}
            >
              {video.likedByMe === true ? "♥" : "♡"}
            </Text>
            <Text style={styles.actionCount} numberOfLines={1}>
              {video.stats.likes}
            </Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={onToggleSave}
            accessibilityRole="button"
            accessibilityLabel={video.savedByMe ? t("watch.unsave") : t("watch.save")}
            accessibilityState={{ selected: video.savedByMe }}
          >
            <Text style={[styles.actionIcon, video.savedByMe && styles.on]}>
              ★
            </Text>
            <Text style={styles.actionCount} numberOfLines={1}>
              {video.stats.saves}
            </Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={onOpenComments}
            disabled={!onOpenComments}
            accessibilityRole="button"
            accessibilityLabel={t("watch.comments")}
            accessibilityState={{ disabled: !onOpenComments }}
          >
            <Text
              style={[
                styles.actionIcon,
                !onOpenComments && styles.disabledIcon,
              ]}
            >
              ◌
            </Text>
            <Text style={styles.actionCount} numberOfLines={1}>
              {video.stats.comments}
            </Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={onShare}
            disabled={!onShare}
            accessibilityRole="button"
            accessibilityLabel={t("watch.share")}
            accessibilityState={{ disabled: !onShare }}
            testID="watch-share-entry"
          >
            <Text
              style={[styles.actionIcon, !onShare && styles.disabledIcon]}
            >
              ↗
            </Text>
            <Text style={styles.actionCount} numberOfLines={1}>
              {video.stats.shares}
            </Text>
          </Pressable>
          {onDeleteOwn ? (
            <Pressable
              style={styles.action}
              onPress={onDeleteOwn}
              accessibilityRole="button"
              accessibilityLabel={t("watch.deleteOwn")}
            >
              <Text style={[styles.actionIcon, styles.deleteIcon]}>⌫</Text>
              <Text style={styles.actionCount} numberOfLines={1}>
                {t("actions.delete")}
              </Text>
            </Pressable>
          ) : null}
          {onReport ? (
            <Pressable
              style={styles.action}
              onPress={onReport}
              accessibilityRole="button"
              accessibilityLabel={t("watch.reportVideo")}
            >
              <Text style={styles.actionIcon}>⚑</Text>
              <Text style={styles.actionCount} numberOfLines={1}>
                {t("actions.report")}
              </Text>
            </Pressable>
          ) : null}
          {onBlockUser ? (
            <Pressable
              style={styles.action}
              onPress={onBlockUser}
              accessibilityRole="button"
              accessibilityLabel={t("watch.blockAccount")}
            >
              <Text style={styles.actionIcon}>⊘</Text>
              <Text style={styles.actionCount} numberOfLines={1}>
                {t("actions.block")}
              </Text>
            </Pressable>
          ) : null}
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
          <View
            style={[
              styles.timelineTimes,
              { paddingRight: WATCH_TIMELINE_TRAILING_GUTTER },
            ]}
          >
            <Text style={styles.timeText}>
              {formatPlaybackClock(timeline.currentTime)}
            </Text>
            <Text style={styles.timeText}>
              {formatPlaybackClock(timeline.duration)}
            </Text>
          </View>
          <ScrubBar
            ratio={isActive ? timeline.ratio : 0}
            accessibilityLabel={t("watch.seek")}
            onSeekRatio={onSeekRatio}
            onGestureActiveChange={onScrubActive}
            tall
          />
        </View>
      </View>
      {paneStatus === "error" ? (
        <View
          style={styles.retryOverlay}
          accessibilityRole="alert"
          pointerEvents="auto"
          testID="watch-retry-overlay"
        >
          <Text style={styles.errorText}>
            {paneError ?? t("watch.playbackFailed")}
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => void onRetryPlayback()}
            disabled={retrying || !isActive}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("watch.retryPlayback")}
            accessibilityState={{ busy: retrying, disabled: retrying || !isActive }}
            testID="watch-retry-playback"
          >
            <Text style={styles.retryText}>
              {retrying ? t("status.retrying") : t("actions.retry")}
            </Text>
          </Pressable>
        </View>
      ) : null}
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
  retryOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    elevation: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,5,16,0.45)",
    paddingHorizontal: 24,
    gap: 12,
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
  publishedAt: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  soundChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    minHeight: 32,
    justifyContent: "center",
  },
  soundChipText: {
    color: colors.accentCyan,
    fontSize: 13,
    fontWeight: "700",
  },
  rail: {
    position: "absolute",
    right: 12,
    alignItems: "center",
    gap: WATCH_RAIL_GAP,
    zIndex: 5,
    elevation: 6,
  },
  action: {
    alignItems: "center",
    minWidth: 44,
    minHeight: WATCH_RAIL_ACTION_MIN_HEIGHT,
    justifyContent: "center",
  },
  actionIcon: {
    color: colors.text,
    fontSize: 28,
  },
  disabledIcon: {
    opacity: 0.45,
  },
  deleteIcon: {
    color: colors.danger,
  },
  on: {
    color: colors.accentViolet,
  },
  liked: {
    color: colors.danger,
  },
  unliked: {
    color: colors.text,
  },
  actionCount: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
    maxWidth: WATCH_RAIL_ACTION_LABEL_MAX_WIDTH,
    textAlign: "center",
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
    minHeight: 36,
    paddingVertical: 12,
  },
  scrubHitTall: {
    minHeight: 48,
    paddingVertical: 14,
  },
  scrubTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "visible",
    justifyContent: "center",
    direction: WATCH_SCRUB_LAYOUT_DIRECTION,
  },
  scrubFill: {
    position: "absolute",
    left: 0,
    height: 5,
    borderRadius: 999,
  },
  scrubThumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: colors.text,
    borderWidth: 1,
    borderColor: colors.accentCyan,
  },
  scrubThumbTall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
});
