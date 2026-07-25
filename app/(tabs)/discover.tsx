import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DiscoverCard } from "@/components/discover/DiscoverCard";
import { DiscoverSearchBar } from "@/components/discover/DiscoverSearchBar";
import {
  DiscoverPlaceholderChip,
  DiscoverSection,
} from "@/components/discover/DiscoverSection";
import {
  filterDiscoverCards,
  loadDiscoverHome,
  mapDiscoverCategoryHref,
  resolveDiscoverSearchPhase,
  type DiscoverCardModel,
  type DiscoverCategory,
  type DiscoverHomeModel,
} from "@/src/lib/discover";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [home, setHome] = useState<DiscoverHomeModel | null>(null);
  const [cards, setCards] = useState<DiscoverCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const result = await loadDiscoverHome(getSupabase(), { limit: 16 });
      if (!result.ok) {
        setHome(null);
        setCards([]);
        setError(result.message);
        setUnavailable(Boolean(result.unavailable));
        return;
      }
      setHome(result.home);
      setCards(result.cards);
    } catch (err) {
      setHome(null);
      setCards([]);
      setError(
        err instanceof Error ? err.message : "Unable to load Discover."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const searchResults = useMemo(
    () => filterDiscoverCards(cards, query),
    [cards, query]
  );

  const searchPhase = resolveDiscoverSearchPhase({
    query,
    loading: loading && Boolean(query.trim()),
    error: query.trim() ? error : null,
    resultCount: searchResults.length,
  });

  const onCategoryPress = (category: DiscoverCategory) => {
    const href = mapDiscoverCategoryHref(category.id);
    if (!href) {
      Alert.alert(
        category.label,
        "This category is not available in this version."
      );
      return;
    }
    router.push(href as Href);
  };

  const onPlaceholderPress = (label: string, message: string) => {
    Alert.alert(label, message);
  };

  if (loading && !home) {
    return (
      <View
        style={styles.center}
        accessibilityLabel="Loading Discover"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.muted}>Loading Discover…</Text>
      </View>
    );
  }

  if (error && !home) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          {unavailable ? "Discover unavailable" : "Couldn’t load Discover"}
        </Text>
        <Text style={styles.muted} accessibilityRole="alert">
          {error}
        </Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading Discover"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (searchPhase !== "idle") {
    return (
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <DiscoverSearchBar value={query} onChangeText={setQuery} />
        {searchPhase === "loading" ? (
          <View style={styles.centerFlex}>
            <ActivityIndicator color={colors.accentCyan} />
          </View>
        ) : null}
        {searchPhase === "error" ? (
          <View style={styles.centerFlex}>
            <Text style={styles.muted} accessibilityRole="alert">
              {error}
            </Text>
          </View>
        ) : null}
        {searchPhase === "empty" ? (
          <View style={styles.centerFlex}>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.muted}>
              No loaded Discover items match “{query.trim()}”.
            </Text>
          </View>
        ) : null}
        {searchPhase === "results" ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.searchList}
            renderItem={({ item }) => (
              <View style={styles.searchRow}>
                <DiscoverCard item={item} compact />
              </View>
            )}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 28),
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accentCyan}
          />
        }
      >
        <DiscoverSearchBar value={query} onChangeText={setQuery} />

        <Text style={styles.sectionLabel} accessibilityRole="header">
          Categories
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {(home?.categories ?? []).map((category) => (
            <Pressable
              key={category.id}
              style={styles.categoryChip}
              onPress={() => onCategoryPress(category)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${category.label}`}
            >
              <Text style={styles.categoryText}>{category.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {home ? (
          <>
            <DiscoverSection section={home.trending} />
            <DiscoverSection section={home.latest} />
            <DiscoverSection section={home.recommended} />

            <Text style={styles.sectionLabel} accessibilityRole="header">
              More
            </Text>
            <View style={styles.placeholders}>
              <DiscoverPlaceholderChip
                label="World"
                onPress={() =>
                  onPlaceholderPress(
                    "World",
                    "World / Globe discovery is not available yet."
                  )
                }
              />
              <DiscoverPlaceholderChip
                label="People"
                onPress={() =>
                  onPlaceholderPress(
                    "People",
                    "People discovery is not available yet."
                  )
                }
              />
              <DiscoverPlaceholderChip
                label="Hashtags"
                onPress={() =>
                  onPlaceholderPress(
                    "Hashtags",
                    "Hashtag discovery is not available yet."
                  )
                }
              />
            </View>
          </>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: 24,
    gap: 12,
  },
  centerFlex: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  muted: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  retryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  categories: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 18,
  },
  categoryChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    color: colors.text,
    fontWeight: "700",
  },
  placeholders: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  searchRow: {
    marginBottom: 10,
  },
});
