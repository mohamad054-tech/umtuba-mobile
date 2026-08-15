import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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

import { IdentityHeader } from "@/components/IdentityHeader";
import { WatchVideoCard } from "@/components/WatchVideoCard";
import type { WatchFeedCursor, WatchVideo } from "@/src/contracts/watch";
import { getErrorMessage } from "@/src/contracts/validation";
import {
  fetchWatchFeedPage,
  refreshPlaybackUrl,
} from "@/src/lib/feed/watchFeed";
import { useAuth } from "@/src/lib/auth/AuthContext";
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
  blockUserLocally,
  filterWatchItemsForViewer,
  loadBlockedUsers,
  loadHiddenPostIds,
  reportWatchPost,
  reportWatchUser,
  UGC_REPORT_REASON_LABELS,
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
  shouldAcceptViewableIndexUpdate,
  shouldLoadPlayer,
  watchItemKey,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import { colors } from "@/src/theme/colors";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");
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
  const { user } = useAuth();
  const listRef = useRef<FlatList<WatchVideo>>(null);
  const params = useLocalSearchParams<{ post?: string }>();
  const focusPostId =
    typeof params.post === "string" && /^\d+$/.test(params.post)
      ? Number(params.post)
      : null;

  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [cursor, setCursor] = useState<WatchFeedCursor | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
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

  const initialInFlight = useRef(false);
  const moreInFlight = useRef(false);
  const activeIndexRef = useRef(0);
  const videosLengthRef = useRef(0);
  const itemHeightRef = useRef(WINDOW_HEIGHT);
  const programmaticAdvanceUntilRef = useRef(0);

  useEffect(() => {
    itemHeightRef.current = itemHeight;
  }, [itemHeight]);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      void Promise.all([loadBlockedUsers(), loadHiddenPostIds()]).then(
        ([users, posts]) => {
          setBlockedUserIds(new Set(users.map((row) => row.userId)));
          setHiddenPostIds(new Set(posts));
        }
      );
      return () => {
        setScreenFocused(false);
      };
    }, [])
  );

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

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const visibleVideos = useMemo(
    () =>
      filterWatchItemsForViewer(videos, {
        blockedUserIds,
        hiddenPostIds,
      }),
    [blockedUserIds, hiddenPostIds, videos]
  );

  useEffect(() => {
    videosLengthRef.current = visibleVideos.length;
  }, [visibleVideos.length]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const onBack = () => {
      if (!screenFocused) return false;
      if (activeIndexRef.current > 0) {
        const prev = activeIndexRef.current - 1;
        const offset = resolveWatchScrollOffset(prev, itemHeightRef.current);
        if (offset != null) {
          programmaticAdvanceUntilRef.current =
            Date.now() + PROGRAMMATIC_ADVANCE_LOCK_MS;
          listRef.current?.scrollToOffset({ offset, animated: true });
          activeIndexRef.current = prev;
          setActiveIndex(prev);
        }
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [screenFocused]);

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
        setVideos(page.videos);
        setCursor(page.nextCursor);
        setEndReached(!page.nextCursor);
        setActiveIndex(0);
      } catch (err) {
        setError(getErrorMessage(err, "Unable to load Watch feed."));
      } finally {
        setLoading(false);
        setRefreshing(false);
        initialInFlight.current = false;
      }
    },
    [focusPostId]
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
      setError(getErrorMessage(err, "Unable to load more videos."));
    } finally {
      setLoadingMore(false);
      moreInFlight.current = false;
    }
  }, [cursor, endReached, loadingMore]);

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
        setActiveIndex(first.index);
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

  const onToggleLike = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const supabase = getSupabase();
      const result = await togglePostLike(supabase, video.postId);
      if (!result.ok) {
        Alert.alert("Like failed", result.message);
        return;
      }
      patchVideo(video.id, {
        likedByMe: result.liked,
        stats: { ...video.stats, likes: result.likes },
      });
    },
    [patchVideo]
  );

  const onToggleSave = useCallback(
    async (video: WatchVideo) => {
      if (!video.postId) return;
      const supabase = getSupabase();
      const result = await togglePostSave(supabase, video.postId);
      if (!result.ok) {
        Alert.alert("Save failed", result.message);
        return;
      }
      patchVideo(video.id, {
        savedByMe: result.saved,
        stats: { ...video.stats, saves: result.saves },
      });
    },
    [patchVideo]
  );

  const onDeleteOwn = useCallback(
    (video: WatchVideo) => {
      if (!video.postId || !user?.id) return;
      if (!viewerMaySeeDeleteControl(user.id, video.author.id)) return;
      Alert.alert(
        "Delete video",
        "This removes your video from Watch. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                const result = await deletePostForOwner(
                  getSupabase(),
                  user.id,
                  video.postId as number
                );
                if (!result.ok) {
                  Alert.alert("Delete failed", result.message);
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
    [user?.id]
  );

  const onReport = useCallback(
    (video: WatchVideo) => {
      if (!video.postId || !user?.id) return;
      if (!viewerMaySeeReportControl(user.id, video.author.id)) return;

      const pickReason = (target: "content" | "user") => {
        Alert.alert(
          target === "content" ? "Report video" : "Report account",
          target === "content"
            ? "Why are you reporting this video?"
            : "Why are you reporting this account?",
          [
            { text: "Cancel", style: "cancel" },
            ...UGC_REPORT_REASONS.map((reason: UgcReportReason) => ({
              text: UGC_REPORT_REASON_LABELS[reason],
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
                      result.ok ? "Report submitted" : "Unable to report",
                      result.ok
                        ? "Thanks. Moderators received this report and the video is hidden on this device."
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
                    result.ok ? "Report submitted" : "Unable to report",
                    result.ok
                      ? "Thanks. Moderators received this account report."
                      : result.message
                  );
                })();
              },
            })),
          ]
        );
      };

      Alert.alert("Report", "What do you want to report?", [
        { text: "Cancel", style: "cancel" },
        { text: "This video", onPress: () => pickReason("content") },
        { text: "This account", onPress: () => pickReason("user") },
      ]);
    },
    [user?.id]
  );

  const onBlockUser = useCallback(
    (video: WatchVideo) => {
      if (!user?.id || !video.author.id) return;
      if (!viewerMaySeeBlockControl(user.id, video.author.id)) return;
      Alert.alert(
        "Block account",
        `Hide @${video.author.username.replace(/^@/, "")} on this device?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: () => {
              void (async () => {
                const result = await blockUserLocally({
                  viewerId: user.id,
                  targetUserId: video.author.id,
                  username: video.author.username,
                });
                if (!result.ok) {
                  Alert.alert("Block failed", result.message);
                  return;
                }
                setBlockedUserIds((prev) => {
                  const next = new Set(prev);
                  next.add(result.userId);
                  return next;
                });
                Alert.alert(
                  "Account blocked",
                  result.localOnly
                    ? "This account is hidden on this device only."
                    : "This account is blocked on UMTUBA and hidden on this device."
                );
              })();
            },
          },
        ]
      );
    },
    [user?.id]
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
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);

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
  }, []);

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
        shouldLoadPlayer={shouldLoadPlayer(index, activeIndex)}
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
          const username = item.author.username.replace(/^@/, "");
          if (username) {
            router.push(`/profile?u=${encodeURIComponent(username)}` as never);
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
          accessibilityLabel="Loading more videos"
        />
      );
    }
    if (endReached && videos.length > 0) {
      return (
        <Text style={styles.endHint} accessibilityLiveRegion="polite">
          You’re caught up.
        </Text>
      );
    }
    return null;
  }, [endReached, loadingMore, videos.length]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ActivityIndicator
          color={colors.accentCyan}
          size="large"
          accessibilityLabel="Loading Watch feed"
        />
        <Text style={styles.hint}>Loading Watch…</Text>
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
          accessibilityLabel="Retry loading Watch feed"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (visibleVideos.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <IdentityHeader title="Watch" />
        <Text style={styles.hint}>No videos yet. Check back soon.</Text>
        <Pressable
          style={styles.retry}
          onPress={() => void loadInitial({ soft: true })}
          accessibilityRole="button"
          accessibilityLabel="Refresh Watch feed"
        >
          <Text style={styles.retryText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View
        style={[styles.header, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <IdentityHeader title="Watch" />
      </View>
      {error ? (
        <View style={[styles.banner, { top: insets.top + 48 }]}>
          <Text style={styles.bannerText}>{error}</Text>
          <Pressable onPress={() => setError(null)} accessibilityRole="button">
            <Text style={styles.bannerDismiss}>Dismiss</Text>
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
          const nextHeight = event.nativeEvent.layout.height;
          if (Number.isFinite(nextHeight) && nextHeight > 0) {
            setItemHeight(nextHeight);
          }
        }}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews={Platform.OS === "android"}
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
    zIndex: 2,
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
});
