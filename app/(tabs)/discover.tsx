import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { WatchVideo } from "@/src/contracts/watch";
import { getErrorMessage } from "@/src/contracts/validation";
import { fetchWatchFeedPage } from "@/src/lib/feed/watchFeed";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function DiscoverScreen() {
  const [videos, setVideos] = useState<WatchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchWatchFeedPage(getSupabase(), { limit: 12 });
      setVideos(page.videos);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => void load()}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.note}>
        Simple feed list — grid Discover UI arrives in Phase 2.
      </Text>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No videos to discover yet.</Text>
        }
        renderItem={({ item }) => (
          <Link
            href={
              item.postId
                ? `/(tabs)/watch?post=${item.postId}`
                : "/(tabs)/watch"
            }
            asChild
          >
            <Pressable style={styles.row}>
              <Text style={styles.username}>{item.author.username}</Text>
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption || item.title}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  note: {
    color: colors.textSubtle,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  username: {
    color: colors.accentCyan,
    fontWeight: "700",
    marginBottom: 4,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 40,
  },
  error: { color: colors.danger },
  retry: { color: colors.accentCyan, fontWeight: "700" },
});
