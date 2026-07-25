import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DiscoverCard } from "@/components/discover/DiscoverCard";
import type { DiscoverSectionModel } from "@/src/lib/discover";
import { colors } from "@/src/theme/colors";

type DiscoverSectionProps = {
  section: DiscoverSectionModel;
};

export function DiscoverSection({ section }: DiscoverSectionProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        {section.title}
      </Text>

      {section.status === "unavailable" ? (
        <View
          style={styles.banner}
          accessibilityRole="text"
          accessibilityLabel={`${section.title} unavailable. ${section.message ?? ""}`}
        >
          <Text style={styles.bannerText}>
            {section.message ?? "Not available yet."}
          </Text>
        </View>
      ) : null}

      {section.status === "empty" ? (
        <View style={styles.banner} accessibilityRole="text">
          <Text style={styles.bannerText}>
            {section.message ?? "Nothing here yet."}
          </Text>
        </View>
      ) : null}

      {section.status === "error" ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.errorText}>
            {section.message ?? "Unable to load this section."}
          </Text>
        </View>
      ) : null}

      {section.status === "ready" ? (
        <FlatList
          horizontal
          data={section.items}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          renderItem={({ item }) => <DiscoverCard item={item} />}
        />
      ) : null}
    </View>
  );
}

export function DiscoverPlaceholderChip({
  label,
  onPress,
}: {
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={styles.chip}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, not available yet`}
      accessibilityHint="Placeholder for a future Discover surface"
    >
      <Text style={styles.chipText}>{label}</Text>
      <Text style={styles.chipMeta}>Soon</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 22,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  row: {
    paddingHorizontal: 16,
    gap: 10,
  },
  banner: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bannerText: {
    color: colors.textMuted,
    lineHeight: 20,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    lineHeight: 20,
    fontSize: 13,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  chipText: {
    color: colors.text,
    fontWeight: "600",
  },
  chipMeta: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "600",
  },
});
