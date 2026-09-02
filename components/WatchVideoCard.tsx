import { useEventListener } from "expo";
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
import { SelectedSoundPlayer } from "@/components/sounds/SelectedSoundPlayer";
import { WatchCaption } from "@/components/WatchCaption";
import { WatchQuickActions } from "@/components/WatchQuickActions";
import { WatchSideVolumeControl } from "@/components/WatchSideVolumeControl";
import type { WatchVideo } from "@/src/contracts/watch";
import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  localeTextAlign,
  localeWritingDirection,
  useTranslation,
} from "@/src/lib/i18n";
import {
  resolveSelectedSoundWatchAudio,
  resolveSocialSoundPlaybackUriById,
} from "@/src/lib/sounds/socialSoundPlayback";
import { getSupabase } from "@/src/lib/supabase/client";
import { formatPublishedAt } from "@/src/lib/time/publishedAt";
import {
  resolveWatchTrimBounds,
  shouldEndAtTrim,
  shouldSeekToTrimStart,
  watchAddedSoundScale,
  watchEditAudioScale,
  watchEditFromPipeline,
} from "@/src/lib/video/watchEditPlayback";
import {
  isLocalWatchPlaybackUri,
  shouldMountWatchPlayer,
} from "@/src/lib/feed/videoStoragePath";
import {
  canSeekWithDuration,
  formatPlaybackClock,
  isLikelyExpiredPlaybackUrl,
  resolveEffectiveAudio,
  resolveProgressRatio,
  resolveScrubRatioFromPageX,
  resolveSeekTimeOrNull,
  sanitizePlaybackError,
  scrubFillWidthPercent,
  scrubThumbLeftPercent,
  shouldAttachWatchSurface,
  WATCH_SCRUB_LAYOUT_DIRECTION,
  shouldLoopCurrentVideo,
  shouldPlayVideo,
  shouldExposeWatchScrub,
  shouldPlayWithUserPause,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import {
  isWatchCellBindingAligned,
  resolveWatchBoundCellSource,
  watchMediaIdentity,
} from "@/src/lib/watch/watchCellBinding";
import {
  markWatchCellBind,
  markWatchTransition,
} from "@/src/lib/watch/watchTransitionTrace";
import { resolveAndroidWatchBufferOptions } from "@/src/lib/watch/androidWatchMediaCache";
import {
  shouldApplyWatchPlayerOp,
  shouldHonorLatePlayerEvent,
  shouldTeardownUnexpectedPlay,
} from "@/src/lib/watch/activePlayerOwnership";
import {
  applyWatchInactiveTeardown,
  nextPlayerInstanceGeneration,
  releaseWatchPlayerBinding,
  resolveNativePlayerStatusCatchup,
  resolveGatedWatchPlaybackIntent,
  resolveRetryTargetPostId,
  resolveWatchNativePlatform,
  shouldApplyWatchTransport,
  shouldHonorWatchStatusEvent,
  shouldMountSelectedSoundPlayer,
  shouldUnmuteWatchAfterFirstFrame,
} from "@/src/lib/watch/playerLifecycle";
import {
  applyInactiveAudioTeardown,
  applyPlaybackIntent,
  applySeekTime,
  isPlayerAlive,
  runAlivePlayerOp,
} from "@/src/lib/watch/playerSession";
import {
  WATCH_HEADER_RAIL_RESERVED,
  WATCH_RAIL_ACTION_LABEL_MAX_WIDTH,
  WATCH_RAIL_ACTION_MIN_HEIGHT,
  WATCH_RAIL_COMPACT_GAP,
  WATCH_RAIL_GAP,
  WATCH_TIMELINE_TRAILING_GUTTER,
  WATCH_VOLUME_RIGHT_CLEARANCE,
  watchRailBottomOffset,
  watchRailShouldCompact,
} from "@/src/lib/watch/railLayout";
import { WATCH_VIDEO_CONTENT_FIT } from "@/src/lib/watch/watchVideoFit";
import {
  WATCH_LIKE_ACK_MS,
  WATCH_LONG_PRESS_MS,
  createWatchTapClassifier,
  shouldCancelWatchTapsOnLongPress,
  shouldDispatchWatchVideoTap,
  shouldMountWatchVideoTapLayer,
  shouldOpenWatchQuickActions,
} from "@/src/lib/watch/watchGestures";
import {
  DEFAULT_WATCH_PLAYBACK_SPEED,
  resolveWatchPlaybackSpeed,
  resolveWatchQuickActions,
  shouldApplyWatchPlaybackSpeed,
  type WatchPlaybackSpeed,
} from "@/src/lib/watch/watchQuickActions";
import {
  WATCH_FOLLOW_CHIP_MIN_HEIGHT,
  shouldShowWatchFollowChip,
  watchFollowChipState,
} from "@/src/lib/watch/watchCaption";
import { watchPrefersReducedMotion } from "@/src/lib/watch/watchReduceMotion";
import { colors } from "@/src/theme/colors";

const PLAY_PAUSE_FEEDBACK_MS = 700;
const TIME_UPDATE_INTERVAL_SEC = 0.25;
const SCRUB_CATCHUP_EPSILON = 0.02;

export type WatchVideoCardProps = {
  video: WatchVideo;
  listIndex?: number;
  isActive: boolean;
  /** Mount native player only for the platform load window (iOS ±1, Android active). */
  shouldLoadPlayer: boolean;
  /** Android previous+current+next prepare. Defaults to shouldLoadPlayer (iOS unchanged). */
  shouldPreparePlayer?: boolean;
  /** Android: this cell is activeIndex + 1. Attach TextureView once READY. */
  isNextItem?: boolean;
  /** Android: attach next TextureView off-screen once READY and current is near end. */
  warmNextSurface?: boolean;
  onHandoffState?: (state: { ready: boolean; firstFrame: boolean }) => void;
  onRemainingMs?: (remainingMs: number | null) => void;
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
  /** Double-tap Like only. Must never unlike. */
  onEnsureLike?: () => void;
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
  playbackRate?: WatchPlaybackSpeed;
  onPlaybackRateChange?: (rate: WatchPlaybackSpeed) => void;
  following?: boolean;
  onEnsureFollow?: () => void;
  onNotInterested?: () => void;
  onHashtagPress?: (tag: string) => void;
  onMentionPress?: (username: string) => void;
  onOpenSound?: (soundId: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Feed cell height. Compact rail only when the full stack does not fit. */
  cellHeight?: number;
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
  loadPlayer: boolean;
  preparePlayer: boolean;
  isNextItem: boolean;
  warmNextSurface: boolean;
  mediaId: string;
  postId: number | null;
  playerEpoch: number;
  listIndex: number;
  ownershipGeneration: number;
  muted: boolean;
  volume: number;
  loop: boolean;
  seekRequest: { token: number; ratio: number } | null;
  playbackRate: WatchPlaybackSpeed;
  onTimeline: (state: TimelineState) => void;
  onEnded?: () => void;
  onFirstFrame?: () => void;
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
  loadPlayer,
  preparePlayer,
  isNextItem,
  warmNextSurface,
  mediaId,
  postId,
  playerEpoch,
  listIndex,
  ownershipGeneration,
  muted,
  volume,
  loop,
  seekRequest,
  playbackRate,
  onTimeline,
  onEnded,
  onFirstFrame,
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
  const nativeStatusRef = useRef<string | null>(null);
  const attachSurfaceRef = useRef(false);
  const mediaIdRef = useRef(mediaId);
  const postIdRef = useRef(postId);
  const playerEpochRef = useRef(playerEpoch);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  const loopRef = useRef(loop);
  const firstFrameRef = useRef(false);
  isActiveRef.current = isActive;
  shouldPlayRef.current = shouldPlay;
  ownershipGenerationRef.current = ownershipGeneration;
  mediaIdRef.current = mediaId;
  postIdRef.current = postId;
  playerEpochRef.current = playerEpoch;
  mutedRef.current = muted;
  volumeRef.current = volume;
  loopRef.current = loop;

  useEffect(() => {
    onPlayerStatus?.(status, errorMessage);
  }, [errorMessage, onPlayerStatus, status]);

  const playerSource = useMemo(
    () =>
      nativePlatform === "android"
        ? { uri: src, useCaching: !isLocalWatchPlaybackUri(src) }
        : src,
    [nativePlatform, src]
  );
  const player = useVideoPlayer(playerSource, (p) => {
    // New SharedObject starts silent. Ownership effect unmutes only the active post.
    p.loop = false;
    p.muted = true;
    p.volume = 0;
    p.audioMixingMode = "mixWithOthers";
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.keepScreenOnWhilePlaying = true;
    p.timeUpdateEventInterval = TIME_UPDATE_INTERVAL_SEC;
    const buffers = resolveAndroidWatchBufferOptions(nativePlatform);
    if (buffers) {
      p.bufferOptions = buffers;
    }
  });
  const boundPlayerRef = useRef<typeof player | null>(null);

  const canTouchBoundPlayer = () =>
    playerAliveRef.current &&
    boundPlayerRef.current === player &&
    isPlayerAlive(player);

  useEventListener(player, "statusChange", ({ status: next, error }) => {
    nativeStatusRef.current = next;
    if (!canTouchBoundPlayer()) return;
    if (next === "loading") {
      setStatus("loading");
      setErrorMessage(null);
      return;
    }
    if (next === "readyToPlay") {
      setStatus("ready");
      statusRef.current = "ready";
      setErrorMessage(null);
      if (
        !shouldHonorWatchStatusEvent({
          playerAlive: true,
          bound: true,
          eventMediaId: mediaIdRef.current,
          boundMediaId: mediaId,
          eventPostId: postIdRef.current,
          boundPostId: postId,
          eventEpoch: playerEpochRef.current,
          boundEpoch: playerEpoch,
        })
      ) {
        playGenerationRef.current = null;
        applyInactiveAudioTeardown(player, { resetPosition: false });
        return;
      }
      const intent = resolveGatedWatchPlaybackIntent({
        nativeReady: true,
        jsReady: true,
        isActive: isActiveRef.current,
        shouldPlay: shouldPlayRef.current,
        playerAlive: true,
        ownerGeneration: ownershipGenerationRef.current,
        commandGeneration: ownershipGenerationRef.current,
        surfaceAttached: attachSurfaceRef.current,
        playerMediaId: mediaIdRef.current,
        visibleMediaId: mediaId,
        playerEpoch: playerEpochRef.current,
        visibleEpoch: playerEpoch,
        playerPostId: postIdRef.current,
        visiblePostId: postId,
        platform: nativePlatform,
        firstFrameConfirmed: firstFrameRef.current,
        muted,
        volume,
        loop,
      });
      if (intent) {
        playGenerationRef.current = ownershipGenerationRef.current;
        applyPlaybackIntent(player, intent);
        runAlivePlayerOp(player, (alive) => {
          alive.playbackRate = shouldApplyWatchPlaybackSpeed(isActiveRef.current)
            ? playbackRate
            : DEFAULT_WATCH_PLAYBACK_SPEED;
        });
        if (!intent.muted && intent.volume > 0) {
          markWatchTransition(nativePlatform, "audio_start");
        }
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

  // Bind this SharedObject. Silence the previous instance before release so
  // leftover AVPlayer audio cannot mix into the next item (Build 24).
  useLayoutEffect(() => {
    if (boundPlayerRef.current && boundPlayerRef.current !== player) {
      releaseWatchPlayerBinding({
        player: boundPlayerRef.current,
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
    nativeStatusRef.current = null;
    statusRef.current = "loading";
    setStatus("loading");
    setErrorMessage(null);
    let nativeStatus: string | null = nativeStatusRef.current;
    try {
      if (typeof player.status === "string") {
        nativeStatus = player.status;
        nativeStatusRef.current = nativeStatus;
      }
    } catch {
      nativeStatus = nativeStatusRef.current;
    }
    const caught = resolveNativePlayerStatusCatchup({
      bound: true,
      nativeStatus,
      jsStatus: statusRef.current,
    });
    if (caught && caught !== statusRef.current) {
      setStatus(caught);
      if (caught !== "error") {
        setErrorMessage(null);
      }
    }
    return () => {
      releaseWatchPlayerBinding({
        player,
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

  const attachSurface = shouldAttachWatchSurface({
    loadPlayer,
    preparePlayer,
    itemReady: status === "ready" || nativeStatusRef.current === "readyToPlay",
    warmNextSurface,
    isNextItem,
    platform: nativePlatform,
  });
  attachSurfaceRef.current = attachSurface;

  useLayoutEffect(() => {
    if (!canTouchBoundPlayer()) return;
    const itemReady = status === "ready";
    const nativeReady = nativeStatusRef.current === "readyToPlay";
    if (!isActive || !shouldPlay) {
      applyWatchInactiveTeardown(player, {
        platform: nativePlatform,
        itemReady,
      });
      playGenerationRef.current = null;
      if (!isActive) {
        onTimeline({ currentTime: 0, duration: 0, ratio: 0 });
      }
      return;
    }
    if (
      !shouldApplyWatchTransport({
        playerAlive: true,
        itemReady: itemReady || nativeReady,
        kind: "play",
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
    const intent = resolveGatedWatchPlaybackIntent({
      nativeReady,
      jsReady: itemReady,
      isActive,
      shouldPlay,
      playerAlive: true,
      ownerGeneration: ownershipGeneration,
      commandGeneration: ownershipGeneration,
      surfaceAttached: attachSurface,
      playerMediaId: mediaId,
      visibleMediaId: mediaId,
      playerEpoch,
      visibleEpoch: playerEpoch,
      playerPostId: postId,
      visiblePostId: postId,
      platform: nativePlatform,
      firstFrameConfirmed: firstFrameRef.current,
      muted,
      volume,
      loop,
    });
    if (
      intent &&
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
      applyPlaybackIntent(player, intent);
      runAlivePlayerOp(player, (alive) => {
        alive.playbackRate = shouldApplyWatchPlaybackSpeed(isActive)
          ? playbackRate
          : DEFAULT_WATCH_PLAYBACK_SPEED;
      });
      if (isActive && !intent.muted && intent.volume > 0) {
        markWatchTransition(nativePlatform, "audio_start");
      }
      return;
    }
    playGenerationRef.current = null;
    applyWatchInactiveTeardown(player, {
      platform: nativePlatform,
      itemReady,
    });
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
    playbackRate,
    attachSurface,
    mediaId,
    playerEpoch,
    postId,
  ]);

  useEffect(() => {
    if (!canTouchBoundPlayer()) return;
    runAlivePlayerOp(player, (alive) => {
      alive.playbackRate = shouldApplyWatchPlaybackSpeed(isActive)
        ? playbackRate
        : DEFAULT_WATCH_PLAYBACK_SPEED;
    });
  }, [isActive, playbackRate, player]);

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

  useEffect(() => {
    if (attachSurface) {
      markWatchTransition(nativePlatform, "surface_attached");
    }
    if (nativePlatform !== "android") return;
    const aligned = isWatchCellBindingAligned({
      visibleIndex: listIndex,
      visibleMediaId: mediaId,
      activeIndex: isActive ? listIndex : isNextItem ? listIndex - 1 : listIndex,
      activeMediaId: mediaId,
      playerMediaId: mediaId,
      surfaceMediaId: attachSurface ? mediaId : null,
    });
    markWatchCellBind("android", {
      visibleIndex: listIndex,
      visibleMediaId: mediaId,
      activeIndex: isActive ? listIndex : isNextItem ? listIndex - 1 : listIndex,
      activeMediaId: mediaId,
      playerMediaId: mediaId,
      surfaceAttached: attachSurface,
      aligned: isActive ? aligned && attachSurface : aligned,
    });
  }, [
    attachSurface,
    isActive,
    isNextItem,
    listIndex,
    mediaId,
    nativePlatform,
  ]);

  useEffect(() => {
    if (status === "ready") {
      markWatchTransition(nativePlatform, "next_ready");
    }
  }, [nativePlatform, status]);

  useEffect(() => {
    firstFrameRef.current = false;
  }, [player, mediaId, playerEpoch]);

  const onRenderedFirstFrame = useCallback(() => {
    firstFrameRef.current = true;
    markWatchTransition(nativePlatform, "first_frame");
    if (
      canTouchBoundPlayer() &&
      shouldUnmuteWatchAfterFirstFrame({
        firstFrameConfirmed: true,
        isActive: isActiveRef.current,
        shouldPlay: shouldPlayRef.current,
        userMuted: mutedRef.current,
        surfaceAttached: attachSurfaceRef.current,
        playerMediaId: mediaIdRef.current,
        visibleMediaId: mediaId,
      })
    ) {
      runAlivePlayerOp(player, (alive) => {
        alive.muted = false;
        alive.volume = volumeRef.current;
      });
      markWatchTransition(nativePlatform, "audio_start");
    }
    onFirstFrame?.();
  }, [mediaId, nativePlatform, onFirstFrame, player]);

  return (
    <View
      style={styles.playerWrap}
      importantForAccessibility="no-hide-descendants"
    >
      {attachSurface ? (
        <VideoView
          style={styles.video}
          player={player}
          contentFit={WATCH_VIDEO_CONTENT_FIT}
          nativeControls={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onFirstFrameRender={onRenderedFirstFrame}
        />
      ) : null}

      {attachSurface && status === "loading" && (
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
  listIndex,
  isActive,
  shouldLoadPlayer: loadPlayer,
  shouldPreparePlayer: preparePlayer = loadPlayer,
  isNextItem = false,
  warmNextSurface = false,
  onHandoffState,
  onRemainingMs,
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
  onEnsureLike,
  onToggleSave,
  onOpenComments,
  onShare,
  onDeleteOwn,
  onReport,
  onBlockUser,
  onOpenProfile,
  onRefreshSrc,
  playbackRate = DEFAULT_WATCH_PLAYBACK_SPEED,
  onPlaybackRateChange,
  following = false,
  onEnsureFollow,
  onNotInterested,
  onHashtagPress,
  onMentionPress,
  onOpenSound,
  style,
  cellHeight,
  topInset = 0,
  bottomInset = 0,
}: WatchVideoCardProps) {
  const { t, locale } = useTranslation();
  const captionAlign = localeTextAlign(locale);
  const captionDirection = localeWritingDirection(locale);
  const followState = watchFollowChipState(following);
  const { user } = useAuth();
  const railActionCount =
    4 +
    (onDeleteOwn ? 1 : 0) +
    (onReport ? 1 : 0) +
    (onBlockUser ? 1 : 0);
  const compactRail =
    cellHeight != null &&
    watchRailShouldCompact({
      cellHeight,
      actionCount: railActionCount,
      bottomInset,
      topReserved: Math.max(WATCH_HEADER_RAIL_RESERVED, topInset),
    });
  const railGap = compactRail ? WATCH_RAIL_COMPACT_GAP : WATCH_RAIL_GAP;
  const showFollow = shouldShowWatchFollowChip({
    viewerId: user?.id,
    authorId: video.author.id,
  });
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 });
  const [selectedSoundUri, setSelectedSoundUri] = useState<string | null>(null);
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
  const [likeAck, setLikeAck] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeAckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapClassifierRef = useRef(createWatchTapClassifier());
  const seekTokenRef = useRef(0);
  const scrubTargetRatioRef = useRef<number | null>(null);
  const [playerEpoch, setPlayerEpoch] = useState(0);
  const mediaId = watchMediaIdentity(video);
  const [boundMediaId, setBoundMediaId] = useState(mediaId);
  const [epochSrc, setEpochSrc] = useState(video.src);
  const boundSource = resolveWatchBoundCellSource({
    cellMediaId: mediaId,
    cellSrc: video.src,
    playerMediaId: boundMediaId,
    playerSrc: epochSrc,
  });
  if (boundSource.mustReplace) {
    setBoundMediaId(boundSource.mediaId);
    setEpochSrc(boundSource.src);
    setPlayerEpoch((prev) => nextPlayerInstanceGeneration(prev));
  }
  const boundSrc = boundSource.src;
  const boundEpoch = boundSource.mustReplace
    ? nextPlayerInstanceGeneration(playerEpoch)
    : playerEpoch;
  const [paneStatus, setPaneStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [paneError, setPaneError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retryInFlightRef = useRef(false);
  const expiredRefreshAttemptedRef = useRef(false);
  const mountPlayer = shouldMountWatchPlayer({
    shouldLoadPlayer: loadPlayer || preparePlayer,
    src: boundSrc,
  });

  useEffect(() => {
    expiredRefreshAttemptedRef.current = false;
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
  const addedSoundScale = watchAddedSoundScale(edit);
  const selectedSoundAudio = resolveSelectedSoundWatchAudio({
    isActive,
    shouldPlay,
    watchMuted: muted,
    watchVolume: volume,
    addedSoundVolume: addedSoundScale,
  });

  useEffect(() => {
    let cancelled = false;
    const soundId = edit.soundId;
    if (!soundId || !loadPlayer) {
      setSelectedSoundUri(null);
      return;
    }
    void resolveSocialSoundPlaybackUriById(
      getSupabase(),
      soundId,
      user?.id ?? null
    ).then((uri) => {
      if (!cancelled) setSelectedSoundUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [edit.soundId, loadPlayer, user?.id]);

  useEffect(() => {
    if (!isActive) {
      tapClassifierRef.current.cancel();
      setUserPaused(false);
      setFeedback(null);
      setLikeAck(false);
      setQuickActionsOpen(false);
      setTimeline({ currentTime: 0, duration: 0, ratio: 0 });
      setSeekRequest(null);
      trimEndedRef.current = false;
    }
  }, [isActive]);

  useEffect(() => {
    trimEndedRef.current = false;
  }, [video.id]);

  useEffect(() => {
    const classifier = tapClassifierRef.current;
    return () => {
      classifier.cancel();
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
      if (likeAckTimer.current) {
        clearTimeout(likeAckTimer.current);
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

  const firstFrameRef = useRef(false);
  const onHandoffStateRef = useRef(onHandoffState);
  onHandoffStateRef.current = onHandoffState;
  const onRemainingMsRef = useRef(onRemainingMs);
  onRemainingMsRef.current = onRemainingMs;

  useEffect(() => {
    firstFrameRef.current = false;
  }, [playerEpoch, video.id]);

  useEffect(() => {
    onHandoffStateRef.current?.({
      ready: paneStatus === "ready",
      firstFrame: firstFrameRef.current,
    });
  }, [paneStatus]);

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

  useEffect(() => {
    if (!isActive || paneStatus !== "error") return;
    if (expiredRefreshAttemptedRef.current) return;
    if (!isLikelyExpiredPlaybackUrl(paneError)) return;
    expiredRefreshAttemptedRef.current = true;
    void onRetryPlayback();
  }, [isActive, onRetryPlayback, paneError, paneStatus]);

  const onTogglePlayPause = useCallback(() => {
    if (paneStatus === "error") return;
    if (!isActive || !feedShouldPlay) return;
    setUserPaused((paused) => {
      const next = !paused;
      showFeedback(next ? "pause" : "play");
      return next;
    });
  }, [feedShouldPlay, isActive, paneStatus, showFeedback]);

  const showLikeAck = useCallback(() => {
    if (watchPrefersReducedMotion()) return;
    setLikeAck(true);
    if (likeAckTimer.current) {
      clearTimeout(likeAckTimer.current);
    }
    likeAckTimer.current = setTimeout(() => {
      setLikeAck(false);
      likeAckTimer.current = null;
    }, WATCH_LIKE_ACK_MS);
  }, []);

  const onVideoAreaTap = useCallback(() => {
    if (quickActionsOpen) return;
    if (!shouldDispatchWatchVideoTap("video")) return;
    if (!shouldMountWatchVideoTapLayer({ paneStatus })) return;
    tapClassifierRef.current.tap({
      onSingle: onTogglePlayPause,
      onDouble: () => {
        showLikeAck();
        onEnsureLike?.();
      },
    });
  }, [onEnsureLike, onTogglePlayPause, paneStatus, quickActionsOpen, showLikeAck]);

  const onVideoAreaLongPress = useCallback(() => {
    if (!shouldOpenWatchQuickActions("video")) return;
    if (!shouldMountWatchVideoTapLayer({ paneStatus })) return;
    if (shouldCancelWatchTapsOnLongPress()) {
      tapClassifierRef.current.cancel();
    }
    setQuickActionsOpen(true);
  }, [paneStatus]);

  const onTimeline = useCallback((state: TimelineState) => {
    if (isActive && state.duration > 0) {
      onRemainingMsRef.current?.(
        Math.max(0, (state.duration - state.currentTime) * 1000)
      );
    }
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
  }, [edit, isActive, loop, onEnded, video.durationMs]);

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
      {mountPlayer ? (
        <WatchPlayerPane
          key={`watch-player-${mediaId}-${boundEpoch}`}
          src={boundSrc}
          mediaId={mediaId}
          postId={video.postId ?? null}
          playerEpoch={boundEpoch}
          listIndex={listIndex ?? -1}
          isActive={isActive}
          shouldPlay={shouldPlay}
          loadPlayer={loadPlayer}
          preparePlayer={preparePlayer}
          isNextItem={isNextItem}
          warmNextSurface={warmNextSurface}
          ownershipGeneration={ownershipGeneration}
          muted={audio.muted}
          volume={audio.volume}
          loop={loop}
          seekRequest={isActive ? seekRequest : null}
          playbackRate={playbackRate}
          onTimeline={onTimeline}
          onEnded={onEnded}
          onFirstFrame={() => {
            firstFrameRef.current = true;
            onHandoffState?.({
              ready: paneStatus === "ready",
              firstFrame: true,
            });
          }}
          onPlayerStatus={onPlayerStatus}
        />
      ) : (
        <View style={styles.placeholder} accessibilityElementsHidden>
          {loadPlayer ? (
            <View style={styles.centerOverlay} pointerEvents="none">
              <ActivityIndicator
                color={colors.accentCyan}
                accessibilityLabel={t("watch.loadingVideo")}
              />
            </View>
          ) : (
            <View />
          )}
        </View>
      )}

      {selectedSoundUri &&
      shouldMountSelectedSoundPlayer({
        isActive,
        shouldLoadPlayer: loadPlayer,
        uri: selectedSoundUri,
      }) ? (
        <SelectedSoundPlayer
          uri={selectedSoundUri}
          shouldPlay={selectedSoundAudio.shouldPlay}
          muted={selectedSoundAudio.muted}
          volume={selectedSoundAudio.volume}
          loop={loop}
          startOffsetMs={edit.mix.soundStartOffsetMs}
        />
      ) : null}

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
        {shouldMountWatchVideoTapLayer({ paneStatus }) ? (
          <Pressable
            style={[styles.tapLayer, { right: WATCH_VOLUME_RIGHT_CLEARANCE }]}
            onPress={onVideoAreaTap}
            onLongPress={onVideoAreaLongPress}
            delayLongPress={WATCH_LONG_PRESS_MS}
            accessible={false}
            importantForAccessibility="no"
          />
        ) : null}

        {likeAck ? (
          <View
            style={styles.likeAck}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            accessibilityLabel={t("watch.likeConfirmed")}
            testID="watch-like-ack"
          >
            <View style={styles.likeAckRing} />
            <View style={styles.likeAckCore} />
          </View>
        ) : null}

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
            <Text
              style={[
                styles.username,
                { textAlign: captionAlign, writingDirection: captionDirection },
              ]}
              numberOfLines={1}
            >
              {video.author.username}
            </Text>
          </Pressable>
          {showFollow && onEnsureFollow ? (
            <Pressable
              onPress={followState.disabled ? undefined : onEnsureFollow}
              disabled={followState.disabled}
              accessibilityRole="button"
              accessibilityLabel={
                followState.kind === "following"
                  ? t("follow.following")
                  : t("follow.follow")
              }
              accessibilityState={{
                selected: followState.selected,
                disabled: followState.disabled,
              }}
              style={[
                styles.followChip,
                followState.kind === "following" && styles.followChipOn,
              ]}
            >
              <Text
                style={[
                  styles.followChipText,
                  followState.kind === "following" && styles.followChipTextOn,
                ]}
              >
                {followState.kind === "following"
                  ? t("follow.following")
                  : t("follow.follow")}
              </Text>
            </Pressable>
          ) : null}
          <WatchCaption
            caption={video.caption}
            title={video.title}
            resetKey={video.id}
            onHashtagPress={onHashtagPress}
            onMentionPress={onMentionPress}
          />
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
              onPress={() => onOpenSound?.(edit.soundId as string)}
              disabled={!onOpenSound}
              accessibilityRole="button"
              accessibilityLabel={t("sound.original")}
              accessibilityState={{ disabled: !onOpenSound }}
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
          style={[
            styles.rail,
            { bottom: watchRailBottomOffset(bottomInset), gap: railGap },
          ]}
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
            {compactRail ? null : (
              <Text style={styles.actionCount} numberOfLines={1}>
                {video.stats.likes}
              </Text>
            )}
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
            {compactRail ? null : (
              <Text style={styles.actionCount} numberOfLines={1}>
                {video.stats.saves}
              </Text>
            )}
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
            {compactRail ? null : (
              <Text style={styles.actionCount} numberOfLines={1}>
                {video.stats.comments}
              </Text>
            )}
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
            {compactRail ? null : (
              <Text style={styles.actionCount} numberOfLines={1}>
                {video.stats.shares}
              </Text>
            )}
          </Pressable>
          {onDeleteOwn ? (
            <Pressable
              style={styles.action}
              onPress={onDeleteOwn}
              accessibilityRole="button"
              accessibilityLabel={t("watch.deleteOwn")}
            >
              <Text style={[styles.actionIcon, styles.deleteIcon]}>⌫</Text>
              {compactRail ? null : (
                <Text style={styles.actionCount} numberOfLines={1}>
                  {t("actions.delete")}
                </Text>
              )}
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
              {compactRail ? null : (
                <Text style={styles.actionCount} numberOfLines={1}>
                  {t("actions.report")}
                </Text>
              )}
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
              {compactRail ? null : (
                <Text style={styles.actionCount} numberOfLines={1}>
                  {t("actions.block")}
                </Text>
              )}
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
          {shouldExposeWatchScrub(timeline.duration) ? (
            <ScrubBar
              ratio={isActive ? timeline.ratio : 0}
              accessibilityLabel={t("watch.seek")}
              onSeekRatio={onSeekRatio}
              onGestureActiveChange={onScrubActive}
              tall
            />
          ) : (
            <View
              style={styles.shortProgress}
              pointerEvents="none"
              accessibilityElementsHidden
            />
          )}
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
      {captionsOn && (video.caption || video.title) ? (
        <View style={styles.captionOverlay} pointerEvents="none">
          <Text
            style={[
              styles.captionOverlayText,
              { textAlign: captionAlign, writingDirection: captionDirection },
            ]}
          >
            {video.caption || video.title}
          </Text>
        </View>
      ) : null}
      <WatchQuickActions
        visible={quickActionsOpen && isActive}
        actions={resolveWatchQuickActions({
          canShare: Boolean(onShare),
          canReport: Boolean(onReport),
          canFollow: showFollow && Boolean(onEnsureFollow),
        })}
        saved={video.savedByMe === true}
        following={following}
        canFollow={showFollow && Boolean(onEnsureFollow)}
        speed={resolveWatchPlaybackSpeed(playbackRate)}
        captionsOn={captionsOn}
        onClose={() => setQuickActionsOpen(false)}
        onSave={() => {
          setQuickActionsOpen(false);
          onToggleSave();
        }}
        onNotInterested={() => {
          setQuickActionsOpen(false);
          onNotInterested?.();
        }}
        onSpeed={(next) => {
          onPlaybackRateChange?.(next);
        }}
        onCaptions={() => setCaptionsOn((prev) => !prev)}
        onReport={
          onReport
            ? () => {
                setQuickActionsOpen(false);
                onReport();
              }
            : undefined
        }
        onShare={
          onShare
            ? () => {
                setQuickActionsOpen(false);
                onShare();
              }
            : undefined
        }
        onFollow={
          onEnsureFollow
            ? () => {
                setQuickActionsOpen(false);
                onEnsureFollow();
              }
            : undefined
        }
      />
    </View>
  );
}

export const WatchVideoCard = memo(WatchVideoCardComponent);

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.bg,
    overflow: "hidden",
    flexGrow: 0,
    flexShrink: 0,
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
  likeAck: {
    position: "absolute",
    alignSelf: "center",
    top: "38%",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  likeAckRing: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.accentCyan,
    opacity: 0.85,
  },
  likeAckCore: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.accentCyan,
    transform: [{ rotate: "45deg" }],
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
  followChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    minHeight: WATCH_FOLLOW_CHIP_MIN_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accentCyan,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  followChipOn: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  followChipText: {
    color: colors.accentCyan,
    fontSize: 13,
    fontWeight: "700",
  },
  followChipTextOn: {
    color: colors.textMuted,
  },
  captionOverlay: {
    position: "absolute",
    left: 16,
    right: 88,
    bottom: 118,
    backgroundColor: "rgba(5,5,16,0.72)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  captionOverlayText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  shortProgress: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
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
