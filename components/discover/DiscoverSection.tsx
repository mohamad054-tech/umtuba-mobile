import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DiscoverCard } from "@/components/discover/DiscoverCard";
import type { DiscoverSectionModel } from "@/src/lib/discover";
import {
  DISCOVER_SECTION_MESSAGE_KEYS,
  DISCOVER_SECTION_TITLE_KEYS,
  useTranslation,
} from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type DiscoverSectionProps = {
  section: DiscoverSectionModel;
};

export function DiscoverSection({ section }: DiscoverSectionProps) {
  const { t } = useTranslation();
  const titleKey =
    DISCOVER_SECTION_TITLE_KEYS[
      section.id as keyof typeof DISCOVER_SECTION_TITLE_KEYS
    ];
  const messageKey =
    DISCOVER_SECTION_MESSAGE_KEYS[
      section.id as keyof typeof DISCOVER_SECTION_MESSAGE_KEYS
    ];
  const title = titleKey ? t(titleKey) : section.title;
  const fallbackMessage =
    section.status === "unavailable"
      ? t("discover.sectionUnavailable")
      : section.status === "empty"
        ? t("discover.sectionEmpty")
        : t("discover.sectionError");
  const message = messageKey ? t(messageKey) : section.message ?? fallbackMessage;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      {section.status === "unavailable" ? (
        <View
          style={styles.banner}
          accessibilityRole="text"
          accessibilityLabel={`${title}. ${message}`}
        >
          <Text style={styles.bannerText}>{message}</Text>
        </View>
      ) : null}

      {section.status === "empty" ? (
        <View style={styles.banner} accessibilityRole="text">
          <Text style={styles.bannerText}>{message}</Text>
        </View>
      ) : null}

      {section.status === "error" ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.errorText}>{message}</Text>
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
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.chip}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("discover.soonA11y", { values: { label } })}
      accessibilityHint={t("discover.soonHint")}
    >
      <Text style={styles.chipText}>{label}</Text>
      <Text style={styles.chipMeta}>{t("discover.soon")}</Text>
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
