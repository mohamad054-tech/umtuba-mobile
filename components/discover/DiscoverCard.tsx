import { useRouter, type Href } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { DiscoverCardModel } from "@/src/lib/discover";
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type DiscoverCardProps = {
  item: DiscoverCardModel;
  compact?: boolean;
};

export function DiscoverCard({ item, compact = false }: DiscoverCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const canOpen = Boolean(item.destination) && !item.unavailable;

  const onPress = () => {
    if (!canOpen || !item.destination) return;
    router.push(item.destination as Href);
  };

  return (
    <Pressable
      style={[styles.card, compact && styles.cardCompact]}
      onPress={onPress}
      disabled={!canOpen}
      accessibilityRole={canOpen ? "button" : "text"}
      accessibilityLabel={`${item.title}${item.subtitle ? `, ${item.subtitle}` : ""}${item.unavailable ? `, ${t("status.unavailable")}` : ""}`}
      accessibilityHint={
        canOpen ? t("discover.openContent") : t("discover.noDestination")
      }
    >
      <View style={[styles.media, compact && styles.mediaCompact]}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.image}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.mediaFallback}>
            <Text style={styles.mediaFallbackText} accessible={false}>
              ▶
            </Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
        {item.metadata ? (
          <Text style={styles.meta} numberOfLines={1}>
            {item.metadata}
          </Text>
        ) : null}
        {item.unavailable ? (
          <Text style={styles.unavailable}>{t("status.unavailable")}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardCompact: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  media: {
    width: "100%",
    height: 96,
    backgroundColor: colors.surfaceElevated,
  },
  mediaCompact: {
    width: 72,
    height: 72,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  mediaFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaFallbackText: {
    color: colors.textSubtle,
    fontSize: 22,
  },
  body: {
    padding: 10,
    gap: 2,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    color: colors.accentCyan,
    fontSize: 12,
    fontWeight: "600",
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 11,
  },
  unavailable: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
