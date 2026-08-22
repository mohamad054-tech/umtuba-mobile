import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
  useRouter,
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
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommentsSheet } from "@/components/CommentsSheet";
import { IdentityHeader } from "@/components/IdentityHeader";
import { WatchVideoCard } from "@/components/WatchVideoCard";
import type { WatchFeedCursor, WatchVideo } from "@/src/contracts/watch";
import { getErrorMessage } from "@/src/contracts/validation";
import { REPORT_REASON_KEYS, useTranslation } from "@/src/lib/i18n";
import { prepareWatchPlaybackUrls } from "@/src/lib/feed/watchPlaybackPrep";
import {
  fetchWatchFeedPage,
  refreshPlaybackUrl,
} from "@/src/lib/feed/watchFeed";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";
import {
  applySuccessfulDeleteToList,
  deletePostForOwner,
  viewerMaySeeDeleteControl,
} from "@/src/lib/social/deleteOwnedPost";
import {
  togglePostLike,
  togglePostSave,
} from "@/src/lib/social/interactions";
import {
  isWatchShareEntryEnabled,
  openWatchShareEntry,
} from "@/src/lib/social/shareEntry";
import {
  shareWatchPostFile,
  shareWatchPostLink,
  type ShareAttempt,
  type WatchShareMode,
} from "@/src/lib/social/sharePost";
import {
  blockUserLocally,
  filterWatchItemsForViewer,
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
  sanitizeWatchListIndex,
  saveWatchAutoNextPreference,
  saveWatchMutedPreference,
  saveWatchVolumePreference,
  shouldAcceptViewableIndexUpdate,
  shouldLoadPlayer,
  toWatchListPixels,
  watchInteractionSignature,
  watchItemKey,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import {
  previousRouteNameFromState,
} from "@/src/lib/nav/globalBack";
import {
  peekWatchEntryHref,
  resolveWatchExitNavigation,
  resolveWatchHeaderArrowNavigation,
  resolveWatchRootBack,
  shouldConsumeHardwareBack,
  shouldInterceptWatchRootBack,
} from "@/src/lib/nav/watchRootExit";
import { bumpWatchOwnerGeneration } from "@/src/lib/watch/activePlayerOwnership";
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
  const [preparingShare, setPreparingShare] = useState(false);
  const [exitHintVisible, setExitHintVisible] = useState(false);

  const initialInFlight = useRef(false);
  const moreInFlight = useRef(false);
  const urlGenerationRef = useRef(0);
  const activeIndexRef = useRef(0);
  const playbackGenerationRef = useRef(0);
  const videosLengthRef = useRef(0);
  const itemHeightRef = useRef(WINDOW_HEIGHT);
  const programmaticAdvanceUntilRef = useRef(0);
  const armedUntilMsRef = useRef<number | null>(null);
  const screenFocusedRef = useRef(true);
  const commentPostIdRef = useRef<number | null>(null);
  const exitHintVisibleRef = useRef(false);

  const claimActiveIndex = useCallback((nextIndex: number) => {
    const safeIndex = sanitizeWatchListIndex(nextIndex);
    if (safeIndex == null) return;
    nextIndex = safeIndex;
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
  }, []);

  const claimActiveIndexRef = useRef(claimActiveIndex);
  claimActiveIndexRef.current = claimActiveIndex;

  useEffect(() => {
    itemHeightRef.current = itemHeight;
  }, [itemHeight]);

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
        armedUntilMsRef.current = null;
        exitHintVisibleRef.current = false;
        setExitHintVisible(false);
      };
    }, [])
  );

  useEffect(() => {
    commentPostIdRef.current = commentPostId;
  }, [commentPostId]);

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
    videosLengthRef.current = visibleVideos.length;
  }, [visibleVideos.length]);

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

  const onWatchHeaderArrow = useCallback(() => {
    if (commentPostIdRef.current != null) {
      setCommentPostId(null);
      return;
    }
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
  }, [clearExitArm, navigation, router]);

  const decideWatchRootBack = useCallback(() => {
    return resolveWatchRootBack({
      nowMs: Date.now(),
      armedUntilMs: armedUntilMsRef.current,
      nestedOverlayOpen: commentPostIdRef.current != null,
      atWatchRoot: screenFocusedRef.current,
    });
  }, []);

  useEffect(() => {
    if (!shouldInterceptWatchRootBack(Platform.OS)) return;

    const onBack = () => {
      const decision = decideWatchRootBack();
      if (decision.action === "close-nested") {
        setCommentPostId(null);
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
  }, [armWatchExit, decideWatchRootBack, exitWatchToEntry]);

  useEffect(() => {
    if (!shouldInterceptWatchRootBack(Platform.OS)) return;

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
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
        setCommentPostId(null);
        return;
      }
      if (decision.action === "arm-exit") {
        event.preventDefault();
        armWatchExit(decision.armedUntilMs);
      }
    });
    return unsubscribe;
  }, [armWatchExit, decideWatchRootBack, navigation]);

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
        const page = await fetchWatchFeedPage(supabase, {
          focusPostId,
          limit: 12,
        });
        urlGenerationRef.current += 1;
        setVideos(page.videos);
        setCursor(page.nextCursor);
        setEndReached(!page.nextCursor);
        claimActiveIndex(0);
      } catch (err) {
        setError(getErrorMessage(err, t("watch.loadFailed")));
      } finally {
        setLoading(false);
        setRefreshing(false);
        initialInFlight.current = false;
      }
    },
    [claimActiveIndex, focusPostId, t, user?.id]
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

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (
        !shouldAcceptViewableIndexUpdate({
          nowMs: Date.now(),
          lockUntilMs: programmaticAdvanceUntilRef.current,
        })
      ) {
        return;
      }
      const first = viewableItems.find(
        (item) => item.isViewable && item.index != null
      );
      if (first?.index != null) {
        claimActiveIndexRef.current(first.index);
      }
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
        patchVideo(id, { src });
      },
    });
  }, [activeIndex, patchVideo, playbackIdentity]);

  const onToggleLike = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const supabase = getSupabase();
      const result = await togglePostLike(supabase, video.postId);
      if (!result.ok) {
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

  const onShare = useCallback(
    (video: WatchVideo) => {
      const entry = openWatchShareEntry({ postId: video.postId });
      if (!entry) return;
      const title = video.title;
      const text = video.caption || video.title;
      Alert.alert(t("watch.share"), undefined, [
        ...entry.choices.map((choice) => ({
          text: t(choice.key),
          onPress: () => void runShare(entry.attempt, choice.mode, title, text),
        })),
        { text: t("actions.cancel"), style: "cancel" },
      ]);
    },
    [runShare, t]
  );

  const onToggleSave = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const supabase = getSupabase();
      const result = await togglePostSave(supabase, video.postId);
      if (!result.ok) {
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

  const scrollToWatchIndex = useCallback((nextIndex: number, attempt = 0) => {
    const height = itemHeightRef.current;
    const offset = resolveWatchScrollOffset(nextIndex, height);
    if (offset == null) {
      console.warn("Watch auto-next: invalid scroll offset", {
        nextIndex,
        height,
      });
      return;
    }

    programmaticAdvanceUntilRef.current =
      Date.now() + PROGRAMMATIC_ADVANCE_LOCK_MS;
    claimActiveIndex(nextIndex);

    const run = () => {
      listRef.current?.scrollToOffset({
        offset,
        animated: attempt === 0,
      });
    };

    try {
      run();
    } catch (err) {
      console.warn("Watch auto-next scroll failed:", err);
      if (attempt < 3) {
        setTimeout(() => scrollToWatchIndex(nextIndex, attempt + 1), 80 * (attempt + 1));
      }
      return;
    }

    if (attempt < 2) {
      setTimeout(() => {
        try {
          listRef.current?.scrollToOffset({ offset, animated: false });
        } catch (err) {
          console.warn("Watch auto-next scroll retry failed:", err);
          scrollToWatchIndex(nextIndex, attempt + 1);
        }
      }, 120);
    }
  }, [claimActiveIndex]);

  const onActiveEnded = useCallback(() => {
    const nextIndex = resolveNextWatchIndex({
      autoNext,
      activeIndex: activeIndexRef.current,
      itemCount: videosLengthRef.current,
    });
    if (nextIndex == null) {
      return;
    }
    scrollToWatchIndex(nextIndex);
  }, [autoNext, scrollToWatchIndex]);

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
        isActive={index === activeIndex}
        shouldLoadPlayer={shouldLoadPlayer(index, activeIndex, Platform.OS)}
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
        onToggleSave={() => void onToggleSave(item)}
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
        onOpenProfile={() => {
          const href = buildWatchCreatorProfileHref(item.author);
          if (href) {
            router.push(href as never);
          }
        }}
        onRefreshSrc={() => refreshSrcFor(item)}
        style={{ height: itemHeight }}
        topInset={insets.top + 44}
        bottomInset={insets.bottom}
      />
    ),
    [
      activeIndex,
      playbackGeneration,
      appState,
      autoNext,
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
      onToggleLike,
      onToggleMute,
      onToggleSave,
      user?.id,
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
        onLayout={(event) => {
          const nextHeight = toWatchListPixels(event.nativeEvent.layout.height);
          if (nextHeight != null) {
            setItemHeight(nextHeight);
          }
        }}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        extraData={`${activeIndex}:${playbackGeneration}:${watchInteractionSignature(visibleVideos)}`}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadInitial({ soft: true })}
            tintColor={colors.accentCyan}
            colors={[colors.accentCyan]}
          />
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
