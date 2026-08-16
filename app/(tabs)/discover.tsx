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
  shouldShowDiscoverWorldEntry,
  type DiscoverCardModel,
  type DiscoverCategory,
  type DiscoverHomeModel,
} from "@/src/lib/discover";
import { discoverWorldEntryHref } from "@/src/lib/world/experience";
import {
  DISCOVER_CATEGORY_KEYS,
  useTranslation,
} from "@/src/lib/i18n";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

function DiscoverMoreSection({
  onWorldPress,
  onPeoplePress,
  onHashtagsPress,
}: {
  onWorldPress: () => void;
  onPeoplePress: () => void;
  onHashtagsPress: () => void;
}) {
  const { t } = useTranslation();
  if (!shouldShowDiscoverWorldEntry()) return null;

  return (
    <>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t("discover.more")}
      </Text>
      <View style={styles.placeholders}>
        <DiscoverPlaceholderChip label={t("nav.world")} onPress={onWorldPress} />
        <DiscoverPlaceholderChip label={t("discover.people")} onPress={onPeoplePress} />
        <DiscoverPlaceholderChip label={t("discover.hashtags")} onPress={onHashtagsPress} />
      </View>
    </>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
        err instanceof Error ? err.message : t("discover.unable")
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

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
        t(
          DISCOVER_CATEGORY_KEYS[category.id] ??
            "discover.category.watch"
        ),
        t("discover.categoryUnavailable")
      );
      return;
    }
    router.push(href as Href);
  };

  const onPlaceholderPress = (label: string, message: string) => {
    Alert.alert(label, message);
  };

  const onWorldPress = () => {
    const href = discoverWorldEntryHref();
    if (!href) {
      Alert.alert(t("nav.world"), t("discover.worldUnavailable"));
      return;
    }
    router.push(href as Href);
  };

  const moreSection = (
    <DiscoverMoreSection
      onWorldPress={onWorldPress}
      onPeoplePress={() =>
        onPlaceholderPress(t("discover.people"), t("discover.peopleSoon"))
      }
      onHashtagsPress={() =>
        onPlaceholderPress(t("discover.hashtags"), t("discover.hashtagsSoon"))
      }
    />
  );

  if (loading && !home) {
    return (
      <View
        style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <View
          style={styles.centerFlex}
          accessibilityLabel={t("discover.loading")}
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color={colors.accentCyan} size="large" />
          <Text style={styles.muted}>{t("discover.loading")}</Text>
        </View>
        {moreSection}
      </View>
    );
  }

  if (error && !home) {
    return (
      <View
        style={[styles.root, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <View style={styles.centerFlex}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {unavailable ? t("discover.unavailable") : t("discover.loadFailed")}
          </Text>
          <Text style={styles.muted} accessibilityRole="alert">
            {error}
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel={t("actions.retry")}
          >
            <Text style={styles.retryText}>{t("actions.retry")}</Text>
          </Pressable>
        </View>
        {moreSection}
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
            <Text style={styles.emptyTitle}>{t("discover.noResults")}</Text>
            <Text style={styles.muted}>
              {t("discover.noResultsBody", { values: { query: query.trim() } })}
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
            ListFooterComponent={moreSection}
          />
        ) : (
          moreSection
        )}
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
          {t("discover.categories")}
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
              accessibilityLabel={t("discover.openCategory", {
                values: {
                  label: t(DISCOVER_CATEGORY_KEYS[category.id]),
                },
              })}
            >
              <Text style={styles.categoryText} numberOfLines={1}>
                {t(DISCOVER_CATEGORY_KEYS[category.id])}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {home ? (
          <>
            <DiscoverSection section={home.trending} />
            <DiscoverSection section={home.latest} />
            <DiscoverSection section={home.recommended} />
          </>
        ) : null}

        {moreSection}
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
