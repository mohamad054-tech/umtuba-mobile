import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import {
  togglePostLike,
  togglePostSave,
} from "@/src/lib/social/interactions";
import { getSupabase } from "@/src/lib/supabase/client";
import {
  mergeWatchVideos,
  shouldLoadPlayer,
  watchItemKey,
  type AppLifecycleState,
} from "@/src/lib/watch/playbackPolicy";
import { colors } from "@/src/theme/colors";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

function toLifecycleState(state: AppStateStatus): AppLifecycleState {
  if (state === "active" || state === "background" || state === "inactive") {
    return state;
  }
  return "unknown";
}

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<WatchVideo>>(null);
  const params = useLocalSearchParams<{ post?: string }>();
  const focusPostId =
    typeof params.post === "string" && /^\d+$/.test(params.post)
      ? Number(params.post)
      : null;

  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [cursor, setCursor] = useState<WatchFeedCursor | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);
  const [screenFocused, setScreenFocused] = useState(true);
  const [appState, setAppState] = useState<AppLifecycleState>(
    toLifecycleState(AppState.currentState)
  );

  const initialInFlight = useRef(false);
  const moreInFlight = useRef(false);
  const activeIndexRef = useRef(0);
  const videosLengthRef = useRef(0);

  const pageHeight = WINDOW_HEIGHT;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
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
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    videosLengthRef.current = videos.length;
  }, [videos.length]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const onBack = () => {
      if (!screenFocused) return false;
      if (activeIndexRef.current > 0) {
        const prev = activeIndexRef.current - 1;
        listRef.current?.scrollToIndex({ index: prev, animated: true });
        setActiveIndex(prev);
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
      const first = viewableItems.find((item) => item.isViewable && item.index != null);
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
      if (!result.ok) return;
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
      if (!result.ok) return;
      patchVideo(video.id, {
        savedByMe: result.saved,
        stats: { ...video.stats, saves: result.saves },
      });
    },
    [patchVideo]
  );

  const onToggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const refreshSrcFor = useCallback(async (video: WatchVideo) => {
    if (!video.postId) return null;
    const result = await refreshPlaybackUrl(getSupabase(), video.postId);
    if (!result.ok) return null;
    patchVideo(video.id, { src: result.src });
    return result.src;
  }, [patchVideo]);

  const getItemLayout = useCallback(
    (_: ArrayLike<WatchVideo> | null | undefined, index: number) => ({
      length: pageHeight,
      offset: pageHeight * index,
      index,
    }),
    [pageHeight]
  );

  const keyExtractor = useCallback((item: WatchVideo) => watchItemKey(item), []);

  const renderItem = useCallback(
    ({ item, index }: { item: WatchVideo; index: number }) => (
      <WatchVideoCard
        video={item}
        isActive={index === activeIndex}
        shouldLoadPlayer={shouldLoadPlayer(index, activeIndex)}
        muted={muted}
        appState={appState}
        screenFocused={screenFocused}
        onToggleMute={onToggleMute}
        onToggleLike={() => void onToggleLike(item)}
        onToggleSave={() => void onToggleSave(item)}
        onOpenProfile={() => {
          const username = item.author.username.replace(/^@/, "");
          if (username) {
            router.push(`/profile?u=${encodeURIComponent(username)}` as never);
          }
        }}
        onRefreshSrc={() => refreshSrcFor(item)}
        style={{ height: pageHeight }}
        topInset={insets.top + 44}
        bottomInset={insets.bottom}
      />
    ),
    [
      activeIndex,
      appState,
      insets.bottom,
      insets.top,
      muted,
      onToggleLike,
      onToggleMute,
      onToggleSave,
      pageHeight,
      refreshSrcFor,
      router,
      screenFocused,
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

  if (videos.length === 0) {
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
        data={videos}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={pageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        getItemLayout={getItemLayout}
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
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: true,
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
