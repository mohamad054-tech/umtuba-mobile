import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommentsSheet } from "@/components/CommentsSheet";
import { WatchShareSheet } from "@/components/WatchShareSheet";
import { IdentityHeader } from "@/components/IdentityHeader";
import { WatchVideoCard } from "@/components/WatchVideoCard";
import type { WatchFeedCursor, WatchVideo } from "@/src/contracts/watch";
import { getErrorMessage } from "@/src/contracts/validation";
import { REPORT_REASON_KEYS, useTranslation } from "@/src/lib/i18n";
import { isLocalWatchPlaybackUri } from "@/src/lib/feed/videoStoragePath";
import {
  prepareWatchPlaybackUrls,
  shouldApplyResolvedWatchSrc,
} from "@/src/lib/feed/watchPlaybackPrep";
import {
  fetchWatchFeedPage,
  refreshPlaybackUrl,
} from "@/src/lib/feed/watchFeed";
import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  registerMountedWatchInstance,
  rememberProfileBackContext,
  unregisterMountedWatchInstance,
} from "@/src/lib/nav/profileBackContext";
import { buildWatchSoundHref } from "@/src/lib/nav/watchSoundOrigin";
import { parseProfileUserId } from "@/src/lib/profile/resolveTarget";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";
import {
  applySuccessfulDeleteToList,
  deletePostForOwner,
  viewerMaySeeDeleteControl,
} from "@/src/lib/social/deleteOwnedPost";
import {
  ensureProfileFollow,
  getProfileFollowSnapshot,
} from "@/src/lib/social/follows";
import {
  ensurePostLike,
  previewEnsureLike,
  previewToggleLike,
  previewToggleSave,
  togglePostLike,
  togglePostSave,
} from "@/src/lib/social/interactions";
import {
  isWatchShareEntryEnabled,
  listWatchShareChoices,
  openWatchShareEntry,
} from "@/src/lib/social/shareEntry";
import {
  isWatchInPlaceOverlayOpen,
  isWatchShareSheetOpen,
  resolveWatchInPlaceOverlayClose,
  shouldMountWatchShareOverlay,
  type WatchShareSheetSnapshot,
} from "@/src/lib/social/watchShareSheet";
import {
  shareWatchPostFile,
  shareWatchPostLink,
  type ShareAttempt,
  type WatchShareMode,
} from "@/src/lib/social/sharePost";
import {
  blockUserLocally,
  filterWatchItemsForViewer,
  hidePostLocally,
  loadBlockedUsers,
  loadHiddenPostIds,
  reportWatchPost,
  reportWatchUser,
  UGC_REPORT_REASONS,
  viewerMaySeeBlockControl,
  viewerMaySeeReportControl,
  type UgcReportReason,
} from "@/src/lib/social/ugcModeration";
import { getSupabase } from "@/src/lib/supabase/client";
import {
  DEFAULT_WATCH_AUTO_NEXT,
  DEFAULT_WATCH_MUTED,
  DEFAULT_WATCH_VOLUME,
  loadWatchAutoNextPreference,
  loadWatchMutedPreference,
  loadWatchVolumePreference,
  mergeWatchVideos,
  quantizeWatchVolume,
  resolveNextWatchIndex,
  resolveWatchScrollOffset,
  saveWatchAutoNextPreference,
  saveWatchMutedPreference,
  saveWatchVolumePreference,
  resolveWatchHandoffReadiness,
  shouldPrepareWatchPlayer,
  shouldWarmAndroidNextSurface,
  toWatchListPixels,
  watchInteractionSignature,
  watchItemKey,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import {
  markWatchCache,
  markWatchCellBind,
  markWatchTransition,
} from "@/src/lib/watch/watchTransitionTrace";
import {
  ANDROID_WATCH_CACHE_TARGET,
  ensureAndroidWatchVideoCache,
  peekAndroidWatchCacheHits,
  resolveWatchMediaCachePort,
  syncAndroidWatchRollingCache,
} from "@/src/lib/watch/androidWatchMediaCache";
import {
  invalidateStaleWatchRetainedSources,
  resolveWatchStartupFeed,
} from "@/src/lib/watch/watchOfflineManifest";
import { watchMediaIdentity } from "@/src/lib/watch/watchCellBinding";
import {
  inspectLocalWatchPlaybackFile,
  isolatePrefetchFailureFromActiveCell,
  shouldApplyLocalWatchUriToVideo,
} from "@/src/lib/watch/watchRetainedPlaybackFallback";
import {
  preserveWatchPostAcrossLayoutSession,
  resolveFrozenWatchViewport,
  resolveWatchNativePage,
} from "@/src/lib/watch/watchViewport";
import {
  createWatchActiveIndexArbiter,
  decideWatchActiveIndexClaim,
  decideWatchViewabilityEvidence,
  shouldLoadOwnedWatchPlayer,
  type WatchActiveIndexDecision,
} from "@/src/lib/watch/watchActiveIndexArbiter";
import {
  armWatchFirstPagePin,
  armWatchForwardCommitLock,
  clearWatchFirstPagePin,
  createWatchFirstPagePinState,
  createWatchForwardCommitLock,
  hasFirstWatchReverseDragEvidence,
  hasGenuineReverseDragEvidence,
  reduceWatchHandoff,
  resolveAndroidManualSettleAction,
  resolveFirstWatchCommitNativePin,
  resolveForwardCommitNativeResyncOffset,
  resolveManualHandoffRetarget,
  resolveManualHandoffTarget,
  resolveProactivePrepareIndexes,
  resolveWatchFirstPagePinAlignment,
  resolveWatchHandoffIntentFromViewability,
  shouldApplyFirstWatchNativePin,
  shouldClaimWatchIndexFromNativeSettle,
  shouldIgnoreStaleManualSettle,
  shouldRejectFirstWatchIndexZeroIntent,
  shouldRejectLockedBackwardViewability,
  shouldResyncNativeAfterStaleSettle,
  shouldWarmManualTarget,
  createWatchHandoffMachine,
  type WatchHandoffEvent,
} from "@/src/lib/watch/watchManualHandoff";
import {
  previousRouteNameFromState,
} from "@/src/lib/nav/globalBack";
import {
  isWatchRootSurface,
  peekWatchEntryHref,
  resolveWatchExitNavigation,
  resolveWatchHeaderArrowNavigation,
  resolveWatchRootBack,
  shouldConsumeHardwareBack,
  shouldInterceptWatchRootBack,
} from "@/src/lib/nav/watchRootExit";
import { bumpWatchOwnerGeneration } from "@/src/lib/watch/activePlayerOwnership";
import {
  applyWatchHandoffAudioTransfer,
  bumpWatchLeaveGeneration,
  getRegisteredWatchPlayer,
  resetWatchHandoffAudibleOwner,
} from "@/src/lib/watch/playerLifecycle";
import { shouldEnableWatchPullToRefresh } from "@/src/lib/watch/watchGestures";
import { watchLightHaptic } from "@/src/lib/watch/watchHaptics";
import {
  DEFAULT_WATCH_PLAYBACK_SPEED,
  resetWatchPlaybackSpeedOnPageChange,
  resolveWatchPlaybackSpeed,
  type WatchPlaybackSpeed,
} from "@/src/lib/watch/watchQuickActions";
import { watchHeaderOverlayLayerStyle } from "@/src/lib/watch/watchHeaderOverlay";
import { colors } from "@/src/theme/colors";

const { height: RAW_WINDOW_HEIGHT } = Dimensions.get("window");
const WINDOW_HEIGHT =
  toWatchListPixels(RAW_WINDOW_HEIGHT) ??
  (Math.round(RAW_WINDOW_HEIGHT) || 1);
const PROGRAMMATIC_ADVANCE_LOCK_MS = 750;

function toLifecycleState(state: AppStateStatus): AppLifecycleState {
  if (state === "active" || state === "background" || state === "inactive") {
    return state;
  }
  return "unknown";
}

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const segments = useSegments();
  const { user } = useAuth();
  const { t } = useTranslation();
  const listRef = useRef<FlatList<WatchVideo>>(null);
  const params = useLocalSearchParams<{ post?: string }>();
  const focusPostId =
    typeof params.post === "string" && /^\d+$/.test(params.post)
      ? Number(params.post)
      : null;

  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [cursor, setCursor] = useState<WatchFeedCursor | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastSettledNativePage, setLastSettledNativePage] = useState<
    number | null
  >(null);
  const [playbackGeneration, setPlaybackGeneration] = useState(0);
  const [muted, setMuted] = useState(DEFAULT_WATCH_MUTED);
  const [volume, setVolume] = useState(DEFAULT_WATCH_VOLUME);
  const [autoNext, setAutoNext] = useState(DEFAULT_WATCH_AUTO_NEXT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [appState, setAppState] = useState<AppLifecycleState>(
    toLifecycleState(AppState.currentState)
  );
  const [itemHeight, setItemHeight] = useState(WINDOW_HEIGHT);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(
    () => new Set()
  );
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<number>>(
    () => new Set()
  );
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [shareSheet, setShareSheet] = useState<WatchShareSheetSnapshot | null>(
    null
  );
  const [preparingShare, setPreparingShare] = useState(false);
  const [exitHintVisible, setExitHintVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<WatchPlaybackSpeed>(
    DEFAULT_WATCH_PLAYBACK_SPEED
  );
  const [followByAuthor, setFollowByAuthor] = useState<Record<string, boolean>>(
    {}
  );

  const initialInFlight = useRef(false);
  const moreInFlight = useRef(false);
  const urlGenerationRef = useRef(0);
  const activeIndexRef = useRef(0);
  const playbackGenerationRef = useRef(0);
  const videosLengthRef = useRef(0);
  const itemHeightRef = useRef(WINDOW_HEIGHT);
  const scrollOffsetRef = useRef(0);
  const watchScrollInFlightRef = useRef(false);
  const arbiterRef = useRef(createWatchActiveIndexArbiter());
  const viewportFrozenRef = useRef<{
    height: number | null;
    width: number | null;
  }>({ height: null, width: null });
  const cacheSyncGenerationRef = useRef(0);
  const programmaticAdvanceUntilRef = useRef(0);
  const armedUntilMsRef = useRef<number | null>(null);
  const screenFocusedRef = useRef(true);
  const commentPostIdRef = useRef<number | null>(null);
  const shareSheetOpenRef = useRef(false);
  const exitHintVisibleRef = useRef(false);
  const remainingMsRef = useRef<number | null>(null);
  const currentEndedRef = useRef(false);
  const nextHandoffRef = useRef({
    index: -1,
    ready: false,
    firstFrame: false,
    surfaceAttached: false,
    mediaId: null as string | null,
  });
  const handoffGenRef = useRef(0);
  const [warmNextSurface, setWarmNextSurface] = useState(false);
  const [warmedTargetIndex, setWarmedTargetIndex] = useState<number | null>(
    null
  );
  const warmedTargetIndexRef = useRef<number | null>(null);
  const handoffMachineRef = useRef(createWatchHandoffMachine());
  const dragStartIndexRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const firstPinRef = useRef(createWatchFirstPagePinState());
  const forwardLockRef = useRef(createWatchForwardCommitLock());
  const reverseDragEvidenceRef = useRef(false);
  const manualDragActiveRef = useRef(false);
  const scrollToWatchIndexRef = useRef<
    (
      nextIndex: number,
      attempt?: number,
      options?: { animated?: boolean }
    ) => void
  >(() => {});

  const applyWarmedTargetIndex = useCallback((next: number | null) => {
    warmedTargetIndexRef.current = next;
    setWarmedTargetIndex((prev) => (prev === next ? prev : next));
  }, []);

  const applyWatchIndexDecision = useCallback(
    (decision: WatchActiveIndexDecision, surfaceReady = false) => {
      if (!decision.accept || decision.next.activeIndex == null) return;
      const nextIndex = decision.next.activeIndex;
      arbiterRef.current = decision.next;
      setLastSettledNativePage(decision.next.lastSettledNativePage);
      const nextGeneration = bumpWatchOwnerGeneration(
        playbackGenerationRef.current,
        activeIndexRef.current,
        nextIndex
      );
      if (nextGeneration !== playbackGenerationRef.current) {
        playbackGenerationRef.current = nextGeneration;
        setPlaybackGeneration(nextGeneration);
      }
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      const nextVideo = visibleVideosRef.current[nextIndex];
      if (nextVideo && Platform.OS === "android") {
        const mediaId = watchMediaIdentity(nextVideo);
        markWatchCellBind("android", {
          visibleIndex: nextIndex,
          visibleMediaId: mediaId,
          activeIndex: nextIndex,
          activeMediaId: mediaId,
          playerMediaId: mediaId,
          surfaceAttached: surfaceReady,
          aligned: surfaceReady,
        });
      }
    },
    []
  );

  const applyWatchIndexDecisionRef = useRef(applyWatchIndexDecision);
  applyWatchIndexDecisionRef.current = applyWatchIndexDecision;

  const pinWatchNativeOffset = useCallback((
    nextIndex: number,
    attempt = 0,
    options?: { animated?: boolean }
  ) => {
    const height = itemHeightRef.current;
    const offset = resolveWatchScrollOffset(nextIndex, height);
    if (offset == null) return;
    programmaticAdvanceUntilRef.current =
      Date.now() + PROGRAMMATIC_ADVANCE_LOCK_MS;
    const animated = options?.animated ?? attempt === 0;
    try {
      listRef.current?.scrollToOffset({ offset, animated });
    } catch (err) {
      console.warn("Watch native pin failed:", err);
      if (attempt < 3) {
        setTimeout(
          () => pinWatchNativeOffset(nextIndex, attempt + 1, options),
          80 * (attempt + 1)
        );
      }
    }
  }, []);

  const dispatchWatchHandoff = useCallback((event: WatchHandoffEvent) => {
    const result = reduceWatchHandoff(handoffMachineRef.current, event);
    handoffMachineRef.current = result.next;
    if (result.action !== "silence-then-commit" || !result.commit) {
      return;
    }
    const fromIndex = result.commit.fromIndex;
    applyWatchHandoffAudioTransfer({
      previousPlayer: getRegisteredWatchPlayer(fromIndex),
      previousIndex: fromIndex,
      nextIndex: result.commit.toIndex,
      platform: Platform.OS === "ios" ? "ios" : "android",
      previousItemReady: true,
    });
    applyWatchIndexDecisionRef.current(
      decideWatchActiveIndexClaim({
        arbiter: arbiterRef.current,
        reason: "handoff-commit",
        requestedIndex: result.commit.toIndex,
        navigationGeneration: arbiterRef.current.navigationGeneration,
        nativeSettledPage: arbiterRef.current.lastSettledNativePage,
      }),
      true
    );
    if (result.commit.pinNativeOffset) {
      pinWatchNativeOffset(result.commit.toIndex, 0, { animated: false });
    }
    const commitGeneration = handoffMachineRef.current.navigationGeneration;
    const forwardLock = armWatchForwardCommitLock({
      fromIndex: result.commit.fromIndex,
      toIndex: result.commit.toIndex,
      navigationGeneration: commitGeneration,
    });
    if (forwardLock) {
      forwardLockRef.current = forwardLock;
      reverseDragEvidenceRef.current = false;
      if (forwardLock.fromIndex !== 0) {
        firstPinRef.current = clearWatchFirstPagePin(firstPinRef.current);
      }
    } else {
      forwardLockRef.current = createWatchForwardCommitLock();
    }
    const firstPin = resolveFirstWatchCommitNativePin({
      fromIndex: result.commit.fromIndex,
      toIndex: result.commit.toIndex,
      frozenItemHeight: itemHeightRef.current,
      navigationGeneration: commitGeneration,
    });
    if (
      firstPin &&
      shouldApplyFirstWatchNativePin({
        pinGeneration: firstPin.navigationGeneration,
        currentGeneration: commitGeneration,
      })
    ) {
      firstPinRef.current = armWatchFirstPagePin({
        navigationGeneration: firstPin.navigationGeneration,
      });
      reverseDragEvidenceRef.current = false;
      try {
        listRef.current?.scrollToOffset({
          offset: firstPin.offset,
          animated: false,
        });
      } catch (err) {
        console.warn("Watch native pin failed:", err);
      }
    }
  }, [pinWatchNativeOffset]);

  const dispatchWatchHandoffRef = useRef(dispatchWatchHandoff);
  dispatchWatchHandoffRef.current = dispatchWatchHandoff;

  const prepareAdjacentNeighbors = useCallback((committedIndex: number) => {
    const adjacent = resolveProactivePrepareIndexes({
      committedIndex,
      itemCount: videosLengthRef.current,
    });
    applyWarmedTargetIndex(adjacent.find((index) => index === committedIndex + 1) ?? adjacent[0] ?? null);
    setWarmNextSurface(adjacent.length > 0);
    for (const index of adjacent) {
      const video = visibleVideosRef.current[index];
      if (!video) continue;
      dispatchWatchHandoffRef.current({
        type: "prepare",
        index,
        mediaId: watchMediaIdentity(video),
        generation: playbackGenerationRef.current,
      });
    }
  }, [applyWarmedTargetIndex]);

  useEffect(() => {
    remainingMsRef.current = null;
    currentEndedRef.current = false;
    handoffGenRef.current += 1;
    nextHandoffRef.current = {
      index: -1,
      ready: false,
      firstFrame: false,
      surfaceAttached: false,
      mediaId: null,
    };
    prepareAdjacentNeighbors(activeIndex);
  }, [activeIndex, prepareAdjacentNeighbors]);

  useEffect(() => {
    const generation = registerMountedWatchInstance();
    return () => unregisterMountedWatchInstance(generation);
  }, []);

  useEffect(() => {
    void ensureAndroidWatchVideoCache(Platform.OS);
  }, []);

  useEffect(() => {
    itemHeightRef.current = itemHeight;
  }, [itemHeight]);

  const onWatchListLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const resolved = resolveFrozenWatchViewport({
      frozenHeight: viewportFrozenRef.current.height,
      frozenWidth: viewportFrozenRef.current.width,
      measuredHeight: height,
      measuredWidth: width,
    });
    if (resolved.height == null) return;
    const wasUnfrozen = viewportFrozenRef.current.height == null;
    const sessionChange = resolved.isNewSession && !wasUnfrozen;
    viewportFrozenRef.current = {
      height: resolved.height,
      width: resolved.width,
    };
    if (itemHeightRef.current !== resolved.height) {
      itemHeightRef.current = resolved.height;
      setItemHeight(resolved.height);
    }
    if (!sessionChange || !resolved.heightChanged) return;
    const current = visibleVideosRef.current[activeIndexRef.current];
    const keep = preserveWatchPostAcrossLayoutSession({
      activePostId: current?.postId ?? current?.id ?? null,
      videos: visibleVideosRef.current,
      fallbackIndex: activeIndexRef.current,
    });
    const offset = resolveWatchScrollOffset(keep, resolved.height);
    if (offset == null) return;
    listRef.current?.scrollToOffset({ offset, animated: false });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      screenFocusedRef.current = true;
      void Promise.all([loadBlockedUsers(), loadHiddenPostIds()]).then(
        ([users, posts]) => {
          setBlockedUserIds(new Set(users.map((row) => row.userId)));
          setHiddenPostIds(new Set(posts));
        }
      );
      return () => {
        screenFocusedRef.current = false;
        setScreenFocused(false);
        dispatchWatchHandoffRef.current({
          type: "cancel",
          reason: "blur-unmount",
        });
        firstPinRef.current = clearWatchFirstPagePin(firstPinRef.current);
        forwardLockRef.current = createWatchForwardCommitLock();
        reverseDragEvidenceRef.current = false;
        prepareAdjacentNeighbors(activeIndexRef.current);
        const nextGeneration = bumpWatchLeaveGeneration(
          playbackGenerationRef.current
        );
        playbackGenerationRef.current = nextGeneration;
        setPlaybackGeneration(nextGeneration);
        armedUntilMsRef.current = null;
        exitHintVisibleRef.current = false;
        setExitHintVisible(false);
      };
    }, [prepareAdjacentNeighbors])
  );

  useEffect(() => {
    commentPostIdRef.current = commentPostId;
  }, [commentPostId]);

  useEffect(() => {
    shareSheetOpenRef.current = isWatchShareSheetOpen(shareSheet);
  }, [shareSheet]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppState(toLifecycleState(next));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadWatchMutedPreference(),
      loadWatchVolumePreference(),
      loadWatchAutoNextPreference(),
    ]).then(([nextMuted, nextVolume, nextAutoNext]) => {
      if (cancelled) return;
      setMuted(nextMuted);
      setVolume(nextVolume);
      setAutoNext(nextAutoNext);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleVideos = useMemo(
    () =>
      filterWatchItemsForViewer(videos, {
        blockedUserIds,
        hiddenPostIds,
      }),
    [blockedUserIds, hiddenPostIds, videos]
  );

  const playbackIdentity = useMemo(
    () =>
      visibleVideos
        .map((video) => `${watchItemKey(video)}:${video.videoPath ?? ""}`)
        .join("|"),
    [visibleVideos]
  );
  const visibleVideosRef = useRef(visibleVideos);
  visibleVideosRef.current = visibleVideos;

  useEffect(() => {
    const intent = handoffMachineRef.current.intent ?? handoffMachineRef.current.prepared;
    if (!intent) return;
    const video = visibleVideosRef.current[intent.index];
    const currentMediaId = video ? watchMediaIdentity(video) : null;
    if (currentMediaId !== intent.mediaId) {
      dispatchWatchHandoffRef.current({
        type: "cancel",
        reason: "feed-identity-change",
      });
      prepareAdjacentNeighbors(activeIndexRef.current);
    }
  }, [playbackIdentity, prepareAdjacentNeighbors]);

  useEffect(() => {
    videosLengthRef.current = visibleVideos.length;
  }, [visibleVideos.length]);

  const activeVideoId = visibleVideos[activeIndex]?.id ?? null;
  useEffect(() => {
    setPlaybackRate(resetWatchPlaybackSpeedOnPageChange());
  }, [activeVideoId]);

  useEffect(() => {
    const authors = [
      ...new Set(
        visibleVideos
          .map((video) => video.author.id)
          .filter((id): id is string => Boolean(id) && id !== user?.id)
      ),
    ].slice(0, 8);
    if (authors.length === 0) return;
    let cancelled = false;
    void Promise.all(
      authors.map(async (id) => {
        const snap = await getProfileFollowSnapshot(getSupabase(), id);
        return [id, snap.ok && snap.following === true] as const;
      })
    ).then((rows) => {
      if (cancelled) return;
      setFollowByAuthor((prev) => {
        const next = { ...prev };
        for (const [id, following] of rows) {
          if (prev[id] === true && following === false) continue;
          next[id] = following;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, playbackIdentity]);

  const clearExitArm = useCallback(() => {
    armedUntilMsRef.current = null;
    if (exitHintVisibleRef.current) {
      exitHintVisibleRef.current = false;
      setExitHintVisible(false);
    }
  }, []);

  const armWatchExit = useCallback((armedUntilMs: number) => {
    armedUntilMsRef.current = armedUntilMs;
    exitHintVisibleRef.current = true;
    setExitHintVisible(true);
  }, []);

  const exitWatchToEntry = useCallback(() => {
    const state = navigation.getState() as
      | { index?: number; routes?: Array<{ name?: string }> }
      | undefined;
    const decision = resolveWatchExitNavigation({
      entryHref: peekWatchEntryHref(),
      canGoBack: navigation.canGoBack(),
      previousRouteName: previousRouteNameFromState(state),
    });
    clearExitArm();
    if (decision.action === "history-back") {
      router.back();
      return decision;
    }
    if (decision.action === "replace") {
      router.replace(decision.href as never);
      return decision;
    }
    return decision;
  }, [clearExitArm, navigation, router]);

  const closeWatchInPlaceOverlay = useCallback(() => {
    const target = resolveWatchInPlaceOverlayClose({
      commentsOpen: commentPostIdRef.current != null,
      shareSheetOpen: shareSheetOpenRef.current,
    });
    if (target === "comments") {
      setCommentPostId(null);
      return true;
    }
    if (target === "share") {
      setShareSheet(null);
      return true;
    }
    return false;
  }, []);

  const onWatchHeaderArrow = useCallback(() => {
    if (closeWatchInPlaceOverlay()) return;
    const state = navigation.getState() as
      | { index?: number; routes?: Array<{ name?: string }> }
      | undefined;
    const decision = resolveWatchHeaderArrowNavigation({
      entryHref: peekWatchEntryHref(),
      canGoBack: navigation.canGoBack(),
      previousRouteName: previousRouteNameFromState(state),
    });
    clearExitArm();
    if (decision.action === "history-back") {
      router.back();
      return;
    }
    router.replace(decision.href as never);
  }, [clearExitArm, closeWatchInPlaceOverlay, navigation, router]);

  const decideWatchRootBack = useCallback(() => {
    return resolveWatchRootBack({
      nowMs: Date.now(),
      armedUntilMs: armedUntilMsRef.current,
      nestedOverlayOpen: isWatchInPlaceOverlayOpen({
        commentsOpen: commentPostIdRef.current != null,
        shareSheetOpen: shareSheetOpenRef.current,
      }),
      atWatchRoot: screenFocusedRef.current,
    });
  }, []);

  useEffect(() => {
    if (!shouldInterceptWatchRootBack(Platform.OS)) return;

    const onBack = () => {
      if (!isWatchRootSurface(pathname, segments)) return false;
      const decision = decideWatchRootBack();
      if (decision.action === "close-nested") {
        closeWatchInPlaceOverlay();
        return true;
      }
      if (decision.action === "arm-exit") {
        armWatchExit(decision.armedUntilMs);
        return true;
      }
      if (decision.action === "exit") {
        const exitNav = exitWatchToEntry();
        return shouldConsumeHardwareBack(decision, exitNav);
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [armWatchExit, closeWatchInPlaceOverlay, decideWatchRootBack, exitWatchToEntry, pathname, segments]);

  useEffect(() => {
    if (!shouldInterceptWatchRootBack(Platform.OS)) return;

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isWatchRootSurface(pathname, segments)) return;
      const actionType = (
        event as { data?: { action?: { type?: string } } }
      ).data?.action?.type;
      if (
        actionType &&
        actionType !== "GO_BACK" &&
        actionType !== "POP" &&
        actionType !== "POP_TO_TOP"
      ) {
        return;
      }
      const decision = decideWatchRootBack();
      if (decision.action === "close-nested") {
        event.preventDefault();
        closeWatchInPlaceOverlay();
        return;
      }
      if (decision.action === "arm-exit") {
        event.preventDefault();
        armWatchExit(decision.armedUntilMs);
      }
    });
    return unsubscribe;
  }, [armWatchExit, closeWatchInPlaceOverlay, decideWatchRootBack, navigation, pathname, segments]);

  useEffect(() => {
    if (!exitHintVisible) return;
    const armedUntilMs = armedUntilMsRef.current;
    if (armedUntilMs == null) return;
    const waitMs = Math.max(0, armedUntilMs - Date.now());
    const timer = setTimeout(() => {
      if (armedUntilMsRef.current === armedUntilMs) {
        clearExitArm();
      }
    }, waitMs);
    return () => clearTimeout(timer);
  }, [clearExitArm, exitHintVisible]);

  const loadInitial = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (initialInFlight.current) return;
      initialInFlight.current = true;
      if (!opts?.soft) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const supabase = getSupabase();
        const startup = await resolveWatchStartupFeed({
          accountId: user?.id ?? null,
          fetchFeed: () =>
            fetchWatchFeedPage(supabase, {
              focusPostId,
              limit: 12,
            }),
        });
        urlGenerationRef.current += 1;
        if (startup.source === "offline" && startup.videos.length === 0) {
          setError(t("watch.loadFailed"));
          return;
        }
        setVideos(mergeWatchVideos([], startup.videos));
        if (startup.page) {
          setCursor(startup.page.nextCursor);
          setEndReached(!startup.page.nextCursor);
        } else {
          setCursor(null);
          setEndReached(true);
        }
        const first = visibleVideosRef.current[0] ?? startup.videos[0];
        resetWatchHandoffAudibleOwner();
        handoffMachineRef.current = createWatchHandoffMachine({
          committedIndex: 0,
          committedMediaId: first ? watchMediaIdentity(first) : "",
          committedGeneration: playbackGenerationRef.current,
          navigationGeneration: arbiterRef.current.navigationGeneration,
        });
        applyWatchIndexDecision(
          decideWatchActiveIndexClaim({
            arbiter: arbiterRef.current,
            reason: "bootstrap",
            requestedIndex: 0,
            navigationGeneration: arbiterRef.current.navigationGeneration,
          })
        );
      } catch (err) {
        setError(getErrorMessage(err, t("watch.loadFailed")));
      } finally {
        setLoading(false);
        setRefreshing(false);
        initialInFlight.current = false;
      }
    },
    [applyWatchIndexDecision, focusPostId, t, user?.id]
  );

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!cursor || moreInFlight.current || loadingMore || endReached) return;
    moreInFlight.current = true;
    setLoadingMore(true);
    try {
      const supabase = getSupabase();
      const page = await fetchWatchFeedPage(supabase, { cursor });
      setVideos((prev) => mergeWatchVideos(prev, page.videos));
      setCursor(page.nextCursor);
      if (!page.nextCursor) {
        setEndReached(true);
      }
    } catch (err) {
      console.error("Watch pagination failed:", err);
      setError(getErrorMessage(err, t("watch.loadMoreFailed")));
    } finally {
      setLoadingMore(false);
      moreInFlight.current = false;
    }
  }, [cursor, endReached, loadingMore, t]);

  const reportNeighborHandoffState = useCallback((
    index: number,
    state: {
      ready: boolean;
      firstFrame: boolean;
      surfaceAttached?: boolean;
      mediaId?: string | null;
    }
  ) => {
    nextHandoffRef.current = {
      index,
      ready: state.ready,
      firstFrame: state.firstFrame,
      surfaceAttached: state.surfaceAttached === true || state.firstFrame === true,
      mediaId: state.mediaId ?? null,
    };
    const video = visibleVideosRef.current[index];
    const mediaId = state.mediaId ?? (video ? watchMediaIdentity(video) : "");
    if (!mediaId) return;
    const attached = state.surfaceAttached === true || state.firstFrame === true;
    if (state.firstFrame) {
      dispatchWatchHandoffRef.current({
        type: "first-frame",
        index,
        mediaId,
        generation: playbackGenerationRef.current,
        surfaceAttached: attached,
      });
      return;
    }
    dispatchWatchHandoffRef.current({
      type: "prepare-progress",
      index,
      mediaId,
      generation: playbackGenerationRef.current,
      surfaceAttached: attached,
      firstFrame: false,
    });
  }, []);

  const onWatchScrollBeginDrag = useCallback(() => {
    manualDragActiveRef.current = true;
    dragStartIndexRef.current = activeIndexRef.current;
    dragStartOffsetRef.current = scrollOffsetRef.current;
  }, []);

  const onWatchScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      watchScrollInFlightRef.current = true;
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      if (!manualDragActiveRef.current) return;
      const directional = resolveManualHandoffTarget({
        fromIndex: dragStartIndexRef.current,
        currentOffset: scrollOffsetRef.current,
        itemHeight: itemHeightRef.current,
        itemCount: videosLengthRef.current,
      });
      const nativeHint = resolveWatchNativePage(
        scrollOffsetRef.current,
        itemHeightRef.current,
        videosLengthRef.current
      );
      const target =
        nativeHint != null && nativeHint !== dragStartIndexRef.current
          ? nativeHint
          : directional;
      if (
        (forwardLockRef.current.armed &&
          hasGenuineReverseDragEvidence({
            committedIndex: activeIndexRef.current,
            lockToIndex: forwardLockRef.current.toIndex,
            dragStartIndex: dragStartIndexRef.current,
            dragStartOffset: dragStartOffsetRef.current,
            dragTargetIndex: target,
            itemHeight: itemHeightRef.current,
          })) ||
        (firstPinRef.current.inFlight &&
          hasFirstWatchReverseDragEvidence({
            committedIndex: activeIndexRef.current,
            dragStartIndex: dragStartIndexRef.current,
            dragStartOffset: dragStartOffsetRef.current,
            dragTargetIndex: target,
            itemHeight: itemHeightRef.current,
          }))
      ) {
        reverseDragEvidenceRef.current = true;
      }
      const retarget = resolveManualHandoffRetarget({
        previousTarget: warmedTargetIndexRef.current,
        nextTarget: target,
        fromIndex: dragStartIndexRef.current,
      });
      if (retarget === "cancel") {
        dispatchWatchHandoffRef.current({
          type: "cancel",
          reason: "return-to-current",
        });
        prepareAdjacentNeighbors(activeIndexRef.current);
        return;
      }
      if (retarget === "retarget") {
        dispatchWatchHandoffRef.current({
          type: "cancel",
          reason: "rapid-retarget",
        });
      }
      if (
        !shouldWarmManualTarget({
          fromIndex: dragStartIndexRef.current,
          targetIndex: target,
        })
      ) {
        return;
      }
      applyWarmedTargetIndex(target);
    },
    [applyWarmedTargetIndex, prepareAdjacentNeighbors]
  );

  const onWatchScrollSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      watchScrollInFlightRef.current = false;
      manualDragActiveRef.current = false;
      scrollOffsetRef.current = offset;
      const nativePage = resolveWatchNativePage(
        offset,
        itemHeightRef.current,
        videosLengthRef.current
      );
      if (nativePage == null) return;
      if (
        shouldResyncNativeAfterStaleSettle({
          lock: forwardLockRef.current,
          nativePage,
          committedIndex: activeIndexRef.current,
          reverseDragEvidence: reverseDragEvidenceRef.current,
        })
      ) {
        const offset = resolveForwardCommitNativeResyncOffset({
          lock: forwardLockRef.current,
          frozenItemHeight: itemHeightRef.current,
        });
        if (offset != null) {
          try {
            listRef.current?.scrollToOffset({
              offset,
              animated: false,
            });
          } catch (err) {
            console.warn("Watch native pin failed:", err);
          }
        }
        return;
      }
      const pin = firstPinRef.current;
      const pinGeneration = handoffMachineRef.current.navigationGeneration;
      if (pin.inFlight) {
        const alignment = resolveWatchFirstPagePinAlignment({
          nativePage,
          committedIndex: activeIndexRef.current,
          pin,
          currentGeneration: pinGeneration,
        });
        if (alignment === "clear") {
          firstPinRef.current = clearWatchFirstPagePin(pin);
        } else if (
          alignment === "keep" &&
          nativePage === 0 &&
          activeIndexRef.current === 1 &&
          !reverseDragEvidenceRef.current
        ) {
          const again = resolveFirstWatchCommitNativePin({
            fromIndex: 0,
            toIndex: 1,
            frozenItemHeight: itemHeightRef.current,
            navigationGeneration: pin.navigationGeneration,
          });
          if (
            again &&
            shouldApplyFirstWatchNativePin({
              pinGeneration: again.navigationGeneration,
              currentGeneration: pinGeneration,
            })
          ) {
            try {
              listRef.current?.scrollToOffset({
                offset: again.offset,
                animated: false,
              });
            } catch (err) {
              console.warn("Watch native pin failed:", err);
            }
          }
        }
        if (
          nativePage === 0 &&
          activeIndexRef.current === 1 &&
          !reverseDragEvidenceRef.current
        ) {
          return;
        }
      }
      if (
        shouldIgnoreStaleManualSettle({
          locked: Date.now() < programmaticAdvanceUntilRef.current,
          nativePage,
          activeIndex: activeIndexRef.current,
          reverseDragEvidence: reverseDragEvidenceRef.current,
        })
      ) {
        return;
      }

      void shouldClaimWatchIndexFromNativeSettle({
        platform: Platform.OS,
        nativePage,
        activeIndex: activeIndexRef.current,
      });
      setLastSettledNativePage(nativePage);
      arbiterRef.current = {
        ...arbiterRef.current,
        lastSettledNativePage: nativePage,
      };
      dispatchWatchHandoffRef.current({
        type: "settle",
        nativePage,
      });

      const action = resolveAndroidManualSettleAction({
        nativePage,
        activeIndex: activeIndexRef.current,
      });
      if (action === "cancel") {
        const stillHeading = resolveManualHandoffTarget({
          fromIndex: activeIndexRef.current,
          currentOffset: offset,
          itemHeight: itemHeightRef.current,
          itemCount: videosLengthRef.current,
        });
        if (stillHeading != null) {
          applyWarmedTargetIndex(stillHeading);
          return;
        }
        prepareAdjacentNeighbors(activeIndexRef.current);
        return;
      }

      applyWarmedTargetIndex(nativePage);
      const targetVideo = visibleVideosRef.current[nativePage];
      if (targetVideo) {
        dispatchWatchHandoffRef.current({
          type: "prepare",
          index: nativePage,
          mediaId: watchMediaIdentity(targetVideo),
          generation: playbackGenerationRef.current,
        });
      }
    },
    [applyWarmedTargetIndex, prepareAdjacentNeighbors]
  );

  const onViewableItemsChanged = useRef(
    (info: { viewableItems: ViewToken[] }) => {
      decideWatchViewabilityEvidence();
      const intent = resolveWatchHandoffIntentFromViewability({
        viewableItems: info.viewableItems,
        committedIndex: activeIndexRef.current,
        itemCount: videosLengthRef.current,
      });
      if (intent == null) return;
      if (
        shouldRejectLockedBackwardViewability({
          nominatedIndex: intent,
          committedIndex: activeIndexRef.current,
          lock: forwardLockRef.current,
          currentGeneration: handoffMachineRef.current.navigationGeneration,
          reverseDragEvidence: reverseDragEvidenceRef.current,
        }) ||
        shouldRejectFirstWatchIndexZeroIntent({
          nominatedIndex: intent,
          committedIndex: activeIndexRef.current,
          pin: firstPinRef.current,
          currentGeneration: handoffMachineRef.current.navigationGeneration,
          reverseDragEvidence: reverseDragEvidenceRef.current,
        })
      ) {
        return;
      }
      const video = visibleVideosRef.current[intent];
      if (!video) return;
      const state = nextHandoffRef.current;
      const owns = state.index === intent;
      dispatchWatchHandoffRef.current({
        type: "viewability-80",
        index: intent,
        mediaId: watchMediaIdentity(video),
        generation: playbackGenerationRef.current,
        surfaceAttached: owns && (state.surfaceAttached === true || state.firstFrame === true),
        firstFrame: owns && state.firstFrame === true,
      });
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 80,
  }).current;

  const patchVideo = useCallback((id: string, patch: Partial<WatchVideo>) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              ...patch,
              stats: { ...v.stats, ...(patch.stats || {}) },
            }
          : v
      )
    );
  }, []);

  useEffect(() => {
    const snapshot = visibleVideosRef.current;
    if (snapshot.length === 0) return;
    const generation = urlGenerationRef.current + 1;
    urlGenerationRef.current = generation;
    void prepareWatchPlaybackUrls(getSupabase(), snapshot, activeIndex, {
      isCurrent: () => urlGenerationRef.current === generation,
      onResolved: (id, src) => {
        if (urlGenerationRef.current !== generation) return;
        const video = visibleVideosRef.current.find((row) => row.id === id);
        const current = video?.src;
        void (async () => {
          const port = resolveWatchMediaCachePort();
          let currentLocalUsable: boolean | undefined;
          if (isLocalWatchPlaybackUri(current) && port) {
            currentLocalUsable = (
              await inspectLocalWatchPlaybackFile(port, current)
            ).usable;
            if (!currentLocalUsable && video) {
              await invalidateStaleWatchRetainedSources({
                accountId: user?.id ?? null,
                mediaId: watchMediaIdentity(video),
                port,
              });
            }
          }
          if (urlGenerationRef.current !== generation) return;
          if (
            !shouldApplyResolvedWatchSrc(current, src, { currentLocalUsable })
          ) {
            return;
          }
          patchVideo(id, { src });
        })();
      },
    });
  }, [activeIndex, patchVideo, playbackIdentity, user?.id]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const snapshot = visibleVideosRef.current;
    if (snapshot.length === 0) return;
    let cancelled = false;
    void peekAndroidWatchCacheHits({ videos: snapshot }).then((hits) => {
      if (cancelled) return;
      for (const hit of hits) {
        const video = visibleVideosRef.current.find(
          (row) => row.id === hit.videoId
        );
        if (!video || video.src === hit.uri) continue;
        if (
          !shouldApplyLocalWatchUriToVideo({
            video,
            candidateMediaId: hit.mediaId,
            candidateUri: hit.uri,
            fileUsable: true,
          })
        ) {
          continue;
        }
        patchVideo(hit.videoId, { src: hit.uri });
      }
      if (hits.length > 0) {
        markWatchCache("android", {
          target: ANDROID_WATCH_CACHE_TARGET,
          cachedIds: hits.map((hit) => hit.mediaId),
          hits: hits.map((hit) => hit.mediaId),
          misses: [],
          evicted: [],
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [patchVideo, playbackIdentity]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const snapshot = visibleVideosRef.current;
    if (snapshot.length === 0) return;
    const generation = cacheSyncGenerationRef.current + 1;
    cacheSyncGenerationRef.current = generation;
    void syncAndroidWatchRollingCache({
      platform: "android",
      videos: snapshot,
      activeIndex,
      accountId: user?.id ?? null,
      onResolved: (videoId, localUri) => {
        if (cacheSyncGenerationRef.current !== generation) return;
        const video = visibleVideosRef.current.find(
          (row) => row.id === videoId
        );
        if (!video || video.src === localUri) return;
        if (
          !shouldApplyLocalWatchUriToVideo({
            video,
            candidateMediaId: watchMediaIdentity(video),
            candidateUri: localUri,
            fileUsable: true,
          })
        ) {
          return;
        }
        patchVideo(videoId, { src: localUri });
      },
    }).catch(() => {
      const active = visibleVideosRef.current[activeIndex];
      if (!active) return;
      isolatePrefetchFailureFromActiveCell({
        failedMediaId: "prefetch",
        activeMediaId: watchMediaIdentity(active),
        activeSrc: active.src,
        activeError: null,
      });
    });
  }, [activeIndex, patchVideo, playbackIdentity, user?.id]);

  const onToggleLike = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const snapshot = {
        likedByMe: video.likedByMe,
        likes: video.stats.likes,
      };
      const preview = previewToggleLike(snapshot);
      patchVideo(video.id, {
        likedByMe: preview.liked,
        stats: { ...video.stats, likes: preview.likes },
      });
      if (preview.liked) watchLightHaptic();
      const result = await togglePostLike(getSupabase(), video.postId);
      if (!result.ok) {
        patchVideo(video.id, {
          likedByMe: snapshot.likedByMe,
          stats: { ...video.stats, likes: snapshot.likes },
        });
        Alert.alert(t("watch.likeFailed"), result.message);
        return;
      }
      patchVideo(video.id, {
        likedByMe: result.liked,
        stats: { ...video.stats, likes: result.likes },
      });
    },
    [patchVideo, t]
  );

  const onEnsureLike = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const snapshot = {
        likedByMe: video.likedByMe,
        likes: video.stats.likes,
      };
      const preview = previewEnsureLike(snapshot);
      if (!preview.noop) {
        patchVideo(video.id, {
          likedByMe: true,
          stats: { ...video.stats, likes: preview.likes },
        });
        watchLightHaptic();
      }
      const result = await ensurePostLike(getSupabase(), video.postId, snapshot);
      if (!result.ok) {
        patchVideo(video.id, {
          likedByMe: snapshot.likedByMe,
          stats: { ...video.stats, likes: snapshot.likes },
        });
        Alert.alert(t("watch.likeFailed"), result.message);
        return;
      }
      patchVideo(video.id, {
        likedByMe: true,
        stats: { ...video.stats, likes: result.likes },
      });
    },
    [patchVideo, t]
  );

  const runShare = useCallback(
    async (
      attempt: ShareAttempt,
      mode: WatchShareMode,
      title: string,
      text: string
    ) => {
      const visiblePostId = videos[activeIndexRef.current]?.postId ?? null;
      const labels = {
        mediaUnavailable: t("watch.mediaUnavailable"),
        shareFailed: t("watch.shareFailed"),
      };
      if (mode === "file") setPreparingShare(true);
      try {
        const result =
          mode === "link"
            ? await shareWatchPostLink(getSupabase(), {
                attempt,
                title,
                text,
                visiblePostId,
                labels,
              })
            : await shareWatchPostFile(getSupabase(), {
                attempt,
                title,
                visiblePostId,
                labels,
              });
        if (!result.ok) {
          Alert.alert(
            result.code === "media_unavailable"
              ? t("watch.mediaUnavailable")
              : t("watch.shareFailed"),
            result.message
          );
          return;
        }
        if (result.shared && result.shares > 0) {
          const target = videos.find((row) => row.postId === attempt.postId);
          if (target) {
            patchVideo(target.id, {
              stats: { ...target.stats, shares: result.shares },
            });
          }
        }
      } finally {
        setPreparingShare(false);
      }
    },
    [patchVideo, t, videos]
  );

  const onShare = useCallback((video: WatchVideo) => {
    const entry = openWatchShareEntry({ postId: video.postId });
    if (!entry) return;
    setShareSheet({
      postId: entry.attempt.postId,
      title: video.title,
      text: video.caption || video.title,
      activeItemId: video.id,
    });
  }, []);

  const onToggleSave = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const snapshot = {
        savedByMe: video.savedByMe,
        saves: video.stats.saves,
      };
      const preview = previewToggleSave(snapshot);
      patchVideo(video.id, {
        savedByMe: preview.saved,
        stats: { ...video.stats, saves: preview.saves },
      });
      if (preview.saved) watchLightHaptic();
      const result = await togglePostSave(getSupabase(), video.postId);
      if (!result.ok) {
        patchVideo(video.id, {
          savedByMe: snapshot.savedByMe,
          stats: { ...video.stats, saves: snapshot.saves },
        });
        Alert.alert(t("watch.saveFailed"), result.message);
        return;
      }
      patchVideo(video.id, {
        savedByMe: result.saved,
        stats: { ...video.stats, saves: result.saves },
      });
    },
    [patchVideo, t]
  );

  const onEnsureFollow = useCallback(
    async (authorId: string) => {
      if (!authorId || followByAuthor[authorId] === true) return;
      setFollowByAuthor((prev) => ({ ...prev, [authorId]: true }));
      watchLightHaptic();
      const result = await ensureProfileFollow(getSupabase(), authorId, {
        following: false,
      });
      if (!result.ok) {
        setFollowByAuthor((prev) => ({ ...prev, [authorId]: false }));
        Alert.alert(t("watch.followFailed"), result.message);
      }
    },
    [followByAuthor, t]
  );

  const onNotInterested = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      setHiddenPostIds((prev) => {
        const next = new Set(prev);
        next.add(video.postId as number);
        return next;
      });
      await hidePostLocally(video.postId);
      Alert.alert(t("watch.notInterested"), t("watch.notInterestedDone"));
    },
    [t]
  );

  const onDeleteOwn = useCallback(
    (video: WatchVideo) => {
      if (!video.postId || !user?.id) return;
      if (!viewerMaySeeDeleteControl(user.id, video.author.id)) return;
      Alert.alert(
        t("watch.deleteTitle"),
        t("watch.deleteBody"),
        [
          { text: t("actions.cancel"), style: "cancel" },
          {
            text: t("actions.delete"),
            style: "destructive",
            onPress: () => {
              void (async () => {
                const result = await deletePostForOwner(
                  getSupabase(),
                  user.id,
                  video.postId as number
                );
                if (!result.ok) {
                  Alert.alert(t("watch.deleteFailed"), result.message);
                  return;
                }
                setVideos((prev) =>
                  applySuccessfulDeleteToList(
                    prev,
                    (row) => row.id === video.id,
                    true
                  )
                );
              })();
            },
          },
        ]
      );
    },
    [t, user?.id]
  );

  const onReport = useCallback(
    (video: WatchVideo) => {
      if (!video.postId || !user?.id) return;
      if (!viewerMaySeeReportControl(user.id, video.author.id)) return;

      const pickReason = (target: "content" | "user") => {
        Alert.alert(
          target === "content" ? t("report.video") : t("report.account"),
          target === "content"
            ? t("report.whyVideo")
            : t("report.whyAccount"),
          [
            { text: t("actions.cancel"), style: "cancel" },
            ...UGC_REPORT_REASONS.map((reason: UgcReportReason) => ({
              text: t(REPORT_REASON_KEYS[reason]),
              onPress: () => {
                void (async () => {
                  if (target === "content") {
                    const result = await reportWatchPost({
                      viewerId: user.id,
                      ownerUserId: video.author.id,
                      postId: video.postId as number,
                      reason,
                    });
                    setHiddenPostIds((prev) => {
                      const next = new Set(prev);
                      next.add(video.postId as number);
                      return next;
                    });
                    Alert.alert(
                      result.ok ? t("report.submitted") : t("report.failed"),
                      result.ok
                        ? t("report.thanksVideo")
                        : result.message
                    );
                    return;
                  }

                  const result = await reportWatchUser({
                    viewerId: user.id,
                    targetUserId: video.author.id,
                    reason,
                  });
                  Alert.alert(
                    result.ok ? t("report.submitted") : t("report.failed"),
                    result.ok
                      ? t("report.thanksAccount")
                      : result.message
                  );
                })();
              },
            })),
          ]
        );
      };

      Alert.alert(t("actions.report"), t("report.what"), [
        { text: t("actions.cancel"), style: "cancel" },
        { text: t("report.thisVideo"), onPress: () => pickReason("content") },
        { text: t("report.thisAccount"), onPress: () => pickReason("user") },
      ]);
    },
    [t, user?.id]
  );

  const onBlockUser = useCallback(
    (video: WatchVideo) => {
      if (!user?.id || !video.author.id) return;
      if (!viewerMaySeeBlockControl(user.id, video.author.id)) return;
      Alert.alert(
        t("block.title"),
        t("block.body", {
          values: { username: video.author.username.replace(/^@/, "") },
        }),
        [
          { text: t("actions.cancel"), style: "cancel" },
          {
            text: t("actions.block"),
            style: "destructive",
            onPress: () => {
              void (async () => {
                const result = await blockUserLocally({
                  viewerId: user.id,
                  targetUserId: video.author.id,
                  username: video.author.username,
                });
                if (!result.ok) {
                  Alert.alert(t("block.failed"), result.message);
                  return;
                }
                setBlockedUserIds((prev) => {
                  const next = new Set(prev);
                  next.add(result.userId);
                  return next;
                });
                Alert.alert(
                  t("block.done"),
                  result.localOnly
                    ? t("block.localOnly")
                    : t("block.serverAndLocal")
                );
              })();
            },
          },
        ]
      );
    },
    [t, user?.id]
  );

  const onToggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      void saveWatchMutedPreference(next);
      return next;
    });
  }, []);

  const onVolumeChange = useCallback((next: number) => {
    const quantized = quantizeWatchVolume(next);
    setVolume(quantized);
    void saveWatchVolumePreference(quantized);
  }, []);

  const onToggleAutoNext = useCallback(() => {
    setAutoNext((value) => {
      const next = !value;
      void saveWatchAutoNextPreference(next);
      return next;
    });
  }, []);

  const onScrubGestureChange = useCallback((active: boolean) => {
    setListScrollEnabled(!active);
  }, []);

  const scrollToWatchIndex = useCallback((
    nextIndex: number,
    attempt = 0,
    options?: { animated?: boolean }
  ) => {
    dispatchWatchHandoffRef.current({
      type: "scroll-to-index",
      index: nextIndex,
    });
    markWatchTransition(Platform.OS, "next_source_activation", {
      index: nextIndex,
      readiness: resolveWatchHandoffReadiness({
        nextReady: nextHandoffRef.current.ready,
        nextFirstFrame: nextHandoffRef.current.firstFrame,
      }),
    });
    pinWatchNativeOffset(nextIndex, attempt, options);
  }, [pinWatchNativeOffset]);
  scrollToWatchIndexRef.current = scrollToWatchIndex;

  const onActiveEnded = useCallback(() => {
    const nextIndex = resolveNextWatchIndex({
      autoNext,
      activeIndex: activeIndexRef.current,
      itemCount: videosLengthRef.current,
    });
    if (nextIndex == null) {
      return;
    }
    markWatchTransition(Platform.OS, "current_end", { index: nextIndex });
    currentEndedRef.current = true;
    setWarmNextSurface(true);
    const nextVideo = visibleVideosRef.current[nextIndex];
    if (!nextVideo) return;
    const nextState = nextHandoffRef.current;
    const owns = nextState.index === nextIndex;
    dispatchWatchHandoffRef.current({
      type: "auto-next",
      index: nextIndex,
      mediaId: watchMediaIdentity(nextVideo),
      generation: playbackGenerationRef.current,
      surfaceAttached: owns && (nextState.surfaceAttached === true || nextState.firstFrame === true),
      firstFrame: owns && nextState.firstFrame === true,
    });
  }, [autoNext]);

  const refreshSrcFor = useCallback(async (video: WatchVideo) => {
    if (!video.postId) return null;
    const result = await refreshPlaybackUrl(getSupabase(), video.postId);
    if (!result.ok) return null;
    patchVideo(video.id, { src: result.src });
    return result.src;
  }, [patchVideo]);

  const getItemLayout = useCallback(
    (_: ArrayLike<WatchVideo> | null | undefined, index: number) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
    [itemHeight]
  );

  const keyExtractor = useCallback((item: WatchVideo) => watchItemKey(item), []);

  const renderItem = useCallback(
    ({ item, index }: { item: WatchVideo; index: number }) => (
      <WatchVideoCard
        video={item}
        listIndex={index}
        isActive={index === activeIndex}
        shouldLoadPlayer={shouldLoadOwnedWatchPlayer({
          index,
          activeIndex,
          platform: Platform.OS,
          lastSettledNativePage,
          warmedTargetIndex,
          prepareAdjacentNeighbors: true,
        })}
        shouldPreparePlayer={shouldPrepareWatchPlayer(
          index,
          activeIndex,
          Platform.OS
        )}
        isNextItem={index === activeIndex + 1}
        warmNextSurface={
          Platform.OS === "android" &&
          (Math.abs(index - activeIndex) === 1 ||
            index === warmedTargetIndex ||
            (index === activeIndex + 1 && warmNextSurface))
        }
        onHandoffState={
          Math.abs(index - activeIndex) === 1 || index === warmedTargetIndex
            ? (state) => {
                reportNeighborHandoffState(index, state);
              }
            : undefined
        }
        onRemainingMs={
          Platform.OS === "android" && index === activeIndex
            ? (remainingMs) => {
                remainingMsRef.current = remainingMs;
                const nextWarm = shouldWarmAndroidNextSurface({
                  platform: "android",
                  remainingMs,
                  ended: currentEndedRef.current,
                });
                setWarmNextSurface((prev) =>
                  prev === nextWarm ? prev : nextWarm
                );
              }
            : undefined
        }
        ownershipGeneration={playbackGeneration}
        muted={muted}
        volume={volume}
        autoNext={autoNext}
        isLastItem={index >= visibleVideos.length - 1}
        appState={appState}
        screenFocused={screenFocused}
        onToggleMute={onToggleMute}
        onVolumeChange={onVolumeChange}
        onToggleAutoNext={onToggleAutoNext}
        onScrubGestureChange={onScrubGestureChange}
        onEnded={index === activeIndex ? onActiveEnded : undefined}
        onToggleLike={() => void onToggleLike(item)}
        onEnsureLike={() => void onEnsureLike(item)}
        onToggleSave={() => void onToggleSave(item)}
        playbackRate={index === activeIndex ? playbackRate : DEFAULT_WATCH_PLAYBACK_SPEED}
        onPlaybackRateChange={
          index === activeIndex
            ? (rate) => {
                setPlaybackRate(resolveWatchPlaybackSpeed(rate));
              }
            : undefined
        }
        following={item.author.id ? followByAuthor[item.author.id] === true : false}
        onEnsureFollow={
          item.author.id && user?.id && item.author.id !== user.id
            ? () => void onEnsureFollow(item.author.id as string)
            : undefined
        }
        onNotInterested={
          item.postId ? () => void onNotInterested(item) : undefined
        }
        onOpenComments={
          item.postId
            ? () => setCommentPostId(item.postId as number)
            : undefined
        }
        onShare={
          isWatchShareEntryEnabled({ postId: item.postId })
            ? () => void onShare(item)
            : undefined
        }
        onDeleteOwn={
          viewerMaySeeDeleteControl(user?.id, item.author.id)
            ? () => onDeleteOwn(item)
            : undefined
        }
        onReport={
          viewerMaySeeReportControl(user?.id, item.author.id)
            ? () => onReport(item)
            : undefined
        }
        onBlockUser={
          viewerMaySeeBlockControl(user?.id, item.author.id)
            ? () => onBlockUser(item)
            : undefined
        }
        onHashtagPress={() => {
          Alert.alert(t("discover.hashtags"), t("discover.hashtagsSoon"));
        }}
        onMentionPress={(username) => {
          const href = buildWatchCreatorProfileHref({
            username,
            id: null,
          });
          if (!href) return;
          rememberProfileBackContext({
            origin: "watch",
            via: null,
            listId: null,
            listUsername: null,
            ownerId: null,
            ownerUsername: username,
          });
          router.push(href as never);
        }}
        onOpenProfile={() => {
          const href = buildWatchCreatorProfileHref(item.author);
          if (href) {
            rememberProfileBackContext({
              origin: "watch",
              via: null,
              listId: null,
              listUsername: null,
              ownerId: parseProfileUserId(item.author.id),
              ownerUsername: item.author.username ?? null,
            });
            router.push(href as never);
          }
        }}
        onOpenSound={(soundId) => {
          const href = buildWatchSoundHref(soundId);
          if (!href) return;
          rememberProfileBackContext({
            origin: "watch",
            via: null,
            listId: null,
            listUsername: null,
            ownerId: parseProfileUserId(item.author.id),
            ownerUsername: item.author.username ?? null,
          });
          router.push({
            pathname: "/sound/[id]",
            params: { id: soundId.trim(), from: "watch" },
          } as never);
        }}
        onRefreshSrc={() => refreshSrcFor(item)}
        style={{ height: itemHeight, flexGrow: 0, flexShrink: 0 }}
        cellHeight={itemHeight}
        topInset={insets.top + 44}
        bottomInset={insets.bottom}
      />
    ),
    [
      activeIndex,
      lastSettledNativePage,
      playbackGeneration,
      appState,
      autoNext,
      warmNextSurface,
      warmedTargetIndex,
      reportNeighborHandoffState,
      insets.bottom,
      insets.top,
      itemHeight,
      muted,
      onActiveEnded,
      onScrubGestureChange,
      onToggleAutoNext,
      onBlockUser,
      onDeleteOwn,
      onReport,
      onShare,
      onEnsureLike,
      onToggleLike,
      onToggleMute,
      onToggleSave,
      onEnsureFollow,
      onNotInterested,
      playbackRate,
      followByAuthor,
      user?.id,
      t,
      onVolumeChange,
      refreshSrcFor,
      router,
      screenFocused,
      visibleVideos.length,
      volume,
    ]
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <ActivityIndicator
          style={{ marginVertical: 24 }}
          color={colors.accentCyan}
          accessibilityLabel={t("watch.loadingMore")}
        />
      );
    }
    if (endReached && videos.length > 0) {
      return (
        <Text style={styles.endHint} accessibilityLiveRegion="polite">
          {t("watch.caughtUp")}
        </Text>
      );
    }
    return null;
  }, [endReached, loadingMore, t, videos.length]);

  const exitHint = exitHintVisible ? (
    <View
      style={[styles.exitHint, { bottom: insets.bottom + 72 }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.exitHintText}>{t("watch.pressBackAgainToExit")}</Text>
    </View>
  ) : null;

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ActivityIndicator
          color={colors.accentCyan}
          size="large"
          accessibilityLabel={t("watch.loading")}
        />
        <Text style={styles.hint}>{t("watch.loading")}</Text>
        {exitHint}
      </View>
    );
  }

  if (error && videos.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
        <Pressable
          style={styles.retry}
          onPress={() => void loadInitial()}
          accessibilityRole="button"
          accessibilityLabel={t("actions.retry")}
        >
          <Text style={styles.retryText}>{t("actions.retry")}</Text>
        </Pressable>
        {exitHint}
      </View>
    );
  }

  if (visibleVideos.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <IdentityHeader title={t("watch.title")} onBack={onWatchHeaderArrow} />
        <Text style={styles.hint}>{t("watch.empty")}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => void loadInitial({ soft: true })}
          accessibilityRole="button"
          accessibilityLabel={t("actions.refresh")}
        >
          <Text style={styles.retryText}>{t("actions.refresh")}</Text>
        </Pressable>
        {exitHint}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {error ? (
        <View style={[styles.banner, { top: insets.top + 48 }]}>
          <Text style={styles.bannerText}>{error}</Text>
          <Pressable onPress={() => setError(null)} accessibilityRole="button">
            <Text style={styles.bannerDismiss}>{t("actions.dismiss")}</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={visibleVideos}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        scrollEnabled={listScrollEnabled}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onLayout={onWatchListLayout}
        onScroll={onWatchScroll}
        onScrollBeginDrag={onWatchScrollBeginDrag}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onWatchScrollSettle}
        onScrollEndDrag={onWatchScrollSettle}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        extraData={`${activeIndex}:${warmedTargetIndex}:${playbackGeneration}:${watchInteractionSignature(visibleVideos)}`}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews={false}
        refreshControl={
          shouldEnableWatchPullToRefresh(activeIndex) ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadInitial({ soft: true })}
              tintColor={colors.accentCyan}
              colors={[colors.accentCyan]}
            />
          ) : undefined
        }
        ListFooterComponent={listFooter}
        onScrollToIndexFailed={(info) => {
          const offset = resolveWatchScrollOffset(
            info.index,
            itemHeightRef.current
          );
          if (offset == null) return;
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset,
              animated: false,
            });
          }, 100);
        }}
      />
      <View
        style={[
          styles.header,
          watchHeaderOverlayLayerStyle(Platform.OS),
          { paddingTop: insets.top },
        ]}
        pointerEvents="box-none"
        collapsable={false}
      >
        <IdentityHeader title={t("watch.title")} onBack={onWatchHeaderArrow} />
      </View>
      {preparingShare ? (
        <View style={styles.preparing} pointerEvents="none">
          <ActivityIndicator
            color={colors.accentCyan}
            accessibilityLabel={t("watch.preparingVideo")}
          />
          <Text style={styles.preparingText}>{t("watch.preparingVideo")}</Text>
        </View>
      ) : null}
      {exitHint}
      {shouldMountWatchShareOverlay(shareSheet) ? (
        <WatchShareSheet
          visible
          choices={listWatchShareChoices()}
          onClose={() => setShareSheet(null)}
          onChoose={(mode) => {
            const snapshot = shareSheet;
            setShareSheet(null);
            if (!snapshot) return;
            const entry = openWatchShareEntry({ postId: snapshot.postId });
            if (!entry) return;
            void runShare(
              entry.attempt,
              mode,
              snapshot.title,
              snapshot.text
            );
          }}
        />
      ) : null}
      <CommentsSheet
        visible={commentPostId != null}
        postId={commentPostId}
        publishedAt={
          videos.find((row) => row.postId === commentPostId)?.publishedAt ?? null
        }
        onClose={() => setCommentPostId(null)}
        onCountChange={(count) => {
          if (commentPostId == null) return;
          const target = videos.find((row) => row.postId === commentPostId);
          if (!target) return;
          patchVideo(target.id, {
            stats: { ...target.stats, comments: count },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  banner: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  bannerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  bannerDismiss: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 13,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginBottom: 8,
  },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.bg,
    fontWeight: "700",
  },
  endHint: {
    textAlign: "center",
    color: colors.textSubtle,
    paddingVertical: 28,
    fontSize: 13,
  },
  preparing: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    zIndex: 4,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  preparingText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  exitHint: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 5,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  exitHintText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
