import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import type { AppLocale } from "@/src/lib/i18n/locales";
import { localeTextAlign, localeWritingDirection } from "@/src/lib/i18n/rtl";
import { watchedVideoFirstLine } from "@/src/lib/profile/watchedVideoCard";
import { colors } from "@/src/theme/colors";

type Props = {
  locale: AppLocale;
  t: ProfileTranslate;
  title: string;
  imageUrl: string | null;
  showReading: boolean;
  onContinue: () => void;
  onRead: () => void;
};

export default function WatchedVideoCard({
  locale,
  t,
  title,
  imageUrl,
  showReading,
  onContinue,
  onRead,
}: Props) {
  const textAlign = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);
  const line = watchedVideoFirstLine(title) || title;

  return (
    <View style={styles.card}>
      <Text
        style={[styles.kicker, { textAlign, writingDirection }]}
        accessibilityRole="header"
      >
        {t("profile.wasWatching")}
      </Text>
      <View style={styles.row}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.thumbFallback}>
            <Text style={styles.thumbFallbackText} numberOfLines={2}>
              {line}
            </Text>
          </View>
        )}
        <Text
          style={[styles.title, { textAlign, writingDirection }]}
          numberOfLines={3}
        >
          {line}
        </Text>
      </View>
      <Pressable
        style={styles.gold}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={t("profile.continueWatching")}
      >
        <Text style={styles.goldText}>{t("profile.continueWatching")}</Text>
      </Pressable>
      {showReading ? (
        <Pressable
          style={styles.read}
          onPress={onRead}
          accessibilityRole="button"
          accessibilityLabel={t("profile.readArticle")}
        >
          <Text style={[styles.readText, { textAlign, writingDirection }]}>
            {t("profile.readArticle")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.55)",
    gap: 12,
  },
  kicker: {
    color: colors.accentAmber,
    fontSize: 15,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 72,
    height: 96,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  thumbFallback: {
    width: 72,
    height: 96,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  thumbFallbackText: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
  },
  gold: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.accentAmber,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  goldText: {
    color: "#1a1408",
    fontSize: 16,
    fontWeight: "800",
  },
  read: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  readText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
