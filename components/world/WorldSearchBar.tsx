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

import type { WorldSearchResult } from "@/src/lib/world/search";
import { colors } from "@/src/theme/colors";

type WorldSearchBarProps = {
  results: WorldSearchResult[];
  query: string;
  onChangeQuery: (query: string) => void;
  onSelectResult: (result: WorldSearchResult) => void;
  onClear?: () => void;
};

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
  const [focused, setFocused] = useState(false);
  const showPanel = query.trim().length > 0 && focused;

  const empty = useMemo(
    () => query.trim().length > 0 && results.length === 0,
    [query, results.length]
  );

  return (
    <View style={styles.wrap} accessibilityLabel="World search">
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChangeQuery}
          onFocus={() => setFocused(true)}
          placeholder="Search cities, education, users, games"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search World"
          accessibilityHint="Search places and education loaded via World data pipeline"
        />
        {query.length > 0 ? (
          <Pressable
            style={styles.clearButton}
            onPress={() => {
              onClear?.();
              onChangeQuery("");
              setFocused(false);
              Keyboard.dismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {showPanel ? (
        <View style={styles.resultsPanel} accessibilityRole="list">
          {empty ? (
            <Text style={styles.emptyText} accessibilityRole="text">
              No matching places, education, users, or games.
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
                  style={styles.resultRow}
                  onPress={() => {
                    Keyboard.dismiss();
                    setFocused(false);
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
                    {result.sourceType === "places"
                      ? "Place"
                      : result.sourceType === "education"
                        ? "Education"
                        : result.sourceType === "users"
                          ? "User"
                          : "Game"}
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
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  clearButton: {
    minHeight: 48,
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
    maxHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  resultsScroll: {
    maxHeight: 220,
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
