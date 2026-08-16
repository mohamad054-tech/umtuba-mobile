import { useMemo, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { WORLD_KIND_KEYS, useTranslation } from "@/src/lib/i18n";
import type { WorldSearchResult } from "@/src/lib/world/search";
import { colors } from "@/src/theme/colors";

type WorldSearchBarProps = {
  results: WorldSearchResult[];
  query: string;
  onChangeQuery: (query: string) => void;
  onSelectResult: (result: WorldSearchResult) => void;
  onClear?: () => void;
};

function sourceBadgeKey(sourceType: WorldSearchResult["sourceType"]) {
  return WORLD_KIND_KEYS[sourceType] ?? ("world.kind.result" as const);
}

/**
 * World search UI — view-state only. Never imports providers or MapLibre.
 */
export function WorldSearchBar({
  results,
  query,
  onChangeQuery,
  onSelectResult,
  onClear,
}: WorldSearchBarProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const showPanel = query.trim().length > 0 && focused;

  const empty = useMemo(
    () => query.trim().length > 0 && results.length === 0,
    [query, results.length]
  );

  const dismissResults = () => {
    setFocused(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.wrap} accessibilityLabel={t("world.search")}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={() => setFocused(true)}
          placeholder={t("world.search")}
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t("world.search")}
          accessibilityHint={t("world.searchHint")}
          onSubmitEditing={dismissResults}
        />
        {query.length > 0 ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              onClear?.();
              onChangeQuery("");
              dismissResults();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("world.clearSearch")}
            hitSlop={8}
          >
            <Text style={styles.clearText}>{t("world.clear")}</Text>
          </Pressable>
        ) : null}
      </View>

      {showPanel ? (
        <View style={styles.resultsPanel} accessibilityRole="list">
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsHeading}>
              {empty
                ? t("world.noResults")
                : results.length === 1
                  ? t("world.resultCount", { values: { count: results.length } })
                  : t("world.resultsCount", { values: { count: results.length } })}
            </Text>
            <Pressable
              onPress={dismissResults}
              style={styles.dismissButton}
              accessibilityRole="button"
              accessibilityLabel={t("world.closeResults")}
              hitSlop={8}
            >
              <Text style={styles.dismissText}>{t("actions.close")}</Text>
            </Pressable>
          </View>
          {empty ? (
            <Text style={styles.emptyText} accessibilityRole="text">
              {t("world.tryAnother")}
            </Text>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.resultsScroll}
              nestedScrollEnabled
            >
              {results.map((result) => (
                <Pressable
                  key={`${result.sourceType}:${result.id}`}
                  style={({ pressed }) => [
                    styles.resultRow,
                    pressed && styles.resultRowPressed,
                  ]}
                  onPress={() => {
                    dismissResults();
                    onSelectResult(result);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${result.title}, ${result.kind}`}
                >
                  <View style={styles.resultText}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {result.title}
                    </Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {result.kind} · {result.subtitle}
                    </Text>
                  </View>
                  <Text style={styles.resultBadge}>
                    {t(sourceBadgeKey(result.sourceType))}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  clearButton: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  resultsPanel: {
    marginTop: 8,
    maxHeight: 240,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultsHeading: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dismissButton: {
    minHeight: 32,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    color: colors.accentCyan,
    fontSize: 12,
    fontWeight: "700",
  },
  resultsScroll: {
    maxHeight: 190,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  resultRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultRowPressed: {
    backgroundColor: "rgba(34,211,238,0.08)",
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  resultBadge: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
