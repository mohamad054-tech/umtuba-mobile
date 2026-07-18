import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IdentityHeader } from "@/components/IdentityHeader";
import { WatchVideoCard } from "@/components/WatchVideoCard";
import type { WatchFeedCursor, WatchVideo } from "@/src/contracts/watch";
import { getErrorMessage } from "@/src/contracts/validation";
import { fetchWatchFeedPage } from "@/src/lib/feed/watchFeed";
import {
  togglePostLike,
  togglePostSave,
} from "@/src/lib/social/interactions";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

const { height: WINDOW_HEIGHT } = Dimensions.get("window");

export default function WatchScreen() {
  const insets = useSafeAreaInsets();
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageHeight = WINDOW_HEIGHT;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const page = await fetchWatchFeedPage(supabase, {
        focusPostId,
        limit: 12,
      });
      setVideos(page.videos);
      setCursor(page.nextCursor);
      setActiveIndex(0);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load Watch feed."));
    } finally {
      setLoading(false);
    }
  }, [focusPostId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const supabase = getSupabase();
      const page = await fetchWatchFeedPage(supabase, { cursor });
      setVideos((prev) => [...prev, ...page.videos]);
      setCursor(page.nextCursor);
    } catch (err) {
      console.error("Watch pagination failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
      }
    },
    []
  );

  const patchVideo = (id: string, patch: Partial<WatchVideo>) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...patch, stats: { ...v.stats, ...(patch.stats || {}) } } : v))
    );
  };

  const onToggleLike = async (video: WatchVideo) => {
    if (!video.postId) return;
    const supabase = getSupabase();
    const result = await togglePostLike(supabase, video.postId);
    if (!result.ok) return;
    patchVideo(video.id, {
      likedByMe: result.liked,
      stats: { ...video.stats, likes: result.likes },
    });
  };

  const onToggleSave = async (video: WatchVideo) => {
    if (!video.postId) return;
    const supabase = getSupabase();
    const result = await togglePostSave(supabase, video.postId);
    if (!result.ok) return;
    patchVideo(video.id, {
      savedByMe: result.saved,
      stats: { ...video.stats, saves: result.saves },
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.hint}>Loading Watch…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => void loadInitial()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <IdentityHeader title="Watch" />
        <Text style={styles.hint}>No videos yet. Check back soon.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <IdentityHeader title="Watch" />
      </View>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={pageHeight}
        decelerationRate="fast"
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        renderItem={({ item, index }) => (
          <WatchVideoCard
            video={item}
            isActive={index === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onToggleLike={() => void onToggleLike(item)}
            onToggleSave={() => void onToggleSave(item)}
            style={{ height: pageHeight }}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={{ marginVertical: 24 }}
              color={colors.accentCyan}
            />
          ) : null
        }
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
  },
  error: {
    color: colors.danger,
    textAlign: "center",
    marginBottom: 8,
  },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.text,
  },
  retryText: {
    color: colors.bg,
    fontWeight: "700",
  },
});
